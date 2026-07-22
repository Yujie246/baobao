import Dexie, { type Table } from "dexie";
import type { PersistedAppState } from "./types";

interface StoredState extends PersistedAppState {
  id: "current";
  updatedAt: number;
}

class BabyBaoDatabase extends Dexie {
  state!: Table<StoredState, string>;

  constructor() {
    super("baobao-local-v1");
    this.version(1).stores({ state: "id,updatedAt" });
  }
}

let database: BabyBaoDatabase | null = null;

function getDatabase() {
  if (typeof indexedDB === "undefined") return null;
  database ??= new BabyBaoDatabase();
  return database;
}

export async function loadLocalState(): Promise<PersistedAppState | null> {
  const db = getDatabase();
  if (!db) return null;
  const record = await db.state.get("current");
  if (!record) return null;
  return {
    profile: record.profile,
    history: record.history,
    feedback: record.feedback,
    cookStep: record.cookStep,
    completedSteps: record.completedSteps,
    timerEndAt: record.timerEndAt,
    cookPrepared: record.cookPrepared ?? false,
    cookIngredientBlocked: record.cookIngredientBlocked ?? false,
    cookConversation: record.cookConversation ?? [],
    serving: record.serving,
    recipeAdjustments: record.recipeAdjustments ?? { broccoli: "keep", extraCookMinutes: 0 },
    riskInterrupted: record.riskInterrupted ?? false,
  };
}

export async function saveLocalState(state: PersistedAppState) {
  const db = getDatabase();
  if (!db) return;
  await db.state.put({ id: "current", updatedAt: Date.now(), ...state });
}

export async function clearLocalState() {
  const db = getDatabase();
  if (!db) return;
  await db.state.delete("current");
}
