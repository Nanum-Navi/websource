/** 17개 시/도 현행 공식 명칭 */
export const OFFICIAL_REGIONS = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시',
  '광주광역시', '대전광역시', '울산광역시', '세종특별자치시',
  '경기도', '강원특별자치도',
  '충청북도', '충청남도',
  '전북특별자치도', '전라남도',
  '경상북도', '경상남도',
  '제주특별자치도',
] as const;

export type OfficialRegion = typeof OFFICIAL_REGIONS[number];

const REGION_MAP: Record<string, OfficialRegion> = {
  // --- 정식명 (identity) ---
  '서울특별시': '서울특별시',
  '부산광역시': '부산광역시',
  '대구광역시': '대구광역시',
  '인천광역시': '인천광역시',
  '광주광역시': '광주광역시',
  '대전광역시': '대전광역시',
  '울산광역시': '울산광역시',
  '세종특별자치시': '세종특별자치시',
  '경기도': '경기도',
  '강원특별자치도': '강원특별자치도',
  '충청북도': '충청북도',
  '충청남도': '충청남도',
  '전북특별자치도': '전북특별자치도',
  '전라남도': '전라남도',
  '경상북도': '경상북도',
  '경상남도': '경상남도',
  '제주특별자치도': '제주특별자치도',

  // --- 약칭 ---
  '서울': '서울특별시',
  '부산': '부산광역시',
  '대구': '대구광역시',
  '인천': '인천광역시',
  '광주': '광주광역시',
  '대전': '대전광역시',
  '울산': '울산광역시',
  '세종': '세종특별자치시',
  '경기': '경기도',
  '강원': '강원특별자치도',
  '충북': '충청북도',
  '충남': '충청남도',
  '전북': '전북특별자치도',
  '전남': '전라남도',
  '경북': '경상북도',
  '경남': '경상남도',
  '제주': '제주특별자치도',

  // --- ~시 변형 (광주시 제외 — 경기도 광주시와 모호) ---
  '서울시': '서울특별시',
  '부산시': '부산광역시',
  '대구시': '대구광역시',
  '인천시': '인천광역시',
  '대전시': '대전광역시',
  '울산시': '울산광역시',
  '세종시': '세종특별자치시',

  // --- 구명칭 ---
  '전라북도': '전북특별자치도',
  '강원도': '강원특별자치도',
  '제주도': '제주특별자치도',

  // --- 오타 / 잘림 ---
  '제주특별차지도': '제주특별자치도',
  '청충북도': '충청북도',
  '기도': '경기도',
  '제주특별자': '제주특별자치도',
  '세종특별시': '세종특별자치시',
};

/**
 * Map any region variant to the official 17-region name.
 * Returns null if the input is not recognizable as a region.
 */
export function normalizeRegion(raw: string): OfficialRegion | null {
  const trimmed = raw.trim();
  return REGION_MAP[trimmed] ?? null;
}

/** Invisible / zero-width unicode characters to strip */
const INVISIBLE_CHARS = /[\u200b\u200c\u200d\u200e\u200f\ufeff\u2028\u2029\u202f\u2060\u180e\u00ad]/g;

/**
 * Clean an address string:
 * 1. Strip HTML tags
 * 2. Remove invisible unicode characters
 * 3. Convert NBSP / tabs to regular spaces
 * 4. Remove duplicate region prefix
 * 5. Collapse whitespace and trim
 */
export function sanitizeAddress(raw: string): string {
  let addr = raw;
  addr = addr.replace(/<[^>]+>/g, ' ');
  addr = addr.replace(INVISIBLE_CHARS, '');
  addr = addr.replace(/[\u00a0\t]/g, ' ');
  addr = addr.replace(/\s+/g, ' ').trim();
  addr = removeDuplicateRegion(addr);
  return addr;
}

export interface NormalizedAddress {
  address: string;
  region: OfficialRegion | null;
  district: string | null;
}

export function normalizeStoreAddress(raw: string): NormalizedAddress {
  let addr = sanitizeAddress(raw);

  const tokens = addr.split(' ');
  if (tokens.length === 0) {
    return { address: addr, region: null, district: null };
  }

  const region = normalizeRegion(tokens[0]);
  if (!region) {
    return { address: addr, region: null, district: null };
  }

  if (tokens[0] !== region) {
    tokens[0] = region;
    addr = tokens.join(' ');
  }

  const district = tokens.length >= 2 ? tokens[1] : null;

  return { address: addr, region, district };
}

function removeDuplicateRegion(addr: string): string {
  const tokens = addr.split(' ');
  if (tokens.length < 2) return addr;
  const first = normalizeRegion(tokens[0]);
  const second = normalizeRegion(tokens[1]);
  if (first && second && first === second) {
    const keep = tokens[0].length >= tokens[1].length ? tokens[0] : tokens[1];
    return [keep, ...tokens.slice(2)].join(' ');
  }
  return addr;
}
