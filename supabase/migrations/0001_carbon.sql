-- Carbon accounting: legal entities, sites, emission sources, activity data (fuel, power,
-- freight, travel, waste), published emission factors, reporting years that lock into a
-- frozen inventory, supplier and customer emissions requests, targets and reduction actions.
-- Runs on Postgres 14+ and PGlite. Emissions are computed, never typed in: quantity x factor.

create schema if not exists carbon;

create or replace function carbon.touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- The companies in the group, with the size facts the reporting thresholds test.
create table carbon.entities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  country text not null check (country in ('NZ', 'AU')),
  revenue_cents bigint not null default 0 check (revenue_cents >= 0),
  gross_assets_cents bigint not null default 0 check (gross_assets_cents >= 0),
  employees integer not null default 0 check (employees >= 0),
  fy_end_month integer not null default 6 check (fy_end_month between 1 and 12),
  nger_registered boolean not null default false,
  nz_climate_reporting_entity boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index entities_name_ci on carbon.entities (lower(name));

-- A place you operate. region picks the electricity grid factor: NZ, AU-NSW, AU-VIC, ...
create table carbon.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  entity_id uuid not null references carbon.entities(id),
  region text not null check (region ~ '^(NZ|AU-(NSW|VIC|QLD|SA|WA|TAS|NT|ACT))$'),
  kind text not null default 'site',
  data_owner text,
  opened_on date,
  closed_on date check (closed_on is null or opened_on is null or closed_on >= opened_on),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index sites_name_ci on carbon.sites (lower(name));

-- What kinds of activity there are. The category fixes the scope, the GHG Protocol scope 3
-- category and the unit; factors and sources both point here.
create table carbon.categories (
  key text primary key,
  label text not null,
  scope integer not null check (scope in (1, 2, 3)),
  scope3_category integer check (scope3_category between 1 and 15),
  unit text not null,
  region_free boolean not null default false, -- hotel nights and flights: the factor does not depend on the site's grid
  check ((scope = 3) = (scope3_category is not null))
);

insert into carbon.categories (key, label, scope, scope3_category, unit, region_free) values
  ('electricity', 'Grid electricity', 2, null, 'kWh', false),
  ('natural-gas', 'Natural gas (stationary, commercial)', 1, null, 'kWh', false),
  ('diesel-transport', 'Diesel in vehicles', 1, null, 'litre', false),
  ('diesel-stationary', 'Diesel in generators and plant', 1, null, 'litre', false),
  ('petrol', 'Regular petrol in vehicles', 1, null, 'litre', false),
  ('lpg-stationary', 'LPG (stationary, commercial)', 1, null, 'kg', false),
  ('road-freight', 'Road freight by contractors', 3, 4, 'tkm', false),
  ('coastal-shipping', 'Container shipping', 3, 4, 'tkm', true),
  ('air-domestic', 'Domestic flights', 3, 6, 'pkm', false),
  ('air-international-short', 'International flights under 3,700 km, economy', 3, 6, 'pkm', true),
  ('air-international-long', 'International flights over 3,700 km, economy', 3, 6, 'pkm', true),
  ('hotel-nz', 'Hotel nights in New Zealand', 3, 6, 'room-night', true),
  ('hotel-au', 'Hotel nights in Australia', 3, 6, 'room-night', true),
  ('waste-general-landfill', 'General waste to landfill with gas recovery', 3, 5, 'kg', false),
  ('waste-food-landfill', 'Food waste to landfill with gas recovery', 3, 5, 'kg', false),
  ('composting', 'Organic waste composted', 3, 5, 'kg', true);

-- Published factors, each with the edition, table and page it came from. valid_year is set for
-- factors published per calendar year (grid electricity); null means the edition's single value.
create table carbon.factors (
  id uuid primary key default gen_random_uuid(),
  category text not null references carbon.categories(key),
  region text not null default 'ANY' check (region ~ '^(ANY|NZ|AU|AU-(NSW|VIC|QLD|SA|WA|TAS|NT|ACT))$'),
  valid_year integer check (valid_year between 1990 and 2100),
  kg_co2e_per_unit numeric(14,7) not null check (kg_co2e_per_unit >= 0),
  edition text not null,
  table_ref text,
  source_url text not null check (source_url ~ '^https?://'),
  checked_on date not null,
  created_at timestamptz not null default now(),
  unique (category, region, valid_year, edition)
);

