import type { UIMessage } from 'ai';
import { AGENT_LIMITS } from './agent-policy';
import type { ServerTool } from './agent-tools';

type MessagePart = UIMessage['parts'][number];

function isToolPart(
  part: MessagePart,
): part is MessagePart & { type: string; state?: string } {
  return part.type.startsWith('tool-');
}

export type ToolGuardReason =
  | 'duplicate_message'
  | 'tool_rate_limit'
  | 'same_tool_cooldown';

export type ToolGuardResult =
  | { allow: true }
  | { allow: false; reason: ToolGuardReason; message: string };

export const TOOL_DUPLICATE_REPLY =
  'Mình đã xử lý yêu cầu tương tự ở tin nhắn trước. Nếu cần bổ sung, hãy ghi rõ điểm khác (vị trí, thời gian, loại đồ, số người…) nhé.';

export const TOOL_RATE_LIMIT_REPLY =
  'Bạn gửi quá nhiều lệnh giống nhau liên tiếp. Vui lòng đợi vài giây hoặc gộp vào một tin nhắn — mình vẫn nhớ ngữ cảnh trong phiên chat.';

export function normalizeUserText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getUserTexts(messages: UIMessage[]): string[] {
  return messages
    .filter((m) => m.role === 'user')
    .map((m) =>
      m.parts
        .filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join(' '),
    )
    .map((t) => t.trim())
    .filter(Boolean);
}

function countSuccessfulToolCalls(messages: UIMessage[], toolName: string): number {
  let count = 0;
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    for (const part of message.parts) {
      if (
        isToolPart(part) &&
        part.type === `tool-${toolName}` &&
        part.state === 'output-available'
      ) {
        count++;
      }
    }
  }
  return count;
}

/** Các lần gọi tool gần nhất (theo thứ tự thời gian). */
function getRecentToolNames(
  messages: UIMessage[],
  maxCalls: number,
): string[] {
  const names: string[] = [];
  for (let i = messages.length - 1; i >= 0 && names.length < maxCalls; i--) {
    const message = messages[i];
    if (message.role !== 'assistant') continue;
    for (let j = message.parts.length - 1; j >= 0; j--) {
      const part = message.parts[j];
      if (
        isToolPart(part) &&
        part.state === 'output-available'
      ) {
        names.unshift(part.type.replace(/^tool-/, ''));
        if (names.length >= maxCalls) return names;
      }
    }
  }
  return names;
}

/** Đếm số tin user giống hệt liên tiếp ở cuối hội thoại (gồm tin hiện tại). */
export function countConsecutiveIdenticalUserMessages(
  messages: UIMessage[],
): number {
  const userTexts = getUserTexts(messages);
  if (userTexts.length === 0) return 0;

  const target = normalizeUserText(userTexts[userTexts.length - 1]);
  if (!target) return 0;

  let count = 0;
  for (let i = userTexts.length - 1; i >= 0; i--) {
    if (normalizeUserText(userTexts[i]) === target) count++;
    else break;
  }
  return count;
}

export type ConsecutiveSpamGuardResult =
  | { allow: true }
  | { allow: false; silent: true; consecutiveCount: number };

/**
 * Lần thứ N (mặc định 3) gửi cùng một câu liên tiếp → không trả lời (silent stream).
 */
export function evaluateConsecutiveSpamGuard(
  messages: UIMessage[],
): ConsecutiveSpamGuardResult {
  const count = countConsecutiveIdenticalUserMessages(messages);
  if (count >= AGENT_LIMITS.maxConsecutiveDuplicateUserMessages) {
    return { allow: false, silent: true, consecutiveCount: count };
  }
  return { allow: true };
}

/**
 * Chặn gọi tool lặp khi khách spam cùng câu lệnh / cùng intent.
 * Dùng trước khi chạy server tool hoặc khi routing server phát hiện intent.
 */
export function evaluateToolGuard(
  messages: UIMessage[],
  tool: Pick<ServerTool, 'name'>,
  userText: string,
): ToolGuardResult {
  const normalized = normalizeUserText(userText);
  if (!normalized) return { allow: true };

  const consecutive = countConsecutiveIdenticalUserMessages(messages);
  if (consecutive >= 2) {
    return {
      allow: false,
      reason: 'duplicate_message',
      message: TOOL_DUPLICATE_REPLY,
    };
  }

  const sameToolCount = countSuccessfulToolCalls(messages, tool.name);
  if (sameToolCount >= AGENT_LIMITS.maxSameToolPerSession) {
    return {
      allow: false,
      reason: 'tool_rate_limit',
      message: TOOL_RATE_LIMIT_REPLY,
    };
  }

  const recentTools = getRecentToolNames(
    messages,
    AGENT_LIMITS.maxConsecutiveSameTool,
  );
  if (
    recentTools.length >= AGENT_LIMITS.maxConsecutiveSameTool &&
    recentTools.every((name) => name === tool.name)
  ) {
    return {
      allow: false,
      reason: 'same_tool_cooldown',
      message: TOOL_DUPLICATE_REPLY,
    };
  }

  return { allow: true };
}
