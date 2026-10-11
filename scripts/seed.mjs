#!/usr/bin/env node
// Loads the demo business, then closes its two finished years the way an operator would:
// FY2025 (the base year) and FY2026 lock into frozen inventories. Safe to run more than once.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { execute } from './carbon.mjs';

const actor = 'Seed';

export async function seed(db) {
  await db.exec('BEGIN');
  try {
    await db.exec(readFileSync(path.join(REPO_ROOT, 'supabase', 'seed.sql'), 'utf8'));
    await db.exec('COMMIT');
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
  const status = Object.fromEntries((await db.query('select name, status from carbon.inventories')).map((r) => [r.name, r.status]));
  if (status.FY2025 === 'open') await execute(db, 'lock-inventory', { inventory: 'FY2025', date: '2025-06-30', note: 'Base year, reviewed by the CFO', actor });
  if (status.FY2026 === 'open') await execute(db, 'lock-inventory', { inventory: 'FY2026', date: '2026-06-20', note: 'Reviewed by the CFO', actor });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const db = await getDb();
  try {
    await seed(db);
    console.log('seed: Kererū Foods demo ready (FY2025 and FY2026 locked, FY2027 open with gaps)');
  } finally {
    await db.close();
  }
}
