import type { BabyProfile, HistoryRecord, Recipe } from "./types";

/**
 * MOCK DATA ONLY
 * 当前前端不调用真实模型或视频解析服务。所有业务 fixture 集中在本文件，
 * 页面组件禁止自行拼装“AI 结果”。未来接入 RemoteAiGateway 时可整体替换。
 */
export const defaultProfile: BabyProfile = {
  name: "满满",
  months: 10,
  premature: false,
  stage: "soft-lumps",
  avoidFoods: [],
  triedFoods: ["鸡蛋", "面粉", "胡萝卜", "西蓝花"],
  completed: false,
};

export const completedProfile: BabyProfile = {
  ...defaultProfile,
  completed: true,
};

export const shrimpNoodleRecipe: Recipe = {
  id: "shrimp-noodle-demo",
  title: "宝宝虾滑面",
  source: "抖音演示视频",
  duration: "约 25 分钟",
  serving: 1,
  suitability: "adapted",
  summary:
    "视频里的基础做法可以整理成宝宝版本，但满满还没有直接吃过虾。演示方案已把面条调整得更软、更短，并去掉视频中没有确认清楚的调味信息。",
  ingredients: [
    { id: "shrimp", name: "鲜虾仁", amount: "35 g", icon: "虾", status: "untried", note: "满满尚未尝试，制作前需要确认", source: "视频明确" },
    { id: "noodle", name: "宝宝面", amount: "20 g", icon: "面", status: "tried", note: "煮软后剪成约 1 cm", source: "演示调整" },
    { id: "egg", name: "蛋清", amount: "5 g", icon: "蛋", status: "tried", note: "用于帮助虾滑成形", source: "画面识别", optional: true },
    { id: "carrot", name: "胡萝卜", amount: "10 g", icon: "胡", status: "tried", note: "切细碎并充分煮软", source: "视频明确" },
    { id: "broccoli", name: "西蓝花", amount: "8 g", icon: "西", status: "tried", note: "只取软嫩花冠，切碎", source: "视频明确", optional: true },
  ],
  adjustments: [
    { title: "先确认虾的尝试情况", reason: "虾是这份菜谱里唯一尚未记录的主要食材", tone: "pink" },
    { title: "面条煮软并剪短", reason: "匹配满满当前能处理软颗粒的阶段", tone: "yellow" },
    { title: "不加入未确认调味料", reason: "视频没有说明具体成分与用量", tone: "mint" },
  ],
  steps: [
    { id: 1, title: "准备并处理食材", instruction: "把虾仁去虾线，蔬菜切细碎，宝宝面折短备用。", detail: "虾仁处理后约 35 g；胡萝卜和西蓝花都切成容易煮软的小碎粒。", check: "食材已经洗净、分开放置。", tip: "接触生虾后的手和工具要清洗干净。" },
    { id: 2, title: "制作虾滑", instruction: "把虾仁剁成细腻虾泥，加入蛋清，沿一个方向搅拌到黏稠。", detail: "用勺子舀起时能缓慢滑落即可，不需要额外加盐。", check: "虾泥细腻，没有明显大颗粒。", tip: "太稀时先多搅拌，不要直接加入大量淀粉。" },
    { id: 3, title: "煮熟虾滑", instruction: "水微沸后转小火，用小勺下入虾滑，保持小块。", detail: "虾滑全部浮起后继续煮 2 分钟，确认中心熟透。", check: "切开最大一颗，中心颜色一致、没有透明感。", duration: 120, tip: "锅里剧烈翻滚会让虾滑散开。" },
    { id: 4, title: "煮软面条和蔬菜", instruction: "放入宝宝面和胡萝卜，煮软后加入西蓝花碎。", detail: "按下计时后煮 4 分钟；不同面条需要根据包装说明和实际软硬调整。", check: "面条能被勺背轻松压断。", duration: 240, tip: "如果面条仍硬，每次加煮 1 分钟并重新检查。" },
    { id: 5, title: "组合并放凉", instruction: "把虾滑和蔬菜面盛出，剪短面条，放至适宜入口的温度。", detail: "首次盛少量，宝宝保持坐直并由照护者全程看护。", check: "质地、长度和温度都已再次检查。", tip: "以实际质地为准，不只看计时结束。" },
  ],
};

export const initialHistory: HistoryRecord[] = [
  { id: "pumpkin", recipeTitle: "南瓜鸡肉软饭", conclusion: "direct", date: "昨天", progress: "completed", feedback: { amount: "half", acceptance: "liked", swallowing: "smooth" } },
  { id: "tomato", recipeTitle: "番茄牛肉碎碎面", conclusion: "adapted", date: "7 月 18 日", progress: "saved" },
];

export const demoLink = "https://v.douyin.com/baby-noodle-demo/";

export const suitabilityCopy = {
  direct: { label: "可以直接做", title: "没有发现需要调整的地方", className: "safe" },
  adapted: { label: "调整后可以做", title: "有 3 处需要按宝宝情况调整", className: "adapted" },
  "needs-info": { label: "需要补充信息", title: "还差 1 个会改变判断的信息", className: "attention" },
  "not-recommended": { label: "暂不建议", title: "当前档案下不建议照着视频做", className: "danger" },
  uncertain: { label: "无法可靠判断", title: "视频信息不足，不能生成确定结论", className: "muted" },
} as const;
