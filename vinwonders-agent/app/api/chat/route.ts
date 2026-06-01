import {
  detectServerTool,
  getLastUserText,
  getToolHint,
  runBookRestaurant,
  runBuyTransportTicket,
  runSearchDestination,
  runHandleEmergency,
  runServerTool,
} from '@/lib/agent-tools';
import {
  CAPABILITIES_REPLY,
  isCapabilitiesQuestion,
} from '@/lib/agent-capabilities';
import {
  AGENT_LIMITS,
  buildAgentSystemPrompt,
  getStreamSettings,
  isClearlyOffTopic,
  OFF_TOPIC_REPLY,
  SECURITY_INPUT_REJECTED_REPLY,
  SECURITY_RATE_LIMIT_REPLY,
  validateUserMessage,
} from '@/lib/agent-policy';
import {
  createPolicyStreamResponse,
  createSilentStreamResponse,
} from '@/lib/fixed-reply';
import { getValidator } from '@/lib/guardrails';
import { evaluateConsecutiveSpamGuard } from '@/lib/tool-guard';
import {
  buildTokenCostFromUsage,
  logAgentError,
  logAgentMetrics,
  previewUserMessage,
  type ContextLogSnapshot,
} from '@/lib/logging';
import {
  buildKarpathyResponseRules,
  buildKarpathyToolSummaryHint,
} from '@/lib/karpathy-response-rules';
import { prepareConversationContext } from '@/lib/memory';
import { createOllamaChatModel } from '@/lib/ollama-client';
import {
  DEFAULT_OLLAMA_MODEL,
  modelSupportsNativeTools,
  resolveModelId,
} from '@/lib/ollama-config';
import { toOllamaMessages } from '@/lib/ollama-messages';
import { sanitizeToolOutputJson } from '@/lib/security';
import { evaluateToolGuard } from '@/lib/tool-guard';
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  stepCountIs,
  streamText,
  tool,
  type LanguageModelUsage,
  type UIMessage,
} from 'ai';
import { z } from 'zod';

function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

function getUserId(req: Request, requestId: string): string {
  return req.headers.get('x-user-id') ?? `anon-${requestId.slice(0, 8)}`;
}

function buildAgentTools() {
  return {
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
      execute: async ({ keyword, category }) =>
        runSearchDestination(keyword, category),
    }),
    bookRestaurant: tool({
      description:
        'Đặt bàn nhà hàng tại VinWonders. Dùng khi khách muốn giữ chỗ, đặt bàn, reserve.',
      inputSchema: z.object({
        restaurantId: z.string().optional(),
        restaurantName: z.string().optional(),
        guestName: z.string().optional(),
        partySize: z.number().optional(),
        dateTime: z.string().optional(),
        notes: z.string().optional(),
      }),
      execute: async (input) => runBookRestaurant(input, [], ''),
    }),
    handleEmergency: tool({
      description: 'Xử lý mất đồ, lạc trẻ em, sự cố y tế khẩn cấp.',
      inputSchema: z.object({
        type: z.enum(['lost_item', 'medical', 'other']),
        description: z.string(),
      }),
      execute: async ({ type, description }) =>
        runHandleEmergency(type, description),
    }),
    buyTransportTicket: tool({
      description:
        'Mua vé xe buýt công cộng để di chuyển giữa các khu trong VinWonders.',
      inputSchema: z.object({
        destination: z.string().describe('Tên khu/điểm đến'),
        quantity: z.number().int().min(1).max(20).describe('Số lượng vé'),
        passengerType: z
          .enum(['adult', 'child', 'senior', 'disabled'])
          .describe('Loại hành khách'),
        departureTime: z.string().optional().describe('Giờ khởi hành'),
      }),
      execute: async ({
        destination,
        quantity,
        passengerType,
        departureTime,
      }) =>
        runBuyTransportTicket(
          destination,
          quantity,
          passengerType,
          departureTime,
        ),
    }),
  };
}

