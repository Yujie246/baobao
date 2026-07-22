import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "当前环境未配置 Vercel Blob" }, { status: 503 });
  const body = await request.json() as HandleUploadBody;
  try {
    const response = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!/\.(mp4|mov)$/i.test(pathname)) throw new Error("仅支持 MP4 或 MOV 视频");
        return { allowedContentTypes: ["video/mp4", "video/quicktime"], maximumSizeInBytes: 200 * 1024 * 1024, addRandomSuffix: true };
      },
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "上传授权失败" }, { status: 400 });
  }
}
