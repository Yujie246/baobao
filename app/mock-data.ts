import type { BabyProfile, HistoryRecord, Recipe } from "./types";

/**
 * MOCK DATA ONLY
 * 当前前端不调用真实模型或视频解析服务。所有业务 fixture 集中在本文件，
 * 页面组件禁止自行拼装“AI 结果”。未来接入 RemoteAiGateway 时可整体替换。
 */
export const defaultProfile: BabyProfile = {
  name: "",
  months: 0,
  premature: false,
  correctedMonths: null,
  ageConfirmed: false,
  stage: "puree",
  stageConfirmed: false,
  feedingSignals: [],
  feedingSignalsConfirmed: false,
  feedingNote: "",
  avoidStatus: null,
  avoidFoods: [],
  triedFoods: [],
  completed: false,
};

export const completedProfile: BabyProfile = {
  ...defaultProfile,
  name: "满满",
  months: 10,
  ageConfirmed: true,
  stage: "soft-lumps",
  stageConfirmed: true,
  feedingSignalsConfirmed: true,
  avoidStatus: "none",
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
    { id: 1, actionKind: "prepare", title: "准备并处理食材", instruction: "把虾仁去虾线，蔬菜切细碎，宝宝面折短备用。", detail: "虾仁处理后约 35 g；胡萝卜和西蓝花都切成容易煮软的小碎粒。", check: "食材已经洗净、分开放置。", tip: "接触生虾后的手和工具要清洗干净。" },
    { id: 2, actionKind: "mix", title: "制作虾滑", instruction: "把虾仁剁成细腻虾泥，加入蛋清，沿一个方向搅拌到黏稠。", detail: "用勺子舀起时能缓慢滑落即可，不需要额外加盐。", check: "虾泥细腻，没有明显大颗粒。", tip: "太稀时先多搅拌，不要直接加入大量淀粉。" },
    { id: 3, actionKind: "heat", title: "煮熟虾滑", instruction: "水微沸后转小火，用小勺下入虾滑，保持小块。", detail: "虾滑全部浮起后继续煮 2 分钟，确认中心熟透。", check: "切开最大一颗，中心颜色一致、没有透明感。", duration: 120, tip: "锅里剧烈翻滚会让虾滑散开。" },
    { id: 4, actionKind: "timer", title: "煮软面条和蔬菜", instruction: "放入宝宝面和胡萝卜，煮软后加入西蓝花碎。", detail: "按下计时后煮 4 分钟；不同面条需要根据包装说明和实际软硬调整。", check: "面条能被勺背轻松压断。", duration: 240, tip: "如果面条仍硬，每次加煮 1 分钟并重新检查。" },
    { id: 5, actionKind: "serve", title: "组合并放凉", instruction: "把虾滑和蔬菜面盛出，剪短面条，放至适宜入口的温度。", detail: "首次盛少量，宝宝保持坐直并由照护者全程看护。", check: "质地、长度和温度都已再次检查。", tip: "以实际质地为准，不只看计时结束。" },
  ],
};

/**
 * 内容.pdf 对应的结果页展示数据。
 * 这里把“视频事实、未知项、宝宝版调整、执行计划”分开，避免 UI 把推断伪装成事实。
 */
