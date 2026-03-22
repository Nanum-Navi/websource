import { describe, it, expect } from 'vitest';
import { normalizeRegion, sanitizeAddress, normalizeStoreAddress } from '../../src/normalize/address.js';

describe('normalizeRegion', () => {
  it('maps abbreviated names to official names', () => {
    expect(normalizeRegion('서울')).toBe('서울특별시');
    expect(normalizeRegion('부산')).toBe('부산광역시');
    expect(normalizeRegion('대구')).toBe('대구광역시');
    expect(normalizeRegion('인천')).toBe('인천광역시');
    expect(normalizeRegion('광주')).toBe('광주광역시');
    expect(normalizeRegion('대전')).toBe('대전광역시');
    expect(normalizeRegion('울산')).toBe('울산광역시');
    expect(normalizeRegion('세종')).toBe('세종특별자치시');
    expect(normalizeRegion('경기')).toBe('경기도');
    expect(normalizeRegion('강원')).toBe('강원특별자치도');
    expect(normalizeRegion('충북')).toBe('충청북도');
    expect(normalizeRegion('충남')).toBe('충청남도');
    expect(normalizeRegion('전북')).toBe('전북특별자치도');
    expect(normalizeRegion('전남')).toBe('전라남도');
    expect(normalizeRegion('경북')).toBe('경상북도');
    expect(normalizeRegion('경남')).toBe('경상남도');
    expect(normalizeRegion('제주')).toBe('제주특별자치도');
  });

  // ~시 변형 (광주시 제외 — 경기도 광주시와 모호하므로 매핑하지 않음)
  it('maps city-suffix variants', () => {
    expect(normalizeRegion('서울시')).toBe('서울특별시');
    expect(normalizeRegion('부산시')).toBe('부산광역시');
    expect(normalizeRegion('대구시')).toBe('대구광역시');
    expect(normalizeRegion('인천시')).toBe('인천광역시');
    expect(normalizeRegion('대전시')).toBe('대전광역시');
    expect(normalizeRegion('울산시')).toBe('울산광역시');
    expect(normalizeRegion('세종시')).toBe('세종특별자치시');
  });

  it('returns null for ambiguous 광주시', () => {
    expect(normalizeRegion('광주시')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normalizeRegion('')).toBeNull();
    expect(normalizeRegion('  ')).toBeNull();
  });

  it('maps old names to current official names', () => {
    expect(normalizeRegion('전라북도')).toBe('전북특별자치도');
    expect(normalizeRegion('강원도')).toBe('강원특별자치도');
    expect(normalizeRegion('제주도')).toBe('제주특별자치도');
  });

  it('maps known typos', () => {
    expect(normalizeRegion('제주특별차지도')).toBe('제주특별자치도');
    expect(normalizeRegion('청충북도')).toBe('충청북도');
    expect(normalizeRegion('기도')).toBe('경기도');
    expect(normalizeRegion('제주특별자')).toBe('제주특별자치도');
    expect(normalizeRegion('세종특별시')).toBe('세종특별자치시');
  });

  it('returns official names unchanged', () => {
    expect(normalizeRegion('서울특별시')).toBe('서울특별시');
    expect(normalizeRegion('경기도')).toBe('경기도');
    expect(normalizeRegion('전북특별자치도')).toBe('전북특별자치도');
  });

  it('returns null for unrecognizable input', () => {
    expect(normalizeRegion('광나루로56길')).toBeNull();
    expect(normalizeRegion('논현로')).toBeNull();
    expect(normalizeRegion('강남구')).toBeNull();
  });
});

