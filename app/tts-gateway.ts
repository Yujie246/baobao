export type VoiceEngine = "tencent" | "unavailable";

const TTS_ENDPOINT = "/api/tts";

class ChildVoiceTtsGateway {
  private audio: HTMLAudioElement | null = null;
  private request: AbortController | null = null;
  private cache = new Map<string, string>();
  readonly endpoint = TTS_ENDPOINT;

  get isNeuralConfigured() {
    return true;
  }

  cancel() {
    this.request?.abort();
    this.request = null;
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }
  }

  async speak(text: string): Promise<VoiceEngine> {
    this.cancel();
    try {
      let audioUrl = this.cache.get(text);
      if (!audioUrl) {
        const controller = new AbortController();
        this.request = controller;
        const timeout = window.setTimeout(() => controller.abort(), 12_000);
        const response = await fetch(this.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: controller.signal,
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
      return "unavailable";
    } finally {
      this.request = null;
    }
  }
}

export const childVoiceTts = new ChildVoiceTtsGateway();