-- One thing you measure: a meter, a fuel card, a freight contract, a travel account.
create table carbon.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  site_id uuid not null references carbon.sites(id),
  category text not null references carbon.categories(key),
  supplier text,
  account_ref text,
  frequency text not null default 'monthly' check (frequency in ('monthly', 'quarterly', 'annual')),
  data_owner text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index sources_name_ci on carbon.sources (lower(name));

-- The raw numbers off bills, fuel cards and travel reports. Never emissions: those are computed.
create table carbon.activity (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references carbon.sources(id),
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  quantity numeric(16,3) not null check (quantity >= 0),
  evidence text,
  estimated boolean not null default false,
  estimate_method text,
  entered_by text not null default 'operator',
  source_ref text unique,
  raw jsonb,
  imported_tco2e numeric(14,4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not estimated or coalesce(btrim(estimate_method), '') <> '')
);
create index activity_source_period on carbon.activity (source_id, period_start);

-- Reporting years. A locked inventory is frozen line by line and its activity cannot change.
create table carbon.inventories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  starts_on date not null,
  ends_on date not null check (ends_on > starts_on),
  status text not null default 'open' check (status in ('open', 'locked')),
  is_base_year boolean not null default false,
  revenue_cents bigint check (revenue_cents >= 0),
  output_units numeric(16,2) check (output_units >= 0),
  output_unit_label text,
  locked_on date,
  locked_by text,
  lock_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'locked') = (locked_on is not null))
);
create unique index inventories_name_ci on carbon.inventories (lower(name));
create unique index inventories_one_base on carbon.inventories ((true)) where is_base_year;

create table carbon.inventory_lines (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references carbon.inventories(id),
  source_id uuid references carbon.sources(id),
  supplier_request_id uuid,
  site text,
  source text not null,
  category text not null,
  scope integer not null,
  scope3_category integer,
  quantity numeric(16,3),
  unit text,
  kg_co2e_per_unit numeric(14,7),
  factor_edition text,
  factor_year integer,
  tco2e numeric(14,4) not null,
  estimated_share numeric(6,4) not null default 0,
  created_at timestamptz not null default now()
);

-- Your suppliers' share of their own emissions, for scope 3 category 1 (purchased goods).
create table carbon.supplier_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  supplier text not null,
  inventory_id uuid not null references carbon.inventories(id),
  spend_cents bigint not null default 0 check (spend_cents >= 0),
  currency text not null default 'NZD' check (currency ~ '^[A-Z]{3}$'),
  contact text,
  requested_on date,
  due_on date,
  received_on date,
  allocated_tco2e numeric(14,4) check (allocated_tco2e >= 0),
  basis text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((received_on is null) = (allocated_tco2e is null)),
  unique (supplier, inventory_id)
);
create unique index supplier_requests_name_ci on carbon.supplier_requests (lower(name));
alter table carbon.inventory_lines add foreign key (supplier_request_id) references carbon.supplier_requests(id);

-- Your customers asking for your numbers: the request most suppliers now get every year.
create table carbon.customer_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  customer text not null,
  inventory_id uuid references carbon.inventories(id),
  asked_for text not null default 'Scope 1 and 2',
  received_on date not null default current_date,
  due_on date,
  answered_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index customer_requests_name_ci on carbon.customer_requests (lower(name));

create table carbon.targets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  scopes text not null default '1+2' check (scopes in ('1+2', '1+2+3', '3')),
  base_inventory_id uuid not null references carbon.inventories(id),
  target_year_end date not null,
  reduction_pct numeric(5,2) not null check (reduction_pct > 0 and reduction_pct <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index targets_name_ci on carbon.targets (lower(name));

create table carbon.actions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  site_id uuid references carbon.sites(id),
  owner text,
  status text not null default 'idea' check (status in ('idea', 'approved', 'underway', 'done', 'dropped')),
  saving_tco2e_per_year numeric(12,2) check (saving_tco2e_per_year >= 0),
  cost_cents bigint check (cost_cents >= 0),
  due_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index actions_name_ci on carbon.actions (lower(name));

create table carbon.activity_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor text not null,
  action text not null,
  detail text
);

