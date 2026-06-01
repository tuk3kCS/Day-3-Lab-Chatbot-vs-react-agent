'use client';

import type { Destination } from '@/lib/mockData';
import { useState } from 'react';

export type BookingDetails = {
  partySize: number;
  dateTime: string;
  guestName: string;
  notes?: string;
};

type RestaurantBookingFormProps = {
  restaurant: Destination;
  disabled?: boolean;
  onConfirm: (details: BookingDetails) => void;
  onCancel: () => void;
};

export function RestaurantBookingForm({
  restaurant,
  disabled,
  onConfirm,
  onCancel,
}: RestaurantBookingFormProps) {
  const [partySize, setPartySize] = useState(2);
  const [time, setTime] = useState('12:30');
  const [guestName, setGuestName] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (partySize < 1 || partySize > 20) return;
    onConfirm({
      partySize,
      dateTime: `Hôm nay, ${time}`,
      guestName: guestName.trim() || 'Khách VinWonders',
      notes: notes.trim() || undefined,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 space-y-3 rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-3"
    >
      <p className="text-xs font-medium text-emerald-400/90">
        Đặt bàn — {restaurant.name}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[10px] uppercase text-zinc-500">
          Số người
          <input
            type="number"
            min={1}
            max={20}
            value={partySize}
            onChange={(e) => setPartySize(Number(e.target.value))}
            disabled={disabled}
            className="mt-1 w-full rounded-lg border border-[var(--vw-border)] bg-[var(--vw-bg)] px-2.5 py-2 text-sm text-zinc-100 disabled:opacity-50"
          />
        </label>
        <label className="block text-[10px] uppercase text-zinc-500">
          Giờ đến
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={disabled}
            className="mt-1 w-full rounded-lg border border-[var(--vw-border)] bg-[var(--vw-bg)] px-2.5 py-2 text-sm text-zinc-100 disabled:opacity-50"
          />
        </label>
      </div>

      <label className="block text-[10px] uppercase text-zinc-500">
        Tên khách (tuỳ chọn)
        <input
          type="text"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          disabled={disabled}
          placeholder="Nguyễn Văn A"
          className="mt-1 w-full rounded-lg border border-[var(--vw-border)] bg-[var(--vw-bg)] px-2.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 disabled:opacity-50"
        />
      </label>

      <label className="block text-[10px] uppercase text-zinc-500">
        Ghi chú (tuỳ chọn)
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={disabled}
          placeholder="Bàn gần cửa sổ, trẻ em..."
          className="mt-1 w-full rounded-lg border border-[var(--vw-border)] bg-[var(--vw-bg)] px-2.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 disabled:opacity-50"
        />
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="flex-1 rounded-lg border border-[var(--vw-border)] py-2 text-xs text-zinc-400 transition hover:bg-zinc-800 disabled:opacity-50"
        >
          Huỷ
        </button>
        <button
          type="submit"
          disabled={disabled}
          className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          Xác nhận đặt bàn
        </button>
      </div>
    </form>
  );
}
