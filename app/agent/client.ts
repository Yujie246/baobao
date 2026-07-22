import type { BabyProfile } from "../types";
import { toAnalysisProfile } from "../analysis/profile";

export type BabyAgentMessage = { role: "assistant" | "user"; text: string };

export async function streamBabyAgent(
  messages: BabyAgentMessage[],
  profile: BabyProfile,
  onDelta: (delta: string) => void,
  signal?: AbortSignal,
) {
  const response = await fetch("/api/agent-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, babyProfile: toAnalysisProfile(profile) }),
    signal,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || "小助手暂时没有回答，请稍后重试");
  }
  if (!response.body) throw new Error("模型没有返回可读取的内容");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let completed = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const delta = decoder.decode(value, { stream: true });
    if (!delta) continue;
    completed += delta;
    onDelta(delta);
  }
  const tail = decoder.decode();
  if (tail) {
    completed += tail;
    onDelta(tail);
  }
  if (!completed.trim()) throw new Error("模型没有返回内容，请重新提问");
  return completed;
}
