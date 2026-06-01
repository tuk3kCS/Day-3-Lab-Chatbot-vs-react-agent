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

const TRANSPORT_ROUTES: Record<string, { route: string; boardingPoint: string; durationMin: number }> = {
  'grand_world':     { route: 'Tuyến B1', boardingPoint: 'Bến xe buýt Cổng chính',      durationMin: 8  },
  'safari':          { route: 'Tuyến B2', boardingPoint: 'Bến xe buýt Khu Safari',       durationMin: 12 },
  'ocean_park':      { route: 'Tuyến B3', boardingPoint: 'Bến xe buýt Khu Đại dương',    durationMin: 10 },
  'adventure_world': { route: 'Tuyến B1', boardingPoint: 'Bến xe buýt Khu Phiêu lưu',   durationMin: 6  },
  'central':         { route: 'Tuyến B4', boardingPoint: 'Bến xe buýt Trung tâm',        durationMin: 5  },
};

const PASSENGER_PRICES: Record<string, number> = {
  adult:    50000,
  child:    25000,
  senior:   25000,
  disabled: 0,
};

export async function runBuyTransportTicket(
  destination: string,
  quantity: number,
  passengerType: 'adult' | 'child' | 'senior' | 'disabled',
  departureTime?: string,
) {
  const destKey = destination.toLowerCase().replace(/\s+/g, '_');
  const routeInfo = TRANSPORT_ROUTES[destKey] ?? {
    route: 'Tuyến B1',
    boardingPoint: 'Bến xe buýt Cổng chính',
    durationMin: 10,
  };

  const pricePerTicket = PASSENGER_PRICES[passengerType] ?? 50000;
  const totalPrice = pricePerTicket * quantity;
  const ticketId = `VWT-${Math.floor(1000 + Math.random() * 9000)}`;
  const departure = departureTime ?? 'Chuyến tiếp theo';
  const priceText = totalPrice === 0 ? 'Miễn phí' : `${totalPrice.toLocaleString('vi-VN')}đ`;

  return {
    status: 'success' as const,
    ticketId,
    from: 'Cổng chính VinWonders',
    to: destination,
    route: routeInfo.route,
    departureTime: departure,
    quantity,
    passengerType,
    pricePerTicket,
    totalPrice,
    boardingPoint: routeInfo.boardingPoint,
    message: `Đặt vé thành công! Mã vé: ${ticketId}. ${quantity} vé (${passengerType}) — ${priceText}. Lên xe tại: ${routeInfo.boardingPoint}. Giờ khởi hành: ${departure}. Thời gian di chuyển ~${routeInfo.durationMin} phút.`,
  };
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
      name: 'buyTransportTicket';
      input: {
        destination: string;
        quantity: number;
        passengerType: 'adult' | 'child' | 'senior' | 'disabled';
        departureTime?: string;
      };
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

const TRANSPORT_INTENT =
  /(xe buýt|xe buyt|bus|mua vé|mua ve|đặt vé|dat ve|vé xe|ve xe|đi xe|di xe|phương tiện|phuong tien|transport|ticket|di chuyển đến|di chuyen den|đến khu|den khu)/i;

const SORRY_FALLBACK =
/(xin lỗi|sorry|bị lỗi|bi loi|không biết| không thể|khong biet|chưa rõ|chua ro|không chắc|khong chac)/i;

const DESTINATION_NAMES: Record<string, string> = {
  'grand world': 'grand_world',
  'safari': 'safari',
  'ocean park': 'ocean_park',
  'đại dương': 'ocean_park',
  'dai duong': 'ocean_park',
  'adventure': 'adventure_world',
  'phiêu lưu': 'adventure_world',
  'phieu luu': 'adventure_world',
  'trung tâm': 'central',
  'trung tam': 'central',
};

function extractTransportDestination(text: string): string {
  const lower = text.toLowerCase();
  for (const [key, value] of Object.entries(DESTINATION_NAMES)) {
    if (lower.includes(key)) return value;
  }
  return 'grand_world';
}

function extractQuantity(text: string): number {
  const match = text.match(/(\d+)\s*(vé|ve|người|nguoi|ticket|person)/i);
  return match ? parseInt(match[1], 10) : 1;
}

function extractPassengerType(text: string): 'adult' | 'child' | 'senior' | 'disabled' {
  const lower = text.toLowerCase();
  if (/(trẻ em|tre em|child|kids?)/.test(lower)) return 'child';
  if (/(người cao tuổi|nguoi cao tuoi|senior|elderly)/.test(lower)) return 'senior';
  if (/(khuyết tật|khuyet tat|disabled)/.test(lower)) return 'disabled';
  return 'adult';
}

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

  // 4) Mua vé xe buýt / phương tiện
  if (TRANSPORT_INTENT.test(lower) && !SORRY_FALLBACK.test(lower)) {
    return {
      name: 'buyTransportTicket',
      input: {
        destination: extractTransportDestination(trimmed),
        quantity: extractQuantity(trimmed),
        passengerType: extractPassengerType(trimmed),
      },
    };
  }

  // 5) Tìm kiếm địa điểm chung
  if (SEARCH_FALLBACK.test(lower) && !SORRY_FALLBACK.test(lower)) {
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
  if (serverTool.name === 'buyTransportTicket') {
    return {
      name: serverTool.name,
      input: serverTool.input,
      output: await runBuyTransportTicket(
        serverTool.input.destination,
        serverTool.input.quantity,
        serverTool.input.passengerType,
        serverTool.input.departureTime,
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
