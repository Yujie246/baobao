import { afterEach, describe, expect, it, vi } from "vitest";
import { createAiGateway } from "../app/ai-gateway";
import { POST as synthesizeSpeech } from "../app/api/tts/route";
import { completedProfile, shrimpNoodleRecipe, suitabilityCopy } from "../app/mock-data";
import { useAppStore } from "../app/store";

describe("宝宝音色服务", () => {
  const originalSecretId = process.env.TENCENTCLOUD_SECRET_ID;
  const originalSecretKey = process.env.TENCENTCLOUD_SECRET_KEY;

  afterEach(() => {
    if (originalSecretId === undefined) delete process.env.TENCENTCLOUD_SECRET_ID;
    else process.env.TENCENTCLOUD_SECRET_ID = originalSecretId;
    if (originalSecretKey === undefined) delete process.env.TENCENTCLOUD_SECRET_KEY;
    else process.env.TENCENTCLOUD_SECRET_KEY = originalSecretKey;
    vi.unstubAllGlobals();
  });

  it("密钥只在服务端使用，并生成软萌心心男童声", async () => {
    process.env.TENCENTCLOUD_SECRET_ID = "test-id";
    process.env.TENCENTCLOUD_SECRET_KEY = "test-key";
    const tencentFetch = vi.fn().mockResolvedValue(Response.json({
      Response: { Audio: btoa(String.fromCharCode(1, 2, 3)), RequestId: "test-request" },
    }));
    vi.stubGlobal("fetch", tencentFetch);

    const response = await synthesizeSpeech(new Request("https://example.com/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "先把胡萝卜切成小块煮软" }),
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(tencentFetch).toHaveBeenCalledOnce();
    const [url, init] = tencentFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://tts.tencentcloudapi.com");
    expect(new Headers(init.headers).get("Authorization")).toContain("Credential=test-id/");
    expect(JSON.parse(String(init.body))).toMatchObject({
      Text: "先把胡萝卜切成小块煮软",
      VoiceType: 603002,
      SampleRate: 24000,
      Codec: "mp3",
    });
  });

  it("没有服务端密钥时明确降级，不向腾讯云发请求", async () => {
    delete process.env.TENCENTCLOUD_SECRET_ID;
    delete process.env.TENCENTCLOUD_SECRET_KEY;
    const tencentFetch = vi.fn();
    vi.stubGlobal("fetch", tencentFetch);

    const response = await synthesizeSpeech(new Request("https://example.com/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "测试" }),
    }));

    expect(response.status).toBe(503);
    expect(tencentFetch).not.toHaveBeenCalled();
  });
});

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

  it("完成反馈后结束陪做，并把稍后观察写回同一条记录", () => {
    useAppStore.getState().resetDemo();
    useAppStore.getState().setCookPrepared(true);
    useAppStore.getState().setFeedback({ amount: "half", acceptance: "liked", swallowing: "smooth" });
    useAppStore.getState().completeRecipe({ id: "tomato-meat-rice-demo", title: "番茄肉酱青菜软饭" });
    const completed = useAppStore.getState();
    expect(completed.cookPrepared).toBe(false);
    expect(completed.completedSteps).toEqual([]);
    expect(completed.feedback).toEqual({});
    expect(completed.history[0]).toMatchObject({ id: "tomato-meat-rice-demo", progress: "completed", feedback: { amount: "half" } });

    useAppStore.getState().saveObservation("tomato-meat-rice-demo", "normal");
    expect(useAppStore.getState().history[0].feedback?.observed).toBe("normal");
  });
});

describe("宝宝档案状态", () => {
  it("重置后要求用户明确完成三类判断", () => {
    useAppStore.getState().resetDemo();
    const profile = useAppStore.getState().profile;
    expect(profile.months).toBe(0);
    expect(profile.ageConfirmed).toBe(false);
    expect(profile.avoidStatus).toBeNull();
    expect(profile.stageConfirmed).toBe(false);
    expect(profile.feedingSignalsConfirmed).toBe(false);
  });

  it("兼容缺少新字段的旧版已完成档案", () => {
    const legacyProfile = { ...completedProfile } as Partial<typeof completedProfile>;
    delete legacyProfile.correctedMonths;
    delete legacyProfile.ageConfirmed;
    delete legacyProfile.stageConfirmed;
    delete legacyProfile.feedingSignals;
    delete legacyProfile.feedingSignalsConfirmed;
    delete legacyProfile.feedingNote;
    delete legacyProfile.avoidStatus;
    const current = useAppStore.getState();
    current.hydrate({
      profile: legacyProfile as typeof completedProfile,
      history: current.history,
      feedback: current.feedback,
      cookStep: current.cookStep,
      completedSteps: current.completedSteps,
      timerEndAt: current.timerEndAt,
      cookPrepared: current.cookPrepared,
      cookIngredientBlocked: current.cookIngredientBlocked,
      cookConversation: current.cookConversation,
      serving: current.serving,
      recipeAdjustments: current.recipeAdjustments,
      riskInterrupted: current.riskInterrupted,
    });
    const migrated = useAppStore.getState().profile;
    expect(migrated.ageConfirmed).toBe(true);
    expect(migrated.stageConfirmed).toBe(true);
    expect(migrated.feedingSignalsConfirmed).toBe(true);
    expect(migrated.avoidStatus).toBe("none");
  });
});
