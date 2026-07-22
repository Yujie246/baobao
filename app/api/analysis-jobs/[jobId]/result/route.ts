import { NextResponse } from "next/server";
import { loadJob } from "../../../../analysis/server/storage";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  const job = await loadJob(jobId);
  if (!job) return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  if (job.status !== "completed" || !job.result) return NextResponse.json({ error: "结果尚未生成", status: job.status }, { status: 409 });
  return NextResponse.json(job.result, { headers: { "Cache-Control": "no-store" } });
}
