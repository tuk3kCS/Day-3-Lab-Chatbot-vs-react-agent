import type { Destination } from './mockData';

/** Gom địa điểm cùng khu (Hải Vương, Zeus…) — tránh 2–3 card trùng chỗ. */
const VENUE_CLUSTERS: { pattern: RegExp; key: string }[] = [
  { pattern: /hải vương|hai vuong/i, key: 'hai-vuong' },
  { pattern: /zeus|thịnh nộ|thinh no/i, key: 'zeus' },
  { pattern: /safari|river safari/i, key: 'safari' },
  { pattern: /tata show|tata\b/i, key: 'tata' },
  { pattern: /tiên cá|tien ca/i, key: 'mermaid-show' },
  { pattern: /grand world|fiesta/i, key: 'grand-world' },
  { pattern: /vinpearl resort/i, key: 'vinpearl-resort' },
  { pattern: /mặt trời|sky wheel/i, key: 'sky-wheel' },
];

function getVenueCluster(dest: Destination): string | null {
  const text = `${dest.name} ${dest.location ?? ''}`;
  for (const { pattern, key } of VENUE_CLUSTERS) {
    if (pattern.test(text)) return key;
  }
  return null;
}

const DEFAULT_TYPE_PRIORITY: Destination['type'][] = [
  'ride',
  'facility',
  'restaurant',
  'show',
  'hotel',
  'contact',
];

/** Loại trùng id, rồi gom theo cụm địa điểm (ưu tiên category nếu có). */
export function dedupeDestinations(
  results: Destination[],
  preferredCategory?: Destination['type'],
): Destination[] {
  const byId = new Map<string, Destination>();
  for (const dest of results) {
    if (!byId.has(dest.id)) byId.set(dest.id, dest);
  }

  const unique = [...byId.values()];
  const typePriority = preferredCategory
    ? [
        preferredCategory,
        ...DEFAULT_TYPE_PRIORITY.filter((t) => t !== preferredCategory),
      ]
    : DEFAULT_TYPE_PRIORITY;

  const sorted = [...unique].sort(
    (a, b) => typePriority.indexOf(a.type) - typePriority.indexOf(b.type),
  );

  const seenClusters = new Set<string>();
  const out: Destination[] = [];

  for (const dest of sorted) {
    const cluster = getVenueCluster(dest);
    const key = cluster ?? dest.id;
    if (seenClusters.has(key)) continue;
    seenClusters.add(key);
    out.push(dest);
  }

  return out;
}
