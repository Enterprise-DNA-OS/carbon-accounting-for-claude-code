# Carbon Accounting for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| List reduction actions by status with owner, expected saving and due date | `/actions` |
| Show the last 60 activity rows (bills, fuel, freight, travel, waste) with the tonnes each produces | `/activity` |
| Add a reduction action with its site, owner, expected saving a year and due date | `/add-action` |
| Log a customer asking for your emissions: who, which year, what they asked for, and the deadline | `/add-customer-request` |
| Add a published emission factor (a new edition each year) with the page it came from | `/add-factor` |
| Add a site with its entity, grid region (NZ or AU-<state>), kind and data owner | `/add-site` |
| Add an emission source at a site: a meter, fuel card, freight contract or travel account, with its category | `/add-source` |
| Mark a customer request as answered once a person has sent the reply | `/answer-customer-request` |
| List what needs a person: customer deadlines, suppliers who have not replied, missing bills, overdue actions and compliance items due | `/attention` |
| Write the quarterly climate update for the board: footprint so far, trend against the target, actions, obligations and risks | `/board-update` |
| Split a year's emissions by site and scope | `/by-site` |
| List the activity categories, their scope, GHG Protocol scope 3 category and unit | `/categories` |
| Draft one reminder per data owner listing the bills and reports missing for the open year | `/chase-data` |
| Run the year-end close: check, chase or fix with approval, lock, then render the inventory document | `/close-year` |
| Check the records against the rules this industry lives under (the ones listed in docs/compliance.md) and report what is missing, late, or about to breach, with the rule cited | `/compliance` |
| List customers who asked for your emissions, open ones first, with days left | `/customer-requests` |
| Make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it | `/customise` |
| List every month with no data for each active source in the open year, and who to ask | `/data-gaps` |
| Draft the reply to a customer's emissions request from the year's figures: scopes, categories, intensity and method | `/draft-customer-response` |
| Draft the email asking a supplier for their emissions for what they sold you | `/draft-supplier-request` |
| List the companies in the group with the size facts the climate reporting thresholds test | `/entities` |
| List the estimated rows in the open year and how each was worked out | `/estimates` |
| Write every record to one JSON file the business owns | `/export` |
| List the emission factors on file with edition, table, source page and the day each was checked | `/factors` |
| Show one year's footprint: scope 1, 2 and 3, each category's tonnes and share, intensity per tonne of product and per $1m revenue | `/footprint` |
| List every command this system has, in plain words | `/help` |
| Show the last 50 changes and who made them | `/history` |
| List the biggest emission sources in a year and how much of the total the top ones make up | `/hotspots` |
| Bring activity data across from a Persefoni Footprint Ledger export, with a row-by-row check against Persefoni's own totals | `/import` |
| List the reporting years with scope 1, 2 and 3 totals, which are locked and which is the base year | `/inventories` |
| List everything stopping a year from locking: missing months, missing factors, suppliers yet to reply | `/lock-check` |
| Lock a finished year: freeze every line so the figures you report never change | `/lock-inventory` |
| Record a bill, fuel card statement, freight report or travel report for a source: the quantity, the period and the evidence | `/log` |
| Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view` | `/new-view` |
| Show scope 1 and 2 per Australian site per Australian financial year against the NGER facility threshold | `/nger` |
| Show which climate reporting rules each entity falls under: AASB S2 groups in Australia, climate statements in New Zealand | `/obligations` |
| Open a new reporting year | `/open-inventory` |
| Record a supplier's reply: the tonnes CO2e they allocated to you and how they worked it out | `/record-supplier` |
| Record that you asked a supplier for their emissions for a year, with spend and a due date | `/request-supplier` |
| Record a year's revenue and output (tonnes of product, units) so intensity can be worked out | `/set-inventory` |
| Set or change a reduction target: scopes, base year, target year end and percentage | `/set-target` |
| List every site, its grid region, who owns its data and how many sources it has | `/sites` |
| List every emission source (meters, fuel cards, freight contracts, travel accounts) with its scope, supplier and how far its data runs | `/sources` |
| List supplier emissions requests by year: asked, due, received and the tonnes each supplier allocated to you | `/suppliers` |
| Show each reduction target against a straight line from the base year: where each year should be and where it is | `/target-progress` |
| Compare every year: scope 1 and 2 against the base year, scope 3, intensity and how much was estimated. The open year is scaled to a full year | `/trend` |
| Move a reduction action on: status, due date, saving or notes | `/update-action` |
| Remove a wrong activity row in an open year, with the reason, so it can be entered again | `/void-activity` |
| Write the Monday carbon review from attention, data gaps, customer requests, the year so far, target progress and compliance | `/weekly-review` |

If an ask fits nothing here, run the CLI directly (`npm run carbon -- help`) and then propose a new command for it.

## How carbon accounting works here

- Tonnes are quantity times a published factor. Never type emissions in, and never invent a factor: add one only from the publisher's page with `/add-factor`.
- Every bill or report is one activity row for one source and period. Two rows for the same source cannot overlap.
- Scope 2 is location-based. Supplier figures for purchased goods are recorded as the supplier sent them, with their method.
- A locked year is frozen. A correction goes into the open year with a note, never into the locked one.
- Locking a year, voiding activity and answering a customer change the record: read the numbers back and wait for a yes.
- Anything about the law (AASB S2, NGER, New Zealand climate statements) cites `docs/compliance.md`. Nothing here is legal or assurance advice.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis and the guide for moving off Persefoni.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/persefoni