export const tomatoRiceAnalysis = {
  id: "tomato-meat-rice-demo",
  title: "番茄肉酱青菜软饭",
  source: "辅食视频解析",
  baby: { name: "乐乐", months: 13, stage: "泥糊阶段" },
  summary: "米饭、小米、番茄、猪肉丸和青菜焖成软饭，保留软米粒、肉末和蔬菜碎，由成人用勺喂食。",
  blockers: [
    { id: "meatball", title: "猪肉丸完整配料", detail: "确认是否还有蛋、淀粉、调味料等未展示成分" },
    { id: "history", title: "主要食材尝试记录", detail: "确认猪肉、番茄、小米和青菜是否吃过" },
    { id: "cooking", title: "熟制与调味情况", detail: "确认肉丸已经全熟，且没有未说明的调味" },
  ],
  adjustments: [
    { title: "整体再软化", detail: "增加水量，做到稠粥与软饭之间；米粒能被勺背轻松压开" },
    { title: "肉丸压成细末", detail: "避免肉块或肉团，拌入后仍要检查有没有结块" },
    { title: "青菜去粗梗切细", detail: "焯软后切细，避免长纤维；在焖煮剩余 20 分钟时加入" },
  ],
  ingredients: [
    { name: "番茄", amount: "约 1 个圣女果 / 半个大番茄", prep: "去皮、切碎", source: "视频画面识别", status: "identified" },
    { name: "猪肉丸", amount: "1 个", prep: "蒸熟、压成细末", source: "视频明确", status: "unknown" },
    { name: "大米＋小米", amount: "共 38 g", prep: "洗净、浸泡", source: "视频明确", status: "identified" },
    { name: "青菜", amount: "用量未明确", prep: "焯软、去粗梗、切细", source: "画面识别", status: "unknown" },
    { name: "食用油", amount: "用量未明确", prep: "只用于炒软番茄", source: "系统推断", status: "unknown" },
    { name: "清水", amount: "没过食材并适当增加", prep: "按最终质地调整", source: "宝宝版调整", status: "adapted" },
  ],
  differences: [
    { label: "米饭质地", original: "保留明显软饭颗粒", adapted: "稠粥与软饭之间，米粒可轻松压开" },
    { label: "猪肉丸", original: "蒸熟后压碎", adapted: "压成细末，不能保留肉团" },
    { label: "青菜", original: "焯水后切碎", adapted: "去粗梗并切得更细，避免长纤维" },
    { label: "番茄", original: "去皮切块后炒软", adapted: "充分炒软并压散，避免较大果肉块" },
    { label: "首次尝试", original: "视频未说明", adapted: "若含新食材，不在同一餐一次引入多种" },
  ],
  timing: { active: "15 分钟", machine: "60 分钟", total: "70–75 分钟" },
  phases: [
    { actionKind: "prepare", time: "0–10 分钟", title: "并行准备食材", action: "浸泡米和小米；蒸肉丸；番茄去皮切碎；青菜洗净", check: "所有生熟食材分开放置" },
    { actionKind: "mix", time: "10–15 分钟", title: "制作番茄肉酱", action: "番茄炒软压散，加入已经熟透并压细的肉末", check: "看不到明显肉团和大块番茄" },
    { actionKind: "timer", time: "第 15 分钟", title: "开始焖煮", action: "加入米、小米、番茄肉酱和水，启动 60 分钟焖煮", check: "水量比原视频略多" },
    { actionKind: "add", time: "剩余 20 分钟", title: "加入青菜", action: "青菜焯软、去粗梗、切细后加入锅中", check: "没有粗梗和长纤维" },
    { actionKind: "check_texture", time: "焖煮结束", title: "检查最终质地", action: "检查米粒、肉末和青菜；必要时继续压碎并加温水调整", check: "米粒能压开、肉末无团、青菜无长纤维" },
    { actionKind: "serve", time: "约 5 分钟", title: "放凉并喂食", action: "放到适宜入口温度，宝宝坐直，小勺少量喂食", check: "每口吞咽后再喂下一口" },
  ],
  originalFacts: [
    ["成品形态", "混合软饭，湿润黏稠，可见软颗粒"],
    ["颗粒组成", "软米粒、肉末、番茄和青菜碎"],
    ["喂食方式", "宝宝坐在餐椅，由成人用勺喂食"],
    ["成品份量", "画面估计约 200 g"],
  ],
  capabilities: ["能稳定坐直", "接受成人勺喂", "能处理软米粒和细肉末", "能将混合颗粒转移并吞咽"],
  dimensions: [
    ["食材", "需确认"], ["调味", "信息不足"], ["熟制", "需确认"], ["质地", "需调整"],
    ["大小形状", "需调整"], ["喂食方式", "基本适合"], ["新食材引入", "信息不足"], ["特殊情况", "未发现冲突"],
  ],
} as const;

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
