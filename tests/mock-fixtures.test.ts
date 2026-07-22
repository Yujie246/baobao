import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mockTestVideo1Fixture } from "../app/mocks/fixtures";

describe("测试视频 1 mock", () => {
  it("保存完整分析结果和可访问的固定关键帧", () => {
    expect(mockTestVideo1Fixture.meta).toMatchObject({
      dataSource: "mock",
      fixtureId: "mock-test-video-1",
      sourceName: "测试1.mp4",
    });
    expect(mockTestVideo1Fixture.result.视频解析.facts.actions).toHaveLength(11);
    expect(mockTestVideo1Fixture.result.陪做步骤).toHaveLength(8);

    for (const step of mockTestVideo1Fixture.result.陪做步骤) {
      expect(step.image_url).toMatch(/^\/mocks\/mock-test-video-1\/frames\/S\d+\.jpg$/);
      expect(existsSync(path.join(process.cwd(), "public", step.image_url!))).toBe(true);
    }
  });
});

