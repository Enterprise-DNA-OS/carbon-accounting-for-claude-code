-- Demo business: Kererū Foods, a Christchurch chilled-meals manufacturer with a Sydney
-- distribution warehouse opened in September 2025. Financial years run April to March.
-- Two years are complete (scripts/seed.mjs locks them); the current year has gaps on purpose:
-- a missing power bill in Sydney, a missing diesel month, a late food waste report and a
-- quarter of hotel nights nobody sent in. Safe to run more than once.

insert into carbon.entities (name, country, revenue_cents, gross_assets_cents, employees, fy_end_month, nger_registered, nz_climate_reporting_entity) values
  ('Kererū Foods Ltd', 'NZ', 6400000000, 3100000000, 210, 3, false, false),
  ('Kererū Foods Australia Pty Ltd', 'AU', 5200000000, 1400000000, 104, 6, false, false)
on conflict do nothing;

insert into carbon.sites (name, entity_id, region, kind, data_owner, opened_on)
select v.name, e.id, v.region, v.kind, v.owner, v.opened::date
from (values
  ('Christchurch plant', 'Kererū Foods Ltd', 'NZ', 'factory', 'Hemi Walker', null),
  ('Sydney warehouse', 'Kererū Foods Australia Pty Ltd', 'AU-NSW', 'warehouse', 'Liam Brooks', '2025-09-01')
) as v(name, entity, region, kind, owner, opened)
join carbon.entities e on e.name = v.entity
on conflict do nothing;

-- Factors as published. NZ: Ministry for the Environment, Measuring Emissions Catalogue 2026.
-- NSW: National Greenhouse Accounts Factors 2025 (the value ASIC uses in its worked example).
insert into carbon.factors (category, region, valid_year, kg_co2e_per_unit, edition, table_ref, source_url, checked_on) values
  ('electricity', 'NZ', 2024, 0.0993596, 'MfE 2026', 'Table 5.2', 'https://measuringemissionsguide.environment.govt.nz/5_purchased_energy.html', '2026-10-11'),
  ('electricity', 'NZ', 2025, 0.0786625, 'MfE 2026', 'Table 5.2', 'https://measuringemissionsguide.environment.govt.nz/5_purchased_energy.html', '2026-10-11'),
  ('electricity', 'AU-NSW', 2025, 0.64, 'NGA 2025', 'Table 1', 'https://download.asic.gov.au/media/xyzjc1f0/sustainability-reporting-educational-modules-module-6-unit-3.pdf', '2026-10-11'),
  ('natural-gas', 'NZ', null, 0.19543, 'MfE 2026', 'Fuels, stationary commercial', 'https://measuringemissionsguide.environment.govt.nz/3_fuels.html', '2026-10-11'),
  ('diesel-transport', 'NZ', null, 2.67177, 'MfE 2026', 'Table 3.3', 'https://measuringemissionsguide.environment.govt.nz/3_fuels.html', '2026-10-11'),
  ('diesel-stationary', 'NZ', null, 2.6759, 'MfE 2026', 'Fuels, stationary commercial', 'https://measuringemissionsguide.environment.govt.nz/3_fuels.html', '2026-10-11'),
  ('petrol', 'NZ', null, 2.36143, 'MfE 2026', 'Table 3.3', 'https://measuringemissionsguide.environment.govt.nz/3_fuels.html', '2026-10-11'),
  ('lpg-stationary', 'NZ', null, 2.97164, 'MfE 2026', 'Fuels, stationary commercial', 'https://measuringemissionsguide.environment.govt.nz/3_fuels.html', '2026-10-11'),
  ('road-freight', 'NZ', null, 0.135, 'MfE 2026', 'Table 8.11, all trucks', 'https://measuringemissionsguide.environment.govt.nz/8_freight.html', '2026-10-11'),
  ('coastal-shipping', 'ANY', null, 0.046, 'MfE 2026', 'Table 8.19, container freight', 'https://measuringemissionsguide.environment.govt.nz/8_freight.html', '2026-10-11'),
  ('air-domestic', 'NZ', null, 0.115861, 'MfE 2026', 'Table 7.23, no radiative forcing', 'https://measuringemissionsguide.environment.govt.nz/7_travel.html', '2026-10-11'),
  ('air-international-short', 'ANY', null, 0.07435, 'MfE 2026', 'Table 7.28, economy', 'https://measuringemissionsguide.environment.govt.nz/7_travel.html', '2026-10-11'),
  ('air-international-long', 'ANY', null, 0.06926, 'MfE 2026', 'Table 7.28, economy', 'https://measuringemissionsguide.environment.govt.nz/7_travel.html', '2026-10-11'),
  ('hotel-nz', 'ANY', null, 8.33691, 'MfE 2026', 'Table 7.31', 'https://measuringemissionsguide.environment.govt.nz/7_travel.html', '2026-10-11'),
  ('hotel-au', 'ANY', null, 29.9039, 'MfE 2026', 'Table 7.31', 'https://measuringemissionsguide.environment.govt.nz/7_travel.html', '2026-10-11'),
  ('waste-general-landfill', 'NZ', null, 0.333843, 'MfE 2026', 'Table 10.3', 'https://measuringemissionsguide.environment.govt.nz/10_materials_waste.html', '2026-10-11'),
  ('waste-food-landfill', 'NZ', null, 0.971043, 'MfE 2026', 'Table 10.3', 'https://measuringemissionsguide.environment.govt.nz/10_materials_waste.html', '2026-10-11'),
  ('composting', 'ANY', null, 0.1756, 'MfE 2026', 'Table 10.6', 'https://measuringemissionsguide.environment.govt.nz/10_materials_waste.html', '2026-10-11')
