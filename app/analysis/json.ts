import { analysisResultSchema, videoFactPackageSchema, type AnalysisResult, type KnowledgeRule, type VideoFactPackage } from "./schemas";

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

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function timestampToSeconds(value: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function normalizeAnalysisEvidence(raw: string, evidenceIndex: Map<string, KnowledgeRule["dimension"]>) {
  const value = JSON.parse(stripCodeFence(raw));
  const root = record(value);
  if (!root) return raw;
  const allowed = new Set(evidenceIndex.keys());
  const byDimension = new Map<KnowledgeRule["dimension"], string[]>();
  for (const [id, dimension] of evidenceIndex) byDimension.set(dimension, [...(byDimension.get(dimension) || []), id]);
  const normalizeIds = (item: unknown, fallback: string[]) => {
    const target = record(item);
    if (!target) return;
    const ids = Array.isArray(target.evidence_ids) ? target.evidence_ids.filter((id): id is string => typeof id === "string" && allowed.has(id)) : [];
    target.evidence_ids = (ids.length ? ids : fallback).slice(0, 2);
  };
  const normalizeDimensionIds = (item: unknown, dimension: KnowledgeRule["dimension"]) => {
    const target = record(item);
    if (!target) return;
    const dimensionIds = new Set(byDimension.get(dimension));
    const ids = Array.isArray(target.evidence_ids) ? target.evidence_ids.filter((id): id is string => typeof id === "string" && dimensionIds.has(id)) : [];
    target.evidence_ids = (ids.length ? ids : byDimension.get(dimension) || []).slice(0, 2);
  };
  const baby = record(root["宝宝版本"]);
  const judgmentFallbacks = ["E-TEX-01", "E-ING-04", "E-ING-01", "E-PROFILE-02", "E-ING-04"];
  if (baby) {
    if (Array.isArray(baby.key_judgments)) baby.key_judgments.forEach((item, index) => normalizeIds(item, allowed.has(judgmentFallbacks[index]) ? [judgmentFallbacks[index]] : [...allowed].slice(0, 1)));
    if (Array.isArray(baby.ingredients)) baby.ingredients.forEach((item) => normalizeDimensionIds(item, "食材"));
    if (Array.isArray(baby.dimensions)) {
      baby.dimensions.forEach((item) => {
        const target = record(item);
        if (!target) return;
        const dimension = target.dimension as KnowledgeRule["dimension"] | undefined;
        if (!dimension || !byDimension.has(dimension)) return normalizeIds(item, [...allowed].slice(0, 1));
        normalizeDimensionIds(item, dimension);
      });
    }
  }
  const video = record(root["视频解析"]);
  if (video && Array.isArray(video.required_abilities)) {
    const abilityIds = ["质地", "大小形状", "喂养方式"].flatMap((dimension) => byDimension.get(dimension as KnowledgeRule["dimension"]) || []);
    const abilitySet = new Set(abilityIds);
    video.required_abilities.forEach((item) => {
      const target = record(item);
      if (!target) return;
      const ids = Array.isArray(target.evidence_ids) ? target.evidence_ids.filter((id): id is string => typeof id === "string" && abilitySet.has(id)) : [];
      target.evidence_ids = (ids.length ? ids : abilityIds).slice(0, 2);
    });
  }
  if (Array.isArray(root["陪做步骤"])) {
    root["陪做步骤"].forEach((item) => {
      const step = record(item);
      if (!step || typeof step.mapping_note === "string" && step.mapping_note.trim()) return;
      step.mapping_note = step.source_action_id ? "对应原视频中的这一步" : "宝宝版新增步骤";
    });
  }
  return JSON.stringify(value);
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

export function parseAnalysisResult(raw: string, facts: VideoFactPackage, evidenceIndex?: Set<string> | Map<string, KnowledgeRule["dimension"]>): AnalysisResult {
  const parsed = analysisResultSchema.parse(deepNormalize(JSON.parse(stripCodeFence(raw))));
  if (stableJson(parsed.视频解析.facts) !== stableJson(facts)) throw new Error("视频解析.facts 改写了原视频事实包");
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
  if (evidenceIndex) {
    const allowedEvidenceIds = evidenceIndex instanceof Set ? evidenceIndex : new Set(evidenceIndex.keys());
    const references = [
      ...parsed.宝宝版本.key_judgments.flatMap((item) => item.evidence_ids),
      ...parsed.宝宝版本.ingredients.flatMap((item) => item.evidence_ids),
      ...parsed.宝宝版本.dimensions.flatMap((item) => item.evidence_ids),
      ...parsed.视频解析.required_abilities.flatMap((item) => item.evidence_ids),
    ];
    const unknown = [...new Set(references.filter((id) => !allowedEvidenceIds.has(id)))];
    if (unknown.length) throw new Error(`引用了知识库中不存在的证据：${unknown.join("、")}`);
    if (evidenceIndex instanceof Map) {
      for (const item of parsed.宝宝版本.dimensions) {
        const mismatched = item.evidence_ids.filter((id) => evidenceIndex.get(id) !== item.dimension);
        if (mismatched.length) throw new Error(`${item.dimension}维度引用了不属于该维度的证据：${mismatched.join("、")}`);
      }
      const abilityDimensions = new Set<KnowledgeRule["dimension"]>(["质地", "大小形状", "喂养方式"]);
      for (const item of parsed.视频解析.required_abilities) {
        const mismatched = item.evidence_ids.filter((id) => !abilityDimensions.has(evidenceIndex.get(id)!));
        if (mismatched.length) throw new Error(`进食能力“${item.title}”引用了无关证据：${mismatched.join("、")}`);
      }
    }
  }
  return parsed;
}
