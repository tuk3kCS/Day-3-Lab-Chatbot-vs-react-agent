import type { UIMessage } from 'ai';

export type TraceStepStatus = 'pending' | 'running' | 'success' | 'error';

export type TraceStepKind = 'tool' | 'llm' | 'policy';

export type TraceStep = {
  id: string;
  kind: TraceStepKind;
  name: string;
  label: string;
  status: TraceStepStatus;
  input?: unknown;
  output?: unknown;
  summary?: string;
};

export type TraceTurn = {
  turnIndex: number;
  messageId: string;
  userText: string;
  steps: TraceStep[];
};

const TOOL_LABELS: Record<string, string> = {
  searchDestination: 'Tìm địa điểm',
  bookRestaurant: 'Đặt bàn nhà hàng',
  handleEmergency: 'Xử lý khẩn cấp',
};

function getUserText(message: UIMessage): string {
  return message.parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join(' ')
    .trim();
}

function toolNameFromPartType(type: string): string {
  return type.replace(/^tool-/, '');
}

function summarizeOutput(toolName: string, output: unknown): string {
  if (!output || typeof output !== 'object') return '';
  const o = output as Record<string, unknown>;

  if (toolName === 'searchDestination' && Array.isArray(o.results)) {
    const n = o.results.length;
    const names = (o.results as { name?: string }[])
      .slice(0, 3)
      .map((r) => r.name)
      .filter(Boolean);
    return n === 0
      ? 'Không có kết quả'
      : `${n} địa điểm${names.length ? `: ${names.join(', ')}` : ''}${n > 3 ? '…' : ''}`;
  }
  if (toolName === 'handleEmergency' && typeof o.ticketId === 'string') {
    return `Ticket ${o.ticketId}`;
  }
  if (toolName === 'bookRestaurant' && typeof o.bookingCode === 'string') {
    return `Mã ${o.bookingCode}`;
  }
  if (typeof o.message === 'string') {
    return o.message.length > 80 ? `${o.message.slice(0, 80)}…` : o.message;
  }
  return '';
}

function mapToolState(
  state: string | undefined,
  isStreamingMessage: boolean,
): TraceStepStatus {
  if (state === 'output-error') return 'error';
  if (state === 'output-available') return 'success';
  if (
    state === 'input-available' ||
    state === 'input-streaming' ||
    (isStreamingMessage && !state)
  ) {
    return 'running';
  }
  return 'pending';
}

function inferPolicyLabel(text: string): string | null {
  if (text.startsWith('Chào bạn! Mình là trợ lý')) return 'Giới thiệu chức năng (policy)';
  if (text.startsWith('Mình chỉ hỗ trợ thông tin')) return 'Ngoài phạm vi (policy)';
  if (text.includes('giới hạn') && text.includes('ký tự')) return 'Kiểm tra độ dài tin';
  if (text.startsWith('Vui lòng nhập')) return 'Tin nhắn trống';
  if (text.startsWith('Mình đã xử lý yêu cầu tương tự')) {
    return 'Chặn tool trùng (policy)';
  }
  if (text.startsWith('Bạn gửi quá nhiều lệnh giống nhau')) {
    return 'Giới hạn spam tool (policy)';
  }
  return null;
}

function buildStepsFromAssistant(
  message: UIMessage,
  isStreamingMessage: boolean,
): TraceStep[] {
  const steps: TraceStep[] = [];
  const toolByCallId = new Map<string, TraceStep>();

  for (const part of message.parts) {
    if (part.type.startsWith('tool-')) {
      const toolName = toolNameFromPartType(part.type);
      const callId =
        'toolCallId' in part && typeof part.toolCallId === 'string'
          ? part.toolCallId
          : `${message.id}-${toolName}`;

      let step = toolByCallId.get(callId);
      if (!step) {
        step = {
          id: callId,
          kind: 'tool',
          name: toolName,
          label: TOOL_LABELS[toolName] ?? toolName,
          status: 'pending',
        };
        toolByCallId.set(callId, step);
        steps.push(step);
      }

      step.status = mapToolState(
        'state' in part ? (part.state as string) : undefined,
        isStreamingMessage,
      );

      if ('input' in part && part.input !== undefined) {
        step.input = part.input;
      }
      const partState = 'state' in part ? part.state : undefined;
      if (
        partState === 'output-available' &&
        'output' in part &&
        part.output !== undefined
      ) {
        step.output = part.output;
        step.summary = summarizeOutput(toolName, part.output);
      }
      if (partState === 'output-error' && 'errorText' in part) {
        step.summary = String(part.errorText);
      }
      continue;
    }

    if (part.type === 'text') {
      const text = part.text.trim();
      const isTextStreaming =
        isStreamingMessage &&
        'state' in part &&
        part.state === 'streaming';

      if (!text && !isTextStreaming) continue;

      const policyLabel = text ? inferPolicyLabel(text) : null;
      const llmId = `${message.id}-llm`;

      const existingLlm = steps.find((s) => s.id === llmId);
      if (existingLlm) {
        if (policyLabel) {
          existingLlm.kind = 'policy';
          existingLlm.label = policyLabel;
          existingLlm.name = 'policy';
        }
        existingLlm.status = isTextStreaming ? 'running' : 'success';
        if (text) {
          existingLlm.summary =
            text.length > 100 ? `${text.slice(0, 100)}…` : text;
        }
        continue;
      }

      steps.push({
        id: llmId,
        kind: policyLabel ? 'policy' : 'llm',
        name: policyLabel ? 'policy' : 'llm',
        label: policyLabel ?? 'Tóm tắt / trả lời AI',
        status: isTextStreaming ? 'running' : text ? 'success' : 'running',
        summary: text
          ? text.length > 100
            ? `${text.slice(0, 100)}…`
            : text
          : undefined,
      });
    }
  }

  return steps;
}

/** Trích timeline tool/LLM từ hội thoại — dùng cho panel trace bên phải. */
export function extractToolTrace(
  messages: UIMessage[],
  options?: {
    streamingMessageId?: string | null;
    isBusy?: boolean;
  },
): TraceTurn[] {
  const turns: TraceTurn[] = [];
  let turnIndex = 0;
  let pendingUserText = '';

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    if (message.role === 'user') {
      pendingUserText = getUserText(message);
      continue;
    }

    if (message.role !== 'assistant') continue;

    const isStreamingMessage =
      options?.isBusy === true &&
      message.id === options.streamingMessageId;

    const steps = buildStepsFromAssistant(message, isStreamingMessage);

    if (steps.length === 0 && options?.isBusy && isStreamingMessage) {
      steps.push({
        id: `${message.id}-waiting`,
        kind: 'llm',
        name: 'thinking',
        label: 'Đang phân tích…',
        status: 'running',
      });
    }

    turns.push({
      turnIndex: turnIndex++,
      messageId: message.id,
      userText: pendingUserText || '(tin nhắn trước)',
      steps,
    });
    pendingUserText = '';
  }

  if (
    options?.isBusy &&
    messages.length > 0 &&
    messages[messages.length - 1]?.role === 'user'
  ) {
    turns.push({
      turnIndex: turnIndex,
      messageId: 'pending',
      userText: getUserText(messages[messages.length - 1]),
      steps: [
        {
          id: 'pending-route',
          kind: 'llm',
          name: 'routing',
          label: 'Đang xử lý yêu cầu…',
          status: 'running',
        },
      ],
    });
  }

  return turns;
}
