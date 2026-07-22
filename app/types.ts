export type Suitability =
  | "direct"
  | "adapted"
  | "needs-info"
  | "not-recommended"
  | "uncertain";

export type FoodStatus = "tried" | "untried" | "avoid" | "pending";

export type FeedingStage = "puree" | "thick-puree" | "soft-lumps" | "finger-food";

export type FeedingSignal =
  | "gagging"
  | "spitting"
  | "texture-refusal"
  | "swallowing-difficulty";

export interface BabyProfile {
  name: string;
  months: number;
  premature: boolean;
  correctedMonths: number | null;
  ageConfirmed: boolean;
  stage: FeedingStage;
  stageConfirmed: boolean;
  feedingSignals: FeedingSignal[];
  feedingSignalsConfirmed: boolean;
  feedingNote: string;
  avoidStatus: "none" | "has" | null;
  avoidFoods: string[];
  triedFoods: string[];
  completed: boolean;
}

export interface Ingredient {
  id: string;
  name: string;
  amount: string;
  icon: string;
  status: FoodStatus;
  note: string;
  source: "视频明确" | "画面识别" | "演示调整";
  optional?: boolean;
}

export interface CookingStep {
  id: number;
  title: string;
  instruction: string;
  detail: string;
  check: string;
  duration?: number;
  tip?: string;
  actionKind?: "prepare" | "mix" | "heat" | "timer" | "add" | "check_texture" | "cool" | "serve" | "generic";
}

export interface Recipe {
  id: string;
  title: string;
  source: string;
  duration: string;
  serving: number;
  suitability: Suitability;
  summary: string;
  ingredients: Ingredient[];
  adjustments: Array<{ title: string; reason: string; tone: "yellow" | "pink" | "mint" }>;
  steps: CookingStep[];
}

export interface Feedback {
  amount?: "most" | "half" | "few" | "none";
  acceptance?: "liked" | "neutral" | "refused";
  swallowing?: "smooth" | "difficulty" | "unusual";
  observed?: "normal" | "unsure" | "unusual";
  note?: string;
  completedAt?: number;
}

export interface HistoryRecord {
  id: string;
  recipeTitle: string;
  conclusion: Suitability;
  date: string;
  progress: "saved" | "cooking" | "completed";
  feedback?: Feedback;
}

export interface CookConversationMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  phase: "prep" | "cook";
  step: number;
}

export interface PersistedAppState {
  profile: BabyProfile;
  history: HistoryRecord[];
  feedback: Feedback;
  cookStep: number;
  completedSteps: number[];
  timerEndAt: number | null;
  cookPrepared: boolean;
  cookIngredientBlocked: boolean;
  cookConversation: CookConversationMessage[];
  serving: number;
  recipeAdjustments: {
    broccoli: "keep" | "omit" | "carrot";
    extraCookMinutes: number;
  };
  riskInterrupted: boolean;
}