create trigger entities_touch before update on carbon.entities for each row execute function carbon.touch();
create trigger sites_touch before update on carbon.sites for each row execute function carbon.touch();
create trigger sources_touch before update on carbon.sources for each row execute function carbon.touch();
create trigger activity_touch before update on carbon.activity for each row execute function carbon.touch();
create trigger inventories_touch before update on carbon.inventories for each row execute function carbon.touch();
create trigger supplier_requests_touch before update on carbon.supplier_requests for each row execute function carbon.touch();
create trigger customer_requests_touch before update on carbon.customer_requests for each row execute function carbon.touch();
create trigger targets_touch before update on carbon.targets for each row execute function carbon.touch();
create trigger actions_touch before update on carbon.actions for each row execute function carbon.touch();

-- ---------------------------------------------------------------- the frozen record

-- Inventory lines are written once, at lock, and never change.
create or replace function carbon.lines_frozen() returns trigger language plpgsql as $$
begin
  raise exception 'Inventory lines are frozen once an inventory locks; record a correction in the next inventory';
end $$;
create trigger inventory_lines_frozen before update or delete on carbon.inventory_lines for each row execute function carbon.lines_frozen();

-- Activity inside a locked inventory cannot be added, changed or removed.
create or replace function carbon.activity_guard() returns trigger language plpgsql as $$
declare r record;
begin
  for r in select i.name from carbon.inventories i where i.status = 'locked' and (
      (tg_op <> 'INSERT' and old.period_start <= i.ends_on and old.period_end >= i.starts_on) or
      (tg_op <> 'DELETE' and new.period_start <= i.ends_on and new.period_end >= i.starts_on)) loop
    raise exception 'Inventory % is locked: activity in it cannot change', r.name;
  end loop;
  return coalesce(new, old);
end $$;
create trigger activity_guard before insert or update or delete on carbon.activity for each row execute function carbon.activity_guard();

-- A locked inventory stays locked, and keeps its dates.
create or replace function carbon.inventory_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'locked' then raise exception 'Inventory % is locked and is kept as the record', old.name; end if;
    return old;
  end if;
  if old.status = 'locked' and (new.status <> 'locked' or new.starts_on <> old.starts_on or new.ends_on <> old.ends_on) then
    raise exception 'Inventory % is locked: its status and dates cannot change', old.name;
  end if;
  return new;
end $$;
create trigger inventory_guard before update or delete on carbon.inventories for each row execute function carbon.inventory_guard();

-- ---------------------------------------------------------------- views

-- Every activity row with the factor it uses: the site's own region before 'ANY', the
-- activity's own calendar year before the latest earlier one, the newest check last.
create or replace view carbon.activity_emissions as
select a.id as activity_id, a.source_id, s.name as source, st.id as site_id, st.name as site, st.region,
  c.key as category, c.label as category_label, c.scope, c.scope3_category, c.unit,
  a.period_start, a.period_end, a.quantity, a.estimated, a.estimate_method, a.evidence, a.imported_tco2e,
  f.id as factor_id, f.kg_co2e_per_unit, f.edition as factor_edition, f.valid_year as factor_year,
  extract(year from a.period_start)::int as activity_year,
  round(a.quantity * f.kg_co2e_per_unit / 1000, 4) as tco2e
from carbon.activity a
join carbon.sources s on s.id = a.source_id
join carbon.sites st on st.id = s.site_id
join carbon.categories c on c.key = s.category
left join lateral (
  select f.* from carbon.factors f
  where f.category = c.key
    and f.region in (st.region, split_part(st.region, '-', 1), 'ANY')
    and (f.valid_year is null or f.valid_year <= extract(year from a.period_start))
  order by (f.region = st.region) desc, (f.region = split_part(st.region, '-', 1)) desc,
    f.valid_year desc nulls last, f.checked_on desc
  limit 1
) f on true;

-- Activity spread over each inventory by days of overlap: a quarterly bill across year end
-- is split between the two years in proportion.
create or replace view carbon.inventory_activity as
select i.id as inventory_id, i.name as inventory, ae.*,
  (least(ae.period_end, i.ends_on) - greatest(ae.period_start, i.starts_on) + 1)::numeric
    / (ae.period_end - ae.period_start + 1) as share
