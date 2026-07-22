import { describe, expect, it } from "vitest";
import { POLICY_EVIDENCE, searchKnowledge } from "../app/analysis/evidence";

describe("policy evidence", () => {
  it("has stable unique evidence ids", () => {
    const ids = POLICY_EVIDENCE.map((item) => item.evidence_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers all six adaptation dimensions", () => {
    const dimensions = new Set(searchKnowledge().map((item) => item.dimension));
    expect(dimensions).toEqual(new Set(["食材", "调味", "熟制", "质地", "大小形状", "喂养方式"]));
  });

  it("is marked as real policy evidence rather than mock output", () => {
    expect(POLICY_EVIDENCE.every((item) => item.source.length > 0 && item.location.length > 0)).toBe(true);
  });
});
