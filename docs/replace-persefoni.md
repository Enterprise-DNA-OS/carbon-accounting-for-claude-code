# Moving off Persefoni

Checked 11 October 2026. Your activity history comes across in one command from Persefoni's Footprint Ledger export. Every row is recalculated here from its quantity and a published factor, and the import shows Persefoni's tonnes beside this system's tonnes for each row, so you see exactly where the two differ before anything is saved.

## 1. Export from Persefoni

1. In Persefoni, open the Footprint Ledger for the years you want to keep.
2. Export the ledger to CSV with the activity columns: facility, activity name and type, start and end dates, quantity, unit and the emissions in tCO2e. Include the record ID column so the import can be run again safely.
3. Save the file under `imports/` in this folder (that folder is ignored by git, so nothing private is committed).

Persefoni's column names vary by account and report template. The import recognises the common ones:

| Field | Headings it reads |
|---|---|
| Record ID | Record ID, Ledger ID, Activity ID, ID |
| Facility | Facility, Facility Name, Site, Location |
| Activity | Activity Name, Activity, Description, Name |
| Category | Activity Type, Subcategory, Sub Category, Category, Emission Source |
| Start and end | Start Date, Period Start, Activity Start Date, From / End Date, Period End, Activity End Date, To |
| Quantity and unit | Quantity, Activity Amount, Amount, Usage, Consumption / Unit, Units, Activity Unit, Unit of Measure |
| Persefoni's tonnes | Emissions (tCO2e), Total Emissions (tCO2e), tCO2e, CO2e (t) |
| Country and state | Country, Facility Country / State, Region, State/Province (only needed for a facility this system does not have yet) |

## 2. Do a test run

```bash
npm run carbon -- import persefoni --file=imports/ledger.csv --dry-run
```

The report shows how many rows would come across, the sites and sources it would create, every row it would skip and why, and a reconcile table: Persefoni's tonnes, this system's tonnes and the difference for each row. Nothing is saved.

Differences come from three places:

- **A different factor edition.** Persefoni may use a different year or publisher. This system uses the factor for the activity's own calendar year from the factors on file. Add the edition you want with `/add-factor`.
- **Radiative forcing on flights.** This system's demo flight factors leave it out (MfE Tables 7.23 and 7.28). Add the "with radiative forcing" factors if your policy includes it.
- **Market-based electricity.** If Persefoni reported market-based scope 2 (with renewable certificates), its figures will be lower than this system's location-based ones.

## 3. Map anything it does not recognise

Write a mapping file for other headings or categories:

```json
{
  "columns": { "quantity": "Usage (kWh)", "facility": "Building" },
  "categories": { "Grid power": "electricity", "Fleet - diesel": "diesel-transport" }
}
```

```bash
npm run carbon -- import persefoni --file=imports/ledger.csv --mapping=imports/map.json --dates=mdy --dry-run
```

`--dates=mdy` reads 09/01/2026 as 1 September (Persefoni accounts set up in the United States often export month first). ISO dates (2026-09-01) always read correctly.

## 4. Bring it in

Run the same command without `--dry-run`. Running it again skips every record ID already imported. Rows inside a year you have already locked here are refused: open those years before you lock them, or import first and lock after.

## What maps

| Persefoni | Here |
|---|---|
| Facility | Site (created when new, with its grid region from Country and State) |
| Activity type | Category: electricity, natural gas, diesel, petrol, LPG, road freight, shipping, flights, hotel nights, waste, composting |
| Activity row | Activity: quantity converted to the category's unit (MWh to kWh, kL to litres, tonnes to kg), period, evidence, the original row kept in full |
| Calculated emissions | Kept beside each row for comparison; this system's tonnes are recalculated |

## What does not carry over

- **Categories this system does not hold yet,** such as refrigerant leakage, purchased goods by spend, or investments. They are listed as skipped. Add a category with `/customise`, or ask Enterprise DNA to.
- **Supplier responses from Persefoni's data exchange.** Record each supplier's figure with `/record-supplier`.
- **Targets, scenarios and disclosure report text.** Set targets again with `/set-target`. Report text lives in your own documents.
- **Users and permissions.** There are no seats here. Database access is yours to grant.

## Run both for one year

Keep Persefoni for one more reporting year end. Import the year, lock it here, and compare totals by scope with Persefoni's report. When they match or the differences are explained, cancel the subscription.
