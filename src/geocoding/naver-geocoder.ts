import { createChildLogger } from '../shared/logger.js';
import { NetworkError } from '../shared/errors.js';
import type { GeocodingResult, GeocodingOptions, GeocodingBatchResult } from './types.js';

const log = createChildLogger('naver-geocoder');

const GEOCODE_URL = 'https://maps.apigw.ntruss.com/map-geocode/v2/geocode';

interface NaverGeocodeResponse {
  status: string;
  meta: { totalCount: number };
  addresses: Array<{
    roadAddress: string;
    jibunAddress: string;
    x: string;
    y: string;
  }>;
  errorMessage: string;
}

function getCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.NCP_CLIENT_ID;
  const clientSecret = process.env.NCP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new NetworkError(
      'Naver Cloud credentials not found. Set NCP_CLIENT_ID and NCP_CLIENT_SECRET environment variables.',
    );
  }

  return { clientId, clientSecret };
}

function cleanAddress(address: string): string {
  return address
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/,.*$/, '')
    .trim();
}

export async function geocode(address: string): Promise<GeocodingResult | null> {
  const { clientId, clientSecret } = getCredentials();
  const cleanAddr = cleanAddress(address);

  const attempts = [cleanAddr, address];
  for (const query of attempts) {
    const params = new URLSearchParams({ query });
    const res = await fetch(`${GEOCODE_URL}?${params}`, {
      headers: {
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
      },
    });

    if (!res.ok) {
      log.warn({ status: res.status, address: query }, 'Geocode API HTTP error');
      continue;
    }

    const data = (await res.json()) as NaverGeocodeResponse;
    if (data.status === 'OK' && data.addresses?.length > 0) {
      const addr = data.addresses[0];
      return {
        lat: addr.y,
        lng: addr.x,
        roadAddress: addr.roadAddress || undefined,
        jibunAddress: addr.jibunAddress || undefined,
      };
    }

    log.debug({ status: data.status, address: query, error: data.errorMessage }, 'No geocode result');
  }

  return null;
}

export async function geocodeBatch(
  addresses: string[],
  options: GeocodingOptions = {},
): Promise<GeocodingBatchResult> {
  const { rateLimitMs = 150, maxRetries = 2, onProgress } = options;
  let succeeded = 0;
  let failed = 0;
  const results: GeocodingBatchResult['results'] = [];

  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    let result: GeocodingResult | null = null;
    let lastError: string | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        result = await geocode(address);
        break;
      } catch (err) {
        lastError = (err as Error).message;
        log.warn({ address, attempt, error: lastError }, 'Geocode retry');
        await new Promise((r) => setTimeout(r, rateLimitMs * 2));
      }
    }

    if (result) {
      succeeded++;
      results.push({ address, result });
    } else {
      failed++;
      results.push({ address, result: null, error: lastError || 'No result found' });
    }

    onProgress?.(i + 1, addresses.length, succeeded, failed);

    if (i < addresses.length - 1) {
      await new Promise((r) => setTimeout(r, rateLimitMs));
    }
  }

  return { total: addresses.length, succeeded, failed, results };
}