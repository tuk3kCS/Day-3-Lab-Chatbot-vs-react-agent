'use client';

import type { UIMessage } from 'ai';
import { Bot, User } from 'lucide-react';
import type { EmergencyResult, SearchResult, TransportTicketResult } from './types';
import {
  EmergencyCard,
  SearchDestinationCards,
  ToolLoadingCard,
  TransportTicketCard,
} from './tool-cards';

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      <span className="vw-typing-dot h-2 w-2 rounded-full bg-[var(--vw-gold)]" />
      <span className="vw-typing-dot h-2 w-2 rounded-full bg-[var(--vw-gold)]" />
      <span className="vw-typing-dot h-2 w-2 rounded-full bg-[var(--vw-gold)]" />
    </div>
  );
}

export function ChatMessage({
  message,
  isStreaming,
}: {
  message: UIMessage;
  isStreaming?: boolean;
}) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`vw-message-in flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          isUser
            ? 'bg-zinc-800 ring-1 ring-zinc-700'
            : 'bg-[var(--vw-gold)]/15 ring-1 ring-[var(--vw-gold)]/25'
        }`}
        aria-hidden
      >
        {isUser ? (
          <User className="h-4 w-4 text-zinc-400" />
        ) : (
          <Bot className="h-4 w-4 text-[var(--vw-gold)]" />
        )}
      </div>

      <div
        className={`flex min-w-0 max-w-[min(85%,32rem)] flex-col gap-2 ${
          isUser ? 'items-end' : 'items-start'
        }`}
      >
        <span className="px-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
          {isUser ? 'Bạn' : 'VinWonders AI'}
        </span>

        {message.parts.map((part, index) => {
          if (part.type === 'text') {
            const text = part.text;
            const isEmpty = !text.trim();
            const isStreamingText =
              !isUser && isStreaming && part.state === 'streaming';

            if (isEmpty && !isStreamingText) return null;

            return (
              <div
                key={index}
                className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  isUser
                    ? 'rounded-br-md bg-[var(--vw-gold)] text-zinc-950 shadow-md shadow-amber-900/20'
                    : 'rounded-bl-md border border-[var(--vw-border)] bg-[var(--vw-surface)] text-zinc-100'
                }`}
              >
                {text}
                {isStreamingText && !text && <TypingIndicator />}
              </div>
            );
          }

          if (part.type === 'tool-searchDestination') {
            if (part.state === 'input-available' || part.state === 'input-streaming') {
              return (
                <ToolLoadingCard key={index} label="Đang tìm địa điểm phù hợp..." />
              );
            }
            if (part.state === 'output-available') {
              return (
                <SearchDestinationCards
                  key={index}
                  result={part.output as SearchResult}
                />
              );
            }
          }

          if (part.type === 'tool-buyTransportTicket') {
            if (part.state === 'input-available' || part.state === 'input-streaming') {
              return <ToolLoadingCard key={index} label="Đang đặt vé xe buýt..." />;
            }
            if (part.state === 'output-available') {
              return (
                <TransportTicketCard
                  key={index}
                  result={part.output as TransportTicketResult}
                />
              );
            }
          }

          if (part.type === 'tool-handleEmergency') {
            if (part.state === 'input-available' || part.state === 'input-streaming') {
              return (
                <ToolLoadingCard key={index} label="Đang kích hoạt quy trình khẩn cấp..." />
              );
            }
            if (part.state === 'output-available') {
              return (
                <EmergencyCard key={index} result={part.output as EmergencyResult} />
              );
            }
          }

          return null;
        })}
      </div>
    </div>
  );
}

export function StreamingPlaceholder() {
  return (
    <div className="vw-message-in flex gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--vw-gold)]/15 ring-1 ring-[var(--vw-gold)]/25">
        <Bot className="h-4 w-4 text-[var(--vw-gold)]" />
      </div>
      <div className="rounded-2xl rounded-bl-md border border-[var(--vw-border)] bg-[var(--vw-surface)] px-4 py-3">
        <TypingIndicator />
      </div>
    </div>
  );
}
