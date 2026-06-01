/**
 * Safe DB reset: exports botanical cache → resets DB → seed.sql auto-replays.
 *
 * Use instead of bare `bunx supabase db reset` to avoid losing
 * accumulated Perenual + AI Scribe data:
 *   bun run db-reset-safe
 */

import { join } from 'node:path';

console.log('Step 1/2  Exporting botanical cache...');

const exportScript = join(import.meta.dir, 'export-botanical-seed.ts');
const exportProc = Bun.spawn(['bun', 'run', exportScript], {
  stdout: 'inherit',
  stderr: 'inherit',
  stdin: 'inherit',
});
const exportCode = await exportProc.exited;

if (exportCode !== 0) {
  console.error('\nExport failed — aborting reset. No data was lost.');
  process.exit(1);
}

console.log('\nStep 2/2  Resetting database...');

const resetProc = Bun.spawn(['bunx', 'supabase', 'db', 'reset'], {
  stdout: 'inherit',
  stderr: 'inherit',
  stdin: 'inherit',
});
const resetCode = await resetProc.exited;
process.exit(resetCode);
