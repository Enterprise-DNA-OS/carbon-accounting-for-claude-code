#!/usr/bin/env node
// npm test: a temporary database, migrate, seed twice, then exercise every command and the
// rules that matter (factor choice, frozen years, lock gates, gaps, compliance, import).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { seed } from './seed.mjs';
import { execute, parse, specs, reads, render } from './carbon.mjs';
import { parseCsv } from './lib/csv.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'carbon-test-'));
process.env.DATA_DIR = path.join(tmp, 'db');
process.env.OUTPUT_DIR = tmp;
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const env = { ...process.env };
const actor = 'Test operator';
const exercised = new Set();
let db;
const run = async (cmd, o = {}) => { exercised.add(cmd); return execute(db, cmd, o); };
const cli = (args) => spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'carbon.mjs'), ...args], { cwd: REPO_ROOT, env, encoding: 'utf8' });
const n = (v) => Number(v);
const close = (a, b, eps = 0.01) => assert(Math.abs(n(a) - n(b)) <= eps, `${a} is not ${b}`);

try {
  db = await getDb();
  if (db.mode === 'postgres') await db.exec('drop schema if exists carbon cascade; drop table if exists schema_migrations;');
  assert.equal((await migrate(db)).ran.length, 1);
  assert.equal((await migrate(db)).ran.length, 0, 'migrate is repeatable');
  await seed(db);
  const activityRows = n((await db.query('select count(*) from carbon.activity'))[0].count);
  await seed(db);
  assert.equal(n((await db.query('select count(*) from carbon.activity'))[0].count), activityRows, 'seed is idempotent');
  assert.equal((await run('sources')).length, 14);
  for (const cmd of Object.keys(reads)) assert(Array.isArray(await run(cmd)), `${cmd} returns rows`);

  // Two finished years locked, the current one open.
  const inv = await run('inventories');
  assert.deepEqual(inv.map((i) => [i.inventory, i.status]), [['FY2025', 'locked'], ['FY2026', 'locked'], ['FY2027', 'open']]);

  // Factor choice: NZ grid power uses the factor for the bill's own calendar year.
  const may2024 = (await db.query("select * from carbon.activity_emissions where source = 'Plant electricity' and period_start = '2024-05-01'"))[0];
  close(may2024.kg_co2e_per_unit, 0.0993596, 1e-7);
  close(may2024.tco2e, n(may2024.quantity) * 0.0993596 / 1000, 0.0001);
  const feb2025 = (await db.query("select * from carbon.activity_emissions where source = 'Plant electricity' and period_start = '2025-02-01'"))[0];
  close(feb2025.kg_co2e_per_unit, 0.0786625, 1e-7);
  const syd = (await db.query("select * from carbon.activity_emissions where source = 'Warehouse electricity' limit 1"))[0];
  close(syd.kg_co2e_per_unit, 0.64, 1e-7);
  assert.equal(syd.factor_edition, 'NGA 2025');

  // Quarterly bills are split across years by days: a bill over 1 Mar to 31 May puts 31/92 in the earlier year.
  await run('add-source', { name: 'Standby generator', site: 'christchurch', category: 'diesel-stationary', frequency: 'annual', actor });
  await assert.rejects(run('log', { source: 'Standby generator', from: '2026-03-01', to: '2026-05-31', quantity: '920', actor }), /locked/);
  await assert.rejects(run('add-source', { name: 'Bad', site: 'christchurch', category: 'unicorns', actor }), /Category must be/);

  // Frozen years: lines and their activity cannot change.
  await assert.rejects(db.query('update carbon.inventory_lines set tco2e = 1'), /frozen/);
  await assert.rejects(db.query('delete from carbon.inventory_lines'), /frozen/);
  await assert.rejects(db.query("update carbon.activity set quantity = 1 where source_ref = 'seed-plant-electricity-2025-05'"), /locked/);
  await assert.rejects(db.query("update carbon.inventories set status = 'open', locked_on = null where name = 'FY2025'"), /locked/);
  await assert.rejects(run('lock-inventory', { inventory: 'FY2025', actor }), /already locked/);
  const fy26 = await run('footprint', { inventory: 'FY2026' });
  assert.equal(fy26.status, 'locked');
  const supplierLine = fy26.lines.find((l) => l.category === 'purchased-goods');
  close(supplierLine.tco2e, 214.5 + 1640);
  close(n(fy26.scope1_t) + n(fy26.scope2_t) + n(fy26.scope3_t), fy26.total_t, 0.03);
  const liveFy26 = (await db.query(`select round(sum(tco2e * share), 2) as t from carbon.inventory_activity where inventory = 'FY2026'`))[0].t;
  close(n(liveFy26) + 1854.5, fy26.total_t, 0.05);

  // The open year: gaps, attention, the lock gate, run rate.
  const gaps = await run('data-gaps');
  for (const s of ['Warehouse electricity', 'Delivery trucks diesel', 'Food waste to landfill', 'Hotel nights in Australia']) assert(gaps.some((g) => g.source === s), `gap for ${s}`);
  assert(gaps.some((g) => g.source === 'Warehouse electricity' && g.month === '2026-07'));
  const att = await run('attention');
  assert(att.some((a) => a.what === 'Customer request due' && a.item === 'Harbour Supermarkets'));
  assert(att.some((a) => a.what === 'Supplier has not replied' && /overdue/.test(a.detail)));
  assert(att.some((a) => a.what === 'Action overdue'));
  const check = await run('lock-check', { inventory: 'FY2027' });
  assert(check.some((c) => c.issue === 'Year not finished'));
  assert(check.some((c) => c.issue === 'Missing data'));
  await assert.rejects(run('lock-inventory', { inventory: 'FY2027', actor }), /lock it after the year ends/);
  const tp = await run('target-progress');
  assert.equal(tp.length, 3);
  assert(tp.find((t) => t.inventory === 'FY2027').covers !== 'full year');
  const tr = await run('trend');
  close(tr[0].scope12_vs_base_pct, 0);

  // Compliance from the seed.
  const comp = (await run('compliance')).map((c) => c.rule).join('|');
  assert.match(comp, /Factor year/);
  assert.match(comp, /Group 3/);
  assert.match(comp, /base year/);
  assert.doesNotMatch(comp, /NGER: register/);
  const ob = await run('obligations');
  assert.equal(ob.filter((o) => o.applies).length, 1);
  assert.equal((await run('nger'))[0].site, 'Sydney warehouse');

  // Record the year's work: log a missing month, an estimate, a void, a new factor.
  const logged = await run('log', { source: 'Delivery trucks diesel', month: '2026-07', quantity: '4,120', evidence: 'Z statement Jul 2026', actor });
  close(logged.tco2e, 4120 * 2.67177 / 1000, 0.0001);
  await assert.rejects(run('log', { source: 'Delivery trucks diesel', month: '2026-07', quantity: '1', actor }), /already has activity/);
  await assert.rejects(run('log', { source: 'Food waste to landfill', month: '2026-09', quantity: '1700', estimated: true, actor }), /--method/);
  const est = await run('log', { source: 'Food waste to landfill', month: '2026-09', quantity: '1700', estimated: true, method: 'Average of Jul and Aug weighbridge', actor });
  assert.equal(est.estimated, true);
  assert((await run('estimates')).some((e) => e.source === 'Food waste to landfill'));
  const voided = await run('void-activity', { activity: String(est.id).slice(0, 8), reason: 'Weighbridge docket arrived', actor });
  assert.equal(voided.source, 'Food waste to landfill');
  await assert.rejects(run('void-activity', { activity: (await db.query("select id from carbon.activity where source_ref = 'seed-general-waste-2024-06'"))[0].id.slice(0, 8), reason: 'x', actor }), /locked/);
  await assert.rejects(run('log', { source: 'Food waste', month: '2026-09', quantity: '1', actor }), /More than one source/);
  await run('add-factor', { category: 'electricity', region: 'NZ', year: '2026', value: '0.0812', edition: 'Test edition', url: 'https://example.org/factors', checked: '2026-10-01', actor });
  const sep = (await db.query("select kg_co2e_per_unit, factor_year from carbon.activity_emissions where source = 'Plant electricity' and period_start = '2026-09-01'"))[0];
  assert.equal(sep.factor_year, 2026, 'a newer year factor takes over');
  assert(!(await run('compliance')).some((c) => /Factor year/.test(c.rule) && c.item === 'Plant electricity'));

  // Suppliers and customers.
  await run('request-supplier', { supplier: 'Pacific Cartons', inventory: 'FY2027', spend: '240,000', due: '2026-11-30', date: '2026-10-11', actor });
  const drafted = await run('draft-supplier-request', { supplier: 'pacific', inventory: 'FY2027' });
  assert(fs.readFileSync(drafted.file, 'utf8').includes('Nothing has been sent'));
  await run('record-supplier', { supplier: 'Southern Proteins', inventory: 'FY2027', tco2e: '820', basis: 'Supplier-specific, half year', actor });
  await assert.rejects(run('record-supplier', { supplier: 'Nobody', inventory: 'FY2027', tco2e: '1', basis: 'x', actor }), /No request/);
  assert((await run('footprint')).lines.some((l) => l.category === 'purchased-goods'));
  const resp = await run('draft-customer-response', { request: 'harbour' });
  const text = fs.readFileSync(resp.file, 'utf8');
  assert(text.includes('Nothing has been sent') && text.includes('Scope 1') && text.includes('MfE 2026'));
  await run('answer-customer-request', { request: 'harbour', actor });
  await assert.rejects(run('answer-customer-request', { request: 'harbour', actor }), /already answered/);
  const newReq = await run('add-customer-request', { customer: 'Tasman Grocers', inventory: 'FY2026', asked: 'Scope 1 and 2', due: '2026-11-15', actor });
  assert(newReq.id);
  assert((await run('customer-requests')).some((c) => c.customer === 'Tasman Grocers'));

  // Actions, targets, sites, inventories.
  await run('add-action', { name: 'LED lighting in the dispatch bay', site: 'christchurch', owner: 'Hemi Walker', status: 'approved', saving: '4', cost: '18,000', due: '2027-02-01', actor });
  const upd = await run('update-action', { action: 'electric vans', status: 'underway', due: '2026-12-01', actor });
  assert.equal(upd.status, 'underway');
  await assert.rejects(run('update-action', { action: 'LED', status: 'maybe', actor }), /Status must be/);
  const tgt = await run('set-target', { name: 'Scope 1 and 2 down 42% by FY2030', base: 'FY2025', 'year-end': '2030-03-31', pct: '42', actor });
  assert.equal(tgt.base_year, 'FY2025');
  assert.equal((await run('targets')).length, 1);
  const site = await run('add-site', { name: 'Auckland sales office', entity: 'Kererū Foods Ltd', region: 'nz', kind: 'office', actor });
  assert(site.id);
  await assert.rejects(run('add-site', { name: 'Bad region', entity: 'Kererū Foods Ltd', region: 'Mars', actor }), /Region must be/);
  await assert.rejects(run('open-inventory', { name: 'Overlap', start: '2027-01-01', end: '2027-12-31', actor }), /Overlaps/);
  const fy28 = await run('open-inventory', { name: 'FY2028', start: '2027-04-01', end: '2028-03-31', actor });
  assert.equal(fy28.name, 'FY2028');
  const si = await run('set-inventory', { inventory: 'FY2027', revenue: '67,000,000', output: '4800', actor });
  assert.equal(n(si.revenue_cents), 6700000000);

  // Lock with an override on a finished year (simulated by a closed past window).
  await run('open-inventory', { name: 'Trial year', start: '2023-04-01', end: '2024-03-31', actor });
  const lockedTrial = await run('lock-inventory', { inventory: 'Trial year', override: 'Before we started measuring', date: '2026-10-11', actor });
  assert(lockedTrial.overridden > 0);
  assert.equal(n(lockedTrial.total_t), 0);

  // Import: dry run changes nothing, real run is repeatable, units, dates and reconciliation honoured.
  const fixture = path.join(REPO_ROOT, 'fixtures', 'persefoni-ledger.csv');
  const before = n((await db.query('select count(*) from carbon.activity'))[0].count);
  const dry = await run('import', { file: fixture, 'dry-run': true, actor });
  assert.equal(dry.activity_created, 4, 'the July diesel row overlaps the month logged above');
  assert(dry.problems.some((p) => /already has activity/.test(p)));
  assert.equal(n((await db.query('select count(*) from carbon.activity'))[0].count), before, 'dry run wrote nothing');
  // The diesel July row was logged above; void it so the import can bring Persefoni's figure in.
  await run('void-activity', { activity: String(logged.id).slice(0, 8), reason: 'Bringing the Persefoni record across instead', actor });
  const real = await run('import', { file: fixture, actor });
  assert.equal(real.activity_created, 5);
  assert.equal(real.skipped_existing, 1, 'a repeated record id is skipped');
  assert.equal(real.problems.length, 2);
  assert(real.problems.some((p) => /Refrigerant/.test(p)));
  assert(real.problems.some((p) => /locked inventory FY2026/.test(p)));
  assert.deepEqual(real.sites_created, ['Melbourne sales office (AU-VIC)']);
  const jul = (await db.query("select quantity, period_start from carbon.activity where source_ref = 'persefoni-PF-1001'"))[0];
  assert.equal(n(jul.quantity), 47200, 'MWh converted to kWh');
  assert.equal(jul.period_start, '2026-07-01', 'day-first dates');
  const rec = real.reconcile.find((r) => r.line === 2);
  close(rec.ours_t, 30.208, 0.001);
  assert(Math.abs(rec.diff_pct) < 1);
  assert.equal(real.reconcile.find((r) => /Melbourne/.test(r.source)).ours_t, null, 'no VIC factor yet');
  assert((await run('compliance')).some((c) => c.severity === 'breached' && /Melbourne/.test(c.item)));
  const again = await run('import', { file: fixture, actor });
  assert.equal(again.activity_created, 0);
  assert.equal(again.skipped_existing, 6);
  const mapFile = path.join(tmp, 'map.json');
  fs.writeFileSync(mapFile, JSON.stringify({ columns: { quantity: 'Usage (kWh)' }, categories: { 'Grid power': 'electricity' } }));
  const csv = path.join(tmp, 'p.csv');
  fs.writeFileSync(csv, '﻿Record ID,Facility,Activity Type,Start Date,End Date,Usage (kWh),Unit\r\nX-1,Auckland sales office,Grid power,09/01/2026,09/30/2026,2100,kWh\r\n');
  const mapped = await run('import', { file: csv, mapping: mapFile, dates: 'mdy', actor });
  assert.equal(mapped.activity_created, 1, JSON.stringify(mapped.problems));
  assert.equal((await db.query("select period_end from carbon.activity where source_ref = 'persefoni-X-1'"))[0].period_end, '2026-09-30', 'month-first dates');
  fs.writeFileSync(mapFile, JSON.stringify({ columns: { nickname: 'X' } }));
  await assert.rejects(run('import', { file: csv, mapping: mapFile, actor }), /unknown field/);
  assert.throws(() => parseCsv('a,b\n1'), /expected 2 fields/);

  const ex = await run('export', { out: path.join(tmp, 'export.json') });
  assert(ex.tables.activity > 0 && ex.tables.inventory_lines > 0);

  // Reports and the review.
  assert((await run('hotspots', { inventory: 'FY2026', limit: '5' })).length === 5);
  assert((await run('by-site', { inventory: 'FY2026' })).some((s) => s.site === '(suppliers)'));
  const weekly = await run('weekly-review');
  for (const k of ['attention', 'data gaps', 'customer requests', 'year so far', 'target progress', 'compliance']) assert(Array.isArray(weekly[k]), `weekly ${k}`);
  assert.equal((await run('help')).length, Object.keys(specs).length);
  assert((await run('history')).length > 0);
  assert.match(render('footprint', await run('footprint', { inventory: 'FY2026' })), /Total/);
  assert.match(render('import', dry), /DRY RUN/);

  // Parsing and validation.
  assert.throws(() => parse(['nope']), /Unknown command/);
  assert.throws(() => parse(['sites', '--name=x']), /Unknown --name/);
  assert.throws(() => parse(['import', 'envizi']), /import persefoni/);
  await assert.rejects(run('log', { source: 'Plant electricity', from: '2026-02-30', to: '2026-03-01', quantity: '1', actor }), /Invalid date/);
  await assert.rejects(run('log', { source: 'Plant electricity', month: '2026-10', quantity: 'lots', actor }), /Invalid quantity/);

  // The CLI itself: JSON, human tables, exit code on ambiguity.
  const j = cli(['sources', '--json']);
  assert.equal(j.status, 0, j.stderr);
  assert(JSON.parse(j.stdout).length >= 14);
  const amb = cli(['log', '--source=waste', '--month=2026-10', '--quantity=1']);
  assert.equal(amb.status, 1);
  assert.match(amb.stderr, /More than one source/);

  // Views and documents render.
  for (const [script, out] of [['view.mjs', 'views'], ['docs.mjs', 'docs-out']]) {
    const r = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', script)], { cwd: REPO_ROOT, env: { ...env, OUTPUT_DIR: tmp }, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, new RegExp(out));
  }

  const missing = Object.keys(specs).filter((c) => !exercised.has(c));
  assert.deepEqual(missing, [], `every command is exercised: missing ${missing.join(', ')}`);
  console.log(`PASS: ${exercised.size} commands exercised on ${db.mode}`);
} finally {
  if (db) await db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
