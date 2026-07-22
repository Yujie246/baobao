import { afterEach, describe, expect, it, vi } from "vitest";
import { createAiGateway } from "../app/ai-gateway";
import { cookingStepTimerSeconds } from "../app/analysis/timing";
import { POST as synthesizeSpeech } from "../app/api/tts/route";
import { completedProfile, shrimpNoodleRecipe, suitabilityCopy } from "../app/mock-data";
import { useAppStore } from "../app/store";
import { childVoiceTts } from "../app/tts-gateway";
import { foodJourneyFoods } from "../app/food-journey";

describe("陪做步骤计时判断", () => {
  const step = { title: "焖煮软饭", action: "焖煮", instruction: "盖盖焖煮到软烂", timing: "约 15-20 分钟", timer_seconds: null };

  it("对需要等待的步骤使用保守时间上限", () => {
    expect(cookingStepTimerSeconds(step)).toBe(20 * 60);
    expect(cookingStepTimerSeconds({ ...step, title: "少油慢煎", action: "煎", timing: "每面 2-3 分钟" })).toBe(3 * 60);
  });

  it("即时处理不显示计时器，并优先使用模型给出的结构化时长", () => {
    expect(cookingStepTimerSeconds({ ...step, title: "切碎苹果", action: "切碎", instruction: "切成小碎末", timing: "即时" })).toBeNull();
    expect(cookingStepTimerSeconds({ ...step, timer_seconds: 600 })).toBe(600);
  });
});

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

  it("腾讯云音频不可用时改用设备中文语音", async () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    vi.stubGlobal("window", {
      setTimeout,
      clearTimeout,
      speechSynthesis: {
        getVoices: () => [{ name: "Ting-Ting", lang: "zh-CN", localService: true }],
        speak,
        cancel,
      },
    });
    vi.stubGlobal("SpeechSynthesisUtterance", class {
      lang = "";
      voice: unknown = null;
      rate = 1;
      pitch = 1;
      constructor(public text: string) {}
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "宝宝音色尚未配置" }, { status: 503 })));

    await expect(childVoiceTts.speak("先把胡萝卜切细")).resolves.toBe("system");
    expect(speak).toHaveBeenCalledOnce();
    expect(speak.mock.calls[0][0]).toMatchObject({ text: "先把胡萝卜切细", lang: "zh-CN" });
    childVoiceTts.cancel();
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
      foodJourneyProgress: current.foodJourneyProgress,
    });
    const migrated = useAppStore.getState().profile;
    expect(migrated.ageConfirmed).toBe(true);
    expect(migrated.stageConfirmed).toBe(true);
    expect(migrated.feedingSignalsConfirmed).toBe(true);
    expect(migrated.avoidStatus).toBe("none");
  });

  it("只重置宝宝档案，不删除制作与反馈记录", () => {
    useAppStore.getState().loadDemo();
    const historyBefore = useAppStore.getState().history;
    useAppStore.getState().resetProfile();
    const state = useAppStore.getState();
    expect(state.profile).toMatchObject({ months: 0, completed: false, ageConfirmed: false, avoidStatus: null });
    expect(state.profile.triedFoods).toEqual([]);
    expect(state.history).toEqual(historyBefore);
  });
});

describe("食物成长路线", () => {
  afterEach(() => vi.useRealTimers());

  it("首次进入没有预先点亮的食物", () => {
    useAppStore.getState().resetDemo();
    expect(useAppStore.getState().foodJourneyProgress).toEqual({});
    expect(useAppStore.getState().profile.triedFoods).toEqual([]);
  });

  it("只能按顺序解锁，并允许连续演示完整流程", () => {
    useAppStore.getState().resetDemo();
    const first = foodJourneyFoods[0];
    const second = foodJourneyFoods[1];

    useAppStore.getState().startFoodJourney(second.id);
    expect(useAppStore.getState().foodJourneyProgress[second.id]).toBeUndefined();

    useAppStore.getState().startFoodJourney(first.id);
    expect(useAppStore.getState().recordFoodCheckpoint(first.id, 1)).toBe(false);
    expect(useAppStore.getState().foodJourneyProgress[first.id].completedCheckpoints).toEqual([1]);
    expect(useAppStore.getState().recordFoodCheckpoint(first.id, 2)).toBe(false);
    expect(useAppStore.getState().foodJourneyProgress[first.id].completedCheckpoints).toEqual([1, 2]);
    expect(useAppStore.getState().recordFoodCheckpoint(first.id, 3)).toBe(true);
    expect(useAppStore.getState().foodJourneyProgress[first.id].status).toBe("completed");
    expect(useAppStore.getState().profile.triedFoods).toContain(first.name);

    useAppStore.getState().startFoodJourney(second.id);
    expect(useAppStore.getState().foodJourneyProgress[second.id]?.status).toBe("active");
  });

  it("记录可疑反应后立即暂停，不解锁下一关", () => {
    useAppStore.getState().resetDemo();
    const first = foodJourneyFoods[0];
    useAppStore.getState().startFoodJourney(first.id);
    useAppStore.getState().pauseFoodJourney(first.id, "possible");
    expect(useAppStore.getState().foodJourneyProgress[first.id]).toMatchObject({ status: "paused", reaction: "possible" });
    expect(useAppStore.getState().profile.triedFoods).not.toContain(first.name);
  });
});
