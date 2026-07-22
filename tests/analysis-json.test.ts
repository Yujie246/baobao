import { describe, expect, it } from "vitest";
import { normalizeAnalysisEvidence, normalizeUnifiedAnalysisEvidence, parseAnalysisResult, parseUnifiedAnalysisOutput, parseVideoFacts, stripCodeFence, timestampToSeconds } from "../app/analysis/json";
import { stabilizeConclusionCard } from "../app/analysis/conclusion-card";
import { analysisResultFromUnified, getUnifiedAnalysisPlan } from "../app/analysis/unified";

const validFacts = {
  video_title: "南瓜软饭",
  duration_seconds: 30,
  summary: "把南瓜压泥后拌入软饭",
  actions: [{
    action_id: "A01",
    title: "压南瓜",
    start_time: "00:00:01",
    end_time: "00:00:08",
    keyframe_time: "00:00:05",
    keyframe_description: "勺背正在压南瓜",
    observed_action: "用勺背把熟南瓜压散",
    observed_ingredients: ["南瓜"],
    observed_tools: ["勺"],
    observed_texture: "细软",
    observed_size_shape: null,
    observed_seasoning: null,
    observed_feeding: null,
    unknowns: ["南瓜重量未说明"],
  }],
  global_unknowns: [],
};

