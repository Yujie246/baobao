import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { analysisBabyProfileSchema } from "../../analysis/schemas";
import { buildBabyAgentSystemPrompt } from "../../agent/prompt";
import { buildCookingAgentSystemPrompt } from "../../cooking/prompt";
import { loadJob } from "../../analysis/server/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

const baseURL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const model = process.env.DEEPSEEK_AGENT_MODEL || "deepseek-v4-flash";
const requestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["assistant", "user"]),
    text: z.string().trim().min(1).max(500),
  })).min(1).max(12),
  babyProfile: analysisBabyProfileSchema,
  cookingContext: z.object({
    jobId: z.string().uuid(),
    stepIndex: z.number().int().min(0).max(100),
    prepared: z.boolean(),
    completedStepIds: z.array(z.string().min(1)).max(100),
    timerDurationSeconds: z.number().int().min(10).max(14_400).nullable(),
    timerRemainingSeconds: z.number().int().min(0).max(14_400).nullable(),
  }).optional(),
});

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function friendlyModelError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 0;
  if (status === 401 || status === 403) return errorResponse("小助手服务暂时不可用，请稍后重试", 503);
  if (status === 429) return errorResponse("当前请求较多，请稍后重试", 429);
  if (status >= 500) return errorResponse("小助手服务暂时不可用，请稍后重试", 502);
  if (error instanceof Error && /timeout/i.test(error.message)) return errorResponse("回答超时，请重新提问", 504);
  console.error("DeepSeek agent request failed", error instanceof Error ? error.message : "Unknown error");
  return errorResponse("暂时无法连接小助手服务，请稍后重试", 502);
}

export async function POST(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return errorResponse("不允许跨站调用", 403);
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return errorResponse("服务端尚未配置 DEEPSEEK_API_KEY", 503);

  try {
    const input = requestSchema.parse(await request.json());
    let systemPrompt = buildBabyAgentSystemPrompt(input.babyProfile);
    if (input.cookingContext) {
      const job = await loadJob(input.cookingContext.jobId);
      if (!job) return errorResponse("陪做任务不存在，请返回结果页重新进入", 404);
      if (job.status !== "completed" || !job.result) return errorResponse("分析结果尚未准备好", 409);
      try {
        systemPrompt = buildCookingAgentSystemPrompt(input.babyProfile, job.result, input.cookingContext);
      } catch {
        return errorResponse("当前陪做步骤无效，请返回结果页重新进入", 400);
      }
    }
    const client = new OpenAI({ apiKey, baseURL, timeout: 35_000, maxRetries: 0 });
    const stream = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...input.messages.map((message) => ({ role: message.role, content: message.text })),
      ],
      temperature: 0.25,
      max_tokens: input.cookingContext ? 350 : 500,
      stream: true,
      thinking: { type: "disabled" },
    } as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming & { thinking: { type: "disabled" } }, { signal: request.signal });

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) controller.enqueue(encoder.encode(content));
          }
          controller.close();
        } catch (error) {
          if (error instanceof Error && /aborted|controller is already closed|invalid state/i.test(error.message)) return;
          console.error("DeepSeek agent stream failed", error instanceof Error ? error.message : "Unknown error");
          try { controller.error(error); } catch { /* The browser may have already closed the stream. */ }
        }
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse("对话内容或宝宝档案格式不正确", 400);
    return friendlyModelError(error);
  }
}
