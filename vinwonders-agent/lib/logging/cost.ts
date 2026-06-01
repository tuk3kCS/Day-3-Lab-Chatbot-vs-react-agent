import type { TokenCostBreakdown } from './types';

/** Giá tham chiếu (USD / 1M tokens) — chỉ để so sánh & continuous improvement */
const DEFAULT_INPUT_PER_1M = 0.15;
const DEFAULT_OUTPUT_PER_1M = 0.6;

export function calculateTokenCost(
  inputTokens: number,
  outputTokens: number,
  options?: { isLocalModel?: boolean; pricingModel?: string },
): TokenCostBreakdown {
  const inputRate =
    Number(process.env.COST_INPUT_PER_1M) || DEFAULT_INPUT_PER_1M;
  const outputRate =
    Number(process.env.COST_OUTPUT_PER_1M) || DEFAULT_OUTPUT_PER_1M;

  const simulatedCostUsd =
    (inputTokens * inputRate) / 1_000_000 +
    (outputTokens * outputRate) / 1_000_000;

  const isLocal = options?.isLocalModel ?? true;

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    simulatedCostUsd,
    actualCostUsd: isLocal ? 0 : simulatedCostUsd,
    pricingModel:
      options?.pricingModel ??
      (isLocal ? 'ollama-local' : 'cloud-reference'),
  };
}
