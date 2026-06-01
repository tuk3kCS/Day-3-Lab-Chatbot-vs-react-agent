import type { UIMessage } from 'ai';
import {
  DEFAULT_CONTEXT_CONFIG,
  estimateTokens,
  trimToContextWindow,
  type ContextWindowConfig,
  type ContextWindowStats,
} from './context-window';
import { buildMemorySummary, extractSessionFacts } from './session-memory';

export type PreparedConversationContext = {
  /** Tin nhắn trong cửa sổ gửi tới model */
  windowMessages: UIMessage[];
  /** Tin bị cắt khỏi cửa sổ (dùng cho memory summary) */
  prunedMessages: UIMessage[];
  memorySummary: string;
  stats: ContextWindowStats;
};

export function prepareConversationContext(
  messages: UIMessage[],
  config: ContextWindowConfig = DEFAULT_CONTEXT_CONFIG,
): PreparedConversationContext {
  const conversational = messages.filter(
    (m) => m.role === 'user' || m.role === 'assistant',
  );

  const { windowMessages, stats } = trimToContextWindow(messages, config);
  const prunedMessages = conversational.slice(
    0,
    Math.max(0, conversational.length - windowMessages.length),
  );

  const memoryFacts = extractSessionFacts(
    prunedMessages.length > 0 ? messages : [],
  );
  const memorySummary = buildMemorySummary(memoryFacts);

  return {
    windowMessages,
    prunedMessages,
    memorySummary,
    stats: {
      ...stats,
      prunedUiMessages: prunedMessages.length,
    },
  };
}

export {
  DEFAULT_CONTEXT_CONFIG,
  trimToContextWindow,
  estimateTokens,
  type ContextWindowConfig,
  type ContextWindowStats,
};
export { extractSessionFacts, buildMemorySummary, type SessionFact } from './session-memory';
