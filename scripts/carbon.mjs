#!/usr/bin/env node
// The one CLI. Every slash command in .claude/commands drives this file.
//   npm run carbon -- <command> [--flags] [--json]
// Human tables by default, --json for machines. Names match case-insensitively, by id
// prefix, or by a unique part of the name; an ambiguous match lists the candidates and exits 1.
// Emissions are never typed in: every tonne is a recorded quantity times a published factor.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { table, heading } from './lib/format.mjs';

// ---------------------------------------------------------------- reads

export const reads = {
  entities: `select name as entity, country, revenue_cents, gross_assets_cents, employees, fy_end_month, nger_registered, nz_climate_reporting_entity,
    case country when 'AU' then 'AUD' else 'NZD' end as currency from carbon.entities order by country, name`,
  sites: `select st.id, st.name as site, e.name as entity, st.region, st.kind, st.data_owner, st.opened_on, st.closed_on,
    (select count(*) from carbon.sources s where s.site_id = st.id and s.active)::int as sources
    from carbon.sites st join carbon.entities e on e.id = st.entity_id order by st.name`,
  sources: `select s.id, s.name as source, st.name as site, s.category, c.scope, c.scope3_category, c.unit, s.supplier, s.account_ref, s.frequency, s.data_owner, s.active,
    (select max(a.period_end) from carbon.activity a where a.source_id = s.id) as data_to
    from carbon.sources s join carbon.sites st on st.id = s.site_id join carbon.categories c on c.key = s.category order by st.name, c.scope, s.name`,
  categories: `select key as category, label, scope, scope3_category, unit from carbon.categories order by scope, scope3_category nulls first, key`,
  factors: `select f.category, f.region, f.valid_year, f.kg_co2e_per_unit, c.unit, f.edition, f.table_ref, f.checked_on, f.source_url
    from carbon.factors f join carbon.categories c on c.key = f.category order by f.category, f.region, f.valid_year nulls first`,
  activity: `select activity_id as id, source, site, period_start, period_end, quantity, unit, tco2e, estimated, evidence
    from carbon.activity_emissions order by period_start desc, source limit 60`,
  inventories: `select inventory, status, starts_on, ends_on, is_base_year as base_year, scope1_t, scope2_t, scope3_t, total_t
    from carbon.inventory_totals order by starts_on`,
  suppliers: `select sr.id, sr.supplier, i.name as inventory, sr.spend_cents, sr.currency, sr.requested_on, sr.due_on, sr.received_on, sr.allocated_tco2e as tco2e, sr.basis
    from carbon.supplier_requests sr join carbon.inventories i on i.id = sr.inventory_id order by i.starts_on desc, sr.supplier`,
  'customer-requests': `select cr.id, cr.customer, i.name as inventory, cr.asked_for, cr.received_on, cr.due_on,
    case when cr.answered_on is null then (cr.due_on - current_date) end as days_left, cr.answered_on
    from carbon.customer_requests cr left join carbon.inventories i on i.id = cr.inventory_id order by (cr.answered_on is null) desc, cr.due_on nulls last`,
  actions: `select a.id, a.name as action, st.name as site, a.owner, a.status, a.saving_tco2e_per_year as saving_t_per_year, a.cost_cents, a.due_on, a.notes,
    'NZD' as currency
    from carbon.actions a left join carbon.sites st on st.id = a.site_id
    order by case a.status when 'underway' then 0 when 'approved' then 1 when 'idea' then 2 when 'done' then 3 else 4 end, a.due_on nulls last`,
  'data-gaps': `select inventory, site, source, month, days_since_month_end, data_owner from carbon.data_gaps order by source, month`,
  estimates: `select ia.inventory, ia.source, ia.period_start, ia.period_end, ia.quantity, ia.unit, round(ia.tco2e * ia.share, 4) as tco2e, ia.estimate_method
    from carbon.inventory_activity ia join carbon.inventories i on i.id = ia.inventory_id where ia.estimated and i.status = 'open' order by ia.period_start`,
  obligations: `select entity, country, rule, applies, detail from carbon.obligations order by country, rule`,
  nger: `select site, au_fy, scope12_t, round(100 * scope12_t / 25000, 2) as pct_of_facility_threshold from carbon.nger_years order by au_fy, site`,
  compliance: `select severity, rule, inventory, item, finding from carbon.compliance_findings
    order by case severity when 'breached' then 0 when 'due' then 1 else 2 end, rule, item`,
  targets: `select t.name as target, t.scopes, b.name as base_year, t.target_year_end, t.reduction_pct from carbon.targets t join carbon.inventories b on b.id = t.base_inventory_id order by t.name`,
  history: `select created_at, actor, action, detail from carbon.activity_log order by id desc limit 50`,
};

const today = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------- argument parsing

export const specs = {
  ...Object.fromEntries(Object.keys(reads).map((k) => [k, []])),
  help: [],
  footprint: ['inventory'],
  hotspots: ['inventory', 'limit'],
  'by-site': ['inventory'],
  trend: [],
  'target-progress': [],
  attention: [],
  'weekly-review': [],
  'lock-check': ['inventory'],
  'add-site': ['name', 'entity', 'region', 'kind', 'owner', 'opened', 'actor'],
  'add-source': ['name', 'site', 'category', 'supplier', 'account', 'frequency', 'owner', 'actor'],
  log: ['source', 'month', 'from', 'to', 'quantity', 'evidence', 'estimated', 'method', 'actor'],
  'void-activity': ['activity', 'reason', 'actor'],
  'add-factor': ['category', 'region', 'year', 'value', 'edition', 'table', 'url', 'checked', 'actor'],
  'open-inventory': ['name', 'start', 'end', 'actor'],
  'set-inventory': ['inventory', 'revenue', 'output', 'output-label', 'actor'],
  'lock-inventory': ['inventory', 'override', 'date', 'note', 'actor'],
  'request-supplier': ['supplier', 'inventory', 'spend', 'contact', 'due', 'date', 'actor'],
  'record-supplier': ['supplier', 'inventory', 'tco2e', 'basis', 'date', 'actor'],
  'add-customer-request': ['customer', 'inventory', 'asked', 'due', 'notes', 'date', 'actor'],
  'answer-customer-request': ['request', 'date', 'actor'],
  'draft-customer-response': ['request'],
  'draft-supplier-request': ['supplier', 'inventory'],
  'add-action': ['name', 'site', 'owner', 'status', 'saving', 'cost', 'due', 'notes', 'actor'],
  'update-action': ['action', 'status', 'due', 'saving', 'notes', 'actor'],
  'set-target': ['name', 'scopes', 'base', 'year-end', 'pct', 'actor'],
  import: ['file', 'mapping', 'dates', 'dry-run', 'actor'],
  export: ['out'],
};

const FLAGS = new Set(['json', 'dry-run', 'help', 'estimated']);

