import type { UIMessage } from 'ai';
import { isClearlyOffTopic } from './agent-policy';
import type { Destination } from './mockData';
import { runBookRestaurant } from './booking';
import {
  extractSearchKeyword,
  findContactByPurpose,
  searchDestinations,
} from './search';

export async function runSearchDestination(
  keyword: string,
  category?: Destination['type'],
) {
  const results = searchDestinations({ keyword, category, limit: 5 });
  return { results };
}

export async function runHandleEmergency(
  type: 'lost_item' | 'medical' | 'other',
  description: string,
) {
  const ticketId = `VW-${Math.floor(1000 + Math.random() * 9000)}`;
  const contact = findContactByPurpose(
    type === 'medical' ? 'medical' : type === 'lost_item' ? 'lost_item' : 'general',
  );

  const contactHint = contact
    ? ` Liên hệ: ${contact.name}${contact.contact_number ? ` — ${contact.contact_number}` : ''}${contact.location ? ` (${contact.location})` : ''}.`
    : '';

  return {
    status: 'success',
    ticketId,
    type,
    message: `Đã kích hoạt quy trình ứng phó. Mã ticket: ${ticketId}. Đội ngũ mặt đất đang rà soát.${contactHint} (${description})`,
    contact: contact
      ? {
          name: contact.name,
          location: contact.location,
          contact_number: contact.contact_number,
        }
      : undefined,
  };
}

export { runBookRestaurant };

export function getLastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role === 'user') {
      return message.parts
        .filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join('');
    }
  }
  return '';
}

export type ServerTool =
  | {
      name: 'searchDestination';
      input: { keyword: string; category?: Destination['type'] };
    }
  | {
      name: 'handleEmergency';
      input: { type: 'lost_item' | 'medical' | 'other'; description: string };
    }
  | {
      name: 'bookRestaurant';
      input: {
        restaurantId?: string;
        restaurantName?: string;
        guestName?: string;
        partySize?: number;
        dateTime?: string;
        notes?: string;
      };
    };

const BOOKING_INTENT =
  /(đặt bàn|dat ban|đặt chỗ|dat cho|giữ bàn|giu ban|giữ chỗ|giu cho|đặt hộ|dat ho|book\s*table|reserve|reservation|booking)/i;

const EXPLORATION_INTENT =
  /(đề xuất|de xuat|gợi ý|goi y|nên đi|nen di|chơi đâu|choi dau|đi đâu|di dau|chỗ nào|cho nao|khám phá|kham pha|tìm chỗ|tim cho|giới thiệu|gioi thieu|nên chơi|nen choi|muốn đi|muon di|đi chơi|di choi|chỗ vui|cho vui|lịch trình|lich trinh|địa điểm nào|dia diem nao)/i;

const EMERGENCY_MEDICAL =
  /(y tế|yte|medical|say nắng|say nang|chóng mặt|chong mat|cấp cứu|cap cuu|bị thương|bi thuong|không khỏe|khong khoe)/i;

const EMERGENCY_INCIDENT =
  /(khẩn cấp|khan cap|bị cướp|bi cuop|mất đồ|mat do|mất ví|mat vi|mất điện thoại|mat dien thoai|mất phone|mat phone|lost my|thất lạc đồ|that lac do|lạc trẻ|lac tre|giúp gấp|giup gap|bị mất|bi mat|vừa mất|vua mat|bị rơi|bi roi|đánh mất|danh mat)/i;

/** Không dùng `an\\b` — dễ khớp nhầm đuôi từ (vd. iran). */
const SEARCH_FALLBACK =
  /(mưa|mua|rain|tìm|tim|nhà hàng|nha hang|khách sạn|khach san|show|safari|zeus|buffet|đói|doi\b|hotel|resort|vinwonders|công viên|cong vien)/i;

const SORRY_FALLBACK =
/(xin lỗi|sorry|bị lỗi|bi loi|không biết| không thể|khong biet|chưa rõ|chua ro|không chắc|khong chac)/i;

