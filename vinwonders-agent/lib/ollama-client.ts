import { createOpenAI } from '@ai-sdk/openai';
import { OLLAMA_API_BASE } from './ollama-config';

const ollamaProvider = createOpenAI({
  baseURL: `${OLLAMA_API_BASE}/v1`,
  apiKey: 'ollama',
});

export function createOllamaChatModel(modelId: string) {
  return ollamaProvider.chat(modelId);
}