export function parse(args) {
  const pos = [];
  const o = {};
  for (let i = 0; i < args.length; i++) {
    const x = args[i];
    if (!x.startsWith('--')) { pos.push(x); continue; }
    const at = x.indexOf('=');
    const k = x.slice(2, at < 0 ? undefined : at);
    let v = at < 0 ? true : x.slice(at + 1);
    if (at < 0 && !FLAGS.has(k) && args[i + 1] !== undefined && !args[i + 1].startsWith('--')) v = args[++i];
    if (k in o) throw Error(`Repeated --${k}`);
    o[k] = v;
  }
  let cmd = pos[0] || 'help';
  if (o.help) { cmd = 'help'; delete o.help; }
  if (!specs[cmd]) throw Error(`Unknown command "${cmd}". Run help for the list.`);
  if (cmd === 'import') {
    if (pos[1] !== 'persefoni') throw Error('Use: import persefoni --file=<ledger export csv> [--mapping=<json>] [--dates=dmy|mdy] [--dry-run]');
  } else if (pos.length > 1) throw Error(`Unexpected argument "${pos[1]}"`);
  for (const k of Object.keys(o)) {
    if (k !== 'json' && !specs[cmd].includes(k)) throw Error(`Unknown --${k} for ${cmd}`);
    if (FLAGS.has(k) && o[k] !== true) throw Error(`--${k} takes no value`);
  }
  return { cmd, o };
}

// ---------------------------------------------------------------- validation

const req = (o, k) => {
  if (typeof o[k] !== 'string' || !o[k].trim()) throw Error(`--${k} is required`);
  return o[k].trim();
};
const opt = (o, k) => (typeof o[k] === 'string' && o[k].trim() ? o[k].trim() : null);

export function date(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v) throw Error(`Invalid date "${v}" (use YYYY-MM-DD)`);
  return v;
}
export function cents(v) {
  const s = String(v).replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw Error(`Invalid amount "${v}"`);
  const n = Math.round(Number(s) * 100);
  if (!Number.isSafeInteger(n)) throw Error('Amount is too large');
  return n;
}
export function qty(v, what = 'quantity') {
  const s = String(v).replace(/[,\s]/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) throw Error(`Invalid ${what} "${v}"`);
  return s;
}
const choice = (v, allowed, what) => {
  if (!allowed.includes(v)) throw Error(`${what} must be one of ${allowed.join(', ')}`);
  return v;
};
const lastDay = (ym) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).toISOString().slice(0, 10);

// ---------------------------------------------------------------- lookups

const KINDS = {
  entities: 'carbon.entities', sites: 'carbon.sites', sources: 'carbon.sources', inventories: 'carbon.inventories',
  'supplier requests': 'carbon.supplier_requests', 'customer requests': 'carbon.customer_requests', actions: 'carbon.actions',
};

export async function resolve(db, kind, value) {
  const t = KINDS[kind];
  if (!t) throw Error(`Unknown record kind ${kind}`);
  const v = String(value).trim();
  let rows = await db.query(`select id, name from ${t} where lower(name) = lower($1) or ($2::text is not null and id::text like $2) order by name`,
    [v, /^[0-9a-f-]{4,36}$/i.test(v) ? `${v.toLowerCase()}%` : null]);
  if (!rows.length) rows = await db.query(`select id, name from ${t} where name ilike $1 order by name`, [`%${v.replace(/[%_]/g, '')}%`]);
  if (rows.length !== 1) {
    const list = rows.map((r) => `\n  ${String(r.id).slice(0, 8)}  ${r.name}`).join('');
    const e = Error(`${rows.length ? 'More than one' : 'No'} ${kind.replace(/s$/, '')} matches "${v}"${list}`);
    e.ambiguous = true;
    throw e;
  }
  return rows[0];
}

// An inventory by name, or by default the open one holding today, else the latest open one.
export async function inventory(db, v) {
  if (v) {
    const r = await resolve(db, 'inventories', v);
    return (await db.query('select * from carbon.inventories where id = $1', [r.id]))[0];
  }
  const rows = await db.query(`select * from carbon.inventories where status = 'open'
    order by (current_date between starts_on and ends_on) desc, starts_on desc limit 1`);
  if (!rows.length) throw Error('No open inventory. Open one with open-inventory --name=FY2028 --start=... --end=...');
  return rows[0];
}

async function supplierRequest(db, o) {
  const inv = await inventory(db, opt(o, 'inventory'));
  const name = req(o, 'supplier');
  const rows = await db.query('select * from carbon.supplier_requests where inventory_id = $1 and supplier ilike $2 order by supplier', [inv.id, `%${name.replace(/[%_]/g, '')}%`]);
  const exact = rows.filter((r) => r.supplier.toLowerCase() === name.toLowerCase());
  const hit = exact.length === 1 ? exact : rows;
  if (hit.length > 1) {
    const e = Error(`More than one supplier matches "${name}" in ${inv.name}${hit.map((r) => `\n  ${String(r.id).slice(0, 8)}  ${r.supplier}`).join('')}`);
    e.ambiguous = true;
    throw e;
  }
  return { inv, row: hit[0] || null, name };
}

const log = (db, actor, action, detail) => db.query('insert into carbon.activity_log (actor, action, detail) values ($1, $2, $3)', [actor, action, detail]);
const who = (o) => opt(o, 'actor') || 'operator';

