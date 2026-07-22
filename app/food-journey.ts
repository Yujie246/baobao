import type { FoodId } from "./food-illustrations";

export interface FoodJourneyFood {
  id: FoodId;
  name: string;
  fallback: string;
  summary: string;
  nutrition: string[];
  preparation: string;
  allergenLevel: "common" | "general";
  allergenLabel: string;
  allergenNote: string;
}

export const foodJourneyFoods: FoodJourneyFood[] = [
  { id: "millet-porridge", name: "小米粥", fallback: "粥", summary: "口感温和的谷物类起点，便于从细腻质地开始记录。", nutrition: ["碳水化合物", "B 族维生素", "少量蛋白质"], preparation: "煮至米粒充分开花，按宝宝能力调整细腻度和稠度。", allergenLevel: "general", allergenLabel: "通常不属于常见致敏食物", allergenNote: "任何食物都可能引起个体反应，首次仍需单一、少量并记录。" },
  { id: "pumpkin", name: "南瓜", fallback: "南", summary: "自带甜味和柔软质地，适合学习新颜色和新口感。", nutrition: ["β-胡萝卜素", "膳食纤维", "碳水化合物"], preparation: "去皮去籽后蒸熟，压成与当前进食能力相匹配的质地。", allergenLevel: "general", allergenLabel: "通常不属于常见致敏食物", allergenNote: "留意皮肤、呼吸和消化道方面的新变化。" },
  { id: "potato", name: "土豆", fallback: "土", summary: "味道温和、可塑性高，可以练习从泥糊到软颗粒。", nutrition: ["碳水化合物", "钾", "维生素 C"], preparation: "去皮完全蒸熟，避免生硬块；不使用发绿或发芽部分。", allergenLevel: "general", allergenLabel: "通常不属于常见致敏食物", allergenNote: "首次尝试仍建议不和其他新食物混合。" },
  { id: "broccoli", name: "西兰花", fallback: "西", summary: "认识不同蔬菜风味，花冠和菜梗需分别处理质地。", nutrition: ["维生素 C", "叶酸", "膳食纤维"], preparation: "充分蒸软，初期取软嫩花冠；手指食物需确保能轻松压碎。", allergenLevel: "general", allergenLabel: "通常不属于常见致敏食物", allergenNote: "区分新食物反应与单纯不喜欢味道，以可观察事实为准。" },
  { id: "carrot", name: "胡萝卜", fallback: "胡", summary: "颜色明亮、熟后柔软，适合增加蔬菜的感官经验。", nutrition: ["β-胡萝卜素", "膳食纤维", "钾"], preparation: "煮或蒸至可用勺背轻松压碎，避免生硬圆片。", allergenLevel: "general", allergenLabel: "通常不属于常见致敏食物", allergenNote: "口周短暂染色不等于过敏，但如伴随凸起风团或肿胀应停止。" },
  { id: "spinach", name: "菠菜", fallback: "菠", summary: "帮助丰富叶菜类口感，重点是处理粗梗和长纤维。", nutrition: ["叶酸", "β-胡萝卜素", "维生素 C"], preparation: "充分煮软、去粗梗并切细，少量加入熟悉的主食。", allergenLevel: "general", allergenLabel: "通常不属于常见致敏食物", allergenNote: "首次尝试时保持其他食材熟悉，便于识别变化。" },
  { id: "banana", name: "香蕉", fallback: "蕉", summary: "无需烹调且质地柔软，但仍要根据能力决定压泥或分条。", nutrition: ["碳水化合物", "钾", "维生素 B6"], preparation: "选成熟香蕉，压泥或切成易抓握的大软条，不给硬圆片。", allergenLevel: "general", allergenLabel: "通常不属于常见致敏食物", allergenNote: "若宝宝已有明确食物过敏或严重湿疹，先与专业人员确认。" },
  { id: "pear", name: "梨", fallback: "梨", summary: "为水果体验增加清甜和多汁口感。", nutrition: ["水分", "膳食纤维", "碳水化合物"], preparation: "初期去皮去核后蒸软；能处理手指食物后再调整形态。", allergenLevel: "general", allergenLabel: "通常不属于常见致敏食物", allergenNote: "留意新出现的皮疹、呕吐、腹泻或呼吸变化。" },
  { id: "apple", name: "苹果", fallback: "苹", summary: "可从熟苹果泥逐步过渡到软块，对比同类水果风味。", nutrition: ["膳食纤维", "维生素 C", "碳水化合物"], preparation: "生苹果硬块有噮食风险；去皮去核蒸软后再提供。", allergenLevel: "general", allergenLabel: "通常不属于常见致敏食物", allergenNote: "若只有接触酸性食物后的平坦口周发红，也需记录形态和持续时间。" },
  { id: "egg", name: "鸡蛋", fallback: "蛋", summary: "优质蛋白质来源，也是需要明确标记的常见致敏食物。", nutrition: ["优质蛋白质", "胆碱", "铁"], preparation: "完全熟制，从少量开始；有严重湿疹或既往食物反应时先询问医生。", allergenLevel: "common", allergenLabel: "常见致敏食物", allergenNote: "不要与另一种新的潜在致敏食物同时引入；耐受后应继续规律提供。" },
  { id: "tofu", name: "豆腐", fallback: "豆", summary: "柔软的植物蛋白质来源，大豆属于需留意的常见致敏食物。", nutrition: ["植物蛋白质", "铁", "钙（取决于凝固剂）"], preparation: "选择原味豆腐并充分加热，压碎或切成易捏碎的大软条。", allergenLevel: "common", allergenLabel: "大豆属于常见致敏食物", allergenNote: "看清加工豆制品的完整配料；耐受后继续在日常饮食中提供。" },
  { id: "salmon", name: "三文鱼", fallback: "鱼", summary: "鱼类蛋白质和长链 Omega-3 脂肪酸来源，属于常见致敏食物。", nutrition: ["优质蛋白质", "DHA / Omega-3", "维生素 D"], preparation: "完全熟制、仔细去刺并压散；不提供生食或轻度熟制鱼类。", allergenLevel: "common", allergenLabel: "鱼类属于常见致敏食物", allergenNote: "首次少量、单一引入；有呼吸困难、明显肿胀或意识异常时立即求助。" },
  { id: "corn", name: "玉米", fallback: "玉", summary: "增加谷物的颜色和风味，安全重点是处理外皮和整粒形态。", nutrition: ["碳水化合物", "膳食纤维", "B 族维生素"], preparation: "不提供整粒玉米；初期打碎、过滤粗皮并煮熟。", allergenLevel: "general", allergenLabel: "通常不属于常见致敏食物", allergenNote: "食物过敏和噮食风险是两件事；即使无过敏反应，也要正确处理形态。" },
  { id: "sweet-potato", name: "红薯", fallback: "薯", summary: "柔软甜香的根茎类，可在不同质地阶段反复提供。", nutrition: ["β-胡萝卜素", "碳水化合物", "膳食纤维"], preparation: "去皮蒸透，避免干粉或黏成大团；必要时加熟悉液体调整。", allergenLevel: "general", allergenLabel: "通常不属于常见致敏食物", allergenNote: "不把排便颜色的单独变化当作过敏结论，需结合其他症状记录。" },
  { id: "avocado", name: "牛油果", fallback: "果", summary: "质地细腻、含不饱和脂肪，可以丰富能量和口感。", nutrition: ["不饱和脂肪", "叶酸", "维生素 E"], preparation: "选完全成熟的果肉，压泥或切成大软条，去净果核和外皮。", allergenLevel: "general", allergenLabel: "通常不属于常见致敏食物", allergenNote: "对乳胶等已知过敏情况需告知医生，个体之间的交叉反应需专业判断。" },
];

