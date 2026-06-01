import type { UIMessage } from 'ai';
import type { Destination } from './mockData';
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
    };

/** Ý định hỏi gợi ý / khám phá — ưu tiên trước emergency để tránh false positive */
const EXPLORATION_INTENT =
  /(đề xuất|de xuat|gợi ý|goi y|nên đi|nen di|chơi đâu|choi dau|đi đâu|di dau|chỗ nào|cho nao|khám phá|kham pha|tìm chỗ|tim cho|giới thiệu|gioi thieu|nên chơi|nen choi|muốn đi|muon di|đi chơi|di choi|chỗ vui|cho vui|lịch trình|lich trinh|địa điểm nào|dia diem nao)/i;

const EMERGENCY_MEDICAL =
  /(y tế|yte|medical|say nắng|say nang|chóng mặt|chong mat|cấp cứu|cap cuu|bị thương|bi thuong|không khỏe|khong khoe)/i;

/** Chỉ báo cáo sự cố rõ ràng — không dùng pattern mơ hồ như vi\b hay roi */
const EMERGENCY_INCIDENT =
  /(khẩn cấp|khan cap|bị cướp|bi cuop|mất đồ|mat do|mất ví|mat vi|mất điện thoại|mat dien thoai|mất phone|mat phone|lost my|thất lạc đồ|that lac do|lạc trẻ|lac tre|giúp gấp|giup gap|bị mất|bi mat|vừa mất|vua mat|bị rơi|bi roi|đánh mất|danh mat)/i;

const SEARCH_FALLBACK =
  /(mưa|mua|rain|tìm|tim|nhà hàng|nha hang|khách sạn|khach san|show|safari|zeus|buffet|ăn|an\b|đói|doi\b|hotel|resort)/i;

const SORRY_FALLBACK =
/(xin lỗi|sorry|bị lỗi|bi loi|không biết| không thể|khong biet|chưa rõ|chua ro|không chắc|khong chac)/i;

export function detectServerTool(text: string): ServerTool | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();

  // 1) Câu hỏi gợi ý / đi chơi → search (kể cả sau khi đã báo mất đồ trước đó)
  if (EXPLORATION_INTENT.test(lower) && !SORRY_FALLBACK.test(lower)) {
    const { keyword, category } = extractSearchKeyword(trimmed);
    return {
      name: 'searchDestination',
      input: { keyword, category },
    };
  }

  // 2) Y tế khẩn cấp
  if (EMERGENCY_MEDICAL.test(lower) && !SORRY_FALLBACK.test(lower)) {
    return {
      name: 'handleEmergency',
      input: { type: 'medical', description: trimmed },
    };
  }

  // 3) Báo sự cố mất đồ / an ninh
  if (EMERGENCY_INCIDENT.test(lower) && !SORRY_FALLBACK.test(lower)) {
    return {
      name: 'handleEmergency',
      input: { type: 'lost_item', description: trimmed },
    };
  }

  // 4) Tìm kiếm địa điểm chung
  if (SEARCH_FALLBACK.test(lower) && !SORRY _FALLBACK.test(lower)) {
    const { keyword, category } = extractSearchKeyword(trimmed);
    return {
      name: 'searchDestination',
      input: { keyword, category },
    };
  }

  return null;
}

export async function runServerTool(serverTool: ServerTool) {
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
  return {
    name: serverTool.name,
    input: serverTool.input,
    output: await runHandleEmergency(
      serverTool.input.type,
      serverTool.input.description,
    ),
  };
}
