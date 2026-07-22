import { describe, expect, it } from "vitest";
import { characterIntents, resolveCookingIntent, resolveResultIntent } from "../app/character-illustrations";

describe("IP 形象语义映射", () => {
  it("所有公开姿势都存在对应资源", async () => {
    const fs = await import("node:fs/promises");
    for (const intent of characterIntents) {
      await expect(fs.access(`public/illustrations/ip/v1/${intent}-160.webp`)).resolves.toBeUndefined();
      await expect(fs.access(`public/illustrations/ip/v1/${intent}-320.webp`)).resolves.toBeUndefined();
    }
  });

  it("做饭动作使用稳定的 actionKind，未知值安全退回准备姿势", () => {
    expect(resolveCookingIntent("mix")).toBe("mix");
    expect(resolveCookingIntent("check_texture")).toBe("inspect");
    expect(resolveCookingIntent("unexpected-api-value")).toBe("prepare");
    expect(resolveCookingIntent()).toBe("prepare");
  });

  it("结果状态不会把风险结论展示成庆祝形象", () => {
    expect(resolveResultIntent("direct")).toBe("serve");
    expect(resolveResultIntent("needs-info")).toBe("question");
    expect(resolveResultIntent("not-recommended")).toBe("paused");
    expect(resolveResultIntent("uncertain")).toBe("inspect");
  });
});
