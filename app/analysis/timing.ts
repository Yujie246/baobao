import type { AnalysisCookingStep } from "./schemas";

const timedAction = /焖|煮|蒸|烤|煎|炖|泡|腌|冷却|晾|静置|发酵|加热/;
const immediateTiming = /即时|立刻|马上|无需等待/;

export function cookingStepTimerSeconds(step: Pick<AnalysisCookingStep, "title" | "action" | "instruction" | "timing" | "timer_seconds">) {
  if (step.timer_seconds) return step.timer_seconds;
  if (!step.timing || immediateTiming.test(step.timing)) return null;
  if (!timedAction.test(`${step.title} ${step.action} ${step.instruction}`)) return null;
  const matches = [...step.timing.matchAll(/(\d+(?:\.\d+)?)(?:\s*[-–—至到]\s*(\d+(?:\.\d+)?))?\s*(小时|分钟|分|秒)/g)];
  if (!matches.length) return null;
  const seconds = matches.reduce((total, match) => {
    const amount = Number(match[2] || match[1]);
    const unit = match[3];
    return total + amount * (unit === "小时" ? 3600 : unit === "秒" ? 1 : 60);
  }, 0);
  return seconds >= 10 && seconds <= 14_400 ? Math.round(seconds) : null;
}
