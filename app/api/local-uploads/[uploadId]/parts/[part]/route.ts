import { NextResponse } from "next/server";
import { saveLocalUploadPart } from "@/app/analysis/server/local-uploads";

export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ uploadId: string; part: string }> }) {
  try {
    const { uploadId, part } = await context.params;
    const bytes = new Uint8Array(await request.arrayBuffer());
    await saveLocalUploadPart(uploadId, Number(part), bytes);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "分片上传失败" }, { status: 400 });
  }
}
