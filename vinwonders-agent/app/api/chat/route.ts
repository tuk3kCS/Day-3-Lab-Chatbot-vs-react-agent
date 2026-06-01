import {
  detectServerTool,
  getLastUserText,
  runSearchDestination,
  runHandleEmergency,
  runBuyTransportTicket,
  runServerTool,
} from '@/lib/agent-tools';
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
    execute: async ({ keyword, category }) =>
      runSearchDestination(keyword, category),
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
    description: 'Mua vé xe buýt công cộng để di chuyển đến các khu trong VinWonders.',
    inputSchema: z.object({
      destination: z.string().describe('Tên khu/điểm đến (ví dụ: safari, grand_world, ocean_park)'),
      quantity: z.number().int().min(1).max(20).describe('Số lượng vé'),
      passengerType: z
        .enum(['adult', 'child', 'senior', 'disabled'])
        .describe('Loại hành khách'),
      departureTime: z.string().optional().describe('Giờ khởi hành mong muốn (tùy chọn)'),
    }),
    execute: async ({ destination, quantity, passengerType, departureTime }) =>
      runBuyTransportTicket(destination, quantity, passengerType, departureTime),
  }),
};

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

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const startTime = performance.now();

  const ctx = prepareConversationContext(messages);
  const modelMessages = toOllamaMessages(ctx.windowMessages);

  const contextNote =
    ctx.stats.prunedUiMessages > 0
      ? `[Context window] Đang gửi ${ctx.stats.windowUiMessages}/${ctx.stats.totalUiMessages} tin gần nhất (~${ctx.stats.estimatedTokens} tokens ước lượng).`
      : '';

  const system = buildSystemPrompt(ctx.memorySummary, contextNote);

  const onFinish = ({ usage }: { usage: LanguageModelUsage }) =>
    logMetrics(usage, startTime);

  const responseHeaders = {
    'X-Context-Total': String(ctx.stats.totalUiMessages),
    'X-Context-Window': String(ctx.stats.windowUiMessages),
    'X-Context-Pruned': String(ctx.stats.prunedUiMessages),
    'X-Context-Tokens': String(ctx.stats.estimatedTokens),
    'X-Memory-Active': ctx.memorySummary ? '1' : '0',
  };

  if (!MODEL_SUPPORTS_TOOLS) {
    const serverTool = detectServerTool(getLastUserText(messages));

    if (serverTool) {
      const { name, input, output } = await runServerTool(serverTool);
      const toolCallId = generateId();

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
                : name === 'buyTransportTicket'
                ? 'Tóm tắt thông tin vé xe buýt cho khách: mã vé, tuyến xe, bến lên xe, giờ khởi hành, tổng tiền.'
                : 'Tóm tắt kết quả khẩn cấp cho khách.';

            const summary = streamText({
              model: ollamaModel,
              messages: modelMessages,
              system: `${system}\n\n${toolHint}\n\nKết quả công cụ "${name}": ${JSON.stringify(output)}.`,
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
Nếu khách báo mất đồ / y tế khẩn cấp → gọi handleEmergency.
Nếu khách muốn mua vé xe buýt / hỏi phương tiện di chuyển → gọi buyTransportTicket.`,
    tools: agentTools,
    onFinish,
  });

  return result.toUIMessageStreamResponse({ headers: responseHeaders });
}