from carbon.inventories i
join carbon.activity_emissions ae on ae.period_start <= i.ends_on and ae.period_end >= i.starts_on;

-- Live totals per source for open inventories, frozen lines for locked ones.
create or replace view carbon.inventory_sources as
select inventory_id, inventory, 'live'::text as basis, site, source, category, scope, scope3_category, unit,
  round(sum(quantity * share), 3) as quantity,
  round(sum(tco2e * share), 4) as tco2e,
  round(coalesce(sum(case when estimated then tco2e * share end) / nullif(sum(tco2e * share), 0), 0), 4) as estimated_share,
  bool_or(kg_co2e_per_unit is null) as missing_factor,
  max(factor_edition) as factor_edition
from carbon.inventory_activity ia
where (select status from carbon.inventories where id = ia.inventory_id) = 'open'
group by inventory_id, inventory, site, source, category, scope, scope3_category, unit
union all
select sr.inventory_id, i.name, 'live', null, 'Supplier: ' || sr.supplier, 'purchased-goods', 3, 1, null, null,
  sr.allocated_tco2e, 0, false, sr.basis
from carbon.supplier_requests sr join carbon.inventories i on i.id = sr.inventory_id
where i.status = 'open' and sr.allocated_tco2e is not null
union all
select l.inventory_id, i.name, 'locked', l.site, l.source, l.category, l.scope, l.scope3_category, l.unit,
  l.quantity, l.tco2e, l.estimated_share, false, l.factor_edition
from carbon.inventory_lines l join carbon.inventories i on i.id = l.inventory_id;

create or replace view carbon.inventory_totals as
select i.id as inventory_id, i.name as inventory, i.status, i.starts_on, i.ends_on, i.is_base_year,
  coalesce(round(sum(x.tco2e) filter (where x.scope = 1), 2), 0) as scope1_t,
  coalesce(round(sum(x.tco2e) filter (where x.scope = 2), 2), 0) as scope2_t,
  coalesce(round(sum(x.tco2e) filter (where x.scope = 3), 2), 0) as scope3_t,
  coalesce(round(sum(x.tco2e) filter (where x.scope in (1, 2)), 2), 0) as scope12_t,
  coalesce(round(sum(x.tco2e), 2), 0) as total_t,
  i.revenue_cents, i.output_units, i.output_unit_label,
  round((i.ends_on - i.starts_on + 1) / 30.4375)::int as months_total,
  least(round((i.ends_on - i.starts_on + 1) / 30.4375)::int, greatest(0,
    (extract(year from age(least(current_date, i.ends_on + 1), i.starts_on)) * 12 + extract(month from age(least(current_date, i.ends_on + 1), i.starts_on)))::int)) as months_elapsed
from carbon.inventories i left join carbon.inventory_sources x on x.inventory_id = i.id
group by i.id;

-- Months with no activity recorded, for every active source, in every open inventory, up to
-- the last full month. Quarterly and annual sources count a month covered by any bill spanning it.
create or replace view carbon.data_gaps as
select i.name as inventory, st.name as site, s.name as source, s.category, s.supplier, s.data_owner,
  to_char(m.month, 'YYYY-MM') as month, (current_date - (m.month + interval '1 month')::date) as days_since_month_end
from carbon.inventories i
cross join carbon.sources s
join carbon.sites st on st.id = s.site_id
cross join lateral generate_series(date_trunc('month', i.starts_on), date_trunc('month', least(i.ends_on, current_date)) - interval '1 month', interval '1 month') as m(month)
where i.status = 'open' and s.active
  and (st.opened_on is null or st.opened_on <= (m.month + interval '1 month' - interval '1 day')::date)
  and (st.closed_on is null or st.closed_on >= m.month::date)
  and (m.month + interval '1 month' - interval '1 day')::date <= current_date
  and not exists (
    select 1 from carbon.activity a where a.source_id = s.id
      and a.period_start <= (m.month + interval '1 month' - interval '1 day')::date and a.period_end >= m.month::date);

