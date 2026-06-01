/**
 * Example: Secure Chat Route with Guardrails
 * 
 * This file demonstrates how to integrate GuardrailsValidator into the Next.js chat API.
 */

import {
  detectServerTool,
  getLastUserText,
  runSearchDestination,
  runHandleEmergency,
  runServerTool,
} from '@/lib/agent-tools';
import { getValidator } from '@/lib/guardrails';
import { prepareConversationContext } from '@/lib/memory';
import { toOllamaMessages } from '@/lib/ollama-messages';
import { createOpenAI } from '@ai-sdk/openai';
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  streamText,
  tool,
  type LanguageModelUsage,
  type UIMessage,
} from 'ai';
import { z } from 'zod';

const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'qwen2:1.5b';
const MODEL_SUPPORTS_TOOLS =
  process.env.OLLAMA_SUPPORTS_TOOLS === 'true' ||
  (!OLLAMA_MODEL.includes('1.5b') &&
    process.env.OLLAMA_SUPPORTS_TOOLS !== 'false');

const ollama = createOpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama',
});

const ollamaModel = ollama.chat(OLLAMA_MODEL);

const BASE_SYSTEM_PROMPT = `Bạn là trợ lý ảo AI túc trực tại VinWonders.
Hỗ trợ: tìm trò chơi, nhà hàng, show, khách sạn; xử lý mất đồ / y tế khẩn cấp.
Luôn trả lời thân thiện, ngắn gọn, tiếng Việt.`;

function buildSystemPrompt(memorySummary: string, contextNote: string): string {
  const blocks = [BASE_SYSTEM_PROMPT];
  if (memorySummary) blocks.push(memorySummary);
  if (contextNote) blocks.push(contextNote);
  return blocks.join('\n\n');
}

function logMetrics(usage: LanguageModelUsage, startTime: number) {
  const latencyMs = (performance.now() - startTime).toFixed(2);
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const totalTokens = usage.totalTokens ?? 0;

  console.log('\n====== [AI AGENT METRICS LOG] ======');
  console.log(`⏱️ Latency: ${latencyMs} ms`);
  console.log(`📥 Input Tokens: ${inputTokens}`);
  console.log(`📤 Output Tokens: ${outputTokens}`);
  console.log(`🔤 Total Tokens: ${totalTokens}`);
  console.log('====================================\n');
}

function getClientIp(req: Request): string {
  // Try multiple headers for IP detection
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0] ??
    req.headers.get('x-client-ip') ??
    req.headers.get('cf-connecting-ip') ??
    'unknown'
  );
}

function getUserId(req: Request): string {
  // Get from custom header (would be set by auth middleware)
  return req.headers.get('x-user-id') ?? 'anonymous';
}

