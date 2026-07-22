import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createLocalUpload } from "@/app/analysis/server/local-uploads";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: string; contentType?: string; size?: number };
    const upload = await createLocalUpload({
      uploadId: randomUUID(),
      name: String(body.name || "video.mp4"),
      contentType: String(body.contentType || "video/mp4"),
      size: Number(body.size),
    });
    return NextResponse.json({ uploadId: upload.uploadId, chunkSize: upload.chunkSize, chunkCount: upload.chunkCount });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "无法创建上传任务" }, { status: 400 });
  }
}