-- The reporting tests each entity meets. AU: AASB S2 groups under Corporations Act s292A
-- (two of three size tests, or NGER registration). NZ: climate reporting entity flag.
create or replace view carbon.obligations as
select e.name as entity, e.country, rule, applies, detail from carbon.entities e
cross join lateral (values
  ('AU climate report, Group 1 (periods from 1 Jan 2025)',
    e.country = 'AU' and (((e.revenue_cents >= 50000000000)::int + (e.gross_assets_cents >= 100000000000)::int + (e.employees >= 500)::int) >= 2),
    'Two of: revenue $500m, gross assets $1b, 500 employees; or an NGER reporter over the publication threshold'),
  ('AU climate report, Group 2 (periods from 1 Jul 2026)',
    e.country = 'AU' and ((((e.revenue_cents >= 20000000000)::int + (e.gross_assets_cents >= 50000000000)::int + (e.employees >= 250)::int) >= 2) or e.nger_registered),
    'Two of: revenue $200m, gross assets $500m, 250 employees; or any NGER reporter'),
  ('AU climate report, Group 3 (periods from 1 Jul 2027)',
    e.country = 'AU' and (((e.revenue_cents >= 5000000000)::int + (e.gross_assets_cents >= 2500000000)::int + (e.employees >= 100)::int) >= 2),
    'Two of: revenue $50m, gross assets $25m, 100 employees'),
  ('NZ climate statements (FMC Act Part 7A)',
    e.country = 'NZ' and e.nz_climate_reporting_entity,
    'Only climate reporting entities: large listed issuers, banks, insurers, credit unions and scheme managers')
) as r(rule, applies, detail)
where e.country = case when rule like 'AU%' then 'AU' else 'NZ' end;

-- NGER: scope 1 and 2 per Australian facility and per group, per Australian financial year.
create or replace view carbon.nger_years as
select ae.site, 'FY' || (extract(year from ae.period_start)::int + case when extract(month from ae.period_start) >= 7 then 1 else 0 end) as au_fy,
  round(sum(ae.tco2e), 2) as scope12_t
from carbon.activity_emissions ae
where ae.region like 'AU-%' and ae.scope in (1, 2)
group by 1, 2;

-- What the checks find. Severity: breached, due, warning.
create or replace view carbon.compliance_findings as
-- Factor older than its activity: the activity's own year has no published factor in the data.
select 'warning'::text as severity, 'Factor year: use the edition for the activity year (MfE / NGA)'::text as rule,
  ia.inventory as inventory, ia.source as item,
  'Activity in ' || ia.activity_year || ' uses the ' || ia.factor_year || ' factor (' || ia.factor_edition || '); add the newer factor when it is published' as finding
from carbon.inventory_activity ia
join carbon.inventories i on i.id = ia.inventory_id and i.status = 'open'
where ia.factor_year is not null and ia.factor_year < ia.activity_year
group by ia.inventory, ia.source, ia.activity_year, ia.factor_year, ia.factor_edition
union all
-- No factor at all: the emissions cannot be calculated.
select 'breached', 'Every activity needs a published factor (GHG Protocol ch. 6)', ia.inventory, ia.source,
  'No factor for ' || ia.category || ' in ' || ia.region
from carbon.inventory_activity ia join carbon.inventories i on i.id = ia.inventory_id and i.status = 'open'
where ia.kg_co2e_per_unit is null
group by ia.inventory, ia.source, ia.category, ia.region
union all
-- Factors not re-checked against the publisher in 15 months.
select 'warning', 'Factors re-checked every year (MfE and NGA publish annually)', null, f.category || ' ' || f.region,
  f.edition || ' last checked ' || f.checked_on
from carbon.factors f
where f.checked_on < current_date - 456
  and exists (select 1 from carbon.activity_emissions ae where ae.factor_id = f.id and ae.period_start >= current_date - 730)
union all
-- NGER thresholds: 25 kt per facility, 50 kt per group (NGER Act s13).
select 'due', 'NGER: register and report by 31 October when over threshold (NGER Act s13, s19)', n.au_fy, n.site,
  n.scope12_t || ' t scope 1 and 2 against the 25,000 t facility threshold'
