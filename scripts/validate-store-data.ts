/**
 * Validate franchise store data against store_schema.json.
 * Usage: npx tsx scripts/validate-store-data.ts <json-file-path>
 * Output: Validation report to stdout
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { OFFICIAL_REGIONS } from '../src/normalize/address.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

interface StoreMeta {
  brand_id: string;
  brand_name: string;
  totalCount: number;
  extractedAt: string;
  sourceUrl: string;
}

interface Store {
  id: number;
  name: string;
  address: string;
  contact: string | null;
  lat: string;
  lng: string;
  region: string;
  district: string;
  [key: string]: unknown;
}

interface StoreData {
  meta: StoreMeta;
  stores: Store[];
}

interface ValidationError {
  recordId: number | null;
  field: string;
  issue: string;
}

function loadSchema() {
  const schemaPath = resolve(projectRoot, 'meta/store_schema.json');
  return JSON.parse(readFileSync(schemaPath, 'utf-8'));
}

function loadRules() {
  const rulesPath = resolve(projectRoot, 'config/crawl_rules.json');
  return JSON.parse(readFileSync(rulesPath, 'utf-8'));
}

function validate(filePath: string) {
  const absolutePath = resolve(filePath);
  const raw = readFileSync(absolutePath, 'utf-8');
  let data: StoreData;

  try {
    data = JSON.parse(raw);
  } catch {
    console.error('ERROR: Invalid JSON file');
    process.exit(1);
  }

  const rules = loadRules();
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // --- Meta validation ---
  const requiredMeta = ['brand_id', 'brand_name', 'totalCount', 'extractedAt', 'sourceUrl'];
  for (const field of requiredMeta) {
    if (!(field in data.meta)) {
      errors.push({ recordId: null, field: `meta.${field}`, issue: 'missing required field' });
    }
  }

  if (data.meta.totalCount !== data.stores.length) {
    warnings.push(`meta.totalCount (${data.meta.totalCount}) does not match stores.length (${data.stores.length})`);
  }

  // --- Stores validation ---
  if (!Array.isArray(data.stores)) {
    errors.push({ recordId: null, field: 'stores', issue: 'must be an array' });
    return printReport(filePath, data, errors, warnings);
  }

  const requiredFields = ['id', 'name', 'address', 'lat', 'lng', 'region', 'district'];
  const allowedFields = new Set(['id', 'name', 'address', 'contact', 'lat', 'lng', 'region', 'district']);
  const coordRange = rules.validation.coordinateRange;
  const seen = new Set<string>();

  for (const store of data.stores) {
    const rid = store.id ?? null;

    // Required fields
    for (const field of requiredFields) {
      if (!(field in store) || store[field] === null || store[field] === undefined || store[field] === '') {
        errors.push({ recordId: rid, field, issue: 'missing or empty required field' });
      }
    }

    // Region allowlist check
    if (typeof store.region === 'string' && store.region !== '') {
      if (!OFFICIAL_REGIONS.includes(store.region as any)) {
        errors.push({
          recordId: rid,
          field: 'region',
          issue: `non-official region name: "${store.region}"`,
        });
      }
    }

    // Extra fields
    for (const key of Object.keys(store)) {
      if (!allowedFields.has(key)) {
        errors.push({ recordId: rid, field: key, issue: 'field not in schema' });
      }
    }

    // lat/lng type check (must be string)
    if (typeof store.lat !== 'string' && store.lat !== undefined) {
      errors.push({ recordId: rid, field: 'lat', issue: `expected string, got ${typeof store.lat}` });
    }
    if (typeof store.lng !== 'string' && store.lng !== undefined) {
      errors.push({ recordId: rid, field: 'lng', issue: `expected string, got ${typeof store.lng}` });
    }

    // Coordinate range
    if (typeof store.lat === 'string') {
      const latNum = parseFloat(store.lat);
      if (isNaN(latNum) || latNum < coordRange.lat.min || latNum > coordRange.lat.max) {
        errors.push({ recordId: rid, field: 'lat', issue: `out of range (${coordRange.lat.min}~${coordRange.lat.max}): ${store.lat}` });
      }
    }
    if (typeof store.lng === 'string') {
      const lngNum = parseFloat(store.lng);
      if (isNaN(lngNum) || lngNum < coordRange.lng.min || lngNum > coordRange.lng.max) {
        errors.push({ recordId: rid, field: 'lng', issue: `out of range (${coordRange.lng.min}~${coordRange.lng.max}): ${store.lng}` });
      }
    }

    // Duplicate check
    const dedupeKey = `${store.name}||${store.address}`;
    if (seen.has(dedupeKey)) {
      errors.push({ recordId: rid, field: 'name+address', issue: 'duplicate record' });
    }
    seen.add(dedupeKey);

    // Name prefix check
    if (data.meta.brand_name && typeof store.name === 'string') {
      if (!store.name.startsWith(data.meta.brand_name)) {
        warnings.push(`id ${rid}: name "${store.name}" does not start with brand_name "${data.meta.brand_name}"`);
      }
    }

    // Contact nullable check
    if ('contact' in store && store.contact !== null && typeof store.contact !== 'string') {
      errors.push({ recordId: rid, field: 'contact', issue: `expected string or null, got ${typeof store.contact}` });
    }
  }

  printReport(filePath, data, errors, warnings);
}

function printReport(filePath: string, data: StoreData, errors: ValidationError[], warnings: string[]) {
  console.log('='.repeat(60));
  console.log('Franchise Store Data Validation Report');
  console.log('='.repeat(60));
  console.log(`File: ${filePath}`);
  console.log(`Brand: ${data.meta?.brand_name ?? 'unknown'} (${data.meta?.brand_id ?? 'unknown'})`);
  console.log(`Records: ${data.stores?.length ?? 0}`);
  console.log('-'.repeat(60));

  if (errors.length === 0 && warnings.length === 0) {
    console.log('PASSED — No errors or warnings');
    console.log('='.repeat(60));
    process.exit(0);
  }

  if (errors.length > 0) {
    console.log(`\nERRORS (${errors.length}):\n`);
    for (const err of errors) {
      const loc = err.recordId !== null ? `[id: ${err.recordId}]` : '[meta]';
      console.log(`  ${loc} ${err.field}: ${err.issue}`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\nWARNINGS (${warnings.length}):\n`);
    for (const w of warnings) {
      console.log(`  ${w}`);
    }
  }

  console.log('\n' + '='.repeat(60));

  const storeCount = data.stores?.length ?? 0;
  const errorRate = storeCount > 0 ? errors.length / storeCount : 0;

  if (errors.length > 0) {
    console.log(`FAILED — ${errors.length} error(s), ${warnings.length} warning(s)`);
    if (errorRate > 0.05) {
      console.log(`Error rate: ${(errorRate * 100).toFixed(1)}% (threshold: 5%)`);
    }
    process.exit(1);
  } else {
    console.log(`PASSED with ${warnings.length} warning(s)`);
    process.exit(0);
  }
}

// --- Main ---
const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: npx tsx scripts/validate-store-data.ts <json-file-path>');
  process.exit(1);
}

validate(filePath);
