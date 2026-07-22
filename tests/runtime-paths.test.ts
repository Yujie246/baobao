import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveRuntimeTempRoot } from "../app/analysis/server/runtime-paths";

describe("分析任务临时目录", () => {
  it("Vercel 使用系统可写临时目录", () => {
    expect(resolveRuntimeTempRoot({ isVercel: true, cwd: "/var/task", systemTemp: "/tmp" }))
      .toBe(path.join("/tmp", "baobao"));
  });

  it("本地开发继续使用项目内 tmp 目录", () => {
    expect(resolveRuntimeTempRoot({ isVercel: false, cwd: "/workspace", systemTemp: "/tmp" }))
      .toBe(path.join("/workspace", "tmp"));
  });
});
