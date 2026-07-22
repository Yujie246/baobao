import { analysisResultSchema } from "../../analysis/schemas";
import mockTestVideo1FixtureJson from "./mock-test-video-1.json";

export const mockTestVideo1Fixture = {
  meta: mockTestVideo1FixtureJson.meta,
  result: analysisResultSchema.parse(mockTestVideo1FixtureJson.result),
};

const mockAnalysisFixtures = {
  "mock-test-video-1": mockTestVideo1Fixture,
};

export function getMockAnalysisFixture(fixtureId: string) {
  return mockAnalysisFixtures[fixtureId as keyof typeof mockAnalysisFixtures];
}
