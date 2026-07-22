import type { AnalysisJobStatus } from "./schemas";

export const ANALYSIS_HEARTBEAT_INTERVAL_MS = 10_000;
export const ANALYSIS_HEARTBEAT_STALE_MS = 45_000;

const processingStatuses = new Set<AnalysisJobStatus["status"]>([
  "queued",
  "parsing_video",
  "searching_knowledge",
  "generating_plan",
  "extracting_frames",
]);

export function staleAnalysisMessage(job: Pick<AnalysisJobStatus, "status" | "updatedAt">, now = Date.now()) {
  if (!processingStatuses.has(job.status) || now - job.updatedAt <= ANALYSIS_HEARTBEAT_STALE_MS) return null;
  if (job.status === "parsing_video") return "视频解析进程已中断，请重试；视频文件本身没有损坏。";
  if (job.status === "generating_plan") return "生成宝宝版本的模型请求已中断，请点击重试。";
  if (job.status === "extracting_frames") return "关键画面提取进程已中断，请点击重试。";
  return "分析进程已中断，请点击重试。";
}

