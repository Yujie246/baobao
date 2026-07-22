import { describe, expect, it, vi } from "vitest";
import { createAiGateway } from "../app/ai-gateway";
import { completedProfile, shrimpNoodleRecipe, suitabilityCopy } from "../app/mock-data";
import { useAppStore } from "../app/store";

describe("Mock AI Gateway", () => {
  it("按契约返回指定结论并发出完整进度", async () => {
    vi.useFakeTimers();
    const progress: number[] = [];
    const pending = createAiGateway("direct").analyzeVideo("https://example.com/video", completedProfile, (event) => progress.push(event.percent));
    await vi.runAllTimersAsync();
    const result = await pending;
    expect(result.suitability).toBe("direct");
    expect(progress).toEqual([16, 38, 66, 88, 100]);
    vi.useRealTimers();
  });

  it("对三类现场变化返回不同的下一步", async () => {
    vi.useFakeTimers();
    const gateway = createAiGateway();
    const replacement = gateway.answerCookingQuestion("没有西蓝花", shrimpNoodleRecipe, 2);
    const texture = gateway.answerCookingQuestion("面条还是很硬", shrimpNoodleRecipe, 4);
    const risk = gateway.answerCookingQuestion("宝宝出现红肿异常", shrimpNoodleRecipe, 5);
    await vi.runAllTimersAsync();
    expect(await replacement).toContain("胡萝卜");
    expect(await texture).toContain("继续小火煮 1 分钟");
    expect(await risk).toContain("停止喂食");
    vi.useRealTimers();
  });
});

describe("主演示 fixture", () => {
  it("保持 10 月龄宝宝虾滑面完整故事", () => {
    expect(completedProfile.months).toBe(10);
    expect(shrimpNoodleRecipe.title).toBe("宝宝虾滑面");
    expect(shrimpNoodleRecipe.ingredients.length).toBeGreaterThanOrEqual(5);
    expect(shrimpNoodleRecipe.steps).toHaveLength(5);
    expect(shrimpNoodleRecipe.steps.filter((step) => step.duration)).toHaveLength(2);
  });

  it("五级结论都有可展示文案", () => {
    expect(Object.keys(suitabilityCopy).sort()).toEqual(["adapted", "direct", "needs-info", "not-recommended", "uncertain"].sort());
  });
});

describe("菜单保存", () => {
  it("把宝宝虾滑面写入本机记录且不重复", () => {
    useAppStore.getState().resetDemo();
    useAppStore.getState().saveRecipe();
    useAppStore.getState().saveRecipe();
    const saved = useAppStore.getState().history.filter((item) => item.id === "shrimp-noodle-demo");
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ recipeTitle: "宝宝虾滑面", progress: "saved", conclusion: "adapted" });
  });
});
