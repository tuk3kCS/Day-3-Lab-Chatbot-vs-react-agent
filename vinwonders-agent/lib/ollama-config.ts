/** Cấu hình Ollama dùng chung (server + client types). */

export const DEFAULT_OLLAMA_MODEL =
  process.env.OLLAMA_MODEL ?? 'qwen2:1.5b';

export const OLLAMA_API_BASE =
  process.env.OLLAMA_BASE_URL?.replace(/\/v1\/?$/, '') ??
  'http://localhost:11434';

const MODEL_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/;
const MAX_MODEL_ID_LENGTH = 128;

export type OllamaModelOption = {
  id: string;
  label: string;
  supportsTools: boolean;
  description?: string;
};

/** Danh sách gợi ý khi không kết nối được Ollama */
export const FALLBACK_MODELS: OllamaModelOption[] = [
  {
    id: 'qwen2:1.5b',
    label: 'qwen2:1.5b',
    supportsTools: false,
    description: 'Nhẹ, lab (công cụ phía server)',
  },
  {
    id: 'qwen2:7b',
    label: 'qwen2:7b',
    supportsTools: true,
    description: 'Cân bằng',
  },
  {
    id: 'llama3.2:3b',
    label: 'llama3.2:3b',
    supportsTools: true,
    description: 'Nhỏ, đa năng',
  },
  {
    id: 'llama3.2:latest',
    label: 'llama3.2:latest',
    supportsTools: true,
    description: 'Llama 3.2',
  },
];

export function resolveModelId(requested?: string | null): string {
  if (!requested?.trim()) return DEFAULT_OLLAMA_MODEL;
  const id = requested.trim();
  if (id.length > MAX_MODEL_ID_LENGTH || !MODEL_ID_PATTERN.test(id)) {
    return DEFAULT_OLLAMA_MODEL;
  }
  return id;
}

/** Model nhỏ 1.5b thường không gọi tool native — dùng routing server. */
export function modelSupportsNativeTools(modelId: string): boolean {
  if (process.env.OLLAMA_SUPPORTS_TOOLS === 'true') return true;
  if (process.env.OLLAMA_SUPPORTS_TOOLS === 'false') return false;
  return !modelId.includes('1.5b');
}

export function modelOptionFromId(id: string): OllamaModelOption {
  return {
    id,
    label: id,
    supportsTools: modelSupportsNativeTools(id),
  };
}
