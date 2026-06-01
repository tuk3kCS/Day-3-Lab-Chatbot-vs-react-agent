import { appendFile, mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { sanitizeForLogging } from '@/lib/security/sanitization';
import { calculateTokenCost } from './cost';
import type {
  AgentErrorLog,
  AgentMetricsLog,
  ContextLogSnapshot,
  ImprovementRollup,
  TokenCostBreakdown,
} from './types';

const LOG_DIR = path.join(process.cwd(), 'logs');
const METRICS_FILE = 'metrics.jsonl';
const ERRORS_FILE = 'errors.jsonl';
const ROLLUP_FILE = 'improvement-rollup.json';

async function ensureLogDir(): Promise<void> {
  await mkdir(LOG_DIR, { recursive: true });
}

async function appendJsonl(filename: string, payload: object): Promise<void> {
  await ensureLogDir();
  const line = `${JSON.stringify({ ...payload, loggedAt: new Date().toISOString() })}\n`;
  await appendFile(path.join(LOG_DIR, filename), line, 'utf8');
}

async function readRollup(): Promise<ImprovementRollup> {
  try {
    const raw = await readFile(path.join(LOG_DIR, ROLLUP_FILE), 'utf8');
    return JSON.parse(raw) as ImprovementRollup;
  } catch {
    return {
      updatedAt: new Date().toISOString(),
      totalRequests: 0,
      totalErrors: 0,
      avgLatencyMs: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalSimulatedCostUsd: 0,
      toolUsage: {},
    };
  }
}

async function writeRollup(rollup: ImprovementRollup): Promise<void> {
  await ensureLogDir();
  await writeFile(
    path.join(LOG_DIR, ROLLUP_FILE),
    JSON.stringify(rollup, null, 2),
    'utf8',
  );
}

async function updateRollupFromMetrics(entry: AgentMetricsLog): Promise<void> {
  const prev = await readRollup();
  const n = prev.totalRequests + 1;
  const avgLatencyMs =
    (prev.avgLatencyMs * prev.totalRequests + entry.latencyMs) / n;

  const toolKey = entry.toolUsed ?? 'none';
  const toolUsage = {
    ...prev.toolUsage,
    [toolKey]: (prev.toolUsage[toolKey] ?? 0) + 1,
  };

  await writeRollup({
    updatedAt: new Date().toISOString(),
    totalRequests: n,
    totalErrors: prev.totalErrors,
    avgLatencyMs: Math.round(avgLatencyMs * 100) / 100,
    totalInputTokens: prev.totalInputTokens + entry.tokens.inputTokens,
    totalOutputTokens: prev.totalOutputTokens + entry.tokens.outputTokens,
    totalSimulatedCostUsd:
      Math.round(
        (prev.totalSimulatedCostUsd + entry.tokens.simulatedCostUsd) * 1_000_000,
      ) / 1_000_000,
    toolUsage,
  });
}

async function updateRollupFromError(): Promise<void> {
  const prev = await readRollup();
  await writeRollup({
    ...prev,
    updatedAt: new Date().toISOString(),
    totalErrors: prev.totalErrors + 1,
  });
}

function logToConsole(label: string, payload: object): void {
  if (process.env.LOG_SILENT === 'true') return;
  console.log(`[VinWonders Agent] ${label}`, JSON.stringify(payload));
}

export function previewUserMessage(text: string, maxLen = 80): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  const truncated =
    oneLine.length <= maxLen ? oneLine : `${oneLine.slice(0, maxLen)}…`;
  const redacted = sanitizeForLogging(truncated);
  return typeof redacted === 'string' ? redacted : truncated;
}

export async function logAgentMetrics(
  entry: Omit<AgentMetricsLog, 'type'>,
): Promise<void> {
  const record: AgentMetricsLog = {
    type: 'metrics',
    ...(sanitizeForLogging(entry) as Omit<AgentMetricsLog, 'type'>),
  };
  await appendJsonl(METRICS_FILE, record);
  await updateRollupFromMetrics(record);
  logToConsole('METRICS', record);
}

export async function logAgentError(
  entry: Omit<AgentErrorLog, 'type'>,
): Promise<void> {
  const record: AgentErrorLog = {
    type: 'error',
    ...(sanitizeForLogging(entry) as Omit<AgentErrorLog, 'type'>),
  };
  await appendJsonl(ERRORS_FILE, record);
  await updateRollupFromError();
  console.error('[VinWonders Agent] ERROR', JSON.stringify(record));
}

export function buildTokenCostFromUsage(
  inputTokens: number,
  outputTokens: number,
  modelId: string,
): TokenCostBreakdown {
  const isLocal =
    modelId.includes('ollama') ||
    !modelId.includes('gpt') ||
    process.env.OLLAMA_MODEL !== undefined;
  return calculateTokenCost(inputTokens, outputTokens, {
    isLocalModel: isLocal,
    pricingModel: modelId,
  });
}

export type { ContextLogSnapshot };
