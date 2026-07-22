import { shrimpNoodleRecipe } from "./mock-data";
import type { BabyProfile, Recipe, Suitability } from "./types";

export interface AnalysisProgress {
  stage: "reading" | "extracting" | "comparing" | "checking" | "done";
  percent: number;
  label: string;
}

export interface AiGateway {
  analyzeVideo(url: string, profile: BabyProfile, onProgress?: (progress: AnalysisProgress) => void): Promise<Recipe>;
  answerCookingQuestion(message: string, recipe: Recipe, step: number): Promise<string>;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * MOCK ADAPTER
 * 真实 AI 接入应新增 RemoteAiGateway，并保持 AiGateway 契约不变。
 * 页面层只消费结构化 Recipe，不直接 import fixture 或拼接 Prompt。
 */
export class MockAiGateway implements AiGateway {
  constructor(private readonly forcedSuitability: Suitability = "adapted") {}

  async analyzeVideo(_url: string, _profile: BabyProfile, onProgress?: (progress: AnalysisProgress) => void) {
    const stages: AnalysisProgress[] = [
      { stage: "reading", percent: 16, label: "正在读取视频信息…" },
      { stage: "extracting", percent: 38, label: "正在整理食材和步骤…" },
      { stage: "comparing", percent: 66, label: "正在与满满的档案对照…" },
      { stage: "checking", percent: 88, label: "正在检查未知信息…" },
      { stage: "done", percent: 100, label: "宝宝版本整理好了" },
    ];
    for (const stage of stages) {
      onProgress?.(stage);
      await wait(stage.stage === "done" ? 160 : 320);
    }
    return { ...shrimpNoodleRecipe, suitability: this.forcedSuitability };
  }

  async answerCookingQuestion(message: string) {
    await wait(420);
    if (/西蓝花|青菜|蔬菜/.test(message)) {
      return "可以不放西蓝花，或换成满满已经尝试过的胡萝卜。替换后仍要切细碎并煮到勺背能轻松压开。";
    }
    if (/硬|没熟|夹生/.test(message)) {
      return "先不要盛出。继续小火煮 1 分钟，再用勺背检查；如果仍然压不断，就再加煮 1 分钟。以实际软硬为准。";
    }
    if (/红|肿|吐|喘|异常/.test(message)) {
      return "先停止喂食并观察宝宝情况。若出现呼吸困难、明显肿胀、精神状态异常或症状快速加重，请立即寻求紧急医疗帮助。这里不继续普通做饭步骤。";
    }
    return "我已经记下这个变化。请先完成当前步骤的质地检查；如果告诉我具体缺少什么或哪里和预期不同，我会给出更明确的下一步。";
  }
}

export const createAiGateway = (suitability: Suitability = "adapted"): AiGateway =>
  new MockAiGateway(suitability);
