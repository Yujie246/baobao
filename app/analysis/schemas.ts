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

const adaptationStatusSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const status = value.trim();
  if (["适合", "需调整", "待确认", "不建议"].includes(status)) return status;
  if (/(不建议|不适合|禁止|风险高|应避免)/.test(status)) return "不建议";
  if (/(待确认|待核实|需确认|需要确认|无法确认|不确定|未知|信息不足|缺少信息|未记录|需观察)/.test(status)) return "待确认";
  if (/(需调整|需要调整|调整后|需修改|需要修改|需注意|需要注意|需关注|有条件|部分适合|存在冲突|有风险)/.test(status)) return "需调整";
  if (/(适合|符合|通过|可接受|可行|无需调整|已具备|基本具备)/.test(status)) return "适合";
  // 状态只是展示摘要；遇到模型新措辞时采取最保守的“待确认”，不能让完整分析因一个标签失败。
  return "待确认";
}, z.enum(["适合", "需调整", "待确认", "不建议"]));

const judgmentSchema = z.object({
  title: z.string().min(1),
  conclusion: z.string().min(1),
  fact_basis: z.string().min(1),
  reason: z.string().min(1),
  evidence_ids: z.array(z.string().min(1)).min(1).max(2),
  status: adaptationStatusSchema,
});

const dimensionSchema = z.object({
  dimension: z.enum(["食材", "调味", "熟制", "质地", "大小形状", "喂养方式"]),
  conclusion: z.string().min(1),
  fact_basis: z.string().min(1),
  reason: z.string().min(1),
  status: adaptationStatusSchema,
  evidence_ids: z.array(z.string().min(1)).min(1).max(2),
});

const videoRecipeProfileSchema = z.object({
  food_type: z.string().min(1),
  dominant_texture: z.string().min(1),
  particle_composition: z.string().min(1),
  food_form: z.string().min(1),
  feeding_method: z.string().min(1),
  feeding_posture: z.string().min(1),
  final_portion: z.string().min(1),
});

const videoIngredientSchema = z.object({
  name: z.string().min(1),
  amount: z.string().nullable(),
  preparation: z.string().min(1),
  observation: z.string().min(1),
});

const requiredAbilityStatusSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  if (["适合", "已确认", "具备", "基本具备"].includes(value)) return "已具备";
  if (["未确认", "不确定", "信息不足"].includes(value)) return "待确认";
  if (["需调整", "需要协助", "需要帮助", "不具备", "暂未具备", "不适合"].includes(value)) return "需协助";
  return "待确认";
}, z.enum(["已具备", "待确认", "需协助"]));

const conclusionStatusSchema = z.preprocess((value) => {
  if (typeof value !== "string") return "无法可靠判断";
  const status = value.trim();
  if (["可以直接做", "调整后可以做", "需要补充信息", "暂不建议", "无法可靠判断"].includes(status)) return status;
  if (/(不建议|不适合|应避免|暂缓)/.test(status)) return "暂不建议";
  if (/(补充|确认|信息不足|待核实)/.test(status)) return "需要补充信息";
  if (/(调整|修改|处理后)/.test(status)) return "调整后可以做";
  if (/(直接|可以做|适合制作)/.test(status)) return "可以直接做";
  return "无法可靠判断";
}, z.enum(["可以直接做", "调整后可以做", "需要补充信息", "暂不建议", "无法可靠判断"]));

const conclusionCardSchema = z.object({
  headline: z.string().min(6).max(32),
  reassurance: z.string().min(20).max(140),
  adjustments: z.array(z.string().min(8).max(90)).min(1).max(3),
  confirmation: z.string().min(8).max(100),
});

const requiredAbilitySchema = z.object({
  title: z.string().min(1),
  requirement: z.string().min(1),
  profile_comparison: z.string().min(1),
  status: requiredAbilityStatusSchema,
  evidence_ids: z.array(z.string().min(1)).min(1).max(2),
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
    conclusion_status: conclusionStatusSchema,
    conclusion_card: conclusionCardSchema,
    profile_summary: z.string().min(1),
    key_judgments: z.array(judgmentSchema).length(5).superRefine((items, context) => {
      const expected = ["质地匹配度", "复合食材安全性", "新食材引入原则", "基础进食能力", "过敏风险排查"];
      if (items.some((item, index) => item.title !== expected[index])) context.addIssue({ code: "custom", message: `关键判断必须依次为：${expected.join("、")}` });
    }),
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
    recipe_profile: videoRecipeProfileSchema,
    recognized_ingredients: z.array(videoIngredientSchema),
    required_abilities: z.array(requiredAbilitySchema),
    evidence: z.array(knowledgeRuleSchema).default([]),
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
  insights: z.array(z.string()).optional(),
});

export type VideoFactPackage = z.infer<typeof videoFactPackageSchema>;
export type VideoFactAction = z.infer<typeof videoFactActionSchema>;
export type AnalysisBabyProfile = z.infer<typeof analysisBabyProfileSchema>;
export type KnowledgeRule = z.infer<typeof knowledgeRuleSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type AnalysisCookingStep = z.infer<typeof cookingStepSchema>;
export type AnalysisJobStatus = z.infer<typeof analysisJobStatusSchema>;
