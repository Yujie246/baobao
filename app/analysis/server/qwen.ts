import "server-only";
import OpenAI from "openai";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseAnalysisResult, parseVideoFacts } from "../json";
import type { AnalysisBabyProfile, AnalysisResult, KnowledgeRule, VideoFactPackage } from "../schemas";
import type { VideoSource } from "./storage";
import { readVideo } from "./storage";

const baseURL = process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
const model = process.env.QWEN_MODEL || "qwen3.7-plus";

function client() {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error("服务端未配置 DASHSCOPE_API_KEY");
  return new OpenAI({ apiKey, baseURL, timeout: 10 * 60 * 1000, maxRetries: 0 });
}

async function prompt(name: string) {
  return readFile(path.join(process.cwd(), "prompts", name), "utf8");
}

function transient(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 0;
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

async function onceWithRetry<T>(run: () => Promise<T>): Promise<T> {
  try { return await run(); } catch (error) { if (!transient(error)) throw error; return run(); }
}

async function complete(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[], json = true) {
  return onceWithRetry(async () => {
    const payload: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & { enable_thinking: boolean } = {
      model,
      messages,
      temperature: 0.1,
      enable_thinking: false,
      ...(json ? { response_format: { type: "json_object" as const } } : {}),
    };
    const response = await client().chat.completions.create(payload);
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("模型没有返回内容");
    return content;
  });
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
  }]);
  try { return parseVideoFacts(raw); } catch (error) {
    const repaired = await complete([{ role: "user", content: `以下 JSON 未通过校验。只修复格式、字段和时间格式，不得改写 action_id 与已有时间戳。\n错误：${String(error)}\n原文：${raw}` }]);
    return parseVideoFacts(repaired);
  }
}

export async function personalizeWithQwen(facts: VideoFactPackage, profile: AnalysisBabyProfile, evidence: KnowledgeRule[]): Promise<AnalysisResult> {
  const request = `${await prompt("personalized_analysis_prompt.txt")}\n\n视频事实 JSON：\n${JSON.stringify(facts)}\n\n宝宝档案 JSON：\n${JSON.stringify(profile)}\n\n政策证据 JSON：\n${JSON.stringify(evidence)}`;
  const raw = await complete([{ role: "user", content: request }]);
  try { return parseAnalysisResult(raw, facts); } catch (error) {
    const repaired = await complete([{ role: "user", content: `以下结果未通过校验。只修复 JSON 结构；所有 action_id 和时间戳必须与视频事实逐字一致。\n错误：${String(error)}\n视频事实：${JSON.stringify(facts)}\n原结果：${raw}` }]);
    return parseAnalysisResult(repaired, facts);
  }
}
