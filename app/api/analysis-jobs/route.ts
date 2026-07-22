import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { analysisBabyProfileSchema } from "../../analysis/schemas";
import { processAnalysisJob } from "../../analysis/server/process-job";
import { claimLocalUpload } from "../../analysis/server/local-uploads";
import { saveJob, saveUploadedVideo, type VideoSource } from "../../analysis/server/storage";
import { getPlanVideoCandidate } from "../../plan-video-catalog";
import { getMockAnalysisFixture } from "../../mocks/fixtures";
import { stat } from "node:fs/promises";
import path from "node:path";
import { resolveSubmittedVideo } from "../../analysis/server/tikhub";

export const runtime = "nodejs";
export const maxDuration = 300;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

async function runInBackground(task: Promise<void>) {
  if (process.env.VERCEL) {
    const { waitUntil } = await import("@vercel/functions");
    waitUntil(task);
  } else {
    void task;
  }
}

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
      const body = await request.json() as { video?: { url?: string; uploadId?: string; catalogId?: string; name?: string; contentType?: string; size?: number; kind?: "blob" | "remote" | "local-upload" | "catalog" }; babyProfile?: unknown };
      profileValue = body.babyProfile;
      const profile = analysisBabyProfileSchema.parse(profileValue);
      if (body.video?.kind === "catalog") {
        const candidate = getPlanVideoCandidate(body.video.catalogId || "");
        if (!candidate) return NextResponse.json({ error: "候选视频不存在" }, { status: 404 });
        if (candidate.mockFixtureId) {
          const fixture = getMockAnalysisFixture(candidate.mockFixtureId);
          if (!fixture) return NextResponse.json({ error: "候选视频的 Mock 分析结果不存在" }, { status: 503 });
          const now = Date.now();
          video = { kind: "mock", value: fixture.meta.fixtureId, name: fixture.meta.sourceName, contentType: "video/mp4", size: 0 };
          await saveJob({
            jobId,
            status: "completed",
            progress: 100,
            stageText: "已加载测试视频 1 的 Mock 分析结果",
            error: null,
            createdAt: now,
            updatedAt: now,
            profile,
            video,
            facts: fixture.result.视频解析.facts,
            result: fixture.result,
          });
          return NextResponse.json({ jobId, status: "completed" });
        }
        const value = path.join(process.cwd(), "测试视频", candidate.localFile);
        const file = await stat(value).catch(() => null);
        if (!file?.isFile()) return NextResponse.json({ error: "候选视频文件当前不可用，请改用链接或上传视频" }, { status: 503 });
        video = { kind: "local", value, name: candidate.localFile, contentType: "video/mp4", size: file.size };
        const now = Date.now();
        await saveJob({ jobId, status: "queued", progress: 5, stageText: "已选择计划候选视频，准备分析", error: null, createdAt: now, updatedAt: now, profile, video });
        const task = processAnalysisJob(jobId);
        await runInBackground(task);
        return NextResponse.json({ jobId, status: "queued" }, { status: 202 });
      }
      if (body.video?.kind === "local-upload") {
        if (!body.video.uploadId) return NextResponse.json({ error: "本地上传任务无效" }, { status: 400 });
        video = await claimLocalUpload(jobId, body.video.uploadId);
        const now = Date.now();
        await saveJob({ jobId, status: "queued", progress: 5, stageText: "任务已创建，准备分析", error: null, createdAt: now, updatedAt: now, profile, video });
        const task = processAnalysisJob(jobId);
        await runInBackground(task);
        return NextResponse.json({ jobId, status: "queued" }, { status: 202 });
      }
      const value = body.video?.url;
      const size = Number(body.video?.size || 0);
      if (!value) return NextResponse.json({ error: "视频地址无效" }, { status: 400 });
      if (size > MAX_VIDEO_BYTES) return NextResponse.json({ error: "视频不能超过 200MB" }, { status: 400 });
      if (body.video?.kind === "remote") {
        const resolved = await resolveSubmittedVideo(value);
        video = { kind: "remote", value: resolved.url, origin: resolved.originalUrl, name: resolved.name, contentType: resolved.contentType, size };
      } else {
        video = { kind: "blob", value, name: body.video?.name || "video.mp4", contentType: body.video?.contentType || "video/mp4", size };
      }
    }
    const profile = analysisBabyProfileSchema.parse(profileValue);
    const now = Date.now();
    await saveJob({ jobId, status: "queued", progress: 5, stageText: "任务已创建，准备分析", error: null, createdAt: now, updatedAt: now, profile, video });
    const task = processAnalysisJob(jobId);
    await runInBackground(task);
    return NextResponse.json({ jobId, status: "queued" }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "创建任务失败" }, { status: 400 });
  }
}
