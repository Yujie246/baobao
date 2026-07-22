import "server-only";
import { get, put } from "@vercel/blob";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AnalysisJobStatus, AnalysisResult, AnalysisBabyProfile, VideoFactPackage } from "../schemas";
import { runtimeTempRoot } from "./runtime-paths";

export interface VideoSource {
  kind: "local" | "blob" | "remote" | "mock";
  value: string;
  origin?: string;
  name: string;
  contentType: string;
  size: number;
}

export interface AnalysisJobRecord extends AnalysisJobStatus {
  profile: AnalysisBabyProfile;
  video: VideoSource;
  facts?: VideoFactPackage;
  result?: AnalysisResult;
}

const root = path.join(runtimeTempRoot, "analysis-jobs");
const hasBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const jobPath = (jobId: string) => `analysis-jobs/${jobId}/job.json`;
const localJobPath = (jobId: string) => path.join(root, jobId, "job.json");

async function streamToBuffer(stream: ReadableStream<Uint8Array>) {
  return Buffer.from(await new Response(stream).arrayBuffer());
}

async function streamVideoWithLimit(response: Response, maxBytes: number) {
  if (!response.body) throw new Error("视频响应没有内容");
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("视频不能超过 200MB");
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

export async function saveJob(record: AnalysisJobRecord) {
  const body = JSON.stringify(record);
  if (hasBlob()) {
    await put(jobPath(record.jobId), body, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
    return;
  }
  await mkdir(path.dirname(localJobPath(record.jobId)), { recursive: true });
  await writeFile(localJobPath(record.jobId), body, "utf8");
}

export async function loadJob(jobId: string): Promise<AnalysisJobRecord | null> {
  try {
    if (hasBlob()) {
      const result = await get(jobPath(jobId), { access: "private", useCache: false });
      if (!result || result.statusCode !== 200) return null;
      return JSON.parse((await streamToBuffer(result.stream)).toString("utf8")) as AnalysisJobRecord;
    }
    return JSON.parse(await readFile(localJobPath(jobId), "utf8")) as AnalysisJobRecord;
  } catch {
    return null;
  }
}

export async function updateJob(jobId: string, patch: Partial<AnalysisJobRecord>) {
  const current = await loadJob(jobId);
  if (!current) throw new Error("分析任务不存在");
  const progress = Math.max(current.progress, patch.progress ?? current.progress);
  const next = { ...current, ...patch, progress, updatedAt: Date.now() };
  await saveJob(next);
  return next;
}

export async function saveUploadedVideo(jobId: string, file: File): Promise<VideoSource> {
  const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^\.+/, "") || "video.mp4";
  const dir = path.join(root, jobId);
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, safeName);
  await writeFile(target, Buffer.from(await file.arrayBuffer()));
  return { kind: "local", value: target, name: safeName, contentType: file.type || "video/mp4", size: file.size };
}

export async function readVideo(source: VideoSource): Promise<Buffer> {
  if (source.kind === "local") return readFile(source.value);
  if (source.kind === "mock") throw new Error("Mock 分析结果不包含可重新分析的视频源");
  if (source.kind === "blob") {
    const result = await get(source.value, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) throw new Error("无法读取已上传视频");
    return streamToBuffer(result.stream);
  }
  let response = await fetch(source.value, { headers: { "User-Agent": "Mozilla/5.0", Accept: "video/*,*/*" }, signal: AbortSignal.timeout(120_000) });
  if (!response.ok && source.origin) {
    const { resolveTikHubVideoUrl } = await import("./tikhub");
    const refreshedUrl = await resolveTikHubVideoUrl(source.origin);
    response = await fetch(refreshedUrl, { headers: { "User-Agent": "Mozilla/5.0", Accept: "video/*,*/*" }, signal: AbortSignal.timeout(120_000) });
  }
  if (!response.ok) throw new Error("无法读取视频链接，地址可能已失效");
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > 200 * 1024 * 1024) throw new Error("视频不能超过 200MB");
  return streamVideoWithLimit(response, 200 * 1024 * 1024);
}

export async function materializeVideo(jobId: string, source: VideoSource) {
  if (source.kind === "local") return source.value;
  const dir = path.join(root, jobId);
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, source.name || "video.mp4");
  await writeFile(target, await readVideo(source));
  return target;
}

export async function saveFrame(jobId: string, stepId: string, bytes: Buffer) {
  const pathname = `analysis-jobs/${jobId}/frames/${stepId}.jpg`;
  if (hasBlob()) {
    await put(pathname, bytes, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "image/jpeg" });
  } else {
    const target = path.join(root, jobId, "frames", `${stepId}.jpg`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  return `/api/analysis-jobs/${jobId}/frames/${stepId}`;
}

export async function readFrame(jobId: string, stepId: string) {
  if (hasBlob()) {
    const result = await get(`analysis-jobs/${jobId}/frames/${stepId}.jpg`, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    return streamToBuffer(result.stream);
  }
  try { return await readFile(path.join(root, jobId, "frames", `${stepId}.jpg`)); } catch { return null; }
}