async function tx(db, fn) {
  await db.exec('BEGIN');
  try {
    const r = await fn();
    await db.exec('COMMIT');
    return r;
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
}

function writeDraft(name, body) {
  const dir = path.join(process.env.OUTPUT_DIR || REPO_ROOT, 'drafts');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${today()}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}.md`);
  fs.writeFileSync(file, body);
  return file;
}

const t1 = (v) => (v === null || v === undefined ? '' : Number(v).toLocaleString('en-NZ', { maximumFractionDigits: 1, minimumFractionDigits: 1 }));

// ---------------------------------------------------------------- the reports

async function footprint(db, o) {
  const inv = await inventory(db, opt(o, 'inventory'));
  const totals = (await db.query('select * from carbon.inventory_totals where inventory_id = $1', [inv.id]))[0];
  const lines = await db.query(`select case scope when 3 then 'Scope 3.' || scope3_category else 'Scope ' || scope end as scope, category,
      round(sum(tco2e), 2) as tco2e, round(100 * sum(tco2e) / nullif(sum(sum(tco2e)) over (), 0), 1) as share_pct,
      round(100 * sum(tco2e * estimated_share) / nullif(sum(tco2e), 0), 1) as estimated_pct
    from carbon.inventory_sources where inventory_id = $1 group by scope, scope3_category, category order by scope, scope3_category nulls first, tco2e desc`, [inv.id]);
  const intensity = totals.revenue_cents ? Number(totals.total_t) / (Number(totals.revenue_cents) / 1e8) : null;
  return { inventory: inv.name, status: inv.status, from: inv.starts_on, to: inv.ends_on, scope1_t: totals.scope1_t, scope2_t: totals.scope2_t,
    scope3_t: totals.scope3_t, total_t: totals.total_t, t_per_million_revenue: intensity === null ? null : Math.round(intensity * 10) / 10,
    t_per_output_unit: totals.output_units ? Math.round(10000 * Number(totals.total_t) / Number(totals.output_units)) / 10000 : null,
    output_unit: totals.output_unit_label, lines };
}

async function hotspots(db, o) {
  const inv = await inventory(db, opt(o, 'inventory'));
  const limit = Math.min(50, Math.max(1, Number(opt(o, 'limit') || 10)));
  return db.query(`select source, site, case scope when 3 then '3.' || scope3_category else scope::text end as scope, round(tco2e, 2) as tco2e,
      round(100 * tco2e / nullif(sum(tco2e) over (), 0), 1) as share_pct,
      round(100 * sum(tco2e) over (order by tco2e desc, source) / nullif(sum(tco2e) over (), 0), 1) as cumulative_pct
    from carbon.inventory_sources where inventory_id = $1 order by tco2e desc, source limit $2`, [inv.id, limit]);
}

async function bySite(db, o) {
  const inv = await inventory(db, opt(o, 'inventory'));
  return db.query(`select coalesce(site, '(suppliers)') as site, round(sum(tco2e) filter (where scope = 1), 2) as scope1_t,
      round(sum(tco2e) filter (where scope = 2), 2) as scope2_t, round(sum(tco2e) filter (where scope = 3), 2) as scope3_t, round(sum(tco2e), 2) as total_t
    from carbon.inventory_sources where inventory_id = $1 group by site order by total_t desc`, [inv.id]);
}

async function trend(db) {
  return db.query(`select t.inventory, t.status,
      case when t.months_elapsed < t.months_total then t.months_elapsed || ' of ' || t.months_total || ' months' else 'full year' end as covers,
      t.scope12_t, t.scope3_t, t.total_t,
      round(t.scope12_t * t.months_total / nullif(t.months_elapsed, 0), 2) as scope12_full_year_t,
      round(100 * (t.scope12_t * t.months_total / nullif(t.months_elapsed, 0) - b.scope12_t) / nullif(b.scope12_t, 0), 1) as scope12_vs_base_pct,
      round(t.total_t / nullif(t.revenue_cents / 1e8, 0), 1) as t_per_million_revenue,
      round(t.total_t / nullif(t.output_units, 0), 4) as t_per_output_unit,
      round(100 * (select sum(tco2e * estimated_share) from carbon.inventory_sources s where s.inventory_id = t.inventory_id) / nullif(t.total_t, 0), 1) as estimated_pct
    from carbon.inventory_totals t left join carbon.inventory_totals b on b.is_base_year order by t.starts_on`);
}

// Straight line from the base year to the target year: where each year should be, against where it is.
// An open year is compared on its run rate: what it has so far, scaled to twelve months.
async function targetProgress(db) {
  return db.query(`select tg.name as target, t.inventory,
      case when t.months_elapsed < t.months_total then t.months_elapsed || ' of ' || t.months_total || ' months' else 'full year' end as covers,
      round(a.actual * t.months_total / nullif(t.months_elapsed, 0), 2) as full_year_t,
      round(bt * (1 - tg.reduction_pct / 100 * least(1, greatest(0, (t.ends_on - b.ends_on)::numeric / nullif(tg.target_year_end - b.ends_on, 0)))), 2) as on_track_t,
      round(100 * (1 - (a.actual * t.months_total / nullif(t.months_elapsed, 0)) / nullif(bt, 0)), 1) as reduced_pct,
      tg.reduction_pct as target_pct, tg.target_year_end
    from carbon.targets tg
    join carbon.inventories b on b.id = tg.base_inventory_id
    join carbon.inventory_totals bb on bb.inventory_id = b.id
    cross join lateral (select case tg.scopes when '1+2' then bb.scope12_t when '3' then bb.scope3_t else bb.total_t end as bt) x
    join carbon.inventory_totals t on t.starts_on >= b.starts_on
    cross join lateral (select case tg.scopes when '1+2' then t.scope12_t when '3' then t.scope3_t else t.total_t end as actual) a
    order by tg.name, t.starts_on`);
}

// What stops an inventory locking: missing months, missing factors, suppliers yet to reply.
async function lockIssues(db, inv) {
  return db.query(`
    select 'Missing data' as issue, s.name as item, to_char(m, 'YYYY-MM') as detail
    from carbon.sources s join carbon.sites st on st.id = s.site_id
    cross join lateral generate_series(date_trunc('month', $2::date), date_trunc('month', least($3::date, current_date)) - case when $3::date < current_date then interval '0 month' else interval '1 month' end, interval '1 month') m
    where s.active and (st.opened_on is null or st.opened_on <= (m + interval '1 month' - interval '1 day')::date)
      and (st.closed_on is null or st.closed_on >= m::date)
      and not exists (select 1 from carbon.activity a where a.source_id = s.id and a.period_start <= (m + interval '1 month' - interval '1 day')::date and a.period_end >= m::date)
    union all
    select 'No factor', source, category || ' in ' || region from carbon.inventory_activity where inventory_id = $1 and kg_co2e_per_unit is null group by source, category, region
    union all
    select 'Supplier has not replied', supplier, coalesce('due ' || due_on, 'not yet asked') from carbon.supplier_requests where inventory_id = $1 and received_on is null
    order by 1, 2, 3`, [inv.id, inv.starts_on, inv.ends_on]);
}

async function lockCheck(db, o) {
  const inv = await inventory(db, opt(o, 'inventory'));
  if (inv.status === 'locked') return [];
  const issues = await lockIssues(db, inv);
  if (inv.ends_on >= today()) issues.unshift({ issue: 'Year not finished', item: inv.name, detail: `ends ${inv.ends_on}` });
  return issues;
}

async function attention(db) {
  return db.query('select what, item, detail from carbon.attention order by sort_on, what, item');
}

async function weeklyReview(db) {
  const inv = await inventory(db, null).catch(() => null);
  return {
    attention: await attention(db),
    'data gaps': await db.query(reads['data-gaps']),
    'customer requests': (await db.query(reads['customer-requests'])).filter((r) => !r.answered_on),
    'year so far': inv ? (await footprint(db, { inventory: inv.name })).lines : [],
    'target progress': await targetProgress(db),
    compliance: await db.query(reads.compliance),
  };
}

// ---------------------------------------------------------------- the work

async function addSite(db, o) {
  const name = req(o, 'name');
  const ent = await resolve(db, 'entities', req(o, 'entity'));
  const region = req(o, 'region').toUpperCase();
  if (!/^(NZ|AU-(NSW|VIC|QLD|SA|WA|TAS|NT|ACT))$/.test(region)) throw Error('Region must be NZ or AU-<state>, for example AU-NSW');
  const opened = opt(o, 'opened') ? date(o.opened) : null;
  return tx(db, async () => {
    const row = (await db.query(`insert into carbon.sites (name, entity_id, region, kind, data_owner, opened_on) values ($1, $2, $3, $4, $5, $6) returning id, name`,
      [name, ent.id, region, opt(o, 'kind') || 'site', opt(o, 'owner'), opened]))[0];
    await log(db, who(o), 'add-site', `${name} (${region})`);
    return row;
  });
}

async function addSource(db, o) {
  const name = req(o, 'name');
  const site = await resolve(db, 'sites', req(o, 'site'));
  const cat = req(o, 'category').toLowerCase();
  const known = (await db.query('select key from carbon.categories')).map((r) => r.key);
  choice(cat, known, 'Category');
  const freq = choice(opt(o, 'frequency') || 'monthly', ['monthly', 'quarterly', 'annual'], 'Frequency');
  return tx(db, async () => {
    const row = (await db.query(`insert into carbon.sources (name, site_id, category, supplier, account_ref, frequency, data_owner) values ($1, $2, $3, $4, $5, $6, $7) returning id, name`,
      [name, site.id, cat, opt(o, 'supplier'), opt(o, 'account'), freq, opt(o, 'owner')]))[0];
    await log(db, who(o), 'add-source', `${name} at ${site.name}: ${cat}`);
    return row;
  });
}

async function logActivity(db, o) {
  const src = await resolve(db, 'sources', req(o, 'source'));
  let from; let to;
  if (opt(o, 'month')) {
    const m = req(o, 'month');
    if (!/^\d{4}-\d{2}$/.test(m)) throw Error('--month is YYYY-MM');
    from = date(`${m}-01`); to = lastDay(m);
    if (opt(o, 'from') || opt(o, 'to')) throw Error('Use --month or --from and --to, not both');
  } else {
    from = date(req(o, 'from')); to = date(req(o, 'to'));
    if (to < from) throw Error('--to is before --from');
  }
  const quantity = qty(req(o, 'quantity'));
  const estimated = o.estimated === true;
  if (estimated && !opt(o, 'method')) throw Error('An estimate needs --method: how it was worked out');
  const overlap = await db.query('select id, period_start, period_end from carbon.activity where source_id = $1 and period_start <= $3 and period_end >= $2', [src.id, from, to]);
  if (overlap.length) throw Error(`${src.name} already has activity for ${overlap[0].period_start} to ${overlap[0].period_end} (${String(overlap[0].id).slice(0, 8)}). Void it first to replace it.`);
  return tx(db, async () => {
    const row = (await db.query(`insert into carbon.activity (source_id, period_start, period_end, quantity, evidence, estimated, estimate_method, entered_by)
      values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`, [src.id, from, to, quantity, opt(o, 'evidence'), estimated, opt(o, 'method'), who(o)]))[0];
    await log(db, who(o), 'log', `${src.name} ${from} to ${to}: ${quantity}${estimated ? ' (estimate)' : ''}`);
    return (await db.query('select activity_id as id, source, period_start, period_end, quantity, unit, kg_co2e_per_unit, factor_edition, factor_year, tco2e, estimated from carbon.activity_emissions where activity_id = $1', [row.id]))[0];
  });
}

async function voidActivity(db, o) {
  const v = req(o, 'activity').toLowerCase();
  const reason = req(o, 'reason');
  const rows = await db.query('select a.id, s.name, a.period_start, a.period_end, a.quantity from carbon.activity a join carbon.sources s on s.id = a.source_id where a.id::text like $1', [`${v}%`]);
  if (rows.length !== 1) throw Object.assign(Error(`${rows.length ? 'More than one' : 'No'} activity row matches "${v}"`), { ambiguous: true });
  const r = rows[0];
  return tx(db, async () => {
    await db.query('delete from carbon.activity where id = $1', [r.id]);
    await log(db, who(o), 'void-activity', `${r.name} ${r.period_start} to ${r.period_end}, ${r.quantity}: ${reason}`);
    return { voided: String(r.id).slice(0, 8), source: r.name, from: r.period_start, to: r.period_end, quantity: r.quantity, reason };
  });
}

async function addFactor(db, o) {
  const cat = req(o, 'category').toLowerCase();
  choice(cat, (await db.query('select key from carbon.categories')).map((r) => r.key), 'Category');
  const region = (opt(o, 'region') || 'ANY').toUpperCase();
  const year = opt(o, 'year') ? Number(o.year) : null;
  if (year !== null && !(Number.isInteger(year) && year >= 1990 && year <= 2100)) throw Error('--year is a calendar year');
  const url = req(o, 'url');
  if (!/^https?:\/\//.test(url)) throw Error('--url must be the page the factor was published on');
  return tx(db, async () => {
    const row = (await db.query(`insert into carbon.factors (category, region, valid_year, kg_co2e_per_unit, edition, table_ref, source_url, checked_on)
      values ($1, $2, $3, $4, $5, $6, $7, $8) returning category, region, valid_year, kg_co2e_per_unit, edition`,
      [cat, region, year, qty(req(o, 'value'), 'factor'), req(o, 'edition'), opt(o, 'table'), url, opt(o, 'checked') ? date(o.checked) : today()]))[0];
    await log(db, who(o), 'add-factor', `${cat} ${region} ${year ?? ''} ${o.value} (${o.edition})`);
    return row;
  });
}

async function openInventory(db, o) {
  const name = req(o, 'name');
  const start = date(req(o, 'start'));
  const end = date(req(o, 'end'));
  if (end <= start) throw Error('--end must be after --start');
  const clash = await db.query('select name from carbon.inventories where starts_on <= $2 and ends_on >= $1', [start, end]);
  if (clash.length) throw Error(`Overlaps inventory ${clash[0].name}`);
  return tx(db, async () => {
    const row = (await db.query('insert into carbon.inventories (name, starts_on, ends_on) values ($1, $2, $3) returning id, name, starts_on, ends_on', [name, start, end]))[0];
    await log(db, who(o), 'open-inventory', `${name} ${start} to ${end}`);
    return row;
  });
}

async function setInventory(db, o) {
  const inv = await inventory(db, req(o, 'inventory'));
  const revenue = opt(o, 'revenue') ? cents(o.revenue) : inv.revenue_cents;
  const output = opt(o, 'output') ? qty(o.output, 'output') : inv.output_units;
  return tx(db, async () => {
    await db.query('update carbon.inventories set revenue_cents = $2, output_units = $3, output_unit_label = coalesce($4, output_unit_label) where id = $1',
      [inv.id, revenue, output, opt(o, 'output-label')]);
    await log(db, who(o), 'set-inventory', `${inv.name}: revenue ${revenue}, output ${output}`);
    return { inventory: inv.name, revenue_cents: revenue, output_units: output };
  });
}

async function lockInventory(db, o) {
  const inv = await inventory(db, req(o, 'inventory'));
  if (inv.status === 'locked') throw Error(`${inv.name} is already locked`);
  const on = opt(o, 'date') ? date(o.date) : today();
  if (on <= inv.ends_on) throw Error(`${inv.name} runs to ${inv.ends_on}: lock it after the year ends`);
  const issues = await lockIssues(db, inv);
  const override = opt(o, 'override');
  if (issues.length && !override) throw Error(`${issues.length} lock issue(s) in ${inv.name}; fix them or pass --override="<reason>":\n${table(issues, columns(issues))}`);
  return tx(db, async () => {
    await db.query(`insert into carbon.inventory_lines (inventory_id, source_id, site, source, category, scope, scope3_category, quantity, unit, kg_co2e_per_unit, factor_edition, factor_year, tco2e, estimated_share)
      select $1, source_id, site, source, category, scope, scope3_category, round(sum(quantity * share), 3), unit,
        case when count(distinct factor_id) = 1 then max(kg_co2e_per_unit) end, string_agg(distinct factor_edition, ', '), max(factor_year),
        round(sum(tco2e * share), 4), round(coalesce(sum(case when estimated then tco2e * share end) / nullif(sum(tco2e * share), 0), 0), 4)
      from carbon.inventory_activity where inventory_id = $1 and kg_co2e_per_unit is not null
      group by source_id, site, source, category, scope, scope3_category, unit`, [inv.id]);
    await db.query(`insert into carbon.inventory_lines (inventory_id, supplier_request_id, source, category, scope, scope3_category, factor_edition, tco2e)
      select $1, id, 'Supplier: ' || supplier, 'purchased-goods', 3, 1, basis, allocated_tco2e from carbon.supplier_requests where inventory_id = $1 and allocated_tco2e is not null`, [inv.id]);
    await db.query(`update carbon.inventories set status = 'locked', locked_on = $2, locked_by = $3, lock_note = $4 where id = $1`,
      [inv.id, on, who(o), override ? `Override: ${override}` : opt(o, 'note')]);
    await log(db, who(o), 'lock-inventory', `${inv.name}${override ? ` with ${issues.length} issue(s) overridden: ${override}` : ''}`);
    const t = (await db.query('select * from carbon.inventory_totals where inventory_id = $1', [inv.id]))[0];
    return { inventory: inv.name, locked_on: on, lines: Number((await db.query('select count(*) from carbon.inventory_lines where inventory_id = $1', [inv.id]))[0].count),
      scope1_t: t.scope1_t, scope2_t: t.scope2_t, scope3_t: t.scope3_t, total_t: t.total_t, overridden: override ? issues.length : 0 };
  });
}

async function requestSupplier(db, o) {
  const { inv, row, name } = await supplierRequest(db, o);
  const asked = opt(o, 'date') ? date(o.date) : today();
  const due = opt(o, 'due') ? date(o.due) : null;
  return tx(db, async () => {
    let r;
    if (row) {
      if (row.received_on) throw Error(`${row.supplier} already replied for ${inv.name}`);
      r = (await db.query(`update carbon.supplier_requests set requested_on = $2, due_on = coalesce($3, due_on), contact = coalesce($4, contact),
        spend_cents = coalesce($5, spend_cents) where id = $1 returning supplier, requested_on, due_on`, [row.id, asked, due, opt(o, 'contact'), opt(o, 'spend') ? cents(o.spend) : null]))[0];
    } else {
      r = (await db.query(`insert into carbon.supplier_requests (name, supplier, inventory_id, spend_cents, contact, requested_on, due_on)
        values ($1, $2, $3, $4, $5, $6, $7) returning supplier, requested_on, due_on`, [`${name} ${inv.name}`, name, inv.id, opt(o, 'spend') ? cents(o.spend) : 0, opt(o, 'contact'), asked, due]))[0];
    }
    await log(db, who(o), 'request-supplier', `${r.supplier} for ${inv.name}, due ${r.due_on ?? 'open'}`);
    return { ...r, inventory: inv.name };
  });
}

async function recordSupplier(db, o) {
  const { inv, row, name } = await supplierRequest(db, o);
  if (!row) throw Error(`No request to ${name} in ${inv.name}. Run request-supplier first.`);
  if (inv.status === 'locked') throw Error(`${inv.name} is locked`);
  const t = qty(req(o, 'tco2e'), 'tCO2e');
  return tx(db, async () => {
    const r = (await db.query(`update carbon.supplier_requests set received_on = $2, allocated_tco2e = $3, basis = $4 where id = $1 returning supplier, received_on, allocated_tco2e as tco2e, basis`,
      [row.id, opt(o, 'date') ? date(o.date) : today(), t, req(o, 'basis')]))[0];
    await log(db, who(o), 'record-supplier', `${row.supplier} ${inv.name}: ${t} t`);
    return { ...r, inventory: inv.name };
  });
}

async function addCustomerRequest(db, o) {
  const customer = req(o, 'customer');
  const inv = opt(o, 'inventory') ? await inventory(db, o.inventory) : null;
  return tx(db, async () => {
    const r = (await db.query(`insert into carbon.customer_requests (name, customer, inventory_id, asked_for, received_on, due_on, notes)
      values ($1, $2, $3, $4, $5, $6, $7) returning id, customer, asked_for, due_on`,
      [`${customer} ${inv ? inv.name : today()}`, customer, inv?.id ?? null, opt(o, 'asked') || 'Scope 1 and 2', opt(o, 'date') ? date(o.date) : today(), opt(o, 'due') ? date(o.due) : null, opt(o, 'notes')]))[0];
    await log(db, who(o), 'add-customer-request', `${customer}: ${r.asked_for}`);
    return r;
  });
}

async function answerCustomerRequest(db, o) {
  const cr = await resolve(db, 'customer requests', req(o, 'request'));
  const row = (await db.query('select * from carbon.customer_requests where id = $1', [cr.id]))[0];
  if (row.answered_on) throw Error(`${row.customer} was already answered on ${row.answered_on}`);
  return tx(db, async () => {
    const r = (await db.query('update carbon.customer_requests set answered_on = $2 where id = $1 returning customer, answered_on', [cr.id, opt(o, 'date') ? date(o.date) : today()]))[0];
    await log(db, who(o), 'answer-customer-request', `${r.customer} answered ${r.answered_on}`);
    return r;
  });
}

async function draftCustomerResponse(db, o) {
  const cr = await resolve(db, 'customer requests', req(o, 'request'));
  const row = (await db.query('select * from carbon.customer_requests where id = $1', [cr.id]))[0];
  if (!row.inventory_id) throw Error(`${row.customer}'s request names no reporting year. Set one with /customise or add the request again with --inventory.`);
  const inv = (await db.query('select * from carbon.inventories where id = $1', [row.inventory_id]))[0];
  const fp = await footprint(db, { inventory: inv.name });
  const factors = await db.query(`select distinct factor_edition from carbon.inventory_sources where inventory_id = $1 and factor_edition is not null order by 1`, [inv.id]);
  const biz = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'brand.json'), 'utf8')).business_name || 'our business';
  const body = [
    `# Emissions for ${row.customer}: ${inv.name}`,
    '',
    `Draft. Nothing has been sent. Check the figures, then send it from your own email or upload it to ${row.customer}'s supplier portal.`,
    '',
    `To: ${row.customer}`,
    `Asked for: ${row.asked_for}`,
    row.due_on ? `Due: ${row.due_on}` : '',
    '',
    `Hello,`,
    '',
    `Here are ${biz}'s greenhouse gas emissions for ${inv.name} (${inv.starts_on} to ${inv.ends_on}), measured under the GHG Protocol Corporate Standard on an operational control basis.${inv.status === 'locked' ? ' The year is closed and these figures will not change.' : ' The year is still open, so these figures are provisional.'}`,
    '',
    '| | tCO2e |',
    '|---|---:|',
    `| Scope 1 (fuel we burn) | ${t1(fp.scope1_t)} |`,
    `| Scope 2 (electricity, location-based) | ${t1(fp.scope2_t)} |`,
    `| Scope 3 (freight, travel, waste, purchased goods) | ${t1(fp.scope3_t)} |`,
    `| Total | ${t1(fp.total_t)} |`,
    '',
    fp.t_per_output_unit !== null ? `Emissions per ${fp.output_unit || 'unit'}: ${fp.t_per_output_unit} tCO2e (all scopes).` : '',
    '',
    '## By category',
    '',
    '| Scope | Category | tCO2e | Share |',
    '|---|---|---:|---:|',
    ...fp.lines.map((l) => `| ${l.scope} | ${l.category} | ${t1(l.tco2e)} | ${l.share_pct}% |`),
    '',
    `Emission factors: ${factors.map((f) => f.factor_edition).join('; ') || 'none recorded'}.`,
    `Estimated data: ${t1(fp.lines.reduce((s, l) => s + Number(l.tco2e) * Number(l.estimated_pct || 0) / 100, 0))} tCO2e of the total.`,
    '',
    'Happy to walk through the method or the source data.',
    '',
  ].filter((l) => l !== null).join('\n');
  return { file: writeDraft(`emissions-for-${row.customer}-${inv.name}`, body), customer: row.customer, inventory: inv.name, total_t: fp.total_t };
}

