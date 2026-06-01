import type { UIMessage } from 'ai';
import { mockData, type Destination } from './mockData';
import type { SearchResult } from '@/components/chat/types';

export type BookRestaurantInput = {
  restaurantId?: string;
  restaurantName?: string;
  guestName?: string;
  partySize?: number;
  dateTime?: string;
  notes?: string;
};

export type ReservationResult = {
  status: 'confirmed' | 'waitlist';
  bookingCode: string;
  restaurant: {
    id: string;
    name: string;
    location?: string;
    contact_number?: string;
  };
  guestName: string;
  partySize: number;
  dateTime: string;
  message: string;
  qrHint: string;
};

const restaurants = () => mockData.filter((d) => d.type === 'restaurant');

function matchRestaurantByName(text: string): Destination | undefined {
  const lower = text.toLowerCase();
  return restaurants().find(
    (r) =>
      lower.includes(r.name.toLowerCase()) ||
      lower.includes(r.id) ||
      (r.name.toLowerCase().includes('hải vương') &&
        /hải vương|hai vuong/.test(lower)) ||
      (r.name.toLowerCase().includes('yummy') && /yummy|fastfood/.test(lower)) ||
      (r.name.toLowerCase().includes('ba miền') &&
        /ba mien|ẩm thực/.test(lower)),
  );
}

/** Lấy nhà hàng từ kết quả search gần nhất trong hội thoại */
export function findRestaurantFromMessages(
  messages: UIMessage[],
  userText: string,
): Destination | undefined {
  const byName = matchRestaurantByName(userText);
  if (byName) return byName;

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== 'assistant') continue;

    for (const part of message.parts) {
      if (
        part.type === 'tool-searchDestination' &&
        part.state === 'output-available' &&
        'output' in part
      ) {
        const { results } = part.output as SearchResult;
        const fromSearch = results.filter((r) => r.type === 'restaurant');
        if (fromSearch.length === 1) return fromSearch[0];
        if (fromSearch.length > 1) {
          if (/hải vương|hai vuong/.test(userText.toLowerCase())) {
            return fromSearch.find((r) => r.id === 'res-01') ?? fromSearch[0];
          }
          if (/yummy|fastfood|nhanh/.test(userText.toLowerCase())) {
            return fromSearch.find((r) => r.id === 'res-02') ?? fromSearch[0];
          }
          if (/ba mien|ẩm thực|pho/.test(userText.toLowerCase())) {
            return fromSearch.find((r) => r.id === 'res-03') ?? fromSearch[0];
          }
          return fromSearch[0];
        }
      }
    }
  }

  return restaurants()[0];
}

export function parseBookingDetails(text: string): {
  partySize: number;
  dateTime: string;
  guestName: string;
} {
  const lower = text.toLowerCase();
  const partyMatch = text.match(/(\d+)\s*(người|nguoi|khách|khach|pax)/i);
  const partySize = partyMatch ? Math.min(20, Math.max(1, Number(partyMatch[1]))) : 2;

  let dateTime = 'Hôm nay, 12:30';
  if (/tối|toi|19|20:?\d{0,2}|buổi tối/.test(lower)) dateTime = 'Hôm nay, 18:30';
  else if (/trưa|trua|11:?\d{0,2}|12:?\d{0,2}/.test(lower)) dateTime = 'Hôm nay, 12:30';
  else if (/sáng|sang|9:|10:/.test(lower)) dateTime = 'Hôm nay, 10:00';

  const timeMatch = text.match(/(\d{1,2})[:h](\d{2})?/i);
  if (timeMatch) {
    const h = timeMatch[1].padStart(2, '0');
    const m = (timeMatch[2] ?? '00').padStart(2, '0');
    dateTime = `Hôm nay, ${h}:${m}`;
  }

  const nameMatch = text.match(
    /(?:tên|ten|tôi là|toi la|khách tên|khach ten)\s+([A-Za-zÀ-ỹ\s]{2,30})/i,
  );
  const guestName = nameMatch ? nameMatch[1].trim() : 'Khách VinWonders';

  return { partySize, dateTime, guestName };
}

export async function runBookRestaurant(
  input: BookRestaurantInput,
  messages: UIMessage[],
  userText: string,
): Promise<ReservationResult> {
  const restaurant =
    (input.restaurantId
      ? mockData.find((d) => d.id === input.restaurantId)
      : undefined) ??
    (input.restaurantName
      ? matchRestaurantByName(input.restaurantName)
      : undefined) ??
    findRestaurantFromMessages(messages, userText);

  if (!restaurant || restaurant.type !== 'restaurant') {
    const fallback = restaurants()[0];
    return buildReservation(fallback, input, userText);
  }

  return buildReservation(restaurant, input, userText);
}

function buildReservation(
  restaurant: Destination,
  input: BookRestaurantInput,
  userText: string,
): ReservationResult {
  const parsed = parseBookingDetails(userText);
  const partySize = input.partySize ?? parsed.partySize;
  const dateTime = input.dateTime ?? parsed.dateTime;
  const guestName = input.guestName ?? parsed.guestName;
  const bookingCode = `VB-${Math.floor(10000 + Math.random() * 89999)}`;

  const isPeak = /12:30|12:00|13:00|18:30|19:00/.test(dateTime);
  const status = isPeak && partySize > 6 ? 'waitlist' : 'confirmed';

  const message =
    status === 'confirmed'
      ? `Đã đặt bàn thành công tại ${restaurant.name} cho ${partySize} người lúc ${dateTime}. Vui lòng đến trước 10 phút và xuất mã ${bookingCode} tại quầy.`
      : `Khung giờ cao điểm — đã ghi nhận yêu cầu ${partySize} người lúc ${dateTime}. Nhà hàng sẽ gọi xác nhận trong 15 phút. Mã tham chiếu: ${bookingCode}.`;

  return {
    status,
    bookingCode,
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      location: restaurant.location,
      contact_number: restaurant.contact_number,
    },
    guestName,
    partySize,
    dateTime,
    message,
    qrHint: `Mã QR đặt bàn: ${bookingCode}`,
  };
}