on conflict do nothing;

insert into carbon.sources (name, site_id, category, supplier, account_ref, frequency, data_owner)
select v.name, s.id, v.category, v.supplier, v.account_ref, v.frequency, v.owner
from (values
  ('Plant electricity', 'Christchurch plant', 'electricity', 'Meridian', 'ICP 0001427931CH6E2', 'monthly', 'Hemi Walker'),
  ('Plant gas boiler', 'Christchurch plant', 'natural-gas', 'Genesis', 'ICP 1001190044QT9A1', 'monthly', 'Hemi Walker'),
  ('Delivery trucks diesel', 'Christchurch plant', 'diesel-transport', 'Z Business fuel card', 'Card 7781', 'monthly', 'Sophie Tan'),
  ('Sales cars petrol', 'Christchurch plant', 'petrol', 'Z Business fuel card', 'Card 7782', 'monthly', 'Sophie Tan'),
  ('Forklift LPG', 'Christchurch plant', 'lpg-stationary', 'Rockgas', 'Acct 55210', 'quarterly', 'Hemi Walker'),
  ('Chilled freight contractor', 'Christchurch plant', 'road-freight', 'Southfreight', 'Contract SF-12', 'monthly', 'Sophie Tan'),
  ('Containers to Sydney', 'Christchurch plant', 'coastal-shipping', 'Pacifica Lines', 'Booking KF', 'quarterly', 'Sophie Tan'),
  ('Domestic flights', 'Christchurch plant', 'air-domestic', 'Orbit travel report', null, 'quarterly', 'Grace Liu'),
  ('Trans-Tasman flights', 'Christchurch plant', 'air-international-short', 'Orbit travel report', null, 'quarterly', 'Grace Liu'),
  ('Hotel nights in Australia', 'Christchurch plant', 'hotel-au', 'Orbit travel report', null, 'quarterly', 'Grace Liu'),
  ('General waste', 'Christchurch plant', 'waste-general-landfill', 'Waste Management', 'Acct WM-3301', 'monthly', 'Hemi Walker'),
  ('Food waste to landfill', 'Christchurch plant', 'waste-food-landfill', 'Waste Management', 'Acct WM-3302', 'monthly', 'Hemi Walker'),
  ('Food waste composted', 'Christchurch plant', 'composting', 'Living Earth', 'Acct LE-118', 'monthly', 'Hemi Walker'),
  ('Warehouse electricity', 'Sydney warehouse', 'electricity', 'Origin', 'NMI 4103728815', 'monthly', 'Liam Brooks')
) as v(name, site, category, supplier, account_ref, frequency, owner)
join carbon.sites s on s.name = v.site
on conflict do nothing;

