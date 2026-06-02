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

export async function runWeather(location: string) {
  // Normalize: bỏ dấu tiếng Việt để wttr.in nhận đúng
  const normalized = location
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim();

  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (apiKey) {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric&lang=vi`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = await res.json();
      return {
        location: data.name,
        weather: `${data.weather[0].description}, ${Math.round(data.main.temp)}°C (cảm giác như ${Math.round(data.main.feels_like)}°C), độ ẩm ${data.main.humidity}%`,
      };
    }
  }

  // Fallback: wttr.in dùng tên đã normalize
  const res = await fetch(
    `https://wttr.in/${encodeURIComponent(normalized)}?format=3`,
    { signal: AbortSignal.timeout(5000) }
  );
  if (!res.ok) throw new Error('Weather service unavailable');
  const weather = await res.text();
  return { location, weather };
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

// ─── Ticket Search ─────────────────────────────────────────────────────────────

const TICKET_DATABASE: Record<string, {
  name: string;
  tickets: { type: string; price: number }[];
  combos?: { name: string; adult: number; child: number }[];
  openingHours?: string;
}> = {
  'vinwonders phu quoc': {
    name: 'VinWonders Phú Quốc',
    tickets: [
      { type: 'Người lớn', price: 950000 },
      { type: 'Trẻ em', price: 710000 },
      { type: 'Người cao tuổi', price: 710000 },
    ],
    combos: [
      { name: 'VinWonders + Safari', adult: 1350000, child: 1000000 },
    ],
    openingHours: '09:00 – 19:30',
  },
  'ba na hills': {
    name: 'Ba Na Hills',
    tickets: [
      { type: 'Người lớn', price: 900000 },
      { type: 'Trẻ em', price: 750000 },
    ],
    openingHours: '07:00 – 22:00',
  },
};

export async function runSearchTicket(destination: string) {
  const TICKET_PRICES: Record<string, { name: string; adult: number; child: number; senior: number }> = {
    vinwonders: { name: 'VinWonders Phú Quốc', adult: 850000, child: 650000, senior: 650000 },
    grand_world: { name: 'Grand World', adult: 200000, child: 150000, senior: 150000 },
    safari: { name: 'Vinpearl Safari', adult: 650000, child: 450000, senior: 450000 },
    ocean_park: { name: 'Ocean Park', adult: 0, child: 0, senior: 0 },
    adventure_world: { name: 'Adventure World', adult: 0, child: 0, senior: 0 },
  };

  const key = destination.toLowerCase().replace(/\s+/g, '_');
  const info = TICKET_PRICES[key] ?? TICKET_PRICES['vinwonders'];

  return {
    destination: info.name,
    prices: {
      adult: info.adult === 0 ? 'Miễn phí' : `${info.adult.toLocaleString('vi-VN')}đ`,
      child: info.child === 0 ? 'Miễn phí' : `${info.child.toLocaleString('vi-VN')}đ`,
      senior: info.senior === 0 ? 'Miễn phí' : `${info.senior.toLocaleString('vi-VN')}đ`,
    },
    note: 'Giá vé đã bao gồm thuế. Trẻ em dưới 100cm miễn phí.',
  };
}

// ─── Transport ─────────────────────────────────────────────────────────────────

const TRANSPORT_ROUTES: Record<string, { route: string; boardingPoint: string; durationMin: number }> = {
  'grand_world': { route: 'Tuyến B1', boardingPoint: 'Bến xe buýt Cổng chính', durationMin: 8 },
  'safari': { route: 'Tuyến B2', boardingPoint: 'Bến xe buýt Khu Safari', durationMin: 12 },
  'ocean_park': { route: 'Tuyến B3', boardingPoint: 'Bến xe buýt Khu Đại dương', durationMin: 10 },
  'adventure_world': { route: 'Tuyến B1', boardingPoint: 'Bến xe buýt Khu Phiêu lưu', durationMin: 6 },
  'central': { route: 'Tuyến B4', boardingPoint: 'Bến xe buýt Trung tâm', durationMin: 5 },
};

const PASSENGER_PRICES: Record<string, number> = {
  adult: 50000,
  child: 25000,
  senior: 25000,
  disabled: 0,
};

export async function runBuyTransportTicket(
  destination: string,
  quantity: number,
  passengerType: 'adult' | 'child' | 'senior' | 'disabled',
  departureTime?: string,
) {
  const destKey = destination.toLowerCase().replace(/\s+/g, '_');
  const displayTo = DESTINATION_DISPLAY[destKey] ?? destination;
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
    to: displayTo,
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

// ─── ServerTool type ───────────────────────────────────────────────────────────

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
  }
  | {
    name: 'weather';
    input: { location: string };
  }
  | {
    name: 'searchTicket';                  // ← MỚI
    input: { destination: string };
  };

// ─── Intent regexes ────────────────────────────────────────────────────────────

const BOOKING_INTENT =
  /(đặt bàn|dat ban|đặt chỗ|dat cho|giữ bàn|giu ban|giữ chỗ|giu cho|đặt hộ|dat ho|book\s*table|reserve|reservation|booking)/i;

const EXPLORATION_INTENT =
  /(đề xuất|de xuat|gợi ý|goi y|nên đi|nen di|chơi đâu|choi dau|đi đâu|di dau|chỗ nào|cho nao|khám phá|kham pha|tìm chỗ|tim cho|giới thiệu|gioi thieu|nên chơi|nen choi|muốn đi|muon di|đi chơi|di choi|chỗ vui|cho vui|lịch trình|lich trinh|địa điểm nào|dia diem nao)/i;

const EMERGENCY_MEDICAL =
  /(y tế|yte|medical|say nắng|say nang|chóng mặt|chong mat|cấp cứu|cap cuu|bị thương|bi thuong|không khỏe|khong khoe)/i;

const EMERGENCY_INCIDENT =
  /(khẩn cấp|khan cap|bị cướp|bi cuop|mất đồ|mat do|mất ví|mat vi|mất điện thoại|mat dien thoai|mất phone|mat phone|lost my|thất lạc đồ|that lac do|lạc trẻ|lac tre|giúp gấp|giup gap|bị mất|bi mat|vừa mất|vua mat|bị rơi|bi roi|đánh mất|danh mat)/i;

const SEARCH_FALLBACK =
  /(mưa|mua|rain|tìm|tim|nhà hàng|nha hang|khách sạn|khach san|show|safari|zeus|buffet|đói|doi\b|hotel|resort|vinwonders|công viên|cong vien)/i;

const TRANSPORT_INTENT =
  /(xe buýt|xe buyt|bus|mua vé|mua ve|đặt vé|dat ve|vé xe|ve xe|đi xe|di xe|phương tiện|phuong tien|transport|ticket|di chuyển đến|di chuyen den|đến khu|den khu)/i;

const SORRY_FALLBACK =
  /(xin lỗi|sorry|bị lỗi|bi loi|không biết| không thể|khong biet|chưa rõ|chua ro|không chắc|khong chac)/i;

const WEATHER_INTENT =
  /(thời tiết|thoi tiet|nhiệt độ|nhiet do|mưa không|mua khong|nắng không|nang khong|weather|temperature|trời hôm nay|hôm nay trời|nên đi|có mưa|có nắng|trời như thế nào|ngoài trời)/i;

// MỚI: intent tìm giá vé vào cổng / tham quan
const TICKET_SEARCH_INTENT =
  /(giá vé|gia ve|vé vào cổng|ve vao cong|vé tham quan|ve tham quan|giá ticket|gia ticket|bao nhiêu.*vé|vé.*bao nhiêu|tra cứu vé|tra cuu ve|tìm vé|tim ve|vé vào|ve vao|ticket price|entry fee|admission)/i;

// ─── Helpers ───────────────────────────────────────────────────────────────────

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

const DESTINATION_DISPLAY: Record<string, string> = {
  grand_world: 'Grand World',
  safari: 'Safari',
  ocean_park: 'Ocean Park',
  adventure_world: 'Adventure World',
  central: 'Trung tâm',
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
  const quantity = match ? parseInt(match[1], 10) : 1;
  return Math.min(20, Math.max(1, quantity));
}

function extractPassengerType(text: string): 'adult' | 'child' | 'senior' | 'disabled' {
  const lower = text.toLowerCase();
  if (/(trẻ em|tre em|child|kids?)/.test(lower)) return 'child';
  if (/(người cao tuổi|nguoi cao tuoi|senior|elderly)/.test(lower)) return 'senior';
  if (/(khuyết tật|khuyet tat|disabled)/.test(lower)) return 'disabled';
  return 'adult';
}

// MỚI: extract tên địa điểm từ câu hỏi về vé
function extractTicketDestination(text: string): string {
  const lower = text.toLowerCase();
  // Ưu tiên khớp với key trong TICKET_DATABASE
  if (lower.includes('ba na') || lower.includes('ba na hills')) return 'ba na hills';
  if (lower.includes('vinwonders') || lower.includes('vin wonder') || lower.includes('phú quốc') || lower.includes('phu quoc')) {
    return 'vinwonders phu quoc';
  }
  // Fallback: lấy phần sau động từ
  const destMatch = text.match(
    /(?:vé|ticket|tham quan|vào|vao|ở|tại|tai|đến|den)\s+(.{3,40}?)(?:\s*[?!.,]|$)/i,
  );
  return destMatch?.[1]?.trim().toLowerCase() ?? 'vinwonders phu quoc';
}

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

// ─── detectServerTool ──────────────────────────────────────────────────────────

export function detectServerTool(
  text: string,
  _messages: UIMessage[] = [],
): ServerTool | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (isClearlyOffTopic(trimmed)) return null;

  const lower = trimmed.toLowerCase();

  // 1) Đặt bàn — ưu tiên cao
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

  // 3.5) Tìm giá vé / thông tin vé tham quan ← MỚI (trước TRANSPORT để tránh bị cướp bởi "ticket")
  if (TICKET_SEARCH_INTENT.test(lower) && !SORRY_FALLBACK.test(lower)) {
    const destMatch = lower.match(/(safari|grand\s*world|ocean\s*park|adventure|vinwonders)/i);
    return {
      name: 'searchTicket',
      input: { destination: destMatch?.[1]?.replace(/\s+/g, '_') ?? 'vinwonders' },
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

  // 4.5) Thời tiết
  if (WEATHER_INTENT.test(lower)) {
    const cityMatch =
      trimmed.match(/(?:ở|tại|tai|ở\s+)\s*(.+?)(?:\s*[?!.,]|$)/i) ??
      trimmed.match(/(?:thời tiết|weather)\s+(.+?)(?:\s*[?!.,]|$)/i) ??
      trimmed.match(/^(.+?)\s+(?:hôm nay|bao nhiêu độ|thế nào|mưa không)/i);

    return {
      name: 'weather',
      input: {
        location: cityMatch?.[1]?.trim() || 'Phu Quoc',
      },
    };
  }

  // 5) Gợi ý / khám phá
  if (EXPLORATION_INTENT.test(lower) && !SORRY_FALLBACK.test(lower)) {
    const { keyword, category } = extractSearchKeyword(trimmed);
    return {
      name: 'searchDestination',
      input: { keyword, category },
    };
  }

  // 6) Tìm kiếm địa điểm chung
  if (SEARCH_FALLBACK.test(lower) && !SORRY_FALLBACK.test(lower)) {
    const { keyword, category } = extractSearchKeyword(trimmed);
    return {
      name: 'searchDestination',
      input: { keyword, category },
    };
  }

  return null;
}

// ─── runServerTool ─────────────────────────────────────────────────────────────

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

  if (serverTool.name === 'weather') {
    return {
      name: serverTool.name,
      input: serverTool.input,
      output: await runWeather(serverTool.input.location),
    };
  }

  if (serverTool.name === 'bookRestaurant') {
    return {
      name: serverTool.name,
      input: serverTool.input,
      output: await runBookRestaurant(serverTool.input, messages, userText),
    };
  }

  // MỚI
  if (serverTool.name === 'searchTicket') {
    return {
      name: serverTool.name,
      input: serverTool.input,
      output: await runSearchTicket(serverTool.input.destination),
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

// ─── getToolHint ───────────────────────────────────────────────────────────────

function getToolHint(toolName: string): string {
  switch (toolName) {
    case 'searchDestination':
      return 'Chỉ gợi ý từ kết quả tìm kiếm; tối đa 5 mục. Nhà hàng: một câu nhắc có thể đặt bàn — không thêm chủ đề khác.';
    case 'bookRestaurant':
      return 'Chỉ xác nhận mã booking, giờ, số người — không ticket khẩn cấp, không quảng cáo thêm.';
    case 'handleEmergency':
      return 'Chỉ ticket, liên hệ, bước tiếp theo — không giải thích dài ngoài sự cố.';
    case 'buyTransportTicket':
      return 'Chỉ xác nhận mã vé, tuyến, giờ, bến lên xe — không thêm chủ đề khác.';
    case 'weather':
      return 'Chỉ trả lời thời tiết hiện tại và nhiệt độ từ dữ liệu công cụ.';
    case 'searchTicket':
      return `Trả lời trực tiếp từ kết quả, không bảo user liên hệ nơi khác.
Quy tắc phân loại vé:
- "người lớn" / "trên 100cm" / "người cao hơn 100cm" = adult
- "trẻ em" / "dưới 100cm" / "trẻ nhỏ" = child  
- "cao tuổi" / "người già" = senior
- Trẻ em dưới 100cm = miễn phí (không cần mua vé)
Nếu user hỏi số lượng, tính tổng tiền luôn: giá × số lượng.`;
    case 'searchTicket':                   // ← MỚI
      return 'Hiển thị bảng giá vé và giờ mở cửa từ kết quả — không thêm thông tin ngoài database. Nếu không tìm thấy, liệt kê các địa điểm được hỗ trợ.';
    default:
      return 'Tóm tắt surgical từ dữ liệu công cụ.';
  }
}

export { getToolHint };