export const foodJourneyStages = [
  { kicker: "第 1 站", title: "温和起步", note: "先从单一食材和熟悉质地开始", foodIds: ["millet-porridge", "pumpkin", "potato"] },
  { kicker: "第 2 站", title: "绿色菜园", note: "增加蔬菜风味和颜色经验", foodIds: ["broccoli", "carrot", "spinach"] },
  { kicker: "第 3 站", title: "甜甜果园", note: "认识不同水果的水分和口感", foodIds: ["banana", "pear", "apple"] },
  { kicker: "第 4 站", title: "蛋白质朋友", note: "潜在致敏食物一次只引入一种", foodIds: ["egg", "tofu", "salmon"] },
  { kicker: "第 5 站", title: "丰富能量", note: "在已建立的记录上继续丰富", foodIds: ["corn", "sweet-potato", "avocado"] },
] as const;

export const foodObservationCheckpoints = [
  { id: 1, label: "第 1 天", title: "白天少量尝试", detail: "一次只加这一种新食物，记下吃了多少。" },
  { id: 2, label: "第 2—3 天", title: "继续观察", detail: "留意皮肤、肠胃和呼吸有没有新变化。" },
  { id: 3, label: "第 3—5 天", title: "完成本轮记录", detail: "没有可疑反应就完成探索，之后规律提供。" },
] as const;

export const possibleAllergySigns = ["明显皮疹或瘙痒", "嘴唇或面部肿胀", "反复呕吐或腹泻", "咳嗽、喘息"];
export const urgentAllergySigns = ["呼吸困难", "舌或咽喉肿胀", "意识或脸色异常"];

export function getFoodJourneyFood(foodId: string) {
  return foodJourneyFoods.find((food) => food.id === foodId);
}
