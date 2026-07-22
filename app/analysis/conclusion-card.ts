import type { AnalysisResult } from "./schemas";

type BabyVersion = AnalysisResult["宝宝版本"];
type ConclusionCard = BabyVersion["conclusion_card"];

const unsupportedMechanism = /(肾脏|补铁|促进.{0,8}发育|增强.{0,8}免疫|有助于.{0,8}(?:发育|大脑)|营养丰富|很营养|帮助消化|更好消化|保护肠胃)/;
const measuredClaim = /\d+(?:\.\d+)?(?:\s*(?:[-—–至到~～]\s*\d+(?:\.\d+)?)?)\s*(?:天|小时|分钟|秒|克|g|厘米|cm|个月|岁)/gi;

function normalizeMeasure(value: string) {
  return value.toLowerCase().replace(/[—–到~～-]/g, "至").replace(/\s+/g, "");
}

function cardText(card: ConclusionCard) {
  return [card.headline, card.reassurance, ...card.adjustments, card.confirmation].join(" ");
}

function unique(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function meaningful(value: string) {
  return !/^(适合|需调整|待确认|不建议|需协助|已具备)$/.test(value.trim());
}

function describeAdjustment(item: BabyVersion["dimensions"][number]) {
  if (item.dimension === "调味") return `${item.conclusion}，保留食材本身的味道。`;
  if (item.dimension === "质地") return `${item.conclusion}，处理到宝宝现在更容易接受的软硬和颗粒大小。`;
  if (item.dimension === "大小形状") return `${item.conclusion}，避免留下明显的大块。`;
  if (item.dimension === "食材") return `${item.conclusion}，没有吃过的食材先分开少量尝试。`;
  if (item.dimension === "熟制") return `${item.conclusion}，入口前再检查实际状态。`;
  return `${item.conclusion}，喂食时根据宝宝的实际表现及时调整。`;
}

export function isConclusionCardGrounded(card: ConclusionCard, groundingSources: unknown[]) {
  const text = cardText(card);
  if (unsupportedMechanism.test(text)) return false;
  const corpus = normalizeMeasure(groundingSources.map((item) => JSON.stringify(item)).join(" "));
  const claims = text.match(measuredClaim) ?? [];
  return claims.every((claim) => corpus.includes(normalizeMeasure(claim)));
}

function fallbackHeadline(baby: BabyVersion, babyName: string) {
  if (baby.conclusion_status === "可以直接做") return `这道辅食挺适合${babyName}，可以按宝宝版来准备`;
  if (baby.conclusion_status === "调整后可以做") return `这道辅食调整一下，就更适合${babyName}了`;
  if (baby.conclusion_status === "需要补充信息") return "再确认几件小事，就能更稳妥地决定";
  if (baby.conclusion_status === "暂不建议") return "这次先缓一缓，我们换个更合适的做法";
  return "目前信息还不够，我们先不着急下结论";
}

function fallbackReassurance(baby: BabyVersion) {
  if (baby.conclusion_status === "可以直接做") return "原视频里的主要食材和做法可以保留，我们已经把它们整理成更适合宝宝操作和入口的版本。";
  if (baby.conclusion_status === "调整后可以做") return "原视频里有可以保留的食材和做法，不需要全部推翻。我们只调整真正影响入口、调味和尝试顺序的地方。";
  if (baby.conclusion_status === "需要补充信息") return "原视频里有可以参考的部分，但在关键信息确认前先不急着照做，补充清楚后再决定会更稳妥。";
  if (baby.conclusion_status === "暂不建议") return "不是你做错了，只是这份做法和宝宝现在的情况不太合适。先缓一缓，再换成更容易处理的版本。";
  return "现有信息还不足以做出可靠判断。先把宝宝的实际进食情况确认清楚，不需要急着尝试。";
}

export function stabilizeConclusionCard(baby: BabyVersion, groundingSources: unknown[]): ConclusionCard {
  if (isConclusionCardGrounded(baby.conclusion_card, groundingSources)) return baby.conclusion_card;
  const babyName = baby.title.match(/^(.+?)版[：:]?/)?.[1] || "宝宝";
  const dimensionAdjustments = baby.dimensions.filter((item) => item.status === "需调整" || item.status === "不建议").map(describeAdjustment);
  const judgmentAdjustments = baby.key_judgments.filter((item) => (item.status === "需调整" || item.status === "不建议") && meaningful(item.conclusion)).map((item) => item.conclusion);
  const adjusted = unique([...dimensionAdjustments, ...judgmentAdjustments]).slice(0, 3);
  const pending = unique([
    ...baby.dimensions.filter((item) => item.status === "待确认" && meaningful(item.conclusion)).map((item) => item.conclusion),
    ...baby.key_judgments.filter((item) => item.status === "待确认" && meaningful(item.conclusion)).map((item) => item.conclusion),
  ]).slice(0, 2);
  const confirmation = baby.feeding_check[0] || (pending.length ? pending.join("；") : "制作和喂食时观察宝宝的实际接受情况，不适应时先停下来调整");
  return {
    headline: fallbackHeadline(baby, babyName),
    reassurance: fallbackReassurance(baby),
    adjustments: adjusted.length ? adjusted : ["按照宝宝版的食材和质地准备，制作时根据宝宝的实际接受情况再做细微调整。"],
    confirmation: `${confirmation.replace(/[。；;]+$/, "")}。确认清楚后，再按宝宝版少量尝试。`,
  };
}
