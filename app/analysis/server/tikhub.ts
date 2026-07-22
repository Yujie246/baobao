const DEFAULT_TIKHUB_BASE_URL = "https://api.tikhub.io";
const TIKHUB_TIMEOUT_MS = 45_000;
const TIKHUB_MAX_ATTEMPTS = 2;

type TikHubPayload = {
  code?: number;
  message?: string;
  message_zh?: string;
  data?: unknown;
};

export type ResolvedSubmittedVideo = {
  url: string;
  originalUrl?: string;
  name: string;
  contentType: string;
};

function submittedUrl(input: string) {
  const match = input.trim().match(/https?:\/\/[^\s<>'"，。！？、]+/i);
  if (!match) throw new Error("没有找到有效的视频链接");
  return match[0].replace(/[)）\]}】]+$/, "");
}

function parsedHttpsUrl(input: string) {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("视频链接格式不正确"); }
  if (url.protocol !== "https:") throw new Error("视频链接必须使用 https://");
  return url;
}

export function isTikHubPlatformUrl(input: string) {
  const host = parsedHttpsUrl(input).hostname.toLowerCase();
  return host === "douyin.com" || host.endsWith(".douyin.com") || host.endsWith(".iesdouyin.com")
    || host === "tiktok.com" || host.endsWith(".tiktok.com");
}

function isDouyinUrl(input: string) {
  const host = parsedHttpsUrl(input).hostname.toLowerCase();
  return host === "douyin.com" || host.endsWith(".douyin.com") || host.endsWith(".iesdouyin.com");
}

function collectVideoUrls(value: unknown, path: string[] = [], candidates: Array<{ url: string; score: number }> = []) {
  if (typeof value === "string" && /^https:\/\//i.test(value)) {
    const key = path.join(".").toLowerCase();
    if (!/(cover|avatar|music|audio|author|share_url)/.test(key)) {
      let score = 0;
      if (key.includes("original_video_url")) score += 120;
      if (key.includes("play_addr")) score += 100;
      if (key.includes("download_addr")) score += 90;
      if (key.includes("video_url")) score += 80;
      if (key.includes("url_list")) score += 30;
      if (/\.m3u8(?:\?|$)/i.test(value)) score -= 40;
      if (score > 0) candidates.push({ url: value, score });
    }
    return candidates;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectVideoUrls(item, [...path, String(index)], candidates));
    return candidates;
  }
  if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => collectVideoUrls(item, [...path, key], candidates));
  }
  return candidates;
}

export function extractTikHubVideoUrl(data: unknown) {
  const candidates = collectVideoUrls(data)
    .filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url) === index)
    .sort((a, b) => b.score - a.score);
  const url = candidates[0]?.url;
  if (!url) throw new Error("TikHub 已解析作品，但没有返回可读取的视频地址");
  parsedHttpsUrl(url);
  return url;
}

function tikhubError(status: number, payload?: TikHubPayload) {
  if (status === 401 || status === 403) return new Error("TikHub API Key 无效或没有接口权限");
  if (status === 402) return new Error("TikHub 余额不足，请充值后重试");
  if (status === 404) return new Error("这条作品不存在或已经不可见");
  if (status === 429) return new Error("TikHub 请求过于频繁，请稍后重试");
  if (status >= 500) return new Error("TikHub 服务暂时不可用，请稍后重试");
  const detail = payload?.message_zh || payload?.message;
  return new Error(detail ? `TikHub 解析失败：${detail}` : "TikHub 无法解析这条分享链接");
}

async function requestTikHub(path: string, params: Record<string, string>) {
  const apiKey = process.env.TIKHUB_API_KEY;
  if (!apiKey) throw new Error("服务端未配置 TIKHUB_API_KEY，暂时不能解析抖音分享链接");
  const baseUrl = (process.env.TIKHUB_BASE_URL || DEFAULT_TIKHUB_BASE_URL).replace(/\/$/, "");
  const endpoint = new URL(`${baseUrl}${path}`);
  Object.entries(params).forEach(([key, value]) => endpoint.searchParams.set(key, value));

  let lastError: unknown;
  for (let attempt = 0; attempt < TIKHUB_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(TIKHUB_TIMEOUT_MS),
      });
      const payload = await response.json().catch(() => null) as TikHubPayload | null;
      const code = payload?.code || response.status;
      if (!response.ok || code < 200 || code >= 300) throw tikhubError(code, payload || undefined);
      return payload?.data;
    } catch (error) {
      lastError = error;
      const retryable = error instanceof TypeError || (error instanceof Error && /超时|timeout|temporarily|暂时不可用/i.test(error.message));
      if (!retryable || attempt === TIKHUB_MAX_ATTEMPTS - 1) break;
    }
  }
  if (lastError instanceof Error && lastError.name === "TimeoutError") throw new Error("TikHub 解析超过 45 秒，请稍后重试");
  throw lastError instanceof Error ? lastError : new Error("TikHub 无法解析这条分享链接");
}

export async function resolveTikHubVideoUrl(url: string) {
  const requests = isDouyinUrl(url) ? [
    ["/api/v1/douyin/app/v3/fetch_one_video_by_share_url", { share_url: url }],
    ["/api/v1/douyin/web/fetch_one_video_by_share_url", { share_url: url }],
  ] as const : [
    ["/api/v1/hybrid/video_data", { url, minimal: "true" }],
  ] as const;

  for (const [path, params] of requests) {
    const data = await requestTikHub(path, params);
    if (!data) continue;
    try { return extractTikHubVideoUrl(data); } catch { /* 尝试官方建议的 Web 备用接口 */ }
  }
  throw new Error("这条作品无法读取，可能已删除、设为私密或受到地区限制");
}

export async function resolveSubmittedVideo(input: string): Promise<ResolvedSubmittedVideo> {
  const url = submittedUrl(input);
  parsedHttpsUrl(url);
  if (!isTikHubPlatformUrl(url)) return { url, name: "remote-video.mp4", contentType: "video/mp4" };
  return {
    url: await resolveTikHubVideoUrl(url),
    originalUrl: url,
    name: "platform-video.mp4",
    contentType: "video/mp4",
  };
}
