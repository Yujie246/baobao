import "server-only";
import OpenAI from "openai";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { normalizeAnalysisEvidence, parseAnalysisResult, parseVideoFacts } from "../json";
import { stabilizeConclusionCard } from "../conclusion-card";
import type { AnalysisBabyProfile, AnalysisResult, KnowledgeRule, VideoFactPackage } from "../schemas";
import type { VideoSource } from "./storage";
import { readVideo } from "./storage";

const baseURL = process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
const model = process.env.QWEN_MODEL || "qwen3.7-plus";
const VIDEO_TIMEOUT_MS = 180_000;
const PLAN_TIMEOUT_MS = 120_000;
const REPAIR_TIMEOUT_MS = 45_000;

function client() {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error("服务端未配置 DASHSCOPE_API_KEY");
  return new OpenAI({ apiKey, baseURL, timeout: VIDEO_TIMEOUT_MS, maxRetries: 0 });
}

async function prompt(name: string) {
  return readFile(path.join(process.cwd(), "prompts", name), "utf8");
}

function isTimeout(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.name === "APIConnectionTimeoutError" || /timed?\s*out|timeout/i.test(error.message);
}

function modelError(error: unknown, stage: "video" | "plan" | "repair") {
  if (isTimeout(error)) {
    if (stage === "video") return new Error("视频内容识别超过 3 分钟，已停止等待。请压缩视频或稍后重试。");
    if (stage === "plan") return new Error("生成宝宝版本超过 2 分钟，已停止等待。视频文件没有问题，请点击重试。");
    return new Error("模型结果修复超过 45 秒，已停止等待。请点击重试。");
  }
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 0;
  if (status === 429 || status >= 500) return new Error("模型服务当前繁忙，请稍后重试。");
  return error instanceof Error ? error : new Error("模型请求失败");
}

async function complete(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[], options?: { json?: boolean; timeoutMs?: number; stage?: "video" | "plan" | "repair" }) {
  const { json = true, timeoutMs = PLAN_TIMEOUT_MS, stage = "plan" } = options || {};
  try {
    const payload: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & { enable_thinking: boolean } = {
      model,
      messages,
      temperature: 0.1,
      enable_thinking: false,
      ...(json ? { response_format: { type: "json_object" as const } } : {}),
    };
    const response = await client().chat.completions.create(payload, { timeout: timeoutMs });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("模型没有返回内容");
    return content;
  } catch (error) {
    throw modelError(error, stage);
  }
}

export async function parseVideoWithQwen(video: VideoSource): Promise<VideoFactPackage> {
  const bytes = await readVideo(video);
  const dataUrl = `data:${video.contentType || "video/mp4"};base64,${bytes.toString("base64")}`;
  const raw = await complete([{
    role: "user",
    content: [
      { type: "video_url", video_url: { url: dataUrl }, fps: 2 } as unknown as OpenAI.Chat.Completions.ChatCompletionContentPart,
      { type: "text", text: await prompt("video_fact_prompt.txt") },
    ],
  }], { timeoutMs: VIDEO_TIMEOUT_MS, stage: "video" });
  try { return parseVideoFacts(raw); } catch (error) {
    const repaired = await complete([{ role: "user", content: `以下 JSON 未通过校验。只修复格式、字段和时间格式，不得改写 action_id 与已有时间戳。\n错误：${String(error)}\n原文：${raw}` }], { timeoutMs: REPAIR_TIMEOUT_MS, stage: "repair" });
    return parseVideoFacts(repaired);
  }
}

export async function personalizeWithQwen(facts: VideoFactPackage, profile: AnalysisBabyProfile, evidence: KnowledgeRule[]): Promise<AnalysisResult> {
  const request = `${await prompt("personalized_analysis_prompt.txt")}\n\n视频事实 JSON：\n${JSON.stringify(facts)}\n\n宝宝档案 JSON：\n${JSON.stringify(profile)}\n\n政策证据 JSON：\n${JSON.stringify(evidence)}`;
  const raw = await complete([{ role: "user", content: request }], { timeoutMs: PLAN_TIMEOUT_MS, stage: "plan" });
  const evidenceIndex = new Map(evidence.map((item) => [item.evidence_id, item.dimension] as const));
  try {
    const parsed = parseAnalysisResult(normalizeAnalysisEvidence(raw, evidenceIndex), facts, evidenceIndex);
    const groundedCard = stabilizeConclusionCard(parsed.宝宝版本, [facts, profile, evidence]);
    return { ...parsed, 宝宝版本: { ...parsed.宝宝版本, conclusion_card: groundedCard }, 视频解析: { ...parsed.视频解析, evidence } };
  } catch (error) {
    try {
      const repaired = await complete([{ role: "user", content: `下面是一份辅食分析 JSON。只修复校验错误和缺失字段，其他内容保持不变；不得改写视频事实、action_id 和时间戳。只输出完整合法 JSON。\n允许的 evidence_ids：${evidence.map((item) => item.evidence_id).join("、")}\n校验错误：${String(error)}\n原结果：${raw}` }], { timeoutMs: REPAIR_TIMEOUT_MS, stage: "repair" });
      const parsed = parseAnalysisResult(normalizeAnalysisEvidence(repaired, evidenceIndex), facts, evidenceIndex);
      const groundedCard = stabilizeConclusionCard(parsed.宝宝版本, [facts, profile, evidence]);
      return { ...parsed, 宝宝版本: { ...parsed.宝宝版本, conclusion_card: groundedCard }, 视频解析: { ...parsed.视频解析, evidence } };
    } catch (repairError) {
      const repairMessage = repairError instanceof Error ? repairError.message : "模型结果修复失败";
      const validationMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`${repairMessage} 原始结果问题：${validationMessage}`);
    }
  }
}
