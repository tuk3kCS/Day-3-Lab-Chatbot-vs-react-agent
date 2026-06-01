import { dedupeDestinations } from './dedupe-destinations';
import { mockData, type Destination } from './mockData';

const TYPE_LABELS: Record<Destination['type'], string> = {
  ride: 'Trò chơi',
  restaurant: 'Nhà hàng',
  facility: 'Khu tham quan',
  hotel: 'Khách sạn',
  show: 'Biểu diễn',
  contact: 'Liên hệ / Khẩn cấp',
};

export { TYPE_LABELS };

export type SearchOptions = {
  keyword: string;
  category?: Destination['type'];
  limit?: number;
};

function matchesQuery(dest: Destination, query: string): boolean {
  const haystack = [
    dest.name,
    dest.description,
    dest.location ?? '',
    dest.type,
    TYPE_LABELS[dest.type],
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

export function searchDestinations({
  keyword,
  category,
  limit = 5,
}: SearchOptions): Destination[] {
  const query = keyword.trim().toLowerCase();
  if (!query) return mockData.slice(0, limit);

  let results = mockData.filter((d) => matchesQuery(d, query));

  if (category) {
    results = results.filter((d) => d.type === category);
  }

  const deduped = dedupeDestinations(results, category);
  return deduped.slice(0, limit);
}

export function findContactByPurpose(
  purpose: 'lost_item' | 'medical' | 'general',
): Destination | undefined {
  if (purpose === 'medical') {
    return mockData.find((d) => d.id === 'contact-01');
  }
  if (purpose === 'lost_item') {
    return mockData.find((d) => d.id === 'contact-02');
  }
  return mockData.find((d) => d.id === 'contact-03');
}

/** Gợi ý từ khóa từ câu hỏi tự nhiên */
export function extractSearchKeyword(text: string): {
  keyword: string;
  category?: Destination['type'];
} {
  const lower = text.toLowerCase();

  if (/đề xuất|de xuat|gợi ý|goi y|chơi|choi|đi đâu|di dau|chỗ vui|cho vui/.test(lower)) {
    return { keyword: 'vinwonders' };
  }
  if (/khách sạn|hotel|nghỉ|resort|vinpearl|fiesta/i.test(lower)) {
    return { keyword: 'vinpearl', category: 'hotel' };
  }
  if (/show|biểu diễn|tata|tiên cá/i.test(lower)) {
    return { keyword: 'show', category: 'show' };
  }
  if (/ăn|nhà hàng|buffet|phở|food|đói/i.test(lower)) {
    return { keyword: 'nhà hàng', category: 'restaurant' };
  }
  if (/mưa|mua|rain|thủy cung|aquarium/i.test(lower)) {
    return { keyword: 'hải vương', category: 'facility' };
  }
  if (/safari|động vật|thú/i.test(lower)) {
    return { keyword: 'safari', category: 'facility' };
  }
  if (/vòng quay|sky wheel|hoàng hôn/i.test(lower)) {
    return { keyword: 'mặt trời', category: 'ride' };
  }
  if (/tàu lượn|tau luon|zeus|thrill/i.test(lower)) {
    return { keyword: 'zeus', category: 'ride' };
  }
  if (/y tế|medical|say nắng|chóng mặt|cấp cứu/i.test(lower)) {
    return { keyword: 'y tế', category: 'contact' };
  }

  for (const dest of mockData) {
    const nameLower = dest.name.toLowerCase();
    const words = nameLower.split(/\s+/).filter((w) => w.length >= 5);
    const matched = words.some((word) => lower.includes(word));
    if (matched) {
      return { keyword: dest.name, category: dest.type };
    }
  }

  return { keyword: text };
}
