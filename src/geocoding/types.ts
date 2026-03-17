export interface GeocodingResult {
  lat: string;
  lng: string;
  roadAddress?: string;
  jibunAddress?: string;
}

export interface GeocodingOptions {
  /** Rate limit between API calls in ms (default: 150) */
  rateLimitMs?: number;
  /** Max retry attempts per address (default: 2) */
  maxRetries?: number;
  /** Called after each address is processed */
  onProgress?: (processed: number, total: number, succeeded: number, failed: number) => void;
}

export interface GeocodingBatchResult {
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{
    address: string;
    result: GeocodingResult | null;
    error?: string;
  }>;
}