/**
 * Geocode one or more addresses via Naver Cloud Geocoding API.
 *
 * Usage:
 *   npx tsx scripts/geocode.ts <address>                    # single address
 *   npx tsx scripts/geocode.ts --stdin                      # JSON array from stdin
 *   echo '["addr1","addr2"]' | npx tsx scripts/geocode.ts --stdin
 *
 * Options:
 *   --rate-limit <ms>   Delay between requests (default: 150)
 *
 * Requires NCP_CLIENT_ID and NCP_CLIENT_SECRET in .env or environment.
 *
 * Output (JSON):
 *   { "ok": true, "results": [ { "address": "...", "lat": "...", "lng": "..." }, ... ] }
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { geocode } from '../src/geocoding/naver-geocoder.js';

// Load .env
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

const args = process.argv.slice(2);
const stdinMode = args.includes('--stdin');
const rateLimitIdx = args.indexOf('--rate-limit');
const rateLimitMs = rateLimitIdx >= 0 ? parseInt(args[rateLimitIdx + 1], 10) : 150;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf-8');
}

try {
  let addresses: string[];

  if (stdinMode) {
    const input = await readStdin();
    addresses = JSON.parse(input);
    if (!Array.isArray(addresses)) {
      throw new Error('stdin must be a JSON array of strings');
    }
  } else {
    const addr = args.filter((a) => !a.startsWith('--'));
    if (addr.length === 0) {
      process.stdout.write(
        JSON.stringify({ ok: false, error: 'Usage: npx tsx scripts/geocode.ts <address> | --stdin' }) + '\n',
      );
      process.exit(1);
    }
    addresses = [addr.join(' ')];
  }

  const results: Array<{ address: string; lat: string | null; lng: string | null }> = [];

  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    const result = await geocode(address);
    results.push({
      address,
      lat: result?.lat ?? null,
      lng: result?.lng ?? null,
    });

    if (i < addresses.length - 1) {
      await new Promise((r) => setTimeout(r, rateLimitMs));
    }
  }

  process.stdout.write(JSON.stringify({ ok: true, results }, null, 2) + '\n');
} catch (err) {
  process.stdout.write(JSON.stringify({ ok: false, error: (err as Error).message }) + '\n');
  process.exit(1);
}