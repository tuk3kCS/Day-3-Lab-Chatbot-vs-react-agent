'use client';

import { ChatMessage, StreamingPlaceholder } from '@/components/chat/chat-message';
import { ModelSelector } from '@/components/chat/model-selector';
import {
  ToolTracePanel,
  ToolTraceToggle,
} from '@/components/chat/tool-trace-panel';
import { DEFAULT_OLLAMA_MODEL } from '@/lib/ollama-config';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { BookingDetails } from '@/components/chat/booking-form';
import { AGENT_LIMITS } from '@/lib/agent-policy';
import { countConsecutiveIdenticalUserMessages } from '@/lib/tool-guard';
import type { Destination } from '@/lib/mockData';
import {
  CalendarCheck,
  CircleHelp,
  CloudRain,
  Compass,
  Hotel,
  Loader2,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  Square,
  Ticket,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const MAX_INPUT_CHARS = AGENT_LIMITS.maxUserMessageChars;

const SUGGESTIONS = [
  {
    icon: CircleHelp,
    label: 'Bạn giúp được gì?',
    text: 'Bạn có thể giúp gì cho tôi tại VinWonders?',
    accent: 'hover:border-zinc-500/40 hover:bg-zinc-800/40',
  },
  {
    icon: ShieldAlert,
    label: 'Mất đồ khẩn cấp',
    text: 'Tôi bị rơi cái ví ở tàu lượn siêu tốc, giúp với!',
    accent: 'hover:border-red-500/40 hover:bg-red-950/30',
  },
  {
    icon: CloudRain,
    label: 'Trời mưa đi đâu?',
    text: 'Trời mưa thì nên đi chơi đâu?',
    accent: 'hover:border-blue-500/40 hover:bg-blue-950/20',
  },
  {
    icon: Sparkles,
    label: 'Khám phá Zeus',
    text: 'Giới thiệu tàu lượn Cơn thịnh nộ của Zeus',
    accent: 'hover:border-[var(--vw-gold)]/40 hover:bg-[var(--vw-gold)]/5',
  },
  {
    icon: CalendarCheck,
    label: 'Đặt bàn nhà hàng',
    text: 'Đặt bàn Nhà hàng Hải Vương 4 người lúc 12:30',
    accent: 'hover:border-emerald-500/40 hover:bg-emerald-950/20',
  },
  {
    icon: Hotel,
    label: 'Khách sạn nghỉ',
    text: 'Có khách sạn nào gần Grand World không?',
    accent: 'hover:border-indigo-500/40 hover:bg-indigo-950/20',
  },
  {
    icon: Ticket,
    label: 'Show buổi tối',
    text: 'Show Tata lúc mấy giờ và nên đến sớm bao lâu?',
    accent: 'hover:border-pink-500/40 hover:bg-pink-950/20',
  },
] as const;

const STATUS_MAP = {
  ready: {
    label: 'Sẵn sàng',
    className: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30',
  },
  submitted: {
    label: 'Đang gửi',
    className: 'bg-amber-500/15 text-amber-400 ring-amber-500/30',
  },
  streaming: {
    label: 'Đang trả lời',
    className: 'bg-amber-500/15 text-amber-400 ring-amber-500/30',
  },
  error: {
    label: 'Lỗi kết nối',
    className: 'bg-red-500/15 text-red-400 ring-red-500/30',
  },
} as const;

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_OLLAMA_MODEL);
  const [traceOpen, setTraceOpen] = useState(false);
  const [spamHint, setSpamHint] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendLockRef = useRef(false);

  const chatTransport = useMemo(
    () =>
      new DefaultChatTransport({
        body: { model: selectedModel },
      }),
    [selectedModel],
  );

  const { messages, sendMessage, status, error, stop, setMessages } = useChat({
    transport: chatTransport,
  });

  const isBusy = status === 'submitted' || status === 'streaming';
  const statusInfo = STATUS_MAP[status] ?? STATUS_MAP.ready;

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, status, scrollToBottom]);

  useEffect(() => {
    if (status === 'ready' || status === 'error') {
      sendLockRef.current = false;
    }
  }, [status]);

  const sendText = useCallback(
    (text: string) => {
      const trimmed = text.trim().slice(0, MAX_INPUT_CHARS);
      if (!trimmed || status !== 'ready' || sendLockRef.current) return;

      const pendingCount = countConsecutiveIdenticalUserMessages([
        ...messages,
        {
          id: 'pending',
          role: 'user',
          parts: [{ type: 'text', text: trimmed }],
        },
      ]);
      if (pendingCount >= AGENT_LIMITS.maxConsecutiveDuplicateUserMessages) {
        setSpamHint(
          'Bạn đã gửi cùng câu hỏi 3 lần liên tiếp. Vui lòng đợi hoặc đổi cách hỏi.',
        );
        return;
      }

      setSpamHint(null);
      sendLockRef.current = true;
      sendMessage({ text: trimmed });
      setInput('');
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [messages, sendMessage, status],
  );

  const handleConfirmBooking = useCallback(
    (restaurant: Destination, details: BookingDetails) => {
      const guestPart = details.guestName ? `, tên ${details.guestName}` : '';
      const notesPart = details.notes ? `, ghi chú: ${details.notes}` : '';
      sendText(
        `Đặt bàn giúp mình tại ${restaurant.name} cho ${details.partySize} người lúc ${details.dateTime}${guestPart}${notesPart}`,
      );
    },
    [sendText],
  );

  const handleClearSession = () => {
    if (isBusy) stop();
    setMessages([]);
    setInput('');
    setSpamHint(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendText(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const lastMessage = messages[messages.length - 1];
  const showStreamingPlaceholder =
    isBusy && lastMessage?.role === 'user';

  return (
    <div className="vw-app-bg flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-[var(--vw-border)]/80 bg-[var(--vw-surface)]/80 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 lg:max-w-none lg:px-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--vw-gold)] to-[var(--vw-gold-dim)] shadow-lg shadow-amber-900/30">
              <Compass className="h-5 w-5 text-zinc-950" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">
                VinWonders AI Agent
              </h1>
              <p className="truncate text-xs text-zinc-500">
                Trợ lý khách tham quan
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ToolTraceToggle
              open={traceOpen}
              onToggle={() => setTraceOpen((v) => !v)}
            />
            <ModelSelector
              value={selectedModel}
              onChange={setSelectedModel}
              disabled={isBusy}
            />
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClearSession}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--vw-border)] px-2.5 py-1 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Phiên mới
              </button>
            )}
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusInfo.className}`}
            >
              {isBusy && (
                <Loader2 className="mr-1 inline h-3 w-3 animate-spin" aria-hidden />
              )}
              {statusInfo.label}
            </span>
          </div>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="vw-scrollbar flex-1 overflow-y-auto px-4 py-6 sm:px-6"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {spamHint && (
            <div
              role="status"
              className="rounded-2xl border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200"
            >
              {spamHint}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-200"
            >
              <p className="font-medium">Không thể nhận phản hồi</p>
              <p className="mt-1 text-red-300/90">
                Vui lòng thử lại sau hoặc bấm Phiên mới.
              </p>
            </div>
          )}

          {messages.length === 0 && (
            <section className="flex flex-col items-center pt-6 pb-4 text-center sm:pt-10">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--vw-gold)]/10 ring-1 ring-[var(--vw-gold)]/20">
                <Sparkles className="h-8 w-8 text-[var(--vw-gold)]" />
              </div>
              <h2 className="text-lg font-semibold text-zinc-100">
                Chào mừng đến VinWonders
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
                Tìm địa điểm, đặt bàn nhà hàng, gợi ý khi trời mưa và hỗ trợ sự cố khẩn cấp.
                Bấm &quot;Bạn giúp được gì?&quot; để xem đầy đủ chức năng.
              </p>
              <div className="mt-6 grid w-full max-w-md gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    disabled={status !== 'ready'}
                    onClick={() => sendText(s.text)}
                    className={`flex items-center gap-3 rounded-2xl border border-[var(--vw-border)] bg-[var(--vw-surface)] px-4 py-3 text-left transition disabled:opacity-50 ${s.accent}`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--vw-surface-elevated)]">
                      <s.icon className="h-4 w-4 text-[var(--vw-gold)]" />
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-zinc-200">
                        {s.label}
                      </span>
                      <span className="mt-0.5 line-clamp-1 text-xs text-zinc-500">
                        {s.text}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {messages.map((m) => (
            <ChatMessage
              key={m.id}
              message={m}
              isStreaming={
                status === 'streaming' &&
                m.role === 'assistant' &&
                m.id === lastMessage?.id
              }
              onConfirmBooking={
                status === 'ready' ? handleConfirmBooking : undefined
              }
              bookingDisabled={isBusy}
            />
          ))}

          {showStreamingPlaceholder && <StreamingPlaceholder />}
        </div>
      </div>

      <footer className="shrink-0 border-t border-[var(--vw-border)]/80 bg-[var(--vw-surface)]/90 px-4 py-3 backdrop-blur-md sm:px-6">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-3xl items-end gap-2"
        >
          <div className="relative min-w-0 flex-1">
            <textarea
              ref={inputRef}
              value={input}
              maxLength={MAX_INPUT_CHARS}
              onChange={(e) => {
                setInput(e.target.value);
                if (spamHint) setSpamHint(null);
              }}
              onKeyDown={handleKeyDown}
              disabled={status !== 'ready'}
              rows={1}
              placeholder="Nhập câu hỏi... (Enter gửi)"
              aria-describedby="input-char-hint"
              className="max-h-32 min-h-[48px] w-full resize-none rounded-2xl border border-[var(--vw-border)] bg-[var(--vw-bg)] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[var(--vw-gold)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--vw-gold)]/20 disabled:opacity-50"
              onInput={(e) => {
                const target = e.currentTarget;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
              }}
            />
            {input.length > MAX_INPUT_CHARS * 0.85 && (
              <p
                id="input-char-hint"
                className={`absolute bottom-1 right-3 text-[10px] tabular-nums ${
                  input.length >= MAX_INPUT_CHARS
                    ? 'text-amber-400'
                    : 'text-zinc-600'
                }`}
              >
                {input.length}/{MAX_INPUT_CHARS}
              </p>
            )}
          </div>

          {isBusy ? (
            <button
              type="button"
              onClick={stop}
              aria-label="Dừng phản hồi"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-zinc-600 bg-zinc-800 text-zinc-300 transition hover:bg-zinc-700"
            >
              <Square className="h-4 w-4 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Gửi tin nhắn"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--vw-gold)] text-zinc-950 shadow-lg shadow-amber-900/25 transition hover:bg-amber-400 disabled:opacity-40"
            >
              <Send className="h-5 w-5" />
            </button>
          )}
        </form>
      </footer>
      </div>

      <ToolTracePanel
        messages={messages}
        status={status}
        modelId={selectedModel}
        className="hidden w-80 shrink-0 border-l xl:w-96 lg:flex"
      />

      {traceOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            aria-label="Đóng trace"
            onClick={() => setTraceOpen(false)}
          />
          <ToolTracePanel
            messages={messages}
            status={status}
            modelId={selectedModel}
            onClose={() => setTraceOpen(false)}
            className="fixed inset-y-0 right-0 z-50 w-[min(100%,20rem)] border-l shadow-2xl lg:hidden"
          />
        </>
      )}
    </div>
  );
}
