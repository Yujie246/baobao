import { describe, expect, it } from "vitest";
import viteConfig from "../vite.config";

describe("Vite 开发服务器", () => {
  it("关闭存在连接竞态的浏览器控制台转发，但保留 HMR", async () => {
    if (typeof viteConfig !== "function") throw new Error("vite.config.ts 应导出配置函数");
    const config = await viteConfig({
      command: "serve",
      mode: "test",
      isSsrBuild: false,
      isPreview: false,
    });
    expect(config.server?.forwardConsole).toBe(false);
    expect(config.server?.hmr).not.toBe(false);
  });
});