async function draftSupplierRequest(db, o) {
  const { inv, row, name } = await supplierRequest(db, o);
  if (!row) throw Error(`No request to ${name} in ${inv.name}. Run request-supplier first.`);
  const biz = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'brand.json'), 'utf8')).business_name || 'our business';
  const body = [
    `# Emissions request to ${row.supplier}: ${inv.name}`,
    '',
    'Draft. Nothing has been sent. A person sends this from their own email.',
    '',
    `To: ${row.contact || row.supplier}`,
    `Subject: Your emissions for what you supplied us, ${inv.starts_on} to ${inv.ends_on}`,
    '',
    'Hello,',
    '',
    `${biz} is measuring its ${inv.name} greenhouse gas emissions, and what we buy from you is part of our scope 3 (purchased goods).`,
    '',
    'Could you send us:',
    '',
    `1. Your emissions for the goods you supplied us between ${inv.starts_on} and ${inv.ends_on}, in tonnes CO2e.`,
    '2. How you allocated them to us (by tonnes, units or dollars sold).',
    '3. Whether your own inventory is verified, and by whom.',
    '',
    row.due_on ? `We need it by ${row.due_on}.` : 'A reply within four weeks would be a great help.',
    '',
    'If you do not measure your emissions yet, tell us and we will use an average for your industry in the meantime.',
    '',
    'Thank you.',
    '',
  ].join('\n');
  return { file: writeDraft(`supplier-request-${row.supplier}-${inv.name}`, body), supplier: row.supplier, inventory: inv.name };
}

