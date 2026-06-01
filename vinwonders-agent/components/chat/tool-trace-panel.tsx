'use client';

import {
  extractToolTrace,
  type TraceStep,
  type TraceStepStatus,
  type TraceTurn,
} from '@/lib/tool-trace';
import type { UIMessage } from 'ai';
import {
  Bot,
  ChevronDown,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
  Workflow,
} from 'lucide-react';
import { useMemo, useState } from 'react';

const STATUS_STYLES: Record<
  TraceStepStatus,
  { dot: string; ring: string; label: string }
> = {
  pending: {
    dot: 'bg-zinc-600',
    ring: 'ring-zinc-600/30',
    label: 'text-zinc-500',
  },
  running: {
    dot: 'bg-amber-400 animate-pulse',
    ring: 'ring-amber-400/40',
    label: 'text-amber-400',
  },
  success: {
    dot: 'bg-emerald-400',
    ring: 'ring-emerald-400/30',
    label: 'text-emerald-400',
  },
  error: {
    dot: 'bg-red-400',
    ring: 'ring-red-400/30',
    label: 'text-red-400',
  },
};

const STATUS_LABEL: Record<TraceStepStatus, string> = {
  pending: 'Chờ',
  running: 'Đang chạy',
  success: 'Xong',
  error: 'Lỗi',
};

function StepRow({ step }: { step: TraceStep }) {
  const [open, setOpen] = useState(false);
  const style = STATUS_STYLES[step.status];
  const hasDetail = step.input !== undefined || step.output !== undefined;

  return (
    <li className="relative pl-5">
      <span
        className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ${style.dot} ${style.ring}`}
        aria-hidden
      />
      <div className="rounded-lg border border-[var(--vw-border)] bg-[var(--vw-bg)]/80 p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-zinc-200">{step.label}</p>
            <p className="mt-0.5 font-mono text-[10px] text-zinc-600">{step.name}</p>
          </div>
          <span className={`shrink-0 text-[10px] font-medium ${style.label}`}>
            {STATUS_LABEL[step.status]}
          </span>
        </div>
        {step.summary && (
          <p className="mt-1.5 text-[11px] leading-snug text-zinc-500">{step.summary}</p>
        )}
        {hasDetail && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2 flex items-center gap-1 text-[10px] text-[var(--vw-gold-dim)] hover:text-[var(--vw-gold)]"
          >
            {open ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Input / Output
          </button>
        )}
        {open && hasDetail && (
          <div className="mt-2 space-y-2">
            {step.input !== undefined && (
              <pre className="max-h-28 overflow-auto rounded-md bg-zinc-950/80 p-2 font-mono text-[10px] leading-relaxed text-zinc-400">
                {JSON.stringify(step.input, null, 2)}
              </pre>
            )}
            {step.output !== undefined && (
              <pre className="max-h-36 overflow-auto rounded-md bg-zinc-950/80 p-2 font-mono text-[10px] leading-relaxed text-emerald-400/90">
                {JSON.stringify(step.output, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function TurnBlock({ turn, isActive }: { turn: TraceTurn; isActive?: boolean }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section
      className={`rounded-xl border p-3 transition ${
        isActive
          ? 'border-[var(--vw-gold)]/40 bg-[var(--vw-gold)]/5'
          : 'border-[var(--vw-border)] bg-[var(--vw-surface)]/60'
      }`}
    >
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-start gap-2 text-left"
      >
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-[10px] font-bold text-zinc-400">
          {turn.turnIndex + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            Câu hỏi
          </p>
          <p className="line-clamp-2 text-xs text-zinc-300">{turn.userText}</p>
        </div>
        {collapsed ? (
          <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-zinc-600" />
        )}
      </button>
      {!collapsed && (
        <ol className="mt-3 space-y-3 border-l border-[var(--vw-border)] ml-1">
          {turn.steps.map((step) => (
            <StepRow key={step.id} step={step} />
          ))}
        </ol>
      )}
    </section>
  );
}

type ToolTracePanelProps = {
  messages: UIMessage[];
  status: string;
  modelId: string;
  className?: string;
  onClose?: () => void;
};

export function ToolTracePanel({
  messages,
  status,
  modelId,
  className = '',
  onClose,
}: ToolTracePanelProps) {
  const isBusy = status === 'submitted' || status === 'streaming';
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');

  const turns = useMemo(
    () =>
      extractToolTrace(messages, {
        isBusy,
        streamingMessageId: isBusy ? lastAssistant?.id : null,
      }),
    [messages, isBusy, lastAssistant?.id],
  );

  const activeTurnIndex = turns.length > 0 ? turns.length - 1 : -1;

  return (
    <aside
      className={`flex h-full w-full flex-col border-[var(--vw-border)] bg-[var(--vw-surface)]/95 ${className}`}
      aria-label="Agent tool trace"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--vw-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-[var(--vw-gold)]" />
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Agent Trace</h2>
            <p className="text-[10px] text-zinc-500">Luồng tool & phản hồi</p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 lg:hidden"
            aria-label="Đóng trace"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="border-b border-[var(--vw-border)] px-4 py-2 text-[10px] text-zinc-500">
        <span className="text-zinc-600">Model:</span>{' '}
        <span className="font-mono text-zinc-400">{modelId}</span>
        <span className="mx-2 text-zinc-700">·</span>
        <span className={isBusy ? 'text-amber-400' : 'text-emerald-400'}>
          {isBusy ? 'Đang xử lý' : 'Sẵn sàng'}
        </span>
      </div>

      <div className="vw-scrollbar flex-1 overflow-y-auto p-3">
        {turns.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <Bot className="mb-3 h-10 w-10 text-zinc-700" />
            <p className="text-sm text-zinc-500">Chưa có bước xử lý</p>
            <p className="mt-1 text-xs text-zinc-600">
              Gửi câu hỏi để xem agent gọi tool nào, input/output ra sao.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {turns.map((turn, i) => (
              <TurnBlock
                key={`${turn.messageId}-${turn.turnIndex}`}
                turn={turn}
                isActive={i === activeTurnIndex && isBusy}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

export function ToolTraceToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--vw-border)] px-2.5 py-1 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 lg:hidden"
      aria-expanded={open}
      aria-label={open ? 'Ẩn agent trace' : 'Hiện agent trace'}
    >
      {open ? (
        <PanelRightClose className="h-3.5 w-3.5" />
      ) : (
        <PanelRightOpen className="h-3.5 w-3.5" />
      )}
      Trace
    </button>
  );
}
