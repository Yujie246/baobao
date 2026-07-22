import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { analysisBabyProfileSchema } from "../../analysis/schemas";
import { processAnalysisJob } from "../../analysis/server/process-job";
import { saveJob, saveUploadedVideo, type VideoSource } from "../../analysis/server/storage";

export const runtime = "nodejs";
export const maxDuration = 800;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

function isVideo(file: File) {
  return ["video/mp4", "video/quicktime"].includes(file.type) || /\.(mp4|mov)$/i.test(file.name);
}

export async function POST(request: Request) {
  try {
    const jobId = randomUUID();
    let profileValue: unknown;
    let video: VideoSource;
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("video");
      if (!(file instanceof File) || !isVideo(file)) return NextResponse.json({ error: "请选择 MP4 或 MOV 视频" }, { status: 400 });
      if (file.size <= 0 || file.size > MAX_VIDEO_BYTES) return NextResponse.json({ error: "视频大小必须在 200MB 以内" }, { status: 400 });
      profileValue = JSON.parse(String(form.get("babyProfile") || "null"));
      video = await saveUploadedVideo(jobId, file);
    } else {
      const body = await request.json() as { video?: { url?: string; name?: string; contentType?: string; size?: number; kind?: "blob" | "remote" }; babyProfile?: unknown };
      profileValue = body.babyProfile;
      const value = body.video?.url;
      const size = Number(body.video?.size || 0);
      if (!value || !/^https:\/\//.test(value)) return NextResponse.json({ error: "视频地址无效" }, { status: 400 });
      if (size > MAX_VIDEO_BYTES) return NextResponse.json({ error: "视频不能超过 200MB" }, { status: 400 });
      video = { kind: body.video?.kind === "remote" ? "remote" : "blob", value, name: body.video?.name || "video.mp4", contentType: body.video?.contentType || "video/mp4", size };
    }
    const profile = analysisBabyProfileSchema.parse(profileValue);
    const now = Date.now();
    await saveJob({ jobId, status: "queued", progress: 5, stageText: "任务已创建，准备分析", error: null, createdAt: now, updatedAt: now, profile, video });
    const task = processAnalysisJob(jobId);
    if (process.env.VERCEL) waitUntil(task); else void task;
    return NextResponse.json({ jobId, status: "queued" }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "创建任务失败" }, { status: 400 });
  }
}