from carbon.nger_years n where n.scope12_t >= 25000
union all
select 'due', 'NGER: register and report by 31 October when over threshold (NGER Act s13, s19)', g.au_fy, 'Australian group',
  g.t || ' t scope 1 and 2 against the 50,000 t group threshold'
from (select au_fy, sum(scope12_t) as t from carbon.nger_years group by au_fy) g where g.t >= 50000
union all
-- AASB S2 groups that apply.
select 'due', o.rule, null, o.entity, o.detail from carbon.obligations o where o.applies
union all
-- Base year recalculation: a site opened or closed after the base year (GHG Protocol ch. 5).
select 'warning', 'Recalculate the base year after structural change (GHG Protocol ch. 5)', b.name, st.name,
  'Site ' || case when st.opened_on > b.ends_on then 'opened ' || st.opened_on else 'closed ' || st.closed_on end || ', after base year ' || b.name || ': check whether the change is significant'
from carbon.inventories b join carbon.sites st on (st.opened_on > b.ends_on or st.closed_on > b.ends_on)
where b.is_base_year
union all
-- Estimated data above a fifth of an open inventory (local rule, change with /customise).
select 'warning', 'Local rule: estimates under 20% of the total', t.inventory, null,
  round(100 * t.est / nullif(t.tot, 0), 1) || '% of tCO2e is estimated'
from (select inventory, sum(tco2e * estimated_share) as est, sum(tco2e) as tot from carbon.inventory_sources where basis = 'live' group by inventory) t
where t.est / nullif(t.tot, 0) > 0.2
union all
-- Scope 3 from the second reporting year (AASB S2 transition relief covers the first only).
select 'warning', 'Scope 3 from the second reporting year (AASB S2, Appendix C relief)', t.inventory, null,
  'No scope 3 recorded in this inventory'
from carbon.inventory_totals t
where t.status = 'open' and t.scope3_t = 0
  and exists (select 1 from carbon.inventories p where p.ends_on < t.starts_on);

-- What needs a person this week.
create or replace view carbon.attention as
select 'Customer request due' as what, cr.customer as item,
  coalesce('due ' || cr.due_on || ' (' || (cr.due_on - current_date) || ' days)', 'no due date') || ': ' || cr.asked_for as detail,
  coalesce(cr.due_on, current_date + 30) as sort_on
from carbon.customer_requests cr where cr.answered_on is null
union all
select 'Supplier has not replied', sr.supplier,
  'asked ' || coalesce(sr.requested_on::text, 'not yet') || coalesce(', due ' || sr.due_on, '') ||
    case when sr.due_on < current_date then ' (' || (current_date - sr.due_on) || ' days overdue)' else '' end,
  coalesce(sr.due_on, current_date + 60)
from carbon.supplier_requests sr join carbon.inventories i on i.id = sr.inventory_id
where sr.received_on is null and i.status = 'open'
union all
select 'Missing data', g.source, count(*) || ' month(s) missing: ' || string_agg(g.month, ', ' order by g.month) || coalesce(' (ask ' || max(g.data_owner) || ')', ''),
  min(to_date(g.month || '-01', 'YYYY-MM-DD'))
from carbon.data_gaps g where g.days_since_month_end >= 10 group by g.source
union all
select 'Action overdue', a.name, a.status || ', due ' || a.due_on || coalesce(', ' || a.owner, ''), a.due_on
from carbon.actions a where a.status in ('approved', 'underway') and a.due_on < current_date
union all
select 'Compliance: ' || f.severity, coalesce(f.item, f.inventory, ''), f.rule || ': ' || f.finding, current_date
from carbon.compliance_findings f where f.severity in ('breached', 'due');

alter table carbon.entities enable row level security;
alter table carbon.sites enable row level security;
alter table carbon.categories enable row level security;
alter table carbon.factors enable row level security;
alter table carbon.sources enable row level security;
alter table carbon.activity enable row level security;
alter table carbon.inventories enable row level security;
alter table carbon.inventory_lines enable row level security;
alter table carbon.supplier_requests enable row level security;
alter table carbon.customer_requests enable row level security;
alter table carbon.targets enable row level security;
alter table carbon.actions enable row level security;
alter table carbon.activity_log enable row level security;
