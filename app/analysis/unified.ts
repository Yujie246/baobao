import { analysisResultSchema, type AnalysisBabyProfile, type AnalysisResult, type KnowledgeRule, type UnifiedAnalysisPlan, type VideoFactPackage } from "./schemas";

const checkDefinitions = [
  ["ingredients_allergy", "食材与过敏", "食材"],
  ["new_food", "新食材引入", "食材"],
  ["seasoning", "调味", "调味"],
  ["cooking", "熟制", "熟制"],
  ["texture", "质地", "质地"],
  ["size_shape", "大小形状", "大小形状"],
  ["eating_ability", "进食能力", "质地"],
  ["feeding", "喂养方式", "喂养方式"],
] as const;

type UnifiedCheck = UnifiedAnalysisPlan["checks"][number];

function legacyStatus(impact: UnifiedCheck["impact"]) {
  return impact === "none" ? "适合" as const : impact === "change" ? "需调整" as const : impact === "block" ? "不建议" as const : "待确认" as const;
}

function impactFromLegacy(status: string): UnifiedCheck["impact"] {
  if (status === "适合" || status === "已具备") return "none";
  if (status === "不建议" || status === "需协助") return "block";
  if (status === "需调整") return "change";
  return "confirm";
}

function byId(plan: UnifiedAnalysisPlan, id: UnifiedCheck["check_id"]) {
  return plan.checks.find((item) => item.check_id === id)!;
}

function nonEmpty(value: string, fallback: string) {
  return value.trim() || fallback;
}

function cardText(value: string, fallback: string, max: number) {
  const text = value.trim().length >= 8 ? value.trim() : `${value.trim()}，${fallback}`;
  return text.slice(0, max);
}

function splitLegacyFact(value: string, fallbackContext: string) {
  const match = value.match(/(?:视频事实|从视频看)[：:]\s*(.*?)(?:；|;)\s*(?:宝宝档案|结合宝宝档案)[：:]\s*(.*)$/);
  return match ? { sourceFact: match[1], babyContext: match[2] } : { sourceFact: value, babyContext: fallbackContext };
}

export function analysisResultFromUnified(plan: UnifiedAnalysisPlan, facts: VideoFactPackage, profile: AnalysisBabyProfile, evidence: KnowledgeRule[]): AnalysisResult {
  const judgmentSources = [
    ["质地匹配度", byId(plan, "texture")],
    ["复合食材安全性", byId(plan, "ingredients_allergy")],
    ["新食材引入原则", byId(plan, "new_food")],
    ["基础进食能力", byId(plan, "eating_ability")],
    ["过敏风险排查", byId(plan, "ingredients_allergy")],
  ] as const;
  const dimensionSources = [
    ["食材", byId(plan, "ingredients_allergy")],
    ["调味", byId(plan, "seasoning")],
    ["熟制", byId(plan, "cooking")],
    ["质地", byId(plan, "texture")],
    ["大小形状", byId(plan, "size_shape")],
    ["喂养方式", byId(plan, "feeding")],
  ] as const;
  const changes = plan.checks.filter((item) => item.impact !== "none").map((item) => nonEmpty(item.action, item.decision));
  const confirmation = plan.checks.find((item) => item.impact === "confirm")?.action || plan.serving_checks[0];
  const ability = byId(plan, "eating_ability");
  const result = {
    统一方案: plan,
    宝宝版本: {
      title: plan.verdict.title,
      conclusion: plan.verdict.summary,
      conclusion_status: plan.verdict.status,
      conclusion_card: {
        headline: plan.verdict.headline,
        reassurance: (plan.verdict.summary.length >= 20 ? plan.verdict.summary : `${plan.verdict.summary}。下面已经整理成可以直接照着做的宝宝版。`).slice(0, 140),
        adjustments: (changes.length ? changes : ["按原视频做法制作，喂前再检查实际质地是否容易压碎和吞咽。"]).slice(0, 3).map((item) => cardText(item, "按宝宝版处理后再继续", 90)),
        confirmation: cardText(confirmation || "喂之前再确认成品质地、温度和宝宝当下状态", "合适后再开始", 100),
      },
      profile_summary: plan.verdict.profile_summary,
      key_judgments: judgmentSources.map(([title, check]) => ({ title, conclusion: check.decision, fact_basis: `${check.source_fact}；${check.baby_context}`, reason: check.action, evidence_ids: check.evidence_ids, status: legacyStatus(check.impact) })),
      ingredients: plan.ingredients.map((item) => ({ name: item.name, amount: item.baby.amount, preparation: item.baby.preparation, status: item.decision, evidence_ids: item.evidence_ids })),
      dimensions: dimensionSources.map(([dimension, check]) => ({ dimension, conclusion: check.decision, fact_basis: `${check.source_fact}；${check.baby_context}`, reason: check.action, status: legacyStatus(check.impact), evidence_ids: check.evidence_ids })),
      feeding_check: plan.serving_checks,
    },
    视频解析: {
      title: plan.source_summary.title,
      summary: plan.source_summary.summary,
      facts,
      recipe_profile: plan.source_summary.recipe_profile,
      recognized_ingredients: plan.ingredients.filter((item) => item.source.observation !== "原视频未出现").map((item) => ({ name: item.name, ...item.source })),
      required_abilities: [{ title: "吃这道辅食需要的能力", requirement: ability.source_fact, profile_comparison: ability.baby_context, status: ability.impact === "none" ? "已具备" as const : ability.impact === "change" ? "需协助" as const : "待确认" as const, evidence_ids: ability.evidence_ids }],
      evidence,
    },
    陪做步骤: plan.steps,
  };
  return analysisResultSchema.parse(result);
}

