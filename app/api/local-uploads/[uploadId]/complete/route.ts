import { NextResponse } from "next/server";
import { completeLocalUpload } from "@/app/analysis/server/local-uploads";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ uploadId: string }> }) {
  try {
    const { uploadId } = await context.params;
    const upload = await completeLocalUpload(uploadId);
    return NextResponse.json({ uploadId: upload.uploadId, name: upload.name, contentType: upload.contentType, size: upload.size });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "完成上传失败" }, { status: 400 });
  }
}
