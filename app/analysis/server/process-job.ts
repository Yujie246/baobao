import "server-only";
import { searchKnowledgeForProfile } from "../evidence";
import { ANALYSIS_HEARTBEAT_INTERVAL_MS } from "../job-runtime";
import type { AnalysisJobStatus } from "../schemas";
import { extractFrames } from "./frames";
import { personalizeWithQwen, parseVideoWithQwen } from "./qwen";
import { loadJob, updateJob } from "./storage";

async function runStage<T>(
  jobId: string,
  stage: AnalysisJobStatus["status"],
  startProgress: number,
  maxProgress: number,
  label: string,
  task: () => Promise<T>,
) {
  const startedAt = Date.now();
  let progress = startProgress;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingHeartbeat: Promise<void> = Promise.resolve();
  await updateJob(jobId, { status: stage, progress, stageText: label });
  const heartbeat = () => {
    if (stopped) return;
    timer = setTimeout(() => {
      if (stopped) return;
      pendingHeartbeat = (async () => {
        const current = await loadJob(jobId);
        if (!current || current.status !== stage) return;
        progress = Math.min(maxProgress, progress + 2);
        const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        await updateJob(jobId, { progress, stageText: `${label}（已处理 ${seconds} 秒）` });
      })().catch(() => undefined).finally(heartbeat);
    }, ANALYSIS_HEARTBEAT_INTERVAL_MS);
  };
  heartbeat();
  try {
    return await task();
  } finally {
    stopped = true;
    if (timer) clearTimeout(timer);
    await pendingHeartbeat;
  }
}

export async function processAnalysisJob(jobId: string) {
  try {
    const job = await loadJob(jobId);
    if (!job) throw new Error("分析任务不存在");
    const facts = job.facts ?? await runStage(jobId, "parsing_video", 10, 40, "正在识别视频中的食材和动作", () => parseVideoWithQwen(job.video));
    if (!job.facts) await updateJob(jobId, { facts, progress: 44, stageText: "视频内容识别完成" });
    await updateJob(jobId, { status: "searching_knowledge", progress: 45, stageText: "正在匹配政策证据与宝宝档案" });
    const evidence = searchKnowledgeForProfile(job.profile);
    let result = await runStage(jobId, "generating_plan", 55, 76, "正在生成宝宝版本与陪做步骤", () => personalizeWithQwen(facts, job.profile, evidence));
    result = await runStage(jobId, "extracting_frames", 80, 92, "正在提取每一步的关键画面", () => extractFrames(jobId, job.video, result));
    await updateJob(jobId, { progress: 95, stageText: "正在完成结果校验" });
    await updateJob(jobId, { status: "completed", progress: 100, stageText: "分析完成", result, error: null });
  } catch (error) {
    await updateJob(jobId, { status: "failed", stageText: "分析失败", error: error instanceof Error ? error.message : "未知错误" }).catch(() => undefined);
  }
}
