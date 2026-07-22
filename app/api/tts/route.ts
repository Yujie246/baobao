const TENCENT_VOICE_TYPE = 502007;
const MAX_TEXT_LENGTH = 150;
const TENCENT_HOST = "tts.tencentcloudapi.com";
const TENCENT_SERVICE = "tts";
const TENCENT_ACTION = "TextToVoice";
const TENCENT_VERSION = "2019-08-23";
const encoder = new TextEncoder();

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function hmac(key: Uint8Array<ArrayBuffer> | ArrayBuffer, value: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(value));
}

async function authorization(secretId: string, secretKey: string, payload: string, timestamp: number) {
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const signedHeaders = "content-type;host;x-tc-action";
  const canonicalHeaders = [
    "content-type:application/json; charset=utf-8",
    `host:${TENCENT_HOST}`,
    `x-tc-action:${TENCENT_ACTION.toLowerCase()}`,
    "",
  ].join("\n");
  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    await sha256Hex(payload),
  ].join("\n");
  const scope = `${date}/${TENCENT_SERVICE}/tc3_request`;
  const stringToSign = [
    "TC3-HMAC-SHA256",
    String(timestamp),
    scope,
    await sha256Hex(canonicalRequest),
  ].join("\n");
  const secretDate = await hmac(encoder.encode(`TC3${secretKey}`), date);
  const secretService = await hmac(secretDate, TENCENT_SERVICE);
  const secretSigning = await hmac(secretService, "tc3_request");
  const signature = toHex(await hmac(secretSigning, stringToSign));
  return `TC3-HMAC-SHA256 Credential=${secretId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function POST(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return jsonError("不允许跨站调用", 403);
  }

  const secretId = process.env.TENCENTCLOUD_SECRET_ID;
  const secretKey = process.env.TENCENTCLOUD_SECRET_KEY;
  if (!secretId || !secretKey) return jsonError("宝宝音色尚未配置", 503);

  let input: { text?: unknown };
  try {
    input = await request.json();
  } catch {
    return jsonError("请求格式不正确", 400);
  }

  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (!text || text.length > MAX_TEXT_LENGTH) {
    return jsonError(`文本长度需为 1—${MAX_TEXT_LENGTH} 个字符`, 400);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    Text: text,
    SessionId: crypto.randomUUID(),
    VoiceType: TENCENT_VOICE_TYPE,
    PrimaryLanguage: 1,
    SampleRate: 24000,
    Codec: "mp3",
    Speed: -0.35,
    Volume: 0,
    EnableSubtitle: false,
  });

  try {
    const response = await fetch(`https://${TENCENT_HOST}`, {
      method: "POST",
      headers: {
        Authorization: await authorization(secretId, secretKey, payload, timestamp),
        "Content-Type": "application/json; charset=utf-8",
        "X-TC-Action": TENCENT_ACTION,
        "X-TC-Timestamp": String(timestamp),
        "X-TC-Version": TENCENT_VERSION,
      },
      body: payload,
    });
    const result = await response.json() as {
      Response?: { Audio?: string; Error?: { Code?: string } };
    };
    if (!response.ok || result.Response?.Error || !result.Response?.Audio) {
      console.error("Tencent TTS request failed", result.Response?.Error?.Code || response.status);
      return jsonError("宝宝音色暂时不可用", 502);
    }

    return new Response(decodeBase64(result.Response.Audio), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Tencent TTS request failed", error instanceof Error ? error.message : "Unknown error");
    return jsonError("宝宝音色服务连接失败", 502);
  }
}
