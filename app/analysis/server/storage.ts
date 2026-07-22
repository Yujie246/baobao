import "server-only";
import { get, put } from "@vercel/blob";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AnalysisJobStatus, AnalysisResult, AnalysisBabyProfile } from "../schemas";

export interface VideoSource {
  kind: "local" | "blob" | "remote";
  value: string;
  name: string;
  contentType: string;
  size: number;
}

export interface AnalysisJobRecord extends AnalysisJobStatus {
  profile: AnalysisBabyProfile;
  video: VideoSource;
  result?: AnalysisResult;
}

const root = path.join(process.cwd(), "tmp", "analysis-jobs");
const hasBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const jobPath = (jobId: string) => `analysis-jobs/${jobId}/job.json`;
const localJobPath = (jobId: string) => path.join(root, jobId, "job.json");

async function streamToBuffer(stream: ReadableStream<Uint8Array>) {
  return Buffer.from(await new Response(stream).arrayBuffer());
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
  if (source.kind === "blob") {
    const result = await get(source.value, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) throw new Error("无法读取已上传视频");
    return streamToBuffer(result.stream);
  }
  const response = await fetch(source.value);
  if (!response.ok) throw new Error("无法读取视频链接");
  return Buffer.from(await response.arrayBuffer());
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
