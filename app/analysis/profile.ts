import type { BabyProfile } from "../types";
import type { AnalysisBabyProfile } from "./schemas";

export function toAnalysisProfile(profile: BabyProfile): AnalysisBabyProfile {
  return {
    name: profile.name,
    months: profile.months,
    correctedMonths: profile.correctedMonths,
    premature: profile.premature,
    stage: profile.stage,
    avoidFoods: profile.avoidFoods,
    triedFoods: profile.triedFoods,
    feedingSignals: profile.feedingSignals,
    note: profile.feedingNote,
  };
}
