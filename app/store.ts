import { create } from "zustand";
import { completedProfile, defaultProfile, initialHistory } from "./mock-data";
import type { BabyProfile, CookConversationMessage, Feedback, PersistedAppState, Suitability } from "./types";

interface AppStore extends PersistedAppState {
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  hydrate: (state: PersistedAppState | null) => void;
  setProfile: (profile: Partial<BabyProfile>) => void;
  finishOnboarding: () => void;
  setCookStep: (step: number) => void;
  setCookPrepared: (value: boolean) => void;
  setCookIngredientBlocked: (value: boolean) => void;
  appendCookMessage: (message: CookConversationMessage) => void;
  completeStep: (step: number) => void;
  setTimerEndAt: (endAt: number | null) => void;
  setServing: (serving: number) => void;
  setRecipeAdjustments: (adjustments: Partial<PersistedAppState["recipeAdjustments"]>) => void;
  setRiskInterrupted: (value: boolean) => void;
  setFeedback: (feedback: Partial<Feedback>) => void;
  saveRecipe: (conclusion?: Suitability) => void;
  completeRecipe: (recipe?: { id: string; title: string }) => void;
  saveObservation: (recipeId: string, observed: NonNullable<Feedback["observed"]>) => void;
  resetDemo: () => void;
  loadDemo: () => void;
}

const baseState: PersistedAppState = {
  profile: defaultProfile,
  history: initialHistory,
  feedback: {},
  cookStep: 1,
  completedSteps: [],
  timerEndAt: null,
  cookPrepared: false,
  cookIngredientBlocked: false,
  cookConversation: [],
  serving: 1,
  recipeAdjustments: { broccoli: "keep", extraCookMinutes: 0 },
  riskInterrupted: false,
};

export const useAppStore = create<AppStore>()(
    (set) => ({
      ...baseState,
      hydrated: false,
      setHydrated: (hydrated) => set({ hydrated }),
      hydrate: (state) => set({
        ...baseState,
        ...(state ?? {}),
        profile: state?.profile
          ? {
              ...baseState.profile,
              ...state.profile,
              correctedMonths: state.profile.correctedMonths ?? null,
              ageConfirmed: state.profile.ageConfirmed ?? state.profile.months >= 4,
              stageConfirmed: state.profile.stageConfirmed ?? state.profile.completed,
              feedingSignals: state.profile.feedingSignals ?? [],
              feedingSignalsConfirmed: state.profile.feedingSignalsConfirmed ?? state.profile.completed,
              feedingNote: state.profile.feedingNote ?? "",
              avoidStatus: state.profile.avoidStatus
                ?? (state.profile.avoidFoods.length > 0 ? "has" : state.profile.completed ? "none" : null),
            }
          : baseState.profile,
        hydrated: true,
      }),
      setProfile: (profile) => set((state) => ({ profile: { ...state.profile, ...profile } })),
      finishOnboarding: () => set((state) => ({ profile: { ...state.profile, completed: true } })),
      setCookStep: (cookStep) => set({ cookStep }),
      setCookPrepared: (cookPrepared) => set({ cookPrepared }),
      setCookIngredientBlocked: (cookIngredientBlocked) => set({ cookIngredientBlocked }),
      appendCookMessage: (message) => set((state) => ({ cookConversation: [...state.cookConversation, message] })),
      completeStep: (step) => set((state) => ({
        completedSteps: state.completedSteps.includes(step) ? state.completedSteps : [...state.completedSteps, step],
        cookStep: Math.min(step + 1, 5),
        timerEndAt: null,
      })),
      setTimerEndAt: (timerEndAt) => set({ timerEndAt }),
      setServing: (serving) => set({ serving }),
      setRecipeAdjustments: (adjustments) => set((state) => ({ recipeAdjustments: { ...state.recipeAdjustments, ...adjustments } })),
      setRiskInterrupted: (riskInterrupted) => set({ riskInterrupted }),
      setFeedback: (feedback) => set((state) => ({ feedback: { ...state.feedback, ...feedback } })),
      saveRecipe: (conclusion = "adapted") => set((state) => ({
        history: [
          {
            id: "shrimp-noodle-demo",
            recipeTitle: "宝宝虾滑面",
            conclusion,
            date: "今天",
            progress: "saved",
          },
          ...state.history.filter((item) => item.id !== "shrimp-noodle-demo"),
        ],
      })),
      completeRecipe: (recipe = { id: "shrimp-noodle-demo", title: "宝宝虾滑面" }) => set((state) => ({
        history: [
          {
            id: recipe.id,
            recipeTitle: recipe.title,
            conclusion: "adapted",
            date: "今天",
            progress: "completed",
            feedback: { ...state.feedback, completedAt: Date.now() },
          },
          ...state.history.filter((item) => item.id !== recipe.id),
        ],
        cookStep: 1,
        completedSteps: [],
        timerEndAt: null,
        cookPrepared: false,
        cookIngredientBlocked: false,
        cookConversation: [],
        riskInterrupted: false,
        feedback: {},
      })),
      saveObservation: (recipeId, observed) => set((state) => ({
        history: state.history.map((item) => item.id === recipeId
          ? { ...item, feedback: { ...item.feedback, observed } }
          : item),
      })),
      resetDemo: () => set({ ...baseState, hydrated: true }),
      loadDemo: () => set({ ...baseState, profile: completedProfile, hydrated: true }),
    }),
);

export function selectPersistedState(state: AppStore): PersistedAppState {
  return {
    profile: state.profile,
    history: state.history,
    feedback: state.feedback,
    cookStep: state.cookStep,
    completedSteps: state.completedSteps,
    timerEndAt: state.timerEndAt,
    cookPrepared: state.cookPrepared,
    cookIngredientBlocked: state.cookIngredientBlocked,
    cookConversation: state.cookConversation,
    serving: state.serving,
    recipeAdjustments: state.recipeAdjustments,
    riskInterrupted: state.riskInterrupted,
  };
}
