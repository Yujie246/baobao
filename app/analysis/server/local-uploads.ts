import "server-only";
import { appendFile, mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { VideoSource } from "./storage";
import { runtimeTempRoot } from "./runtime-paths";

export const LOCAL_UPLOAD_CHUNK_BYTES = 2 * 1024 * 1024;
export const MAX_LOCAL_VIDEO_BYTES = 200 * 1024 * 1024;

interface LocalUploadMeta {
  uploadId: string;
  name: string;
  contentType: string;
  size: number;
  chunkSize: number;
  chunkCount: number;
  completed: boolean;
}

const uploadRoot = path.join(runtimeTempRoot, "local-uploads");
const uploadIdPattern = /^[0-9a-f-]{36}$/i;

function assertUploadId(uploadId: string) {
  if (!uploadIdPattern.test(uploadId)) throw new Error("上传任务无效");
}

function uploadDir(uploadId: string) {
  assertUploadId(uploadId);
  return path.join(uploadRoot, uploadId);
}

function metaPath(uploadId: string) {
  return path.join(uploadDir(uploadId), "meta.json");
}

function partPath(uploadId: string, part: number) {
  return path.join(uploadDir(uploadId), `part-${part}`);
}

function safeVideoName(name: string, contentType: string) {
  const fallback = contentType === "video/quicktime" ? "video.mov" : "video.mp4";
  return name.replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^\.+/, "") || fallback;
}

function isSupportedVideo(name: string, contentType: string) {
  return ["video/mp4", "video/quicktime"].includes(contentType) || /\.(mp4|mov)$/i.test(name);
}

async function readMeta(uploadId: string) {
  try {
    return JSON.parse(await readFile(metaPath(uploadId), "utf8")) as LocalUploadMeta;
  } catch {
    throw new Error("上传任务不存在或已失效");
  }
}

export async function createLocalUpload(input: { uploadId: string; name: string; contentType: string; size: number }) {
  if (!isSupportedVideo(input.name, input.contentType)) throw new Error("请选择 MP4 或 MOV 视频");
  if (!Number.isFinite(input.size) || input.size <= 0 || input.size > MAX_LOCAL_VIDEO_BYTES) {
    throw new Error("视频大小必须在 200MB 以内");
  }
  const meta: LocalUploadMeta = {
    uploadId: input.uploadId,
    name: safeVideoName(input.name, input.contentType),
    contentType: input.contentType || "video/mp4",
    size: input.size,
    chunkSize: LOCAL_UPLOAD_CHUNK_BYTES,
    chunkCount: Math.ceil(input.size / LOCAL_UPLOAD_CHUNK_BYTES),
    completed: false,
  };
  await mkdir(uploadDir(input.uploadId), { recursive: true });
  await writeFile(metaPath(input.uploadId), JSON.stringify(meta), "utf8");
  return meta;
}

export async function saveLocalUploadPart(uploadId: string, part: number, bytes: Uint8Array) {
  const meta = await readMeta(uploadId);
  if (meta.completed) throw new Error("视频已经上传完成");
  if (!Number.isInteger(part) || part < 0 || part >= meta.chunkCount) throw new Error("上传分片序号无效");
  const expected = part === meta.chunkCount - 1 ? meta.size - part * meta.chunkSize : meta.chunkSize;
  if (bytes.byteLength !== expected) throw new Error("上传分片大小不正确，请重新上传");
  await writeFile(partPath(uploadId, part), bytes);
}

export async function completeLocalUpload(uploadId: string) {
  const meta = await readMeta(uploadId);
  if (meta.completed) return meta;
  const target = path.join(uploadDir(uploadId), meta.name);
  await writeFile(target, new Uint8Array());
  let total = 0;
  const sources: string[] = [];
  for (let part = 0; part < meta.chunkCount; part += 1) {
    const source = partPath(uploadId, part);
    let partSize = 0;
    try { partSize = (await stat(source)).size; } catch { throw new Error(`缺少第 ${part + 1} 个上传分片，请重新上传`); }
    const expected = part === meta.chunkCount - 1 ? meta.size - part * meta.chunkSize : meta.chunkSize;
    if (partSize !== expected) throw new Error(`第 ${part + 1} 个上传分片不完整，请重新上传`);
    await appendFile(target, await readFile(source));
    total += partSize;
    sources.push(source);
  }
  if (total !== meta.size) throw new Error("视频上传不完整，请重新上传");
  await Promise.all(sources.map((source) => unlink(source)));
  const completed = { ...meta, completed: true };
  await writeFile(metaPath(uploadId), JSON.stringify(completed), "utf8");
  return completed;
}

export async function claimLocalUpload(jobId: string, uploadId: string): Promise<VideoSource> {
  const meta = await readMeta(uploadId);
  if (!meta.completed) throw new Error("视频尚未上传完成");
  const jobDir = path.join(runtimeTempRoot, "analysis-jobs", jobId);
  await mkdir(jobDir, { recursive: true });
  const target = path.join(jobDir, meta.name);
  try {
    await rename(path.join(uploadDir(uploadId), meta.name), target);
  } catch {
    throw new Error("上传视频不存在或已经被使用");
  }
  return { kind: "local", value: target, name: meta.name, contentType: meta.contentType, size: meta.size };
}
