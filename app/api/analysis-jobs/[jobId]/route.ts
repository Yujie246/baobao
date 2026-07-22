import { NextResponse } from "next/server";
import { loadJob } from "../../../analysis/server/storage";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  const job = await loadJob(jobId);
  if (!job) return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  const status = { jobId: job.jobId, status: job.status, progress: job.progress, stageText: job.stageText, error: job.error, createdAt: job.createdAt, updatedAt: job.updatedAt };
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}