function toContextSnapshot(
  ctx: ReturnType<typeof prepareConversationContext>,
): ContextLogSnapshot {
  return {
    totalUiMessages: ctx.stats.totalUiMessages,
    windowUiMessages: ctx.stats.windowUiMessages,
    prunedUiMessages: ctx.stats.prunedUiMessages,
    estimatedContextTokens: ctx.stats.estimatedTokens,
    memoryActive: Boolean(ctx.memorySummary),
  };
}

type RequestMeta = {
  requestId: string;
  startTime: number;
  userPreview: string;
  context: ContextLogSnapshot;
  toolUsed: string | null;
  modelId: string;
};

function createOnFinish(
  meta: RequestMeta,
  validator = getValidator(),
) {
  return async ({
    usage,
    finishReason,
  }: {
    usage: LanguageModelUsage;
    finishReason?: string;
  }) => {
    validator.trackResourceUsage(
      meta.requestId,
      usage.inputTokens ?? 0,
      usage.outputTokens ?? 0,
      1,
    );

    await logAgentMetrics({
      requestId: meta.requestId,
      model: meta.modelId,
      toolUsed: meta.toolUsed,
      finishReason,
      latencyMs: Math.round(performance.now() - meta.startTime),
      tokens: buildTokenCostFromUsage(
        usage.inputTokens ?? 0,
        usage.outputTokens ?? 0,
        meta.modelId,
      ),
      context: meta.context,
      userMessagePreview: meta.userPreview,
    });
  };
}

async function logPolicyReply(meta: RequestMeta, replyLength: number) {
  await logAgentMetrics({
    requestId: meta.requestId,
    model: meta.modelId,
    toolUsed: meta.toolUsed,
    finishReason: 'policy',
    latencyMs: Math.round(performance.now() - meta.startTime),
    tokens: buildTokenCostFromUsage(
      0,
      Math.ceil(replyLength / 4),
      meta.modelId,
    ),
    context: meta.context,
    userMessagePreview: meta.userPreview,
  });
}

