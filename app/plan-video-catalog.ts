export interface PlanVideoCandidate {
  id: string;
  title: string;
  sourceLabel: string;
  duration: string;
  image: string;
  ingredients: string[];
  formats: string[];
  keywords: string[];
  note: string;
  localFile: string;
  mockFixtureId?: string;
}

export const planVideoCandidates: PlanVideoCandidate[] = [
  { id: "tomato-pork-greens-rice", title: "番茄肉酱青菜焖饭", sourceLabel: "已导入候选视频", duration: "1:28", image: "/home/inspiration/tomato-pork-greens-rice.webp", ingredients: ["番茄", "猪肉", "青菜", "米饭"], formats: ["软饭", "焖饭"], keywords: ["肉类变化", "一锅焖", "熟悉食材"], note: "肉酱和青菜拌进软饭，适合一锅完成。", localFile: "测试1.mp4", mockFixtureId: "mock-test-video-1" },
  { id: "pumpkin-beef-rice", title: "南瓜牛肉焖饭", sourceLabel: "已导入候选视频", duration: "0:26", image: "/home/inspiration/pumpkin-beef-rice.webp", ingredients: ["南瓜", "牛肉", "西蓝花", "米饭"], formats: ["软饭", "焖饭"], keywords: ["鸡肉替换", "肉类变化", "熟悉食材"], note: "南瓜软甜，牛肉切细后和米饭一起焖软。", localFile: "测试2.mp4" },
  { id: "tomato-potato-beef-rice", title: "番茄土豆牛肉焖饭", sourceLabel: "已导入候选视频", duration: "0:54", image: "/home/inspiration/tomato-potato-beef-rice.webp", ingredients: ["番茄", "土豆", "牛肉", "米饭"], formats: ["软饭", "焖饭"], keywords: ["一锅焖", "肉类变化", "熟悉食材"], note: "一锅包含主食、蔬菜和肉，适合集中备菜。", localFile: "测试3.mp4" },
  { id: "black-sesame-egg-custard", title: "黑芝麻红枣蒸蛋", sourceLabel: "已导入候选视频", duration: "0:48", image: "/home/inspiration/black-sesame-egg-custard.webp", ingredients: ["鸡蛋", "黑芝麻", "红枣", "胚芽米"], formats: ["蛋羹", "蒸"], keywords: ["提前备好", "软嫩", "加餐"], note: "蒸蛋配细腻米糊，关键是确认鸡蛋记录和熟制状态。", localFile: "测试视频4.mp4" },
  { id: "spinach-vegetable-egg-custard", title: "菠菜时蔬蛋羹", sourceLabel: "已导入候选视频", duration: "0:35", image: "/home/inspiration/spinach-vegetable-egg-custard.webp", ingredients: ["鸡蛋", "菠菜", "胡萝卜"], formats: ["蛋羹", "蒸"], keywords: ["熟悉食材", "软嫩", "快手"], note: "蔬菜切细放进蛋羹，准备和蒸制时间较短。", localFile: "测试视频5.mp4" },
  { id: "potato-apple-cake", title: "土豆苹果饼", sourceLabel: "已导入候选视频", duration: "0:48", image: "/home/inspiration/potato-apple-cake.webp", ingredients: ["土豆", "苹果", "黑芝麻"], formats: ["软饼", "手指食物"], keywords: ["提前备好", "加餐", "抓握"], note: "软糯小饼，适合需要抓握练习的计划方向。", localFile: "测试视频6.mp4" },
];

export function getPlanVideoCandidate(id: string) {
  return planVideoCandidates.find((candidate) => candidate.id === id);
}

function searchTokens(value: string) {
  return value.toLowerCase().split(/[\s、，,·]+/).map((token) => token.trim()).filter(Boolean);
}

export function searchPlanVideos(query: string) {
  const tokens = searchTokens(query);
  return planVideoCandidates
    .map((candidate) => {
      const fields = [candidate.title, ...candidate.ingredients, ...candidate.formats, ...candidate.keywords];
      const matched = tokens.filter((token) => fields.some((field) => field.toLowerCase().includes(token)));
      const score = matched.length * 10 + (tokens.some((token) => candidate.title.toLowerCase().includes(token)) ? 4 : 0);
      const reasons = [
        ...candidate.ingredients.filter((item) => tokens.some((token) => item.includes(token))),
        ...candidate.formats.filter((item) => tokens.some((token) => item.includes(token))),
        ...candidate.keywords.filter((item) => tokens.some((token) => item.includes(token))),
      ].slice(0, 3);
      return { ...candidate, score, matchReasons: reasons.length ? reasons : [candidate.formats[0], candidate.keywords[0]].filter(Boolean) };
    })
    .filter((candidate) => tokens.length === 0 || candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "zh-CN"));
}
