import { upload } from "@vercel/blob/client";
import type { BabyProfile } from "../types";
import type { AnalysisJobStatus, AnalysisResult } from "./schemas";
import { toAnalysisProfile } from "./profile";

export { toAnalysisProfile } from "./profile";

async function errorMessage(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return payload?.error || `请求失败（${response.status}）`;
}

async function uploadVideoInChunks(file: File, onUploadProgress?: (percent: number) => void) {
  const initResponse = await fetch("/api/local-uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, contentType: file.type, size: file.size }),
  });
  if (!initResponse.ok) throw new Error(await errorMessage(initResponse));
  const init = await initResponse.json() as { uploadId: string; chunkSize: number; chunkCount: number };
  for (let part = 0; part < init.chunkCount; part += 1) {
    const start = part * init.chunkSize;
    const response = await fetch(`/api/local-uploads/${encodeURIComponent(init.uploadId)}/parts/${part}`, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: file.slice(start, Math.min(file.size, start + init.chunkSize)),
    });
    if (!response.ok) throw new Error(await errorMessage(response));
    onUploadProgress?.(Math.round(((part + 1) / init.chunkCount) * 100));
  }
  const completeResponse = await fetch(`/api/local-uploads/${encodeURIComponent(init.uploadId)}/complete`, { method: "POST" });
  if (!completeResponse.ok) throw new Error(await errorMessage(completeResponse));
  return completeResponse.json() as Promise<{ uploadId: string; name: string; contentType: string; size: number }>;
}

export async function createAnalysisJob(file: File, profile: BabyProfile, onUploadProgress?: (percent: number) => void) {
  let response: Response;
  const babyProfile = toAnalysisProfile(profile);
  if (location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
    const blob = await upload(`analysis-videos/${file.name}`, file, {
      access: "private",
      handleUploadUrl: "/api/uploads",
      multipart: file.size > 100 * 1024 * 1024,
      onUploadProgress: ({ percentage }) => onUploadProgress?.(Math.round(percentage)),
    });
    response = await fetch("/api/analysis-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video: { kind: "blob", url: blob.url, name: file.name, contentType: file.type, size: file.size }, babyProfile }),
    });
  } else {
    const localUpload = await uploadVideoInChunks(file, onUploadProgress);
    response = await fetch("/api/analysis-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video: { kind: "local-upload", ...localUpload }, babyProfile }),
    });
  }
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as Promise<{ jobId: string; status: "queued" }>;
}

export async function createUrlAnalysisJob(url: string, profile: BabyProfile) {
  const response = await fetch("/api/analysis-jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video: { kind: "remote", url, name: "remote-video.mp4", contentType: "video/mp4", size: 0 }, babyProfile: toAnalysisProfile(profile) }),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as Promise<{ jobId: string; status: "queued" }>;
}

export async function getAnalysisJob(jobId: string) {
  const response = await fetch(`/api/analysis-jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as Promise<AnalysisJobStatus>;
}

export async function retryAnalysisJob(jobId: string) {
  const response = await fetch(`/api/analysis-jobs/${encodeURIComponent(jobId)}`, { method: "POST" });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as Promise<{ jobId: string; status: "queued" }>;
}

export async function getAnalysisResult(jobId: string) {
  const response = await fetch(`/api/analysis-jobs/${encodeURIComponent(jobId)}/result`, { cache: "no-store" });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as Promise<AnalysisResult>;
}