async function addAction(db, o) {
  const name = req(o, 'name');
  const site = opt(o, 'site') ? await resolve(db, 'sites', o.site) : null;
  const status = choice(opt(o, 'status') || 'idea', ['idea', 'approved', 'underway', 'done', 'dropped'], 'Status');
  return tx(db, async () => {
    const r = (await db.query(`insert into carbon.actions (name, site_id, owner, status, saving_tco2e_per_year, cost_cents, due_on, notes)
      values ($1, $2, $3, $4, $5, $6, $7, $8) returning id, name, status`,
      [name, site?.id ?? null, opt(o, 'owner'), status, opt(o, 'saving') ? qty(o.saving, 'saving') : null, opt(o, 'cost') ? cents(o.cost) : null, opt(o, 'due') ? date(o.due) : null, opt(o, 'notes')]))[0];
    await log(db, who(o), 'add-action', `${name} (${status})`);
    return r;
  });
}

async function updateAction(db, o) {
  const a = await resolve(db, 'actions', req(o, 'action'));
  const status = opt(o, 'status') ? choice(o.status, ['idea', 'approved', 'underway', 'done', 'dropped'], 'Status') : null;
  return tx(db, async () => {
    const r = (await db.query(`update carbon.actions set status = coalesce($2, status), due_on = coalesce($3, due_on),
      saving_tco2e_per_year = coalesce($4, saving_tco2e_per_year), notes = coalesce($5, notes) where id = $1 returning name, status, due_on, saving_tco2e_per_year`,
      [a.id, status, opt(o, 'due') ? date(o.due) : null, opt(o, 'saving') ? qty(o.saving, 'saving') : null, opt(o, 'notes')]))[0];
    await log(db, who(o), 'update-action', `${r.name}: ${r.status}`);
    return r;
  });
}

