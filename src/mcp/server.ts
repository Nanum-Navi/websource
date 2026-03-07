import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const PROJECT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// ─── Script runner ────────────────────────────────────────────────────────────

async function runScript(script: string, args: string[]): Promise<{ ok: boolean; [key: string]: unknown }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['tsx', join(PROJECT_DIR, 'scripts', script), ...args], {
      cwd: PROJECT_DIR,
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => { stdout += d; });
    proc.stderr.on('data', (d: Buffer) => { stderr += d; });

    proc.on('close', () => {
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve({ ok: false, error: stderr.trim() || `No JSON output from ${script}` });
      }
    });

    proc.on('error', (err) => reject(err));
  });
}

// Converts script output to an MCP content response.
// ok:false results are returned as isError so Claude sees them as tool errors.
function toContent(result: { ok: boolean; [key: string]: unknown }) {
  const text = JSON.stringify(result, null, 2);
  return result.ok
    ? { content: [{ type: 'text' as const, text }] }
    : { content: [{ type: 'text' as const, text }], isError: true };
}

// ─── Server ───────────────────────────────────────────────────────────────────

export const server = new McpServer({ name: 'websource', version: '1.0.0' });

// ── websource_discover_sections ──────────────────────────────────────────────

server.tool(
  'websource_discover_sections',
  'Discover category/section tabs on a page (e.g. leaderboard tabs, product categories)',
  {
    url: z.string().url().describe('Page URL to inspect'),
    mode: z.enum(['static', 'rendered', 'auto']).optional().default('auto')
      .describe('Fetch mode — use "rendered" for JS-heavy pages'),
  },
  async ({ url, mode }) => toContent(await runScript('discover-sections.ts', [url, '--mode', mode])),
);

// ── websource_analyze_page ───────────────────────────────────────────────────

server.tool(
  'websource_analyze_page',
  'Analyze a page to detect repeated data blocks, suggested fields, and pagination',
  {
    url: z.string().url().describe('Page URL to analyze'),
    mode: z.enum(['static', 'rendered', 'auto']).optional().default('auto')
      .describe('Fetch mode — use "rendered" if fieldQuality comes back none/poor'),
  },
  async ({ url, mode }) => toContent(await runScript('analyze-page.ts', [url, '--mode', mode])),
);

// ── websource_create_source ──────────────────────────────────────────────────

const FieldSchema = z.object({
  name: z.string(),
  selector: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'url', 'date', 'image', 'price', 'html']),
  attribute: z.string().optional(),
});

server.tool(
  'websource_create_source',
  'Create and persist a data source with its extraction config',
  {
    name: z.string().describe('Human-readable source name'),
    url: z.string().url().describe('Target page URL'),
    fetchMode: z.enum(['static', 'rendered']).optional().default('static'),
    listSelector: z.string().describe('CSS selector for list items (suggestedBlock.selector from analyze_page)'),
    fields: z.array(FieldSchema).describe('Fields to extract'),
    schedule: z.object({
      cronExpr: z.string().describe('Cron expression, e.g. "0 0 * * *"'),
      preset: z.string().optional(),
    }).optional().describe('Omit for manual-only extraction'),
  },
  async ({ name, url, fetchMode, listSelector, fields, schedule }) =>
    toContent(await runScript('create-source.ts', [
      JSON.stringify({ name, url, fetchMode, listSelector, fields, schedule }),
    ])),
);

// ── websource_preview_extraction ─────────────────────────────────────────────

server.tool(
  'websource_preview_extraction',
  'Dry-run extraction for a saved source — returns sample records without writing to the DB',
  {
    sourceId: z.string().describe('Source ID from create_source or list_sources'),
    limit: z.number().int().min(1).max(50).optional().default(5),
  },
  async ({ sourceId, limit }) =>
    toContent(await runScript('preview-extraction.ts', [sourceId, '--limit', String(limit)])),
);

// ── websource_run_extraction ─────────────────────────────────────────────────

server.tool(
  'websource_run_extraction',
  'Run extraction for a saved source and persist the results to the DB',
  {
    sourceId: z.string().describe('Source ID to run'),
    trigger: z.enum(['manual', 'scheduled', 'api']).optional().default('manual'),
  },
  async ({ sourceId, trigger }) =>
    toContent(await runScript('run-extraction.ts', [sourceId, '--trigger', trigger])),
);

// ── websource_list_sources ───────────────────────────────────────────────────

server.tool(
  'websource_list_sources',
  'List all saved data sources with status and last-run stats',
  {
    status: z.enum(['active', 'paused', 'archived']).optional()
      .describe('Filter by status — omit to return all'),
  },
  async ({ status }) =>
    toContent(await runScript('list-sources.ts', status ? ['--status', status] : [])),
);
