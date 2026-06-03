/**
 * Exports cached_botanical_records from a remote Supabase project to a
 * timestamped SQL file in supabase/backups/.
 *
 * Requirements — set these env vars before running (PowerShell):
 *   $env:SUPABASE_URL              = "https://yourproject.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "<service_role_key>"
 *
 * Both values are on: Supabase Dashboard → Settings → API
 *
 * Run:
 *   bun run export-remote-backup
 *
 * The output file in supabase/backups/ contains re-importable INSERT statements.
 * Restore via: Supabase Dashboard → SQL Editor → paste the file contents.
 */

import { createClient } from '@supabase/supabase-js';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

type BotanicalRow = Record<string, unknown>;

const SUPABASE_URL = Bun.env.SUPABASE_URL;
const SUPABASE_KEY = Bun.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars. Set both before running:');
  console.error('  $env:SUPABASE_URL              = "https://yourproject.supabase.co"');
  console.error('  $env:SUPABASE_SERVICE_ROLE_KEY = "<key>"');
  console.error('Both are at: Supabase Dashboard → Settings → API');
  process.exit(1);
}

function escapeSql(s: string): string {
  return s.replace(/'/g, "''");
}

function toSqlLiteral(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return 'ARRAY[]::text[]';
    return `ARRAY[${val.map((v) => `'${escapeSql(String(v))}'`).join(', ')}]`;
  }
  if (typeof val === 'object') {
    // JSONB — serialize back to a SQL string literal with ::jsonb cast
    return `'${escapeSql(JSON.stringify(val))}'::jsonb`;
  }
  return `'${escapeSql(String(val))}'`;
}

function rowToInsert(row: BotanicalRow): string {
  const cols = Object.keys(row);
  const colList = cols.join(', ');
  const valList = cols.map((c) => toSqlLiteral(row[c])).join(',\n    ');
  return [
    `INSERT INTO public.cached_botanical_records (${colList})`,
    `VALUES (`,
    `    ${valList}`,
    `)`,
    `ON CONFLICT (scientific_name) DO NOTHING;`,
  ].join('\n');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client = createClient<any>(SUPABASE_URL, SUPABASE_KEY);
console.log(`Connecting to ${SUPABASE_URL} ...`);

// Fetch in pages to stay inside the Supabase JS default 1 000-row limit.
const PAGE_SIZE = 1000;
const rows: BotanicalRow[] = [];

for (let offset = 0; ; offset += PAGE_SIZE) {
  const { data, error } = await client
    .from('cached_botanical_records')
    .select('*')
    .order('scientific_name')
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) break;
  rows.push(...(data as BotanicalRow[]));
  if (data.length < PAGE_SIZE) break;
}

if (rows.length === 0) {
  console.log('Table is empty — nothing to export.');
  process.exit(0);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = join(import.meta.dir, '..', 'backups');
const backupPath = join(backupDir, `botanical_${timestamp}.sql`);

mkdirSync(backupDir, { recursive: true });

const sql = [
  `-- FloraFlow — cached_botanical_records backup`,
  `-- Generated : ${new Date().toISOString()}`,
  `-- Source    : ${SUPABASE_URL}`,
  `-- Rows      : ${rows.length}`,
  `--`,
  `-- Restore options:`,
  `--   1. Supabase Dashboard → SQL Editor → paste this file`,
  `--   2. psql -d "<connection-string>" -f "<this-file>"`,
  '',
  rows.map(rowToInsert).join('\n\n'),
  '',
].join('\n');

await Bun.write(backupPath, sql);
console.log(`Backed up ${rows.length} rows → ${backupPath}`);