describe('sanitizeAddress', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeAddress('')).toBe('');
    expect(sanitizeAddress('  ')).toBe('');
  });

  it('strips HTML tags', () => {
    expect(sanitizeAddress('서울특별시 강남구 역삼로 123<br>- 1층')).toBe(
      '서울특별시 강남구 역삼로 123 - 1층',
    );
    expect(sanitizeAddress('경기도 성남시 <b>분당구</b> 판교로 1')).toBe(
      '경기도 성남시 분당구 판교로 1',
    );
  });

  it('removes zero-width and invisible unicode characters', () => {
    expect(sanitizeAddress('전라남도 목포시 옥암로 182, 1층\u200b')).toBe(
      '전라남도 목포시 옥암로 182, 1층',
    );
    expect(sanitizeAddress('\u200b경상남도 거창군 거창읍 중앙로 123')).toBe(
      '경상남도 거창군 거창읍 중앙로 123',
    );
    expect(sanitizeAddress('경기도 고양시 일산서구 중\u200b앙로 1568 2층')).toBe(
      '경기도 고양시 일산서구 중앙로 1568 2층',
    );
  });

  it('converts NBSP and tabs to regular spaces', () => {
    expect(sanitizeAddress('경기 성남시 분당구\u00a0롯데백화점')).toBe(
      '경기 성남시 분당구 롯데백화점',
    );
    expect(sanitizeAddress('강원도 원주시\t\t단계동 853-1')).toBe(
      '강원도 원주시 단계동 853-1',
    );
  });

  it('removes duplicate region prefix', () => {
    expect(sanitizeAddress('세종특별자치시 세종특별자치시 한누리대로2149')).toBe(
      '세종특별자치시 한누리대로2149',
    );
    expect(sanitizeAddress('경상북도 경상북도 포항시 남구 효성로 18')).toBe(
      '경상북도 포항시 남구 효성로 18',
    );
    expect(sanitizeAddress('부산 부산광역시 동래구 충렬대로 7')).toBe(
      '부산광역시 동래구 충렬대로 7',
    );
  });

  it('collapses multiple spaces', () => {
    expect(sanitizeAddress('서울특별시  강남구   역삼로 123')).toBe(
      '서울특별시 강남구 역삼로 123',
    );
  });

  it('handles combined issues', () => {
    expect(
      sanitizeAddress('부산광역시 부산광역시 동래구 충렬대로428번길 7<br>\u200b'),
    ).toBe('부산광역시 동래구 충렬대로428번길 7');
  });
});

describe('normalizeStoreAddress', () => {
  it('returns nulls for empty input', () => {
    expect(normalizeStoreAddress('')).toEqual({ address: '', region: null, district: null });
  });

  it('normalizes a standard address with official region', () => {
    expect(normalizeStoreAddress('서울특별시 강남구 역삼로 123')).toEqual({
      address: '서울특별시 강남구 역삼로 123',
      region: '서울특별시',
      district: '강남구',
    });
  });

  it('normalizes abbreviated region in address', () => {
    expect(normalizeStoreAddress('경남 밀양시 창밀로 3566')).toEqual({
      address: '경상남도 밀양시 창밀로 3566',
      region: '경상남도',
      district: '밀양시',
    });
  });

  it('normalizes old region name in address', () => {
    expect(normalizeStoreAddress('전라북도 전주시 덕진구 조경단로 59')).toEqual({
      address: '전북특별자치도 전주시 덕진구 조경단로 59',
      region: '전북특별자치도',
      district: '전주시',
    });
  });

  it('handles address with HTML and unicode issues', () => {
    expect(
      normalizeStoreAddress('충청남도 서산시 호수공원8로 3-4<br>(중앙호수공원)'),
    ).toEqual({
      address: '충청남도 서산시 호수공원8로 3-4 (중앙호수공원)',
      region: '충청남도',
      district: '서산시',
    });
  });

  it('handles duplicate region prefix', () => {
    expect(
      normalizeStoreAddress('경상북도 경상북도 포항시 남구 효성로 18'),
    ).toEqual({
      address: '경상북도 포항시 남구 효성로 18',
      region: '경상북도',
      district: '포항시',
    });
  });

  it('handles address missing region (starts with district)', () => {
    expect(normalizeStoreAddress('강남구 역삼로 123')).toEqual({
      address: '강남구 역삼로 123',
      region: null,
      district: null,
    });
  });

  it('returns null region for ambiguous 광주시 (could be 광주광역시 or 경기도 광주시)', () => {
    expect(normalizeStoreAddress('광주시 오포읍 신현리 123')).toEqual({
      address: '광주시 오포읍 신현리 123',
      region: null,
      district: null,
    });
  });

  it('handles address starting with road name (total parse failure)', () => {
    expect(normalizeStoreAddress('첨단중앙로 96, 1층')).toEqual({
      address: '첨단중앙로 96, 1층',
      region: null,
      district: null,
    });
  });

  it('handles 경기도 with compound district', () => {
    expect(normalizeStoreAddress('경기도 성남시 수정구 제일로 145')).toEqual({
      address: '경기도 성남시 수정구 제일로 145',
      region: '경기도',
      district: '성남시',
    });
  });

  it('replaces abbreviated region in the address text itself', () => {
    const result = normalizeStoreAddress('전남 고흥군 도화면 중심길 19-1');
    expect(result.address).toBe('전라남도 고흥군 도화면 중심길 19-1');
    expect(result.region).toBe('전라남도');
    expect(result.district).toBe('고흥군');
  });

  it('handles parenthetical addresses with region typo', () => {
    expect(
      normalizeStoreAddress('제주특별차지도 제주시 첨단로 123'),
    ).toEqual({
      address: '제주특별자치도 제주시 첨단로 123',
      region: '제주특별자치도',
      district: '제주시',
    });
  });
});