export async function POST(req: Request) {
  const requestId = generateId();
  const startTime = performance.now();
  const validator = getValidator();
  const userId = getUserId(req, requestId);
  const clientIp = getClientIp(req);

  let messages: UIMessage[];
  let modelId = DEFAULT_OLLAMA_MODEL;

  try {
    const body = await req.json();
    messages = body.messages;
    modelId = resolveModelId(body.model);
  } catch (error) {
    await logAgentError({
      requestId,
      model: modelId,
      latencyMs: Math.round(performance.now() - startTime),
      message: error instanceof Error ? error.message : 'Invalid JSON body',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return Response.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 400 });
  }

  if (!validator.checkRateLimit(userId, clientIp)) {
    return Response.json(
      { error: SECURITY_RATE_LIMIT_REPLY, code: 'RATE_LIMIT_EXCEEDED' },
      { status: 429 },
    );
  }

  const useNativeTools = modelSupportsNativeTools(modelId);
  const chatModel = createOllamaChatModel(modelId);

  const ctx = prepareConversationContext(messages);
  const modelMessages = toOllamaMessages(ctx.windowMessages);
  const system = buildAgentSystemPrompt(
    ctx.memorySummary,
    buildKarpathyResponseRules(),
  );
  const lastUserText = getLastUserText(messages);
  const userPreview = previewUserMessage(lastUserText);
  const contextSnapshot = toContextSnapshot(ctx);

  const baseMeta: RequestMeta = {
    requestId,
    startTime,
    userPreview,
    context: contextSnapshot,
    toolUsed: null,
    modelId,
  };

  const inputCheck = validateUserMessage(lastUserText);
  if (!inputCheck.ok) {
    const meta = { ...baseMeta, toolUsed: `policy_${inputCheck.reason}` };
    await logPolicyReply(meta, inputCheck.message.length);
    return createPolicyStreamResponse(messages, inputCheck.message);
  }

  if (!validator.validateInput(lastUserText, userId)) {
    const meta = { ...baseMeta, toolUsed: 'policy_security_input' };
    await logPolicyReply(meta, SECURITY_INPUT_REJECTED_REPLY.length);
    return createPolicyStreamResponse(messages, SECURITY_INPUT_REJECTED_REPLY);
  }

  const spamGuard = evaluateConsecutiveSpamGuard(messages);
  if (!spamGuard.allow) {
    const meta = { ...baseMeta, toolUsed: 'policy_spam_silent' };
    await logPolicyReply(meta, 0);
    return createSilentStreamResponse(messages);
  }

  if (isCapabilitiesQuestion(lastUserText)) {
    const meta = { ...baseMeta, toolUsed: 'policy_capabilities' };
    await logPolicyReply(meta, CAPABILITIES_REPLY.length);
    return createPolicyStreamResponse(messages, CAPABILITIES_REPLY);
  }

  if (isClearlyOffTopic(lastUserText)) {
    const meta = { ...baseMeta, toolUsed: 'policy_off_topic' };
    await logPolicyReply(meta, OFF_TOPIC_REPLY.length);
    return createPolicyStreamResponse(messages, OFF_TOPIC_REPLY);
  }

  try {
    const serverTool = detectServerTool(lastUserText, messages);

    if (serverTool) {
      const guard = evaluateToolGuard(messages, serverTool, lastUserText);
      if (!guard.allow) {
        const meta = {
          ...baseMeta,
          toolUsed: `policy_tool_${guard.reason}`,
        };
        await logPolicyReply(meta, guard.message.length);
        return createPolicyStreamResponse(messages, guard.message);
      }
    }

    if (!useNativeTools) {
      if (serverTool) {
        const meta: RequestMeta = {
          ...baseMeta,
          toolUsed: serverTool.name,
        };
        const { name, input, output } = await runServerTool(
          serverTool,
          messages,
          lastUserText,
        );
        const toolCallId = generateId();
        const toolHint = getToolHint(name);
        const safeOutput = sanitizeToolOutputJson(output);

        return createUIMessageStreamResponse({
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

              const summary = streamText({
                model: chatModel,
                messages: modelMessages,
                system: `${system}\n\n${toolHint}\n\n${buildKarpathyToolSummaryHint(name)}\n\nKết quả công cụ "${name}": ${safeOutput}.`,
                ...getStreamSettings({ afterTool: true }),
                onFinish: createOnFinish(meta, validator),
              });
              for await (const chunk of summary.toUIMessageStream({
                sendStart: false,
                sendFinish: false,
              })) {
                if (
                  chunk.type === 'text-start' ||
                  chunk.type === 'text-delta' ||
                  chunk.type === 'text-end'
                ) {
                  writer.write(chunk);
                }
              }
            },
          }),
        });
      }

      const result = streamText({
        model: chatModel,
        messages: modelMessages,
        system,
        ...getStreamSettings(),
        onFinish: createOnFinish(baseMeta, validator),
      });

      return result.toUIMessageStreamResponse();
    }

    const result = streamText({
      model: chatModel,
      messages: modelMessages,
      system: `${system}

Công cụ: searchDestination, bookRestaurant, handleEmergency, buyTransportTicket — chỉ khi in-scope VinWonders.
Không gọi lại công cụ đã có kết quả; không lộ email/SĐT/CCCD trong câu trả lời trừ khi khách vừa cung cấp để đặt phòng.`,
      tools: buildAgentTools(),
      stopWhen: stepCountIs(AGENT_LIMITS.maxAgentToolSteps),
      ...getStreamSettings(),
      onFinish: createOnFinish(baseMeta, validator),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    await logAgentError({
      requestId,
      model: modelId,
      latencyMs: Math.round(performance.now() - startTime),
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context: contextSnapshot,
      userMessagePreview: userPreview,
    });

    return Response.json(
      { error: 'Không thể xử lý yêu cầu. Vui lòng thử lại sau.' },
      { status: 500 },
    );
  }
}