describe("analysis JSON boundary", () => {
  it("strips markdown fences and normalizes timestamps", () => {
    const parsed = parseVideoFacts(`\`\`\`json\n${JSON.stringify(validFacts)}\n\`\`\``);
    expect(parsed.actions[0].start_time).toBe("00:00:01.000");
    expect(stripCodeFence("```json\n{}\n```")).toBe("{}");
  });

  it("rejects duplicate action IDs", () => {
    const duplicate = { ...validFacts, actions: [validFacts.actions[0], { ...validFacts.actions[0] }] };
    expect(() => parseVideoFacts(JSON.stringify(duplicate))).toThrow(/重复/);
  });

  it("rejects timestamps outside video duration", () => {
    const invalid = { ...validFacts, actions: [{ ...validFacts.actions[0], keyframe_time: "00:00:31.000" }] };
    expect(() => parseVideoFacts(JSON.stringify(invalid))).toThrow(/超出视频时长/);
  });

  it("converts canonical timestamps to seconds", () => {
    expect(timestampToSeconds("00:01:02.500")).toBe(62.5);
    expect(timestampToSeconds(null)).toBeNull();
  });

  it("requires traceable facts and rejects evidence outside the supplied Skill index", () => {
    const facts = parseVideoFacts(JSON.stringify(validFacts));
    const result = {
      宝宝版本: {
        title: "南瓜软饭宝宝版", conclusion: "调整后可尝试", conclusion_status: "调整后可以做", conclusion_card: { headline: "这道南瓜软饭调整一下会更合适", reassurance: "南瓜和软饭的搭配思路可以保留，把质地再处理细腻一些会更容易接受。", adjustments: ["把熟南瓜充分压散，再和软饭拌到没有明显硬块。"], confirmation: "确认宝宝以前吃过南瓜且没有不舒服，就可以少量尝试。" }, profile_summary: "满满 · 10个月 · 软颗粒",
        key_judgments: ["质地匹配度", "复合食材安全性", "新食材引入原则", "基础进食能力", "过敏风险排查"].map((title) => ({ title, conclusion: "需要逐项核对", fact_basis: "视频事实：可见南瓜软饭；宝宝档案：可接受软颗粒", reason: "需要结合个体能力", evidence_ids: ["E-TEX-01"], status: "待确认" })),
        ingredients: [{ name: "南瓜", amount: null, preparation: "压软", status: "宝宝版调整", evidence_ids: ["E-TEX-01"] }],
        dimensions: ["食材", "调味", "熟制", "质地", "大小形状", "喂养方式"].map((dimension) => ({ dimension, conclusion: "逐项核对", fact_basis: "视频事实与宝宝档案均已分开记录", reason: "按对应规则判断", status: "待确认", evidence_ids: ["E-TEX-01"] })),
        feeding_check: ["成人看护"],
      },
      视频解析: {
        title: "原始方案", summary: "把南瓜压泥后拌入软饭", facts,
        recipe_profile: { food_type: "主食", dominant_texture: "软饭", particle_composition: "南瓜泥", food_form: "软饭", feeding_method: "未说明", feeding_posture: "未说明", final_portion: "未说明" },
        recognized_ingredients: [{ name: "南瓜", amount: null, preparation: "压散", observation: "画面可见" }],
        required_abilities: [{ title: "吞咽软饭", requirement: "能处理软颗粒", profile_comparison: "档案待确认", status: "待确认", evidence_ids: ["E-TEX-01"] }],
        evidence: [],
      },
      陪做步骤: [{ step_id: "S01", source_action_id: "A01", title: "压南瓜", start_time: "00:00:01.000", end_time: "00:00:08.000", keyframe_time: "00:00:05.000", keyframe_description: "勺背正在压南瓜", image_url: null, timing: null, action: "压散", instruction: "压散南瓜", completion_check: "无明显硬块", personal_reminder: "现场确认质地", mapping_note: "对应 A01", quick_actions: [], common_questions: [] }],
    };
    const parsed = parseAnalysisResult(JSON.stringify(result), facts, new Set(["E-TEX-01"]));
    expect(parsed.宝宝版本.key_judgments).toHaveLength(5);
    expect(parsed.宝宝版本.conclusion_card.adjustments).toHaveLength(1);
    const unsafeBaby = structuredClone(parsed.宝宝版本);
    unsafeBaby.conclusion_card = { headline: "这道辅食调整一下会更适合宝宝", reassurance: "这份搭配很营养，可以补铁并帮助宝宝更好地发育成长。", adjustments: ["宝宝肾脏还在发育，第一次吃以后观察2-3天。"], confirmation: "确认没有不舒服以后，就可以继续尝试这份辅食。" };
    const stabilized = stabilizeConclusionCard(unsafeBaby, [facts, { months: 10 }, { summary: "每种新食物适应3至5天并观察反应" }]);
    expect(JSON.stringify(stabilized)).not.toMatch(/肾脏|补铁|2-3天/);
    const invalid = structuredClone(result);
    invalid.宝宝版本.key_judgments[0].evidence_ids = ["E-FAKE-01"];
    expect(() => parseAnalysisResult(JSON.stringify(invalid), facts, new Set(["E-TEX-01"]))).toThrow(/不存在的证据/);
    const changed = structuredClone(result);
    changed.视频解析.facts.summary = "模型改写后的事实";
    expect(() => parseAnalysisResult(JSON.stringify(changed), facts, new Set(["E-TEX-01"]))).toThrow(/改写了原视频事实包/);
    const wrongDimension = structuredClone(result);
    const dimensionIndex = new Map([["E-TEX-01", "质地"]] as const);
    expect(() => parseAnalysisResult(JSON.stringify(wrongDimension), facts, dimensionIndex)).toThrow(/食材维度引用了不属于该维度的证据/);
  });

  it("normalizes explainable ability-status synonyms from the model", () => {
    const facts = parseVideoFacts(JSON.stringify(validFacts));
    const requiredStatus = { title: "吞咽软饭", requirement: "能处理软颗粒", profile_comparison: "档案已有记录", status: "基本具备", evidence_ids: ["E-TEX-01"] };
    const base = {
      宝宝版本: {
        title: "宝宝版", conclusion: "可尝试", conclusion_status: "调整后可以做", conclusion_card: { headline: "这道辅食调整一下会更合适", reassurance: "原来的食材和烹饪思路可以保留，把质地处理得更细一些即可。", adjustments: ["把食材处理到没有明显硬块，再根据宝宝表现少量尝试。"], confirmation: "确认宝宝能够接受当前质地后，再逐渐增加食用量。" }, profile_summary: "宝宝档案",
        key_judgments: ["质地匹配度", "复合食材安全性", "新食材引入原则", "基础进食能力", "过敏风险排查"].map((title) => ({ title, conclusion: "结论", fact_basis: "事实", reason: "解释", evidence_ids: ["E-TEX-01"], status: "待确认" })),
        ingredients: [], dimensions: ["食材", "调味", "熟制", "质地", "大小形状", "喂养方式"].map((dimension) => ({ dimension, conclusion: "结论", fact_basis: "事实", reason: "解释", status: "待确认", evidence_ids: ["E-TEX-01"] })), feeding_check: [],
      },
      视频解析: { title: "原方案", summary: "摘要", facts, recipe_profile: { food_type: "主食", dominant_texture: "软", particle_composition: "软颗粒", food_form: "软饭", feeding_method: "勺喂", feeding_posture: "坐姿", final_portion: "未说明" }, recognized_ingredients: [], required_abilities: [requiredStatus], evidence: [] },
      陪做步骤: [{ step_id: "S01", source_action_id: "A01", title: "压南瓜", start_time: "00:00:01.000", end_time: "00:00:08.000", keyframe_time: "00:00:05.000", keyframe_description: "勺背正在压南瓜", image_url: null, timing: null, action: "压散", instruction: "压散", completion_check: "无硬块", personal_reminder: "确认质地", mapping_note: "对应 A01", quick_actions: [], common_questions: [] }],
    };
    expect(parseAnalysisResult(JSON.stringify(base), facts, new Set(["E-TEX-01"])).视频解析.required_abilities[0].status).toBe("已具备");
    base.宝宝版本.key_judgments[3].status = "基本适合（仍需观察）";
    expect(parseAnalysisResult(JSON.stringify(base), facts, new Set(["E-TEX-01"])).宝宝版本.key_judgments[3].status).toBe("待确认");
    base.宝宝版本.key_judgments[3].status = "谨慎尝试并结合现场表现";
    expect(parseAnalysisResult(JSON.stringify(base), facts, new Set(["E-TEX-01"])).宝宝版本.key_judgments[3].status).toBe("待确认");
  });

  it("repairs evidence references deterministically without another model call", () => {
    const raw = JSON.stringify({
      宝宝版本: {
        key_judgments: [{ evidence_ids: ["E-UNKNOWN"] }],
        ingredients: [{ evidence_ids: ["E-SEA-01"] }],
        dimensions: [{ dimension: "食材", evidence_ids: ["E-SEA-01"] }],
      },
      视频解析: { required_abilities: [{ evidence_ids: ["E-ING-01"] }] },
      陪做步骤: [{ source_action_id: "A01", mapping_note: "" }, { source_action_id: null, mapping_note: "" }],
    });
    const normalized = JSON.parse(normalizeAnalysisEvidence(raw, new Map([
      ["E-ING-01", "食材"],
      ["E-SEA-01", "调味"],
      ["E-TEX-01", "质地"],
    ])));
    expect(normalized.宝宝版本.dimensions[0].evidence_ids).toEqual(["E-ING-01"]);
    expect(normalized.宝宝版本.ingredients[0].evidence_ids).toEqual(["E-ING-01"]);
    expect(normalized.视频解析.required_abilities[0].evidence_ids).toEqual(["E-TEX-01"]);
    expect(normalized.陪做步骤[0].mapping_note).toBe("对应原视频中的这一步");
    expect(normalized.陪做步骤[1].mapping_note).toBe("宝宝版新增步骤");
  });

  it("parses one unified plan and attaches original facts server-side", () => {
    const facts = parseVideoFacts(JSON.stringify(validFacts));
    const evidence = [
      ["E-ING-01", "食材"], ["E-SEA-01", "调味"], ["E-COOK-01", "熟制"], ["E-TEX-01", "质地"], ["E-SIZE-01", "大小形状"], ["E-FEED-01", "喂养方式"],
    ].map(([evidence_id, dimension]) => ({ evidence_id, dimension, source: "测试指南", location: "测试章节", summary: "测试规则摘要", relationship: "用于测试结构化引用" })) as Parameters<typeof analysisResultFromUnified>[3];
    const evidenceIndex = new Map(evidence.map((item) => [item.evidence_id, item.dimension] as const));
    const definitions = [
      ["ingredients_allergy", "食材与过敏", "E-ING-01"], ["new_food", "新食材引入", "E-ING-01"], ["seasoning", "调味", "E-SEA-01"], ["cooking", "熟制", "E-COOK-01"], ["texture", "质地", "E-TEX-01"], ["size_shape", "大小形状", "E-SIZE-01"], ["eating_ability", "进食能力", "E-TEX-01"], ["feeding", "喂养方式", "E-FEED-01"],
    ] as const;
    const output = {
      适配方案: {
        verdict: { title: "满满版南瓜软饭", status: "调整后可以做", headline: "压得再细一点就可以尝试", summary: "原视频的南瓜和软饭可以保留，把明显硬块压散后再少量尝试。", profile_summary: "满满 · 10个月 · 软颗粒" },
        source_summary: { title: "南瓜软饭", summary: "把熟南瓜压散后拌入软饭。", recipe_profile: { food_type: "主食", dominant_texture: "软饭", particle_composition: "南瓜泥", food_form: "软饭", feeding_method: "未说明", feeding_posture: "未说明", final_portion: "未说明" } },
        checks: definitions.map(([check_id, dimension, id], index) => ({ check_id, dimension, impact: index === 4 ? "change" : "none", source_fact: "原视频展示了南瓜软饭", baby_context: "宝宝可以吃软颗粒", decision: index === 4 ? "把硬块压散" : "可以保留", action: index === 4 ? "用勺背压到没有明显硬块" : "按宝宝版步骤继续", evidence_ids: [id] })),
        ingredients: [{ name: "南瓜", source: { amount: null, preparation: "压散", observation: "画面可见" }, baby: { amount: "参考一餐少量", preparation: "压到没有明显硬块" }, decision: "调整", evidence_ids: ["E-ING-01"] }],
        steps: [{ step_id: "S01", source_action_id: "A01", title: "压南瓜", start_time: "00:00:01.000", end_time: "00:00:08.000", keyframe_time: "00:00:05.000", keyframe_description: "勺背正在压南瓜", image_url: null, timing: null, action: "压散", instruction: "压散南瓜", completion_check: "没有明显硬块", personal_reminder: "现场确认质地", mapping_note: "对应原视频中的这一步", quick_actions: [], common_questions: [] }],
        serving_checks: ["喂前确认温度和实际质地。"],
      },
    };
    const plan = parseUnifiedAnalysisOutput(normalizeUnifiedAnalysisEvidence(JSON.stringify(output), evidenceIndex), facts, evidenceIndex);
    const result = analysisResultFromUnified(plan, facts, { name: "满满", months: 10, correctedMonths: null, premature: false, stage: "软颗粒", avoidFoods: [], triedFoods: ["南瓜"], feedingSignals: [], note: "" }, evidence);
    expect(result.视频解析.facts).toEqual(facts);
    expect(result.统一方案?.checks).toHaveLength(8);
    expect(result.陪做步骤).toEqual(result.统一方案?.steps);
    expect(getUnifiedAnalysisPlan(result).ingredients[0].source.preparation).toBe("压散");
  });
});
