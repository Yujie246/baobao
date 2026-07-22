export type VoiceEngine = "tencent" | "system" | "unavailable";

const TTS_ENDPOINT = "/api/tts";

function speakWithSystemFallback(text: string) {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return false;
  const synthesis = window.speechSynthesis;
  const voices = synthesis.getVoices();
  const chineseVoices = voices.filter((voice) => /^zh(?:-|_)/i.test(voice.lang));
  const preferredNames = [/xiaoyi/i, /xiaoxiao/i, /ting[- ]?ting/i, /yu[- ]?shu/i, /meijia/i, /sin[- ]?ji/i, /huihui/i];
  const voice = preferredNames
    .map((pattern) => chineseVoices.find((candidate) => pattern.test(candidate.name)))
    .find(Boolean)
    ?? chineseVoices.find((candidate) => candidate.localService)
    ?? chineseVoices[0];
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voice?.lang || "zh-CN";
  utterance.voice = voice || null;
  utterance.rate = .9;
  utterance.pitch = 1.04;
  synthesis.cancel();
  synthesis.speak(utterance);
  return true;
}

class ChildVoiceTtsGateway {
  private audio: HTMLAudioElement | null = null;
  private request: AbortController | null = null;
  private cache = new Map<string, string>();
  private generation = 0;
  readonly endpoint = TTS_ENDPOINT;

  cancel() {
    this.generation += 1;
    this.request?.abort();
    this.request = null;
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }
    window.speechSynthesis?.cancel();
  }

  async speak(text: string): Promise<VoiceEngine> {
    this.cancel();
    const generation = this.generation;
    let controller: AbortController | null = null;
    try {
      let audioUrl = this.cache.get(text);
      if (!audioUrl) {
        const nextController = new AbortController();
        controller = nextController;
        this.request = nextController;
        const timeout = window.setTimeout(() => nextController.abort(), 12_000);
        const response = await fetch(this.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: nextController.signal,
        }).finally(() => window.clearTimeout(timeout));
        if (!response.ok) throw new Error(`TTS request failed: ${response.status}`);
        const audio = await response.blob();
        if (!audio.type.startsWith("audio/")) throw new Error("TTS response is not audio");
        audioUrl = URL.createObjectURL(audio);
        this.cache.set(text, audioUrl);
      }
      this.audio = new Audio(audioUrl);
      this.audio.preload = "auto";
      await this.audio.play();
      return "tencent";
    } catch {
      if (generation !== this.generation) return "unavailable";
      if (speakWithSystemFallback(text)) return "system";
      return "unavailable";
    } finally {
      if (this.request === controller) this.request = null;
    }
  }
}

export const childVoiceTts = new ChildVoiceTtsGateway();
