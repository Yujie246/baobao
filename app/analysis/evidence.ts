import type { AnalysisBabyProfile, KnowledgeRule } from "./schemas";

// 来自用户提供的 infant-feeding-cn-evidence Skill。这里保存稳定观点索引；模型只能引用 ID，不能改写证据。
export const POLICY_EVIDENCE: KnowledgeRule[] = [
  { evidence_id: "E-SCOPE-01", dimension: "喂养方式", source: "WS/T 678—2020《婴幼儿辅食添加营养指南》", location: "第1章“范围”，PDF第3页", summary: "标准适用于健康足月出生、满6至24月龄婴幼儿的辅食添加指导。", relationship: "限定规则直接适用的人群；早产、特殊疾病或范围外月龄只能参照。" },
  { evidence_id: "E-SCOPE-02", dimension: "喂养方式", source: "《托育机构婴幼儿喂养与营养指南（试行）》；WS/T 821—2023", location: "两份文件的“适用范围/范围”", summary: "两份文件面向为3岁以下婴幼儿提供托育服务的机构。", relationship: "家庭场景只参照喂养、看护和操作原则，不套用机构管理要求。" },
  { evidence_id: "E-ING-01", dimension: "食材", source: "WS/T 678—2020《婴幼儿辅食添加营养指南》", location: "3.2，PDF第3页", summary: "辅食种类由单一到多样，每种新食物由少到多，适应3至5天并观察反应。", relationship: "用于判断同餐多种新食材是否需要拆分引入；未知尝试史只能待确认。" },
  { evidence_id: "E-ING-02", dimension: "食材", source: "《中国婴幼儿喂养指南（2022）》；《托育机构婴幼儿喂养与营养指南（试行）》", location: "7至24月龄指南准则1；第一部分第2条第（1）项", summary: "满6月龄开始添加辅食时，可从肉泥、肝泥、强化铁婴儿谷粉等富铁泥糊状食物开始。", relationship: "用于核对辅食初期是否关注富铁食物，不用于断言单餐营养完整。" },
  { evidence_id: "E-ING-03", dimension: "食材", source: "WS/T 678—2020；《托育机构婴幼儿喂养与营养指南（试行）》", location: "WS/T 678 3.2及附录A；托育指南第一部分第2条第（4）项", summary: "辅食应逐步覆盖多类食物，逐步达到每日七类常见食物中的四类及以上。", relationship: "只用于描述本餐覆盖的食物类别，不从单条视频推断全天膳食。" },
  { evidence_id: "E-ING-04", dimension: "食材", source: "WS/T 821—2023《托育机构质量评估标准》", location: "7.3.3；附录A PDF第40页", summary: "明确食物过敏和特殊需求应记录、回避相应食物，并提供替代食物。", relationship: "必须与宝宝已知过敏史结合，不能因视频出现常见过敏原直接判定过敏。" },
  { evidence_id: "E-ING-05", dimension: "食材", source: "《中国婴幼儿喂养指南（2022）》", location: "7至24月龄指南准则2", summary: "及时引入多样化食物，不盲目回避易过敏食物。", relationship: "避免把未尝试误写成禁忌；首次引入仍需结合健康状况和既往反应。" },
  { evidence_id: "E-SEA-01", dimension: "调味", source: "WS/T 678—2020《婴幼儿辅食添加营养指南》", location: "5.3，PDF第5页", summary: "辅食保持原味，12月龄内不宜添加盐、糖及刺激性调味品。", relationship: "用于核对视频明确出现的调味；复合食品配料未知时只能待确认。" },
  { evidence_id: "E-SEA-02", dimension: "调味", source: "WS/T 678—2020；《托育机构婴幼儿喂养与营养指南（试行）》", location: "WS/T 678 5.3；托育指南第二部分第1条第（5）项", summary: "1岁后可逐步尝试淡口味膳食，仍应少盐、少糖、少调味品。", relationship: "用于1岁后调味判断，但不把“可以尝试”解释为必须添加。" },
  { evidence_id: "E-COOK-01", dimension: "熟制", source: "WS/T 678—2020《婴幼儿辅食添加营养指南》", location: "5.2，PDF第5页", summary: "制作过程应清洁卫生、生熟分开，需要熟制的辅食应煮熟煮透。", relationship: "视频只展示表面状态时必须保留内部熟度无法确认，不能凭外观判定。" },
  { evidence_id: "E-COOK-02", dimension: "熟制", source: "WS/T 678—2020《婴幼儿辅食添加营养指南》", location: "5.4，PDF第5页", summary: "蔬菜先洗后切，辅食烹调宜以蒸、煮为主，尽量减少煎、炸。", relationship: "用于比较烹调方式，不等于所有煎制食物都不可执行。" },
  { evidence_id: "E-COOK-03", dimension: "熟制", source: "WS/T 678—2020《婴幼儿辅食添加营养指南》", location: "5.2，PDF第5页", summary: "制作好的辅食应及时食用；未及时食用应妥善保存并尽早食用。", relationship: "用于保存边界提示；视频未说明时不补写具体时长或温度。" },
  { evidence_id: "E-TEX-01", dimension: "质地", source: "WS/T 678—2020《婴幼儿辅食添加营养指南》", location: "3.4，PDF第4页", summary: "辅食质地应由稀到稠、由细到粗，逐步增加硬度和颗粒大小。", relationship: "要求把视频成品质地与宝宝当前可接受质地和处理表现逐项对照。" },
  { evidence_id: "E-TEX-02", dimension: "质地", source: "WS/T 678—2020《婴幼儿辅食添加营养指南》", location: "4.1.4至4.1.5，PDF第4页", summary: "6至8月龄可由泥糊逐渐到碎末，质地达到可用舌头压碎、类似软豆腐。", relationship: "提供阶段参照，但仍须核对宝宝是否进入相应质地阶段。" },
  { evidence_id: "E-TEX-03", dimension: "质地", source: "WS/T 678—2020《婴幼儿辅食添加营养指南》", location: "4.2.4至4.2.5，PDF第4至5页", summary: "9至12月龄可逐步尝试碎块状和指状食物，质地可用牙床压碎、类似香蕉。", relationship: "用于对照碎块和手抓食物；能力未知时必须提出待确认项。" },
  { evidence_id: "E-TEX-04", dimension: "质地", source: "WS/T 678—2020《婴幼儿辅食添加营养指南》", location: "4.3.4至4.3.5，PDF第5页", summary: "1至2岁可逐步使用块状、指状及可手抓食物，必要时切碎或捣碎。", relationship: "提供1至2岁质地参照，不替代实际咀嚼能力核对。" },
  { evidence_id: "E-SIZE-01", dimension: "大小形状", source: "WS/T 678—2020《婴幼儿辅食添加营养指南》", location: "附录A.2，PDF第6页", summary: "应避免可能造成哽噎的大块食物，不给婴幼儿整粒花生、腰果等坚果。", relationship: "结合画面尺寸、软硬度和宝宝能力判断；尺寸不清时写无法确认。" },
  { evidence_id: "E-SIZE-02", dimension: "大小形状", source: "WS/T 821—2023《托育机构质量评估标准》", location: "7.3.2；附录A PDF第40页", summary: "食物应软烂合适，食材加工大小符合婴幼儿发育特点。", relationship: "在家庭场景作原则参照，并与宝宝档案做个体化对照。" },
  { evidence_id: "E-FEED-01", dimension: "喂养方式", source: "WS/T 678—2020；《中国婴幼儿喂养指南（2022）》", location: "WS/T 678 3.7，PDF第4页；7至24月龄指南准则5", summary: "为保证安全，婴幼儿进食时须有成年人看护。", relationship: "视频未展示实际喂养时，只能写成人看护情况无法确认。" },
  { evidence_id: "E-FEED-02", dimension: "喂养方式", source: "WS/T 678—2020；《中国婴幼儿喂养指南（2022）》", location: "WS/T 678 3.5，PDF第4页；7至24月龄指南准则4", summary: "喂养者应回应饥饿和饱足信号，耐心鼓励但不强迫进食。", relationship: "没有喂养画面时不得推断家庭是否做到回应式喂养。" },
  { evidence_id: "E-FEED-03", dimension: "喂养方式", source: "WS/T 678—2020；WS/T 821—2023", location: "WS/T 678 3.5；WS/T 821 6.2.3及附录A PDF第31页", summary: "应根据月龄和发展水平，鼓励并协助婴幼儿逐步自主进食。", relationship: "用于判断手抓或餐具进食要求；自主进食不等于无人看护。" },
  { evidence_id: "E-FEED-04", dimension: "喂养方式", source: "《中国婴幼儿喂养指南（2022）》", location: "7至24月龄指南准则4", summary: "进餐时不看电视、不玩玩具，每次进餐时间不超过20分钟。", relationship: "视频未展示完整进餐过程时，不评价实际时长或环境。" },
  { evidence_id: "E-FEED-05", dimension: "喂养方式", source: "《托育机构婴幼儿喂养与营养指南（试行）》", location: "第一部分第2条第（3）项及第4条", summary: "食物质地应匹配咀嚼吞咽能力，并逐步学习移动、咀嚼和吞咽食物。", relationship: "只识别食物提出的能力要求，不能凭月龄断言宝宝已经具备。" },
  { evidence_id: "E-SAFE-01", dimension: "熟制", source: "WS/T 678—2020《婴幼儿辅食添加营养指南》", location: "3.7、5.1至5.2，PDF第4至5页", summary: "应使用清洁安全卫生的食材和餐具，原料新鲜，生食水果清洗干净。", relationship: "画面未展示清洗或来源时写无法确认，不自行补写步骤。" },
  { evidence_id: "E-PROFILE-01", dimension: "食材", source: "WS/T 821—2023《托育机构质量评估标准》", location: "附录A 7.2.2，PDF第38页", summary: "健康档案包括既往疾病史、过敏史和定期体检等记录。", relationship: "家庭产品可将过敏史作为必要信息收集原则，但不要求机构式完整档案。" },
  { evidence_id: "E-PROFILE-02", dimension: "喂养方式", source: "WS/T 821—2023《托育机构质量评估标准》", location: "6.3.1，PDF第6页", summary: "喂养和支持方案应同时考虑月龄、实际发展情况和个体差异。", relationship: "说明不能只按月龄下结论，仍须依赖宝宝实际能力信息。" },
];

export function searchKnowledge(): KnowledgeRule[] {
  return POLICY_EVIDENCE;
}

export function searchKnowledgeForProfile(profile: AnalysisBabyProfile): KnowledgeRule[] {
  const textureId = profile.months <= 8 ? "E-TEX-02" : profile.months <= 12 ? "E-TEX-03" : "E-TEX-04";
  const seasoningId = profile.months < 12 ? "E-SEA-01" : "E-SEA-02";
  const ids = new Set([
    "E-SCOPE-01",
    "E-ING-01",
    "E-ING-04",
    "E-ING-05",
    seasoningId,
    "E-COOK-01",
    "E-SAFE-01",
    "E-TEX-01",
    textureId,
    "E-SIZE-01",
    "E-SIZE-02",
    "E-FEED-01",
    "E-FEED-02",
    "E-PROFILE-02",
  ]);
  return POLICY_EVIDENCE.filter((item) => ids.has(item.evidence_id));
}