export async function POST(req: Request) {
  const validator = getValidator();
  const startTime = performance.now();

  // Get request identifiers
  const ipAddress = getClientIp(req);
  const userId = getUserId(req);

  try {
    // ✅ STEP 1: Rate limiting check
    console.log(`[SECURITY] Checking rate limit for user=${userId}, ip=${ipAddress}`);
    if (!validator.checkRateLimit(userId, ipAddress)) {
      console.log(`[SECURITY] Rate limit exceeded for user=${userId}`);
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const { messages }: { messages: UIMessage[] } = await req.json();

    // ✅ STEP 2: Validate user input
    const userMessage = getLastUserText(messages);
    console.log(`[SECURITY] Validating input for user=${userId}, length=${userMessage.length}`);
    
    if (!validator.validateInput(userMessage, userId)) {
      console.log(`[SECURITY] Input validation failed for user=${userId}`);
      return new Response(
        JSON.stringify({
          error: 'Invalid input detected. Please check your message.',
          code: 'INVALID_INPUT',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const ctx = prepareConversationContext(messages);
    const modelMessages = toOllamaMessages(ctx.windowMessages);

    const contextNote =
      ctx.stats.prunedUiMessages > 0
        ? `[Context window] Đang gửi ${ctx.stats.windowUiMessages}/${ctx.stats.totalUiMessages} tin gần nhất (~${ctx.stats.estimatedTokens} tokens ước lượng).`
        : '';

    const system = buildSystemPrompt(ctx.memorySummary, contextNote);

    const onFinish = ({ usage }: { usage: LanguageModelUsage }) => {
      // ✅ STEP 3: Track resource usage
      const resourceOk = validator.trackResourceUsage(
        `chat-${userId}`,
        usage.inputTokens ?? 0,
        usage.outputTokens ?? 0,
        1 // Single turn, so 1 step
      );

      if (!resourceOk) {
        console.warn(`[SECURITY] Resource limit concern for user=${userId}`);
      }

      logMetrics(usage, startTime);
    };

    // ✅ STEP 4: Define secure agent tools
    const agentTools = {
      searchDestination: tool({
        description:
          'Tìm trò chơi, nhà hàng, show, khách sạn, liên hệ trong VinWonders.',
        inputSchema: z.object({
          keyword: z.string().describe('Từ khóa cần tìm'),
          category: z
            .enum(['ride', 'restaurant', 'facility', 'hotel', 'show', 'contact'])
            .optional()
            .describe('Lọc theo loại địa điểm'),
        }),
        execute: async ({ keyword, category }) => {
          // Validate tool arguments before execution
          const validation = validator.validateTool(
            'searchDestination',
            { keyword, category },
            ['searchDestination', 'handleEmergency'] // Whitelist
          );

          if (!validation.valid) {
            console.warn(
              `[SECURITY] Tool validation failed for searchDestination: ${validation.error}`
            );
            return { error: validation.error };
          }

          return runSearchDestination(keyword, category);
        },
      }),
      handleEmergency: tool({
        description: 'Xử lý mất đồ, lạc trẻ em, sự cố y tế khẩn cấp.',
        inputSchema: z.object({
          type: z.enum(['lost_item', 'medical', 'other']),
          description: z.string(),
        }),
        execute: async ({ type, description }) => {
          // Validate tool arguments before execution
          const validation = validator.validateTool(
            'handleEmergency',
            { type, description },
            ['searchDestination', 'handleEmergency'] // Whitelist
          );

          if (!validation.valid) {
            console.warn(
              `[SECURITY] Tool validation failed for handleEmergency: ${validation.error}`
            );
            return { error: validation.error };
          }

          return runHandleEmergency(type, description);
        },
      }),
    };

    const responseHeaders = {
      'X-Context-Total': String(ctx.stats.totalUiMessages),
      'X-Context-Window': String(ctx.stats.windowUiMessages),
      'X-Context-Pruned': String(ctx.stats.prunedUiMessages),
      'X-Context-Tokens': String(ctx.stats.estimatedTokens),
      'X-Memory-Active': ctx.memorySummary ? '1' : '0',
      'X-Security-Level': 'guarded',
      'X-User-Id': userId,
    };

    if (!MODEL_SUPPORTS_TOOLS) {
      const serverTool = detectServerTool(userMessage);

      if (serverTool) {
        // Validate detected tool
        const toolValidation = validator.validateTool(
          serverTool.name,
          serverTool.input,
          ['searchDestination', 'handleEmergency']
        );

        if (!toolValidation.valid) {
          console.warn(
            `[SECURITY] Detected tool validation failed: ${toolValidation.error}`
          );
          return new Response(
            JSON.stringify({
              error: 'Tool validation failed',
              code: 'TOOL_VALIDATION_ERROR',
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        const { name, input, output } = await runServerTool(serverTool);
        const toolCallId = generateId();

        // ✅ STEP 5: Sanitize tool output
        const sanitizedOutput = validator.sanitizeOutput(JSON.stringify(output));

        const streamResponse = createUIMessageStreamResponse({
          stream: createUIMessageStream({
            originalMessages: messages,
            execute: async ({ writer }) => {
              writer.write({
                type: 'tool-input-available',
                toolCallId,
                toolName: name,
                input,
              });
              writer.write({
                type: 'tool-output-available',
                toolCallId,
                output,
              });

              const toolHint =
                name === 'searchDestination'
                  ? 'Khách đang hỏi gợi ý địa điểm — KHÔNG tạo ticket khẩn cấp mới; chỉ gợi ý chỗ chơi/ăn phù hợp.'
                  : 'Tóm tắt kết quả khẩn cấp cho khách.';

              const summary = streamText({
                model: ollamaModel,
                messages: modelMessages,
                system: `${system}\n\n${toolHint}\n\nKết quả công cụ "${name}": ${sanitizedOutput}.`,
                onFinish,
              });
              writer.merge(summary.toUIMessageStream());
            },
          }),
          headers: responseHeaders,
        });

        return streamResponse;
      }

      const result = streamText({
        model: ollamaModel,
        messages: modelMessages,
        system,
        onFinish,
      });

      return result.toUIMessageStreamResponse({ headers: responseHeaders });
    }

    const result = streamText({
      model: ollamaModel,
      messages: modelMessages,
      system: `${system}
Nếu khách hỏi địa điểm → gọi searchDestination.
Nếu khách báo mất đồ / y tế khẩn cấp → gọi handleEmergency.`,
      tools: agentTools,
      onFinish,
    });

    return result.toUIMessageStreamResponse({ headers: responseHeaders });

  } catch (error) {
    // ✅ STEP 6: Safe error handling (no details to user)
    console.error('[ERROR] Chat API error:', error);
    
    // Log security event for suspicious errors
    if (error instanceof Error && error.message.includes('script')) {
      console.warn(`[SECURITY] Potential injection attack detected for user=${userId}`);
    }

    return new Response(
      JSON.stringify({
        error: 'An error occurred processing your request.',
        code: 'INTERNAL_ERROR',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
