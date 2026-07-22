import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { AnalysisResult } from "../schemas";
import { materializeVideo, saveFrame, type VideoSource } from "./storage";
import { timestampToSeconds } from "../json";

const execFileAsync = promisify(execFile);
const ffmpegBinary = process.env.FFMPEG_PATH || path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg");

export async function extractFrames(jobId: string, video: VideoSource, result: AnalysisResult) {
  const binary = ffmpegBinary;
  const input = await materializeVideo(jobId, video);
  const outputDir = path.join(process.cwd(), "tmp", "analysis-jobs", jobId, "frame-work");
  await mkdir(outputDir, { recursive: true });
  const steps = await Promise.all(result.陪做步骤.map(async (step) => {
    const seconds = timestampToSeconds(step.keyframe_time);
    if (seconds == null) return step;
    const target = path.join(outputDir, `${step.step_id}.jpg`);
    try {
      await execFileAsync(binary, ["-y", "-ss", String(seconds), "-i", input, "-frames:v", "1", "-q:v", "3", target], { timeout: 60_000 });
      const image_url = await saveFrame(jobId, step.step_id, await readFile(target));
      return { ...step, image_url };
    } catch { return step; }
  }));
  return {
    ...result,
    陪做步骤: steps,
    ...(result.统一方案 ? { 统一方案: { ...result.统一方案, steps } } : {}),
  };
}