-- Monthly bills from April 2024 to September 2026, with a gentle seasonal swing. The gas boiler
-- burns more in the Canterbury winter and drops once the heat pump runs part of the load (from July 2026).
insert into carbon.activity (source_id, period_start, period_end, quantity, evidence, entered_by, source_ref)
select s.id, m::date, (m + interval '1 month' - interval '1 day')::date,
  round((v.base * (1 + v.swing * cos(2 * pi() * (extract(month from m) - 7) / 12))
    * case when v.name = 'Plant gas boiler' and m >= '2026-07-01' then 0.62 else 1 end
    * case when v.name = 'Food waste composted' and m >= '2025-07-01' then 1.6 else 1 end
    * case when v.name = 'Food waste to landfill' and m >= '2025-07-01' then 0.55 else 1 end)::numeric, 0),
  v.evidence || ' ' || to_char(m, 'Mon YYYY'), 'Seed', 'seed-' || lower(replace(v.name, ' ', '-')) || '-' || to_char(m, 'YYYY-MM')
from (values
  ('Plant electricity', 182000, 0.08, 'Meridian invoice', '2024-04-01', '2026-09-01'),
  ('Plant gas boiler', 88000, 0.30, 'Genesis invoice', '2024-04-01', '2026-09-01'),
  ('Delivery trucks diesel', 4100, 0.05, 'Z fuel card statement', '2024-04-01', '2026-09-01'),
  ('Sales cars petrol', 620, 0.05, 'Z fuel card statement', '2024-04-01', '2026-09-01'),
  ('Chilled freight contractor', 61000, 0.10, 'Southfreight tonne-km report', '2024-04-01', '2026-09-01'),
  ('General waste', 6200, 0.05, 'Waste Management weighbridge', '2024-04-01', '2026-09-01'),
  ('Food waste to landfill', 3100, 0.05, 'Waste Management weighbridge', '2024-04-01', '2026-08-01'),
  ('Food waste composted', 2000, 0.05, 'Living Earth docket', '2024-04-01', '2026-09-01'),
  ('Warehouse electricity', 41000, 0.12, 'Origin invoice', '2025-09-01', '2026-06-01')
) as v(name, base, swing, evidence, first_month, last_month)
join carbon.sources s on s.name = v.name
cross join lateral generate_series(v.first_month::timestamp, v.last_month::timestamp, interval '1 month') as m
where not (v.name = 'Delivery trucks diesel' and m = '2026-07-01')
  and not exists (select 1 from carbon.activity a where a.source_ref = 'seed-' || lower(replace(v.name, ' ', '-')) || '-' || to_char(m, 'YYYY-MM'));

-- Quarterly reports: LPG, shipping, flights and hotels. Hotel nights for July to September 2026 never arrived.
insert into carbon.activity (source_id, period_start, period_end, quantity, evidence, entered_by, source_ref)
select s.id, q::date, (q + interval '3 months' - interval '1 day')::date,
  round((v.base * (1 + 0.1 * sin(extract(month from q))))::numeric, 0),
  v.evidence || ' ' || to_char(q, 'Mon YYYY') || ' quarter', 'Seed', 'seed-' || lower(replace(v.name, ' ', '-')) || '-' || to_char(q, 'YYYY-MM')
from (values
  ('Forklift LPG', 950, 'Rockgas statement', '2026-07-01'),
  ('Containers to Sydney', 365000, 'Pacifica Lines voyage summary', '2026-07-01'),
  ('Domestic flights', 21000, 'Orbit travel report', '2026-07-01'),
  ('Trans-Tasman flights', 36000, 'Orbit travel report', '2026-07-01'),
  ('Hotel nights in Australia', 34, 'Orbit travel report', '2026-04-01')
) as v(name, base, evidence, last_quarter)
join carbon.sources s on s.name = v.name
cross join lateral generate_series('2024-04-01'::timestamp, v.last_quarter::timestamp, interval '3 months') as q
where not exists (select 1 from carbon.activity a where a.source_ref = 'seed-' || lower(replace(v.name, ' ', '-')) || '-' || to_char(q, 'YYYY-MM'));

-- The June 2026 Sydney bill was late, so it was estimated from May. July to September are missing.
update carbon.activity set estimated = true, estimate_method = 'Pro-rated from the May 2026 bill (Origin invoice late)', evidence = 'Estimate'
where source_ref = 'seed-warehouse-electricity-2026-06' and not estimated;

