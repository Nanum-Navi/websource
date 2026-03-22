import { describe, it, expect } from 'vitest';
import { normalizeRegion } from '../../src/normalize/address.js';

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
