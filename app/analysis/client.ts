import { upload } from "@vercel/blob/client";
import type { BabyProfile } from "../types";
import type { AnalysisBabyProfile, AnalysisJobStatus, AnalysisResult } from "./schemas";

export function toAnalysisProfile(profile: BabyProfile): AnalysisBabyProfile {
  return {
    name: profile.name,
    months: profile.months,
    correctedMonths: profile.correctedMonths,
    premature: profile.premature,
    stage: profile.stage,
    avoidFoods: profile.avoidFoods,
    triedFoods: profile.triedFoods,
    feedingSignals: profile.feedingSignals,
    note: profile.feedingNote,
  };
}

async function errorMessage(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return payload?.error || `请求失败（${response.status}）`;
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
    const form = new FormData();
    form.set("video", file);
    form.set("babyProfile", JSON.stringify(babyProfile));
    response = await fetch("/api/analysis-jobs", { method: "POST", body: form });
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

export async function getAnalysisResult(jobId: string) {
  const response = await fetch(`/api/analysis-jobs/${encodeURIComponent(jobId)}/result`, { cache: "no-store" });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as Promise<AnalysisResult>;
}