export function getUnifiedAnalysisPlan(result: AnalysisResult): UnifiedAnalysisPlan {
  if (result.统一方案) return result.统一方案;
  const baby = result.宝宝版本;
  const video = result.视频解析;
  const dimensions = new Map(baby.dimensions.map((item) => [item.dimension, item]));
  const judgments = new Map(baby.key_judgments.map((item) => [item.title, item]));
  const ability = video.required_abilities[0];
  const evidenceFallback = (dimension: KnowledgeRule["dimension"]) => video.evidence.find((item) => item.dimension === dimension)?.evidence_id;
  const checks = checkDefinitions.map(([check_id, dimension, legacyDimension]) => {
    const source = check_id === "new_food" ? judgments.get("新食材引入原则")
      : check_id === "eating_ability" ? ability || judgments.get("基础进食能力")
      : check_id === "ingredients_allergy" ? judgments.get("复合食材安全性") || dimensions.get("食材")
      : dimensions.get(legacyDimension);
    const ids = source?.evidence_ids?.length ? source.evidence_ids : [evidenceFallback(legacyDimension)].filter((id): id is string => Boolean(id));
    const conclusion = "conclusion" in (source || {}) ? (source as { conclusion: string }).conclusion : ability?.requirement || "旧结果没有单独保存这项结论";
    const factBasis = "fact_basis" in (source || {}) ? (source as { fact_basis: string }).fact_basis : ability?.requirement || "原视频未单独整理";
    const reason = "reason" in (source || {}) ? (source as { reason: string }).reason : ability?.profile_comparison || "宝宝档案未单独确认";
    const { sourceFact, babyContext } = splitLegacyFact(factBasis, reason);
    const status = source?.status || "待确认";
    return { check_id, dimension, impact: impactFromLegacy(status), source_fact: sourceFact, baby_context: babyContext, decision: conclusion, action: reason, evidence_ids: ids } as UnifiedCheck;
  });
  const sourceIngredients = new Map(video.recognized_ingredients.map((item) => [item.name, item]));
  const babyIngredients = new Map(baby.ingredients.map((item) => [item.name, item]));
  const ingredientNames = [...new Set([...sourceIngredients.keys(), ...babyIngredients.keys()])];
  return {
    verdict: { title: baby.title, status: baby.conclusion_status, headline: baby.conclusion_card.headline, summary: baby.conclusion_card.reassurance, profile_summary: baby.profile_summary },
    source_summary: { title: video.title, summary: video.summary, recipe_profile: video.recipe_profile },
    checks,
    ingredients: ingredientNames.map((name) => {
      const source = sourceIngredients.get(name);
      const adapted = babyIngredients.get(name);
      return {
        name,
        source: { amount: source?.amount ?? null, preparation: source?.preparation || "原视频未说明", observation: source?.observation || "原视频未出现" },
        baby: { amount: adapted?.amount ?? null, preparation: adapted?.preparation || "宝宝版未单独说明" },
        decision: !adapted ? "待确认" : /移除/.test(adapted.status) ? "移除" : /待确认/.test(adapted.status) ? "待确认" : /调整/.test(adapted.status) ? "调整" : "保留",
        evidence_ids: adapted?.evidence_ids?.length ? adapted.evidence_ids : [evidenceFallback("食材")].filter((id): id is string => Boolean(id)),
      };
    }),
    steps: result.陪做步骤,
    serving_checks: baby.feeding_check.length ? baby.feeding_check : ["喂前确认食物温度、实际质地和宝宝当下状态。"],
  };
}