async function setTarget(db, o) {
  const base = await inventory(db, req(o, 'base'));
  const pct = Number(req(o, 'pct'));
  if (!(pct > 0 && pct <= 100)) throw Error('--pct is between 0 and 100');
  const scopes = choice(opt(o, 'scopes') || '1+2', ['1+2', '1+2+3', '3'], 'Scopes');
  const end = date(req(o, 'year-end'));
  if (end <= base.ends_on) throw Error('The target year ends before the base year');
  return tx(db, async () => {
    const r = (await db.query(`insert into carbon.targets (name, scopes, base_inventory_id, target_year_end, reduction_pct) values ($1, $2, $3, $4, $5)
      on conflict (lower(name)) do update set scopes = excluded.scopes, base_inventory_id = excluded.base_inventory_id, target_year_end = excluded.target_year_end, reduction_pct = excluded.reduction_pct
      returning name, scopes, target_year_end, reduction_pct`, [req(o, 'name'), scopes, base.id, end, pct]))[0];
    await db.query('update carbon.inventories set is_base_year = false where is_base_year and id <> $1', [base.id]);
    await db.query('update carbon.inventories set is_base_year = true where id = $1', [base.id]);
    await log(db, who(o), 'set-target', `${r.name}: ${scopes} down ${pct}% from ${base.name} by ${end}`);
    return { ...r, base_year: base.name };
  });
}

// ---------------------------------------------------------------- import persefoni

// Persefoni's Footprint Ledger export. Column names differ between accounts and report
// templates, so each field reads the first heading it recognises; --mapping overrides.
const COLUMNS = {
  record_id: ['Record ID', 'Ledger ID', 'Activity ID', 'ID'],
  facility: ['Facility', 'Facility Name', 'Site', 'Location'],
  activity: ['Activity Name', 'Activity', 'Description', 'Name'],
  category: ['Activity Type', 'Subcategory', 'Sub Category', 'Category', 'Emission Source'],
  start: ['Start Date', 'Period Start', 'Activity Start Date', 'From'],
  end: ['End Date', 'Period End', 'Activity End Date', 'To'],
  quantity: ['Quantity', 'Activity Amount', 'Amount', 'Usage', 'Consumption'],
  unit: ['Unit', 'Units', 'Activity Unit', 'Unit of Measure'],
  emissions: ['Emissions (tCO2e)', 'Total Emissions (tCO2e)', 'tCO2e', 'CO2e (t)'],
  country: ['Country', 'Facility Country'],
  state: ['State', 'Region', 'State/Province'],
};

