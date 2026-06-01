'use client';

import type { OllamaModelOption } from '@/lib/ollama-config';
import { Cpu, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'vinwonders-selected-model';

type ModelsApiResponse = {
  models: OllamaModelOption[];
  defaultModel: string;
  source: 'ollama' | 'fallback';
  hint?: string;
};

type ModelSelectorProps = {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
};

export function ModelSelector({
  value,
  onChange,
  disabled,
}: ModelSelectorProps) {
  const [models, setModels] = useState<OllamaModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [hint, setHint] = useState<string | null>(null);

  const applyDefault = useCallback(
    (list: OllamaModelOption[], defaultModel: string) => {
      setModels(list);
      const stored =
        typeof window !== 'undefined'
          ? localStorage.getItem(STORAGE_KEY)
          : null;
      const pick =
        stored && list.some((m) => m.id === stored) ? stored : defaultModel;
      if (pick && pick !== value) onChange(pick);
      else if (!value && pick) onChange(pick);
    },
    [onChange, value],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/models');
        const data = (await res.json()) as ModelsApiResponse;
        if (cancelled) return;
        setHint(data.source === 'fallback' ? (data.hint ?? null) : null);
        applyDefault(data.models, data.defaultModel);
      } catch {
        if (!cancelled) {
          setHint('Không tải được danh sách model.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [applyDefault]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    localStorage.setItem(STORAGE_KEY, next);
    onChange(next);
  };

  const selected = models.find((m) => m.id === value);

  return (
    <div className="flex min-w-0 flex-col items-end gap-0.5">
      <label className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
        <Cpu className="h-3 w-3" aria-hidden />
        Model
      </label>
      <div className="relative flex items-center">
        {loading && (
          <Loader2
            className="pointer-events-none absolute left-2 h-3.5 w-3.5 animate-spin text-zinc-500"
            aria-hidden
          />
        )}
        <select
          value={value}
          onChange={handleChange}
          disabled={disabled || loading || models.length === 0}
          aria-label="Chọn model Ollama"
          title={
            selected?.supportsTools
              ? 'Model hỗ trợ tool native'
              : 'Model dùng công cụ phía server (lab)'
          }
          className={`max-w-[9.5rem] truncate rounded-full border border-[var(--vw-border)] bg-[var(--vw-bg)] py-1 pr-7 text-xs text-zinc-200 transition hover:border-zinc-600 focus:border-[var(--vw-gold)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--vw-gold)]/30 disabled:opacity-50 sm:max-w-[11rem] ${
            loading ? 'pl-7' : 'pl-2.5'
          }`}
        >
          {models.length === 0 && (
            <option value="">Đang tải...</option>
          )}
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
              {!m.supportsTools ? ' · server tools' : ''}
            </option>
          ))}
        </select>
      </div>
      {hint && (
        <p className="max-w-[11rem] text-right text-[10px] leading-tight text-amber-500/90">
          {hint}
        </p>
      )}
    </div>
  );
}