function parseBookInput(
  text: string,
): Extract<ServerTool, { name: 'bookRestaurant' }>['input'] | null {
  if (!BOOKING_INTENT.test(text)) return null;
  const partyMatch = text.match(/(\d+)\s*(người|nguoi|khách|khach)/i);
  const timeMatch = text.match(/(\d{1,2})[:h](\d{2})?/i);
  const nameMatch = text.match(
    /(?:tên|ten|tôi là|toi la)\s+([A-Za-zÀ-ỹ\s]{2,24})/i,
  );
  return {
    restaurantName: text,
    partySize: partyMatch ? Number(partyMatch[1]) : undefined,
    dateTime: timeMatch
      ? `Hôm nay, ${timeMatch[1].padStart(2, '0')}:${(timeMatch[2] ?? '00').padStart(2, '0')}`
      : undefined,
    guestName: nameMatch?.[1]?.trim(),
    notes: text,
  };
}

export function detectServerTool(
  text: string,
  _messages: UIMessage[] = [],
): ServerTool | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (isClearlyOffTopic(trimmed)) return null;

  const lower = trimmed.toLowerCase();

  // 1) Đặt bàn — ưu tiên cao (kể cả sau khi vừa gợi ý nhà hàng)
  if (BOOKING_INTENT.test(lower)) {
    const input = parseBookInput(trimmed);
    if (input) {
      return { name: 'bookRestaurant', input };
    }
  }

  // 2) Y tế khẩn cấp
  if (EMERGENCY_MEDICAL.test(lower) && !SORRY_FALLBACK.test(lower)) {
    return {
      name: 'handleEmergency',
      input: { type: 'medical', description: trimmed },
    };
  }

  // 3) Báo sự cố
  if (EMERGENCY_INCIDENT.test(lower)) {
    return {
      name: 'handleEmergency',
      input: { type: 'lost_item', description: trimmed },
    };
  }

  // 4) Gợi ý / khám phá
  if (EXPLORATION_INTENT.test(lower)) {
    const { keyword, category } = extractSearchKeyword(trimmed);
    return {
      name: 'searchDestination',
      input: { keyword, category },
    };
  }

  // 5) Tìm kiếm chung
  if (SEARCH_FALLBACK.test(lower)) {
    const { keyword, category } = extractSearchKeyword(trimmed);
    return {
      name: 'searchDestination',
      input: { keyword, category },
    };
  }

  return null;
}

export async function runServerTool(
  serverTool: ServerTool,
  messages: UIMessage[] = [],
  userText = '',
) {
  if (serverTool.name === 'searchDestination') {
    return {
      name: serverTool.name,
      input: serverTool.input,
      output: await runSearchDestination(
        serverTool.input.keyword,
        serverTool.input.category,
      ),
    };
  }

  if (serverTool.name === 'bookRestaurant') {
    return {
      name: serverTool.name,
      input: serverTool.input,
      output: await runBookRestaurant(serverTool.input, messages, userText),
    };
  }

  return {
    name: serverTool.name,
    input: serverTool.input,
    output: await runHandleEmergency(
      serverTool.input.type,
      serverTool.input.description,
    ),
  };
}

function getToolHint(toolName: string): string {
  switch (toolName) {
    case 'searchDestination':
      return 'Chỉ gợi ý từ kết quả tìm kiếm; tối đa 5 mục. Nhà hàng: một câu nhắc có thể đặt bàn — không thêm chủ đề khác.';
    case 'bookRestaurant':
      return 'Chỉ xác nhận mã booking, giờ, số người — không ticket khẩn cấp, không quảng cáo thêm.';
    case 'handleEmergency':
      return 'Chỉ ticket, liên hệ, bước tiếp theo — không giải thích dài ngoài sự cố.';
    default:
      return 'Tóm tắt surgical từ dữ liệu công cụ.';
  }
}

export { getToolHint };