// First matching rule wins. Order matters: "food waste composted" before "food waste".
const CATEGORY_RULES = [
  [/electric/i, 'electricity'],
  [/natural gas|pipeline gas/i, 'natural-gas'],
  [/diesel.*(vehicle|fleet|truck|transport|mobile)|(vehicle|fleet|truck|transport|mobile).*diesel/i, 'diesel-transport'],
  [/diesel/i, 'diesel-stationary'],
  [/petrol|gasoline/i, 'petrol'],
  [/lpg|propane/i, 'lpg-stationary'],
  [/ship|vessel|sea freight|container/i, 'coastal-shipping'],
  [/(road|truck).*freight|freight.*(road|truck)|trucking/i, 'road-freight'],
  [/(flight|air travel).*domestic|domestic.*(flight|air)/i, 'air-domestic'],
  [/(flight|air travel).*long|long.haul/i, 'air-international-long'],
  [/flight|air travel/i, 'air-international-short'],
  [/hotel.*(austral|\bau\b)/i, 'hotel-au'],
  [/hotel|accommodation/i, 'hotel-nz'],
  [/compost/i, 'composting'],
  [/food waste|organic waste/i, 'waste-food-landfill'],
  [/waste|landfill/i, 'waste-general-landfill'],
];

// Units the export may use, converted to the unit each category is kept in.
const UNITS = {
  kWh: { kwh: 1, mwh: 1000, gwh: 1e6 },
  litre: { l: 1, litre: 1, litres: 1, liter: 1, liters: 1, kl: 1000 },
  kg: { kg: 1, t: 1000, tonne: 1000, tonnes: 1000, metric_ton: 1000 },
  tkm: { tkm: 1, 'tonne-km': 1, 'tonne km': 1, 'tonne-kilometre': 1, 'tonne-kilometer': 1 },
  pkm: { pkm: 1, 'passenger-km': 1, 'passenger km': 1, 'passenger-kilometre': 1, 'passenger-kilometer': 1 },
  'room-night': { 'room-night': 1, 'room night': 1, 'room nights': 1, nights: 1, night: 1 },
};

function importDate(v, order) {
  const s = String(v || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return date(s.slice(0, 10));
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) throw Error(`Unreadable date "${s}"`);
  const [d, mo] = order === 'mdy' ? [m[2], m[1]] : [m[1], m[2]];
  return date(`${m[3]}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`);
}