insert into carbon.inventories (name, starts_on, ends_on, is_base_year, revenue_cents, output_units, output_unit_label) values
  ('FY2025', '2024-04-01', '2025-03-31', true, 5800000000, 4100, 'tonne of product'),
  ('FY2026', '2025-04-01', '2026-03-31', false, 6400000000, 4650, 'tonne of product'),
  ('FY2027', '2026-04-01', '2027-03-31', false, null, null, 'tonne of product')
on conflict do nothing;

-- Scope 3 category 1: suppliers' own figures for what they sold us.
insert into carbon.supplier_requests (name, supplier, inventory_id, spend_cents, contact, requested_on, due_on, received_on, allocated_tco2e, basis)
select v.name, v.supplier, i.id, v.spend, v.contact, v.requested::date, v.due::date, v.received::date, v.t, v.basis
from (values
  ('Canterbury Packaging FY2026', 'Canterbury Packaging', 'FY2026', 185000000, 'sustainability@canterburypackaging.example', '2026-04-10', '2026-05-31', '2026-05-20', 214.5, 'Supplier-specific: their audited inventory allocated by tonnes sold to us'),
  ('Southern Proteins FY2026', 'Southern Proteins', 'FY2026', 920000000, 'quality@southernproteins.example', '2026-04-10', '2026-05-31', '2026-06-02', 1640.0, 'Supplier-specific: farm-gate emissions per kg of meat, times kg supplied'),
  ('Canterbury Packaging FY2027', 'Canterbury Packaging', 'FY2027', 0, 'sustainability@canterburypackaging.example', '2026-09-15', '2026-10-31', null, null, null),
  ('Southern Proteins FY2027', 'Southern Proteins', 'FY2027', 0, 'quality@southernproteins.example', '2026-08-01', '2026-09-30', null, null, null),
  ('Pacific Cartons FY2027', 'Pacific Cartons', 'FY2027', 0, 'accounts@pacificcartons.example', null, null, null, null, null)
) as v(name, supplier, inventory, spend, contact, requested, due, received, t, basis)
join carbon.inventories i on i.name = v.inventory
on conflict do nothing;

insert into carbon.customer_requests (name, customer, inventory_id, asked_for, received_on, due_on, answered_on, notes)
select v.name, v.customer, i.id, v.asked, v.received, v.due, v.answered, v.notes
from (values
  ('Harbour Supermarkets FY2026', 'Harbour Supermarkets', 'FY2026', 'Scope 1, 2 and 3, and emissions per tonne of product supplied', current_date - 12, current_date + 6, null::date,
    'Their supplier portal closes on the due date. They report under AASB S2 and need supplier figures for their own scope 3.'),
  ('Kai Collective FY2026', 'Kai Collective', 'FY2026', 'Scope 1 and 2', date '2026-05-04', date '2026-06-15', date '2026-06-10', 'Sent the FY2026 inventory summary.')
) as v(name, customer, inventory, asked, received, due, answered, notes)
join carbon.inventories i on i.name = v.inventory
on conflict do nothing;

insert into carbon.targets (name, scopes, base_inventory_id, target_year_end, reduction_pct)
select 'Scope 1 and 2 down 42% by FY2030', '1+2', i.id, '2030-03-31', 42 from carbon.inventories i where i.name = 'FY2025'
on conflict do nothing;

insert into carbon.actions (name, site_id, owner, status, saving_tco2e_per_year, cost_cents, due_on, notes)
select v.name, s.id, v.owner, v.status, v.saving, v.cost, v.due::date, v.notes
from (values
  ('Heat pump on the boiler loop', 'Christchurch plant', 'Hemi Walker', 'underway', 80, 42000000, '2026-12-15', 'Running part of the load since July 2026; full changeover in December.'),
  ('Electric vans for city deliveries', 'Christchurch plant', 'Sophie Tan', 'approved', 35, 36000000, '2026-09-30', 'Three vans approved in June; order not yet placed.'),
  ('Rooftop solar at the warehouse', 'Sydney warehouse', 'Liam Brooks', 'idea', 60, null, null, 'Landlord consent needed.'),
  ('Send food waste to compost', 'Christchurch plant', 'Hemi Walker', 'done', 40, 0, '2025-07-01', 'Living Earth collects twice a week since July 2025.')
) as v(name, site, owner, status, saving, cost, due, notes)
left join carbon.sites s on s.name = v.site
on conflict do nothing;
