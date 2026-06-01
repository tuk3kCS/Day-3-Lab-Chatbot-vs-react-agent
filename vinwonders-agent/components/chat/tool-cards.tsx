import { TYPE_LABELS } from '@/lib/search';
import type { Destination } from '@/lib/mockData';
import {
  Bus,
  Clock,
  Loader2,
  MapPin,
  Phone,
  ShieldAlert,
  Sparkles,
  Ticket,
} from 'lucide-react';
import type { EmergencyResult, SearchResult, TransportTicketResult } from './types';

const TYPE_STYLES: Record<Destination['type'], string> = {
  ride: 'bg-purple-500/15 text-purple-300',
  restaurant: 'bg-orange-500/15 text-orange-300',
  facility: 'bg-blue-500/15 text-blue-300',
  hotel: 'bg-indigo-500/15 text-indigo-300',
  show: 'bg-pink-500/15 text-pink-300',
  contact: 'bg-red-500/15 text-red-300',
};

export function ToolLoadingCard({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--vw-border)] bg-[var(--vw-surface)] px-4 py-3 text-sm text-[var(--vw-muted)]">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--vw-gold)]" />
      <span>{label}</span>
    </div>
  );
}

function DestinationCard({ dest }: { dest: Destination }) {
  return (
    <article className="rounded-2xl border border-[var(--vw-border)] bg-[var(--vw-surface)] p-4 shadow-sm transition hover:border-[var(--vw-gold)]/30">
      <div className="mb-2 flex flex-wrap items-start gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--vw-gold)]/15">
          <MapPin className="h-4 w-4 text-[var(--vw-gold)]" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug text-zinc-100">{dest.name}</h3>
          <span
            className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${TYPE_STYLES[dest.type]}`}
          >
            {TYPE_LABELS[dest.type]}
          </span>
        </div>
      </div>

      {dest.location && (
        <p className="mb-1 text-xs text-zinc-500">📍 {dest.location}</p>
      )}
      <p className="text-sm leading-relaxed text-zinc-400">{dest.description}</p>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
        {dest.operating_hours && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {dest.operating_hours}
          </span>
        )}
        {dest.contact_number && (
          <span className="inline-flex items-center gap-1 text-[var(--vw-gold-dim)]">
            <Phone className="h-3 w-3" />
            {dest.contact_number}
          </span>
        )}
      </div>

      {dest.tip && (
        <p className="mt-3 rounded-lg bg-[var(--vw-surface-elevated)] px-3 py-2 text-xs text-zinc-500">
          <span className="font-medium text-[var(--vw-gold-dim)]">Mẹo:</span> {dest.tip}
        </p>
      )}
    </article>
  );
}

export function SearchDestinationCards({ result }: { result: SearchResult }) {
  return (
    <div className="space-y-2.5">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[var(--vw-gold)]">
        <Sparkles className="h-3.5 w-3.5" />
        Gợi ý ({result.results.length})
      </p>
      {result.results.map((dest) => (
        <DestinationCard key={dest.id} dest={dest} />
      ))}
    </div>
  );
}

export function TransportTicketCard({ result }: { result: TransportTicketResult }) {
  const priceText =
    result.totalPrice === 0 ? 'Miễn phí' : `${result.totalPrice.toLocaleString('vi-VN')}đ`;

  const passengerLabels: Record<string, string> = {
    adult: 'Người lớn',
    child: 'Trẻ em',
    senior: 'Cao tuổi',
    disabled: 'Khuyết tật',
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-emerald-800/60 bg-gradient-to-br from-emerald-950/80 to-emerald-950/40">
      <div className="flex items-center gap-2 border-b border-emerald-800/40 bg-emerald-900/30 px-4 py-3">
        <Bus className="h-5 w-5 text-emerald-400" />
        <span className="text-sm font-bold tracking-wide text-emerald-300">
          Vé xe buýt VinWonders
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Mã vé</p>
          <p className="font-mono text-xl font-bold tracking-wider text-emerald-200">
            {result.ticketId}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/50 px-3 py-2.5 space-y-2 text-sm">
          <div className="flex items-start gap-2 text-zinc-300">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <div>
              <span className="text-zinc-500">Từ</span>{' '}
              <span className="font-medium">{result.from}</span>
              {' → '}
              <span className="font-medium text-emerald-200">{result.to}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-zinc-300">
            <Bus className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{result.route}</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-300">
            <Clock className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{result.departureTime}</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-300">
            <Ticket className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>
              {result.quantity} vé ({passengerLabels[result.passengerType] ?? result.passengerType})
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-emerald-900/30 px-3 py-2">
          <span className="text-xs text-zinc-400">Bến lên xe</span>
          <span className="text-sm font-medium text-zinc-200">{result.boardingPoint}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-emerald-900/30 px-3 py-2">
          <span className="text-xs text-zinc-400">Tổng thanh toán</span>
          <span className="text-base font-bold text-emerald-300">{priceText}</span>
        </div>
      </div>
    </article>
  );
}

export function EmergencyCard({ result }: { result: EmergencyResult }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-red-800/60 bg-gradient-to-br from-red-950/80 to-red-950/40">
      <div className="flex items-center gap-2 border-b border-red-800/40 bg-red-900/30 px-4 py-3">
        <ShieldAlert className="h-5 w-5 text-red-400" />
        <span className="text-sm font-bold tracking-wide text-red-300">
          Hệ thống an ninh tiếp nhận
        </span>
      </div>
      <div className="space-y-3 p-4">
        <p className="text-xs uppercase tracking-wider text-zinc-500">
          Mã hồ sơ khẩn cấp
        </p>
        <p className="font-mono text-3xl font-bold tracking-wider text-red-200">
          {result.ticketId}
        </p>
        <p className="text-sm leading-relaxed text-zinc-300">{result.message}</p>
        {result.contact && (
          <div className="rounded-xl border border-red-800/40 bg-red-950/50 px-3 py-2.5 text-sm">
            <p className="font-medium text-red-200">{result.contact.name}</p>
            {result.contact.location && (
              <p className="mt-1 text-xs text-zinc-400">{result.contact.location}</p>
            )}
            {result.contact.contact_number && (
              <p className="mt-1 flex items-center gap-1 text-[var(--vw-gold)]">
                <Phone className="h-3.5 w-3.5" />
                {result.contact.contact_number}
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
