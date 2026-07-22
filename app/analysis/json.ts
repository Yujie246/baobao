import { analysisResultSchema, videoFactPackageSchema, type AnalysisResult, type VideoFactPackage } from "./schemas";

export function stripCodeFence(value: string) {
  return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

export function normalizeTimestamp(value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) return `${value}.000`;
  return value;
}

function deepNormalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deepNormalize);
  if (!value || typeof value !== "object") return normalizeTimestamp(value);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key.endsWith("time") ? normalizeTimestamp(item) : deepNormalize(item)]));
}

export function timestampToSeconds(value: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
}

export function parseVideoFacts(raw: string): VideoFactPackage {
  const parsed = videoFactPackageSchema.parse(deepNormalize(JSON.parse(stripCodeFence(raw))));
  if (parsed.duration_seconds != null) {
    for (const action of parsed.actions) {
      for (const field of ["start_time", "end_time", "keyframe_time"] as const) {
        const seconds = timestampToSeconds(action[field]);
        if (seconds != null && seconds > parsed.duration_seconds + 0.5) throw new Error(`${action.action_id}.${field} 超出视频时长`);
      }
    }
  }
  return parsed;
}

export function parseAnalysisResult(raw: string, facts: VideoFactPackage): AnalysisResult {
  const parsed = analysisResultSchema.parse(deepNormalize(JSON.parse(stripCodeFence(raw))));
  const actionMap = new Map(facts.actions.map((action) => [action.action_id, action]));
  for (const step of parsed.陪做步骤) {
    if (!step.source_action_id) {
      if (step.start_time || step.end_time || step.keyframe_time) throw new Error(`${step.step_id} 为新增步骤，时间戳必须为 null`);
      continue;
    }
    const source = actionMap.get(step.source_action_id);
    if (!source) throw new Error(`${step.step_id} 引用了不存在的 action_id`);
    if (step.start_time !== source.start_time || step.end_time !== source.end_time || step.keyframe_time !== source.keyframe_time) {
      throw new Error(`${step.step_id} 改写了原视频时间戳`);
    }
  }
  return parsed;
}
