import { describe, expect, it } from "vitest";
import { parseVideoFacts, stripCodeFence, timestampToSeconds } from "../app/analysis/json";

const validFacts = {
  video_title: "南瓜软饭",
  duration_seconds: 30,
  summary: "把南瓜压泥后拌入软饭",
  actions: [{
    action_id: "A01",
    title: "压南瓜",
    start_time: "00:00:01",
    end_time: "00:00:08",
    keyframe_time: "00:00:05",
    keyframe_description: "勺背正在压南瓜",
    observed_action: "用勺背把熟南瓜压散",
    observed_ingredients: ["南瓜"],
    observed_tools: ["勺"],
    observed_texture: "细软",
    observed_size_shape: null,
    observed_seasoning: null,
    observed_feeding: null,
    unknowns: ["南瓜重量未说明"],
  }],
  global_unknowns: [],
};

describe("analysis JSON boundary", () => {
  it("strips markdown fences and normalizes timestamps", () => {
    const parsed = parseVideoFacts(`\`\`\`json\n${JSON.stringify(validFacts)}\n\`\`\``);
    expect(parsed.actions[0].start_time).toBe("00:00:01.000");
    expect(stripCodeFence("```json\n{}\n```")).toBe("{}");
  });

  it("rejects duplicate action IDs", () => {
    const duplicate = { ...validFacts, actions: [validFacts.actions[0], { ...validFacts.actions[0] }] };
    expect(() => parseVideoFacts(JSON.stringify(duplicate))).toThrow(/重复/);
  });

  it("rejects timestamps outside video duration", () => {
    const invalid = { ...validFacts, actions: [{ ...validFacts.actions[0], keyframe_time: "00:00:31.000" }] };
    expect(() => parseVideoFacts(JSON.stringify(invalid))).toThrow(/超出视频时长/);
  });

  it("converts canonical timestamps to seconds", () => {
    expect(timestampToSeconds("00:01:02.500")).toBe(62.5);
    expect(timestampToSeconds(null)).toBeNull();
  });
});
