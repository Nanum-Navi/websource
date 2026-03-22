// scripts/normalize-store-data.ts
/**
 * Normalize address/region/district in all franchise store data files.
 * Usage: npx tsx scripts/normalize-store-data.ts [--dry-run] [file...]
 *
 * Without file args, processes all data/*.json (excluding *_failed.json).
 * --dry-run: Print changes without modifying files.
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, dirname, basename, join } from 'path';
import { fileURLToPath } from 'url';
import { normalizeStoreAddress } from '../src/normalize/address.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

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
  meta: Record<string, unknown>;
  stores: Store[];
}

interface ChangeRecord {
  id: number;
  field: string;
  before: string;
  after: string;
}

function processFile(filePath: string, dryRun: boolean): ChangeRecord[] {
  const raw = readFileSync(filePath, 'utf-8');
  const data: StoreData = JSON.parse(raw);
  const changes: ChangeRecord[] = [];

  for (const store of data.stores) {
    const original = {
      address: store.address,
      region: store.region,
      district: store.district,
    };

    const normalized = normalizeStoreAddress(store.address);

    if (normalized.address !== original.address) {
      changes.push({ id: store.id, field: 'address', before: original.address, after: normalized.address });
      store.address = normalized.address;
    }

    if (normalized.region && normalized.region !== original.region) {
      changes.push({ id: store.id, field: 'region', before: original.region, after: normalized.region });
      store.region = normalized.region;
    }

    if (normalized.district && normalized.district !== original.district) {
      changes.push({ id: store.id, field: 'district', before: original.district, after: normalized.district });
      store.district = normalized.district;
    }
  }

  if (changes.length > 0 && !dryRun) {
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  }

  return changes;
}

// --- Main ---
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fileArgs = args.filter((a) => a !== '--dry-run');

const dataDir = resolve(projectRoot, 'data');
const files =
  fileArgs.length > 0
    ? fileArgs.map((f) => resolve(f))
    : readdirSync(dataDir)
        .filter((f) => f.endsWith('.json') && !f.includes('_failed'))
        .map((f) => join(dataDir, f));

let totalChanges = 0;
let totalFiles = 0;

for (const file of files.sort()) {
  const changes = processFile(file, dryRun);
  if (changes.length > 0) {
    totalFiles++;
    totalChanges += changes.length;
    const brand = basename(file).replace(/\(.*/, '');
    console.log(`\n${brand} (${changes.length} changes):`);
    for (const c of changes.slice(0, 10)) {
      console.log(`  [id:${c.id}] ${c.field}: "${c.before}" → "${c.after}"`);
    }
    if (changes.length > 10) {
      console.log(`  ... and ${changes.length - 10} more`);
    }
  }
}

console.log('\n' + '='.repeat(60));
console.log(`${dryRun ? '[DRY RUN] ' : ''}Summary: ${totalChanges} changes across ${totalFiles}/${files.length} files`);
if (dryRun && totalChanges > 0) {
  console.log('Re-run without --dry-run to apply changes.');
}
