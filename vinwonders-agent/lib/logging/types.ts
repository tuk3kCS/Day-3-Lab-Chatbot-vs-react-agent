import type { LanguageModelUsage } from 'ai';

export type LogLevel = 'info' | 'warn' | 'error';

export type TokenCostBreakdown = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  simulatedCostUsd: number;
  actualCostUsd: number;
  pricingModel: string;
};

export type ContextLogSnapshot = {
  totalUiMessages: number;
  windowUiMessages: number;
  prunedUiMessages: number;
  estimatedContextTokens: number;
  memoryActive: boolean;
};

export type AgentMetricsLog = {
  type: 'metrics';
  requestId: string;
  model: string;
  toolUsed: string | null;
  finishReason?: string;
  latencyMs: number;
  tokens: TokenCostBreakdown;
  context: ContextLogSnapshot;
  userMessagePreview: string;
};

export type AgentErrorLog = {
  type: 'error';
  requestId: string;
  model: string;
  latencyMs: number;
  message: string;
  stack?: string;
  context?: ContextLogSnapshot;
  userMessagePreview?: string;
};

export type ImprovementRollup = {
  updatedAt: string;
  totalRequests: number;
  totalErrors: number;
  avgLatencyMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalSimulatedCostUsd: number;
  toolUsage: Record<string, number>;
};

export function usageToTokens(usage: LanguageModelUsage): Omit<
  TokenCostBreakdown,
  'simulatedCostUsd' | 'actualCostUsd' | 'pricingModel'
> {
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const totalTokens = usage.totalTokens ?? inputTokens + outputTokens;
  return { inputTokens, outputTokens, totalTokens };
}
