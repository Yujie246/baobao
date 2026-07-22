import { NextResponse } from "next/server";
import { processAnalysisJob } from "../../../analysis/server/process-job";
import { staleAnalysisMessage } from "../../../analysis/job-runtime";
import { loadJob, saveJob, updateJob } from "../../../analysis/server/storage";

export const runtime = "nodejs";
export const maxDuration = 800;

async function runInBackground(task: Promise<void>) {
  if (process.env.VERCEL) {
    const { waitUntil } = await import("@vercel/functions");
    waitUntil(task);
  } else {
    void task;
  }
}

function publicError(error: string | null) {
  if (!error) return null;
  if (error.includes('"code":') || error.includes("Too small") || error.includes("未通过校验")) return "模型返回的结果格式不稳定，视频文件没有问题。请点击重试，系统会重新生成。";
  return error;
}

function analysisInsights(job: NonNullable<Awaited<ReturnType<typeof loadJob>>>) {
  if (job.status === "parsing_video") return [
    "只记录画面、字幕和口播中明确出现的内容",
    "正在拆分食材、处理动作、质地与时间点",
    "视频没有说明的信息会保留为待确认，不会自行补全",
  ];
  const insights: string[] = [];
  if (job.facts) {
    insights.push(`已识别视频主题：${job.facts.video_title}`);
    insights.push(`已整理 ${job.facts.actions.length} 个明确动作，正在保持原始时间点`);
    const unknownCount = job.facts.global_unknowns.length + job.facts.actions.reduce((total, action) => total + action.unknowns.length, 0);
    if (unknownCount) insights.push(`发现 ${unknownCount} 项视频未说明信息，将标记为待确认`);
  }
  if (job.status === "generating_plan") {
    insights.push(`正在结合${job.profile.name}的 ${job.profile.months} 个月档案逐项核对`);
    insights.push("正在检查食材、调味、熟度、质地、大小形状和喂养方式");
    if (job.profile.avoidFoods.length) insights.push(`重点检查需要避开的食材：${job.profile.avoidFoods.join("、")}`);
  }
  if (job.status === "extracting_frames") insights.push("结论已生成，正在为陪做步骤定位关键画面");
  return insights.slice(-4);
}

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  let job = await loadJob(jobId);
  if (!job) return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  const staleMessage = staleAnalysisMessage(job);
  if (staleMessage) job = await updateJob(jobId, { status: "failed", stageText: "分析已停止", error: staleMessage });
  const status = { jobId: job.jobId, status: job.status, progress: job.progress, stageText: job.stageText, error: publicError(job.error), createdAt: job.createdAt, updatedAt: job.updatedAt, insights: analysisInsights(job) };
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  const job = await loadJob(jobId);
  if (!job) return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  if (job.status !== "failed") return NextResponse.json({ error: "只有失败任务可以重试" }, { status: 409 });
  const now = Date.now();
  await saveJob({ ...job, status: "queued", progress: 5, stageText: "正在重新生成分析结果", error: null, updatedAt: now, result: undefined });
  const task = processAnalysisJob(jobId);
    await runInBackground(task);
  return NextResponse.json({ jobId, status: "queued" }, { status: 202 });
}
