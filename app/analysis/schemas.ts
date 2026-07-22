import { z } from "zod";

export const timestampSchema = z.string().regex(/^\d{2}:\d{2}:\d{2}\.\d{3}$/).nullable();

export const videoFactActionSchema = z.object({
  action_id: z.string().min(1),
  title: z.string().min(1),
  start_time: timestampSchema,
  end_time: timestampSchema,
  keyframe_time: timestampSchema,
  keyframe_description: z.string().min(1),
  observed_action: z.string().min(1),
  observed_ingredients: z.array(z.string()),
  observed_tools: z.array(z.string()),
  observed_texture: z.string().nullable(),
  observed_size_shape: z.string().nullable(),
  observed_seasoning: z.string().nullable(),
  observed_feeding: z.string().nullable(),
  unknowns: z.array(z.string()),
});

export const videoFactPackageSchema = z.object({
  video_title: z.string().min(1),
  duration_seconds: z.number().nonnegative().nullable(),
  summary: z.string().min(1),
  actions: z.array(videoFactActionSchema).min(1),
  global_unknowns: z.array(z.string()),
}).superRefine((value, context) => {
  const ids = new Set<string>();
  for (const action of value.actions) {
    if (ids.has(action.action_id)) context.addIssue({ code: "custom", path: ["actions"], message: `action_id 重复：${action.action_id}` });
    ids.add(action.action_id);
  }
});

export const analysisBabyProfileSchema = z.object({
  name: z.string().min(1),
  months: z.number().int().min(0).max(36),
  correctedMonths: z.number().int().min(0).max(36).nullable(),
  premature: z.boolean(),
  stage: z.string().min(1),
  avoidFoods: z.array(z.string()),
  triedFoods: z.array(z.string()),
  feedingSignals: z.array(z.string()),
  note: z.string(),
});

export const knowledgeRuleSchema = z.object({
  evidence_id: z.string().min(1),
  dimension: z.enum(["食材", "调味", "熟制", "质地", "大小形状", "喂养方式"]),
  source: z.string().min(1),
  location: z.string().min(1),
  summary: z.string().min(1),
  relationship: z.string().min(1),
});

const judgmentSchema = z.object({
  title: z.string().min(1),
  conclusion: z.string().min(1),
  reason: z.string().min(1),
  evidence_ids: z.array(z.string()),
  status: z.enum(["适合", "需调整", "待确认", "不建议"]),
});

const dimensionSchema = z.object({
  dimension: z.enum(["食材", "调味", "熟制", "质地", "大小形状", "喂养方式"]),
  conclusion: z.string().min(1),
  status: z.enum(["适合", "需调整", "待确认", "不建议"]),
  evidence_ids: z.array(z.string()),
});

export const cookingStepSchema = z.object({
  step_id: z.string().min(1),
  source_action_id: z.string().nullable(),
  title: z.string().min(1),
  start_time: timestampSchema,
  end_time: timestampSchema,
  keyframe_time: timestampSchema,
  keyframe_description: z.string().nullable(),
  image_url: z.string().nullable().optional().default(null),
  timing: z.string().nullable(),
  action: z.string().min(1),
  instruction: z.string().min(1),
  completion_check: z.string().min(1),
  personal_reminder: z.string().min(1),
  mapping_note: z.string().min(1),
  quick_actions: z.array(z.string()).max(4),
  common_questions: z.array(z.object({ question: z.string(), answer: z.string() })).max(4),
});

export const analysisResultSchema = z.object({
  宝宝版本: z.object({
    title: z.string().min(1),
    conclusion: z.string().min(1),
    conclusion_status: z.enum(["可以直接做", "调整后可以做", "需要补充信息", "暂不建议", "无法可靠判断"]),
    profile_summary: z.string().min(1),
    key_judgments: z.array(judgmentSchema).length(5),
    ingredients: z.array(z.object({ name: z.string(), amount: z.string().nullable(), preparation: z.string(), status: z.string(), evidence_ids: z.array(z.string()) })),
    dimensions: z.array(dimensionSchema).length(6).superRefine((items, context) => {
      const expected = new Set(["食材", "调味", "熟制", "质地", "大小形状", "喂养方式"]);
      items.forEach((item) => expected.delete(item.dimension));
      if (expected.size) context.addIssue({ code: "custom", message: `缺少维度：${[...expected].join("、")}` });
    }),
    feeding_check: z.array(z.string()),
  }),
  视频解析: z.object({
    title: z.string().min(1),
    summary: z.string().min(1),
    facts: videoFactPackageSchema,
    evidence: z.array(knowledgeRuleSchema),
  }),
  陪做步骤: z.array(cookingStepSchema).min(1),
});

export const analysisJobStatusSchema = z.object({
  jobId: z.string().min(1),
  status: z.enum(["queued", "parsing_video", "searching_knowledge", "generating_plan", "extracting_frames", "completed", "failed"]),
  progress: z.number().int().min(0).max(100),
  stageText: z.string().min(1),
  error: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type VideoFactPackage = z.infer<typeof videoFactPackageSchema>;
export type VideoFactAction = z.infer<typeof videoFactActionSchema>;
export type AnalysisBabyProfile = z.infer<typeof analysisBabyProfileSchema>;
export type KnowledgeRule = z.infer<typeof knowledgeRuleSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type AnalysisCookingStep = z.infer<typeof cookingStepSchema>;
export type AnalysisJobStatus = z.infer<typeof analysisJobStatusSchema>;
