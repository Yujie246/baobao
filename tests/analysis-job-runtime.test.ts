import { describe, expect, it } from "vitest";
import { ANALYSIS_HEARTBEAT_STALE_MS, staleAnalysisMessage } from "../app/analysis/job-runtime";

describe("analysis job runtime", () => {
  it("marks a processing job stale when its heartbeat stops", () => {
    const now = 100_000;
    expect(staleAnalysisMessage({ status: "generating_plan", updatedAt: now - ANALYSIS_HEARTBEAT_STALE_MS - 1 }, now)).toMatch(/模型请求已中断/);
  });

  it("does not fail a live or completed job", () => {
    const now = 100_000;
    expect(staleAnalysisMessage({ status: "parsing_video", updatedAt: now - 1_000 }, now)).toBeNull();
    expect(staleAnalysisMessage({ status: "completed", updatedAt: 0 }, now)).toBeNull();
  });
});
