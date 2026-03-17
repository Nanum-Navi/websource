/**
 * Geocode store data files that have missing lat/lng coordinates.
 *
 * Usage:
 *   npx tsx scripts/geocode-stores.ts data/<file>.json [--dry-run]
 *
 * Requires NCP_CLIENT_ID and NCP_CLIENT_SECRET environment variables.
 * These can be set in a .env file at the project root.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { geocode } from '../src/geocoding/naver-geocoder.js';

const args = process.argv.slice(2);
const filePath = args.find((a) => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');

if (!filePath) {
  process.stdout.write(
    JSON.stringify({ ok: false, error: 'Usage: npx tsx scripts/geocode-stores.ts <file.json> [--dry-run]' }) + '\n',
  );
  process.exit(1);
}

const absPath = resolve(filePath);
if (!existsSync(absPath)) {
  process.stdout.write(JSON.stringify({ ok: false, error: `File not found: ${absPath}` }) + '\n');
  process.exit(1);
}

// Load .env if present
const envPath = resolve(import.meta.dirname, '..', '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

try {
  const data = JSON.parse(readFileSync(absPath, 'utf-8'));
  const stores: Array<Record<string, unknown>> = data.stores;

  const needGeocode = stores.filter((s) => !s.lat || !s.lng);
  if (needGeocode.length === 0) {
    process.stdout.write(JSON.stringify({ ok: true, message: 'All stores already have coordinates', total: stores.length }) + '\n');
    process.exit(0);
  }

  console.log(`Total: ${stores.length}, need geocoding: ${needGeocode.length}${dryRun ? ' (dry-run)' : ''}`);

  let succeeded = 0;
  let failed = 0;
  const failedStores: Array<{ id: unknown; name: unknown; address: unknown }> = [];

  for (let i = 0; i < needGeocode.length; i++) {
    const s = needGeocode[i];
    const address = String(s.address || '');

    if (!dryRun) {
      const result = await geocode(address);
      if (result) {
        s.lat = result.lat;
        s.lng = result.lng;
        succeeded++;
      } else {
        failed++;
        failedStores.push({ id: s.id, name: s.name, address: s.address });
      }
    } else {
      succeeded++;
    }

    if ((i + 1) % 50 === 0 || i === needGeocode.length - 1) {
      process.stderr.write(`\r  ${i + 1}/${needGeocode.length} (ok: ${succeeded}, fail: ${failed})`);
    }

    if (!dryRun && i < needGeocode.length - 1) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  process.stderr.write('\n');

  if (!dryRun) {
    data.meta.totalCount = stores.filter((s) => s.lat && s.lng).length;
    writeFileSync(absPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        dryRun,
        total: stores.length,
        geocoded: succeeded,
        failed,
        failedStores: failedStores.length > 0 ? failedStores : undefined,
      },
      null,
      2,
    ) + '\n',
  );
} catch (err) {
  process.stdout.write(JSON.stringify({ ok: false, error: (err as Error).message }) + '\n');
  process.exit(1);
}