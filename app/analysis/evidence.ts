import type { KnowledgeRule } from "./schemas";

// 由用户提供的政策证据 SKILL.md 结构化而来。运行时只检索这些已核验卡片，不让模型编造来源。
export const POLICY_EVIDENCE: KnowledgeRule[] = [
  { evidence_id: "E-SCOPE-01", dimension: "喂养方式", source: "WS/T 678—2020 婴幼儿辅食添加营养指南", location: "范围", summary: "适用于健康足月出生的满6月龄至24月龄婴幼儿；早产及特殊医学状况仅作参考。", relationship: "限定本次规则的适用人群边界。" },
  { evidence_id: "E-ING-01", dimension: "食材", source: "WS/T 678—2020", location: "辅食种类与引入", summary: "辅食应从富含铁的泥糊状食物开始，逐步增加食物种类。", relationship: "用于判断食材组合与月龄阶段是否需要调整。" },
  { evidence_id: "E-ING-02", dimension: "食材", source: "中国居民膳食指南（2022）", location: "婴幼儿喂养准则", summary: "每次只引入一种新食物，由少到多，观察适应情况。", relationship: "用于识别同餐多种新食材带来的待确认项。" },
  { evidence_id: "E-ING-03", dimension: "食材", source: "婴幼儿辅食添加核心信息", location: "食物多样化", summary: "在适应单一食物后逐步实现谷物、蔬果、动物性食物等多样化。", relationship: "用于判断食物类别是否单一或缺失。" },
  { evidence_id: "E-ING-04", dimension: "食材", source: "WS/T 678—2020", location: "过敏与不耐受观察", summary: "添加新食物后应关注皮疹、呕吐、腹泻等异常反应。", relationship: "与宝宝回避和尝试记录联合判断。" },
  { evidence_id: "E-ING-05", dimension: "食材", source: "中国居民膳食指南（2022）", location: "高风险食物引入", summary: "高风险食物不应仅因担忧而长期延迟，但应在适宜形态下逐一引入并观察。", relationship: "避免把未尝试直接误判为禁忌。" },
  { evidence_id: "E-SEA-01", dimension: "调味", source: "WS/T 678—2020", location: "调味原则", summary: "婴儿辅食应保持原味，不额外添加盐、糖及刺激性调味品。", relationship: "用于判断视频中的盐糖和复合调味料。" },
  { evidence_id: "E-SEA-02", dimension: "调味", source: "中国居民膳食指南（2022）", location: "少盐少糖", summary: "培养清淡口味，避免高盐、高糖和重口味加工食品。", relationship: "用于给出删减或待确认调味建议。" },
  { evidence_id: "E-COOK-01", dimension: "熟制", source: "WS/T 678—2020", location: "食物安全", summary: "动物性食物及蛋类应彻底煮熟，避免生食或半生食。", relationship: "用于检查肉、蛋、水产的中心熟制。" },
  { evidence_id: "E-COOK-02", dimension: "熟制", source: "WHO Complementary feeding guideline", location: "Safe preparation and storage", summary: "辅食制作、储存和喂食应遵循清洁、安全和适时食用原则。", relationship: "用于提示生熟分开与储存边界。" },
  { evidence_id: "E-COOK-03", dimension: "熟制", source: "婴幼儿辅食添加核心信息", location: "现做现吃", summary: "辅食宜现做现吃，剩余食物应安全保存并充分加热。", relationship: "用于判断保存和复热说明。" },
  { evidence_id: "E-TEX-01", dimension: "质地", source: "WS/T 678—2020", location: "辅食质地进阶", summary: "辅食质地应从泥糊状逐步过渡到碎末状、软固体，匹配口腔运动能力。", relationship: "用于将原视频质地与宝宝档案阶段对照。" },
  { evidence_id: "E-TEX-02", dimension: "质地", source: "中国居民膳食指南（2022）", location: "质地与咀嚼训练", summary: "不能长期停留在过细泥糊，应随能力增加颗粒和软块。", relationship: "避免一味打泥造成过度降级。" },
  { evidence_id: "E-TEX-03", dimension: "质地", source: "WHO Complementary feeding guideline", location: "Food consistency", summary: "稠度应足以提供能量，同时便于婴幼儿安全进食。", relationship: "用于判断过稀、过干或难吞咽。" },
  { evidence_id: "E-TEX-04", dimension: "质地", source: "婴幼儿辅食添加核心信息", location: "能力导向", summary: "质地进阶应结合月龄、实际咀嚼吞咽表现和既往接受情况。", relationship: "宝宝真实能力优先于机械月龄标签。" },
  { evidence_id: "E-SIZE-01", dimension: "大小形状", source: "WS/T 678—2020", location: "食物性状", summary: "食物大小和形状应便于抓握、咀嚼和吞咽，避免整粒坚果等高风险形态。", relationship: "用于判断颗粒、条块和圆硬食物。" },
  { evidence_id: "E-SIZE-02", dimension: "大小形状", source: "中国居民膳食指南（2022）", location: "预防噎食", summary: "坚硬、圆滑、黏弹且不易碎的食物应切碎、压软或改变形态。", relationship: "用于生成具体切法和完成检查。" },
  { evidence_id: "E-FEED-01", dimension: "喂养方式", source: "WHO Complementary feeding guideline", location: "Responsive feeding", summary: "照护者应回应饥饱信号，鼓励但不强迫进食。", relationship: "用于判断追喂、强喂和进食节奏。" },
  { evidence_id: "E-FEED-02", dimension: "喂养方式", source: "中国居民膳食指南（2022）", location: "回应式喂养", summary: "进食时保持专注互动，减少电视、手机等干扰。", relationship: "用于判断喂食环境。" },
  { evidence_id: "E-FEED-03", dimension: "喂养方式", source: "婴幼儿辅食添加核心信息", location: "自主进食", summary: "在安全看护下鼓励自主抓握和尝试，照护者提供适度帮助。", relationship: "用于判断手抓食物与成人喂食安排。" },
  { evidence_id: "E-FEED-04", dimension: "喂养方式", source: "WS/T 678—2020", location: "喂养频次", summary: "餐次和份量应结合月龄、母乳或配方奶摄入及个体需求调整。", relationship: "避免把视频份量直接套用。" },
  { evidence_id: "E-FEED-05", dimension: "喂养方式", source: "中国居民膳食指南（2022）", location: "安全姿势", summary: "进食时保持稳定坐姿并由成人全程看护。", relationship: "用于生成喂前安全检查。" },
  { evidence_id: "E-SAFE-01", dimension: "喂养方式", source: "婴幼儿辅食添加核心信息", location: "异常反应处置", summary: "出现明显呼吸困难、持续呕吐、意识异常等严重表现应立即停止进食并及时就医。", relationship: "仅作安全边界提示，不替代医学诊断。" },
  { evidence_id: "E-PROFILE-01", dimension: "质地", source: "宝宝档案", location: "进食能力", summary: "宝宝的实际吞咽、吐出、抗拒和咀嚼表现优先于月龄推断。", relationship: "驱动个性化质地调整。" },
  { evidence_id: "E-PROFILE-02", dimension: "食材", source: "宝宝档案", location: "回避与尝试记录", summary: "已确认回避、已尝试和未记录必须分开，不得把缺失记录当作已过敏。", relationship: "驱动食材状态与待确认项。" },
];

export function searchKnowledge(): KnowledgeRule[] {
  return POLICY_EVIDENCE;
}
