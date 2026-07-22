import { NextResponse } from "next/server";
import { readFrame } from "../../../../../analysis/server/storage";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string; stepId: string }> }) {
  const { jobId, stepId } = await context.params;
  if (!/^[\w-]+$/.test(jobId) || !/^[\w-]+$/.test(stepId)) return NextResponse.json({ error: "路径无效" }, { status: 400 });
  const image = await readFrame(jobId, stepId);
  if (!image) return NextResponse.json({ error: "关键帧不存在" }, { status: 404 });
  return new NextResponse(new Uint8Array(image), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" } });
}