async function importPersefoni(db, o) {
  const file = req(o, 'file');
  const rows = parseCsv(fs.readFileSync(path.resolve(file), 'utf8'));
  const order = choice(opt(o, 'dates') || 'dmy', ['dmy', 'mdy'], 'Dates');
  const mapping = opt(o, 'mapping') ? JSON.parse(fs.readFileSync(path.resolve(o.mapping), 'utf8')) : {};
  for (const k of Object.keys(mapping.columns || {})) if (!COLUMNS[k]) throw Error(`Mapping names an unknown field "${k}". Fields: ${Object.keys(COLUMNS).join(', ')}`);
  const get = (r, field) => (mapping.columns?.[field] ? pick(r, mapping.columns[field]) : pick(r, ...COLUMNS[field]));
  const categoryOf = (text) => {
    for (const [k, v] of Object.entries(mapping.categories || {})) if (k.toLowerCase() === String(text).trim().toLowerCase()) return v;
    return CATEGORY_RULES.find(([re]) => re.test(text))?.[1] || null;
  };
  const cats = Object.fromEntries((await db.query('select key, unit from carbon.categories')).map((r) => [r.key, r.unit]));
  const actor = who(o);
  const dry = o['dry-run'] === true;
  const report = { dry_run: dry, rows: rows.length, sites_created: [], sources_created: [], activity_created: 0, skipped_existing: 0, problems: [], reconcile: [] };
  await db.exec('BEGIN');
  try {
    for (const [i, r] of rows.entries()) {
      const line = i + 2;
      try {
        const id = get(r, 'record_id');
        const ref = id ? `persefoni-${id}` : null;
        if (ref && (await db.query('select 1 from carbon.activity where source_ref = $1', [ref])).length) { report.skipped_existing++; continue; }
        const catText = `${get(r, 'category')} ${get(r, 'activity')}`.trim();
        const cat = categoryOf(get(r, 'category')) || categoryOf(catText);
        if (!cat || !cats[cat]) throw Error(`no category for "${catText}" (add it to the mapping file's "categories")`);
        const unitText = String(get(r, 'unit')).trim().toLowerCase();
        const mult = UNITS[cats[cat]]?.[unitText] ?? (unitText === cats[cat].toLowerCase() ? 1 : null);
        if (mult === null || mult === undefined) throw Error(`unit "${get(r, 'unit')}" does not convert to ${cats[cat]} for ${cat}`);
        const quantity = Number(qty(get(r, 'quantity'))) * mult;
        const from = importDate(get(r, 'start'), order);
        const to = importDate(get(r, 'end') || get(r, 'start'), order);
        if (to < from) throw Error(`end ${to} is before start ${from}`);
        const locked = await db.query(`select name from carbon.inventories where status = 'locked' and starts_on <= $2 and ends_on >= $1`, [from, to]);
        if (locked.length) throw Error(`falls in locked inventory ${locked[0].name}`);
        const facility = get(r, 'facility') || 'Imported site';
        let site = (await db.query('select id, name from carbon.sites where lower(name) = lower($1)', [facility]))[0];
        if (!site) {
          const country = /austral|^au$/i.test(get(r, 'country')) ? 'AU' : /zealand|^nz$/i.test(get(r, 'country')) ? 'NZ' : null;
          if (!country) throw Error(`new facility "${facility}" has no Country column to place it`);
          const state = String(get(r, 'state')).toUpperCase().replace(/[^A-Z]/g, '');
          const region = country === 'NZ' ? 'NZ' : ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'].includes(state) ? `AU-${state}` : null;
          if (!region) throw Error(`new Australian facility "${facility}" needs a State column (NSW, VIC, ...) for its grid factor`);
          const ent = (await db.query('select id from carbon.entities where country = $1 order by created_at limit 1', [country]))[0];
          if (!ent) throw Error(`no ${country} entity to hold "${facility}"`);
          site = (await db.query('insert into carbon.sites (name, entity_id, region, kind) values ($1, $2, $3, $4) returning id, name', [facility, ent.id, region, 'imported']))[0];
          report.sites_created.push(`${facility} (${region})`);
        }
        const srcName = `${site.name} ${cat}`;
        let src = (await db.query('select id from carbon.sources where site_id = $1 and category = $2 order by created_at limit 1', [site.id, cat]))[0];
        if (!src) {
          src = (await db.query(`insert into carbon.sources (name, site_id, category, supplier) values ($1, $2, $3, 'Imported from Persefoni') returning id`, [srcName, site.id, cat]))[0];
          report.sources_created.push(srcName);
        }
        const overlap = await db.query('select 1 from carbon.activity where source_id = $1 and period_start <= $3 and period_end >= $2', [src.id, from, to]);
        if (overlap.length) throw Error(`${srcName} already has activity overlapping ${from} to ${to}`);
        const imported = get(r, 'emissions') ? Number(String(get(r, 'emissions')).replace(/,/g, '')) : null;
        const act = (await db.query(`insert into carbon.activity (source_id, period_start, period_end, quantity, evidence, entered_by, source_ref, raw, imported_tco2e)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
          [src.id, from, to, quantity, `Persefoni ledger${id ? ` ${id}` : ''}`, actor, ref, JSON.stringify(r), Number.isFinite(imported) ? imported : null]))[0];
        report.activity_created++;
        if (Number.isFinite(imported) && imported !== null) {
          const ours = (await db.query('select tco2e, factor_edition from carbon.activity_emissions where activity_id = $1', [act.id]))[0];
          report.reconcile.push({ line, source: srcName, from, persefoni_t: imported, ours_t: ours.tco2e === null ? null : Number(ours.tco2e),
            diff_pct: ours.tco2e === null || !imported ? null : Math.round(1000 * (Number(ours.tco2e) - imported) / imported) / 10, our_factor: ours.factor_edition });
        }
      } catch (e) {
        report.problems.push(`line ${line}: ${e.message}`);
      }
    }
    await log(db, actor, 'import persefoni', JSON.stringify({ file: path.basename(file), created: report.activity_created, problems: report.problems.length }));
    await db.exec(dry ? 'ROLLBACK' : 'COMMIT');
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
  return report;
}

async function exportAll(db, o) {
  const out = {};
  for (const t of ['entities', 'sites', 'categories', 'factors', 'sources', 'activity', 'inventories', 'inventory_lines', 'supplier_requests', 'customer_requests', 'targets', 'actions', 'activity_log']) {
    out[t] = await db.query(`select * from carbon.${t} order by 1`);
  }
  const file = path.resolve(opt(o, 'out') || path.join(process.env.OUTPUT_DIR || REPO_ROOT, 'exports', `carbon-${today()}.json`));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  return { file, tables: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])) };
}

// ---------------------------------------------------------------- dispatch

export async function execute(db, cmd, o = {}) {
  if (reads[cmd]) return db.query(reads[cmd]);
  switch (cmd) {
    case 'help': return Object.keys(specs).map((c) => ({ command: c, flags: specs[c].map((f) => `--${f}`).join(' ') }));
    case 'footprint': return footprint(db, o);
    case 'hotspots': return hotspots(db, o);
    case 'by-site': return bySite(db, o);
    case 'trend': return trend(db);
    case 'target-progress': return targetProgress(db);
    case 'attention': return attention(db);
    case 'weekly-review': return weeklyReview(db);
    case 'lock-check': return lockCheck(db, o);
    case 'add-site': return addSite(db, o);
    case 'add-source': return addSource(db, o);
    case 'log': return logActivity(db, o);
    case 'void-activity': return voidActivity(db, o);
    case 'add-factor': return addFactor(db, o);
    case 'open-inventory': return openInventory(db, o);
    case 'set-inventory': return setInventory(db, o);
    case 'lock-inventory': return lockInventory(db, o);
    case 'request-supplier': return requestSupplier(db, o);
    case 'record-supplier': return recordSupplier(db, o);
    case 'add-customer-request': return addCustomerRequest(db, o);
    case 'answer-customer-request': return answerCustomerRequest(db, o);
    case 'draft-customer-response': return draftCustomerResponse(db, o);
    case 'draft-supplier-request': return draftSupplierRequest(db, o);
    case 'add-action': return addAction(db, o);
    case 'update-action': return updateAction(db, o);
    case 'set-target': return setTarget(db, o);
    case 'import': return importPersefoni(db, o);
    case 'export': return exportAll(db, o);
    default: throw Error(`Unknown command ${cmd}`);
  }
}

// ---------------------------------------------------------------- human output

function plain(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') return JSON.stringify(v);
  const s = String(v);
  return /^-?\d+\.\d+$/.test(s) ? s.replace(/\.?0+$/, '') : s;
}

const isTonnes = (k) => /(_t|tco2e)$/.test(k);
const money = (v, cur) => `${cur === 'AUD' ? 'A$' : '$'}${Math.round(Number(v) / 100).toLocaleString('en-NZ')}`;

export function columns(rows) {
  return Object.keys(rows[0]).filter((k) => !['currency'].includes(k)).map((k) => ({
    key: k,
    label: k.replace(/_cents$/, '').replace(/_pct$/, ' %').replace(/_t$/, ' t').replace(/_/g, ' '),
    align: /_cents$|_pct$|_t$|tco2e$|^quantity$|^days|^sources$|^lines$|kg_co2e/.test(k) ? 'right' : 'left',
    format: k.endsWith('_cents') ? (v, r) => (v === null || v === undefined ? '' : money(v, r.currency))
      : isTonnes(k) ? (v) => (v === null || v === undefined ? '' : t1(v))
        : k === 'quantity' ? (v) => (v === null || v === undefined ? '' : Number(v).toLocaleString('en-NZ', { maximumFractionDigits: 1 }))
          : k === 'id' ? (v) => String(v).slice(0, 8)
            : (v) => plain(v),
    width: 64,
  }));
}

export function render(cmd, result) {
  if (Array.isArray(result)) return result.length ? table(result, columns(result)) : '  (none)';
  if (cmd === 'footprint') {
    const f = result;
    const head = `${f.inventory} (${f.from} to ${f.to}, ${f.status === 'locked' ? 'locked' : 'open: provisional'})\n` +
      `  Scope 1 ${t1(f.scope1_t)} t  Scope 2 ${t1(f.scope2_t)} t  Scope 3 ${t1(f.scope3_t)} t  Total ${t1(f.total_t)} tCO2e` +
      (f.t_per_output_unit !== null ? `\n  ${f.t_per_output_unit} t per ${f.output_unit || 'unit'}` : '') +
      (f.t_per_million_revenue !== null ? `  ${t1(f.t_per_million_revenue)} t per $1m revenue` : '');
    return `${head}\n\n${render('', f.lines)}`;
  }
  if (cmd === 'weekly-review') return Object.entries(result).map(([k, rows]) => `${heading(k)}\n${render('', rows)}`).join('\n');
  if (cmd === 'import') {
    const r = result;
    return [`  ${r.dry_run ? 'DRY RUN, nothing saved. ' : ''}${r.rows} rows: ${r.activity_created} activity rows, ${r.skipped_existing} already imported`,
      `  sites created: ${r.sites_created.join(', ') || 'none'}`, `  sources created: ${r.sources_created.join(', ') || 'none'}`,
      ...(r.problems.length ? ['  problems:', ...r.problems.map((p) => `    ${p}`)] : ['  problems: none']),
      ...(r.reconcile.length ? ['', '  Persefoni total against this system, row by row:', render('', r.reconcile)] : [])].join('\n');
  }
  return Object.entries(result).map(([k, v]) => `  ${k}: ${typeof v === 'object' && v !== null ? JSON.stringify(v) : v}`).join('\n');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  let db;
  try {
    const { cmd, o } = parse(process.argv.slice(2));
    db = await getDb();
    const result = await execute(db, cmd, o);
    console.log(o.json ? JSON.stringify(result, null, 2) : render(cmd, result));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    if (db) await db.close();
  }
}
