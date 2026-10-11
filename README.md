<h1 align="center">Carbon Accounting for Claude Code</h1>

<p align="center">
  <strong>The open-source carbon accounting system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Persefoni data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=persefoni">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/persefoni?utm_source=github&utm_medium=readme&utm_campaign=persefoni">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-persefoni">Instead of Persefoni</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Carbon Accounting for Claude Code does the job you pay Persefoni for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the Persefoni dashboard cannot.

Persefoni's own AWS Marketplace listing prices its carbon management platform at US$55,000 for 12 months for organisations under $250M revenue, and US$90,000 under $1B ([listing](https://aws.amazon.com/marketplace/pp/prodview-xjkwazkrg2b62), checked 11 October 2026). IBM Envizi prices by data volume with scope 3 and supply chain emissions as add-ons, and quotes privately ([pricing page](https://www.ibm.com/products/envizi/pricing)).

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=persefoni).

It measures a business's greenhouse gas emissions the way the GHG Protocol asks: sites and the meters, fuel cards, freight contracts and travel accounts at each, the quantity off every bill, and published emission factors with their edition and source page. Tonnes are always quantity times factor, never typed in. It chases missing bills, answers customers who ask for your numbers, chases suppliers for theirs, locks each finished year so the figures you report never change, tracks a reduction target, and checks which New Zealand and Australian reporting rules now apply (AASB S2 groups, NGER thresholds, New Zealand climate statements). Built for NZ and AU manufacturers, wholesalers, freight firms and the suppliers of companies that report.

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No revenue bands, no seats, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for what a supplier portal and charts give that this does not.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/carbon-accounting-for-claude-code.git
cd carbon-accounting-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/attention`. The demo is Kererū Foods, a fictional Christchurch chilled-meals maker with a Sydney warehouse: a supermarket customer wants its emissions in six days, a supplier is late with theirs, three months of Sydney power bills are missing, and the Australian company has just crossed into Group 3 climate reporting.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

49 commands. Every one drives `npm run carbon -- <command>`, which also takes `--json`.

| Command | What it does |
|---|---|
| `/actions` | List reduction actions by status with owner, expected saving and due date. |
| `/activity` | Show the last 60 activity rows (bills, fuel, freight, travel, waste) with the tonnes each produces. |
| `/add-action` | Add a reduction action with its site, owner, expected saving a year and due date. |
| `/add-customer-request` | Log a customer asking for your emissions: who, which year, what they asked for, and the deadline. |
| `/add-factor` | Add a published emission factor (a new edition each year) with the page it came from. |
| `/add-site` | Add a site with its entity, grid region (NZ or AU-<state>), kind and data owner. |
| `/add-source` | Add an emission source at a site: a meter, fuel card, freight contract or travel account, with its category. |
| `/answer-customer-request` | Mark a customer request as answered once a person has sent the reply. |
| `/attention` | List what needs a person: customer deadlines, suppliers who have not replied, missing bills, overdue actions and compliance items due. |
| `/board-update` | Write the quarterly climate update for the board: footprint so far, trend against the target, actions, obligations and risks. |
| `/by-site` | Split a year's emissions by site and scope. |
| `/categories` | List the activity categories, their scope, GHG Protocol scope 3 category and unit. |
| `/chase-data` | Draft one reminder per data owner listing the bills and reports missing for the open year. |
| `/close-year` | Run the year-end close: check, chase or fix with approval, lock, then render the inventory document. |
| `/compliance` | Check the records against the rules this industry lives under (the ones listed in docs/compliance.md) and report what is missing, late, or about to breach, with the rule cited. |
| `/customer-requests` | List customers who asked for your emissions, open ones first, with days left. |
| `/customise` | Make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it. |
| `/data-gaps` | List every month with no data for each active source in the open year, and who to ask. |
| `/draft-customer-response` | Draft the reply to a customer's emissions request from the year's figures: scopes, categories, intensity and method. |
| `/draft-supplier-request` | Draft the email asking a supplier for their emissions for what they sold you. |
| `/entities` | List the companies in the group with the size facts the climate reporting thresholds test. |
| `/estimates` | List the estimated rows in the open year and how each was worked out. |
| `/export` | Write every record to one JSON file the business owns. |
| `/factors` | List the emission factors on file with edition, table, source page and the day each was checked. |
| `/footprint` | Show one year's footprint: scope 1, 2 and 3, each category's tonnes and share, intensity per tonne of product and per $1m revenue. |
| `/help` | List every command this system has, in plain words. |
| `/history` | Show the last 50 changes and who made them. |
| `/hotspots` | List the biggest emission sources in a year and how much of the total the top ones make up. |
| `/import` | Bring activity data across from a Persefoni Footprint Ledger export, with a row-by-row check against Persefoni's own totals. |
| `/inventories` | List the reporting years with scope 1, 2 and 3 totals, which are locked and which is the base year. |
| `/lock-check` | List everything stopping a year from locking: missing months, missing factors, suppliers yet to reply. |
| `/lock-inventory` | Lock a finished year: freeze every line so the figures you report never change. |
| `/log` | Record a bill, fuel card statement, freight report or travel report for a source: the quantity, the period and the evidence. |
| `/new-view` | Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view`. |
| `/nger` | Show scope 1 and 2 per Australian site per Australian financial year against the NGER facility threshold. |
| `/obligations` | Show which climate reporting rules each entity falls under: AASB S2 groups in Australia, climate statements in New Zealand. |
| `/open-inventory` | Open a new reporting year. |
| `/record-supplier` | Record a supplier's reply: the tonnes CO2e they allocated to you and how they worked it out. |
| `/request-supplier` | Record that you asked a supplier for their emissions for a year, with spend and a due date. |
| `/set-inventory` | Record a year's revenue and output (tonnes of product, units) so intensity can be worked out. |
| `/set-target` | Set or change a reduction target: scopes, base year, target year end and percentage. |
| `/sites` | List every site, its grid region, who owns its data and how many sources it has. |
| `/sources` | List every emission source (meters, fuel cards, freight contracts, travel accounts) with its scope, supplier and how far its data runs. |
| `/suppliers` | List supplier emissions requests by year: asked, due, received and the tonnes each supplier allocated to you. |
| `/target-progress` | Show each reduction target against a straight line from the base year: where each year should be and where it is. |
| `/trend` | Compare every year: scope 1 and 2 against the base year, scope 3, intensity and how much was estimated. The open year is scaled to a full year. |
| `/update-action` | Move a reduction action on: status, due date, saving or notes. |
| `/void-activity` | Remove a wrong activity row in an open year, with the reason, so it can be entered again. |
| `/weekly-review` | Write the Monday carbon review from attention, data gaps, customer requests, the year so far, target progress and compliance. |

### What it looks like

```
$ npm run carbon -- footprint --inventory=FY2026
FY2026 (2025-04-01 to 2026-03-31, locked)
  Scope 1 366.8 t  Scope 2 345.3 t  Scope 3 2,100.4 t  Total 2,812.4 tCO2e
  0.6048 t per tonne of product  43.9 t per $1m revenue

  scope      category                   tco2e  share %  estimated %
  ---------  -----------------------  -------  -------  -----------
  Scope 1    natural-gas                206.4      7.3            0
  Scope 1    diesel-transport           131.5      4.7            0
  Scope 1    petrol                      17.6      0.6            0
  Scope 1    lpg-stationary              11.4      0.4            0
  Scope 2    electricity                345.3     12.3            0
  Scope 3.1  purchased-goods          1,854.5     65.9            0
  Scope 3.4  road-freight                98.8      3.5            0
  Scope 3.4  coastal-shipping            67.5      2.4            0
  Scope 3.5  waste-general-landfill      24.8      0.9            0
  Scope 3.5  waste-food-landfill         24.0      0.9            0
  Scope 3.5  composting                   6.1      0.2            0
  Scope 3.6  air-international-short     10.8      0.4            0
  Scope 3.6  air-domestic                 9.8      0.3            0
  Scope 3.6  hotel-au                     4.1      0.1            0
```

## Ten questions Persefoni's dashboards do not answer for you

Each is one command here, on your own data.

| Question | Command |
|---|---|
| Which bills are missing for this year, by month, and who do we ask for each? | `data-gaps` |
| What exactly stops us locking last year right now? | `lock-check` |
| Which customer wants our numbers next, and what is the deadline? | `customer-requests` |
| Which suppliers have not sent their figures, and how overdue are they? | `attention` |
| Are we on track for the 2030 target if this year runs at its current rate? | `target-progress` |
| Which three sources make up most of our footprint this year? | `hotspots` |
| Which of our power bills are still on last year's grid factor? | `compliance` |
| Does our Australian company fall into AASB S2 Group 2 or Group 3, and from when? | `obligations` |
| How close is the Sydney warehouse to the NGER facility threshold? | `nger` |
| How much of this year's total is estimated, and how was each estimate made? | `estimates` |

## Your first hour: ten things to ask for

1. "Put our business name, logo and colours on the documents" (edits `brand.json`).
2. "What needs doing this week?"
3. "Log Meridian's September bill: 181,500 kWh, invoice 88123."
4. "Draft the reply to Harbour Supermarkets."
5. "Chase everyone with missing bills" (`/chase-data`).
6. "The MfE 2027 factors are out: add the 2026 grid factor."
7. "We closed FY2027. Check it, show me the totals, then lock it."
8. "Add refrigerant top-ups as a scope 1 category" (`/customise`).
9. "Give me a page for the operations manager: this year by site and month" (`/new-view`).
10. "Test our Persefoni ledger export without saving it."

## Instead of Persefoni

Export the Footprint Ledger from Persefoni as CSV, do a test run, then import:

```bash
npm run carbon -- import persefoni --file=imports/ledger.csv --actor="Migration" --dry-run
```

The test run recalculates every row here and shows Persefoni's tonnes beside this system's, row by row, so differences in factor edition or method show up before anything is saved. The full guide, with the column headings it reads, the mapping file and what does not carry over: [docs/replace-persefoni.md](docs/replace-persefoni.md).

## Documents and views

- `npm run docs` renders a branded emissions inventory for every reporting year (summary, by scope and category, by site, activity data, factors with sources, sign-off), a supplier emissions statement for every customer request, and a request letter for every supplier yet to reply, from `brand.json`.
- `npm run view` renders two read-only pages: the week (what needs a person, missing months, customer deadlines) and the footprint (every year, biggest sources, actions, compliance).
- `/compliance` checks the records against the rules in [docs/compliance.md](docs/compliance.md), each with its source.

## How the numbers work

- Activity: the quantity off a bill or report, for a source, over a period. A bill that crosses a year end is split between the years by days.
- Factor: the published factor for the category and the site's region (NZ, or the Australian state's grid), for the activity's own calendar year where the publisher gives one per year, else the newest earlier one. Each factor keeps its edition, table and source page.
- Tonnes: quantity times factor, divided by 1,000. Never typed in. Supplier figures for purchased goods (scope 3 category 1) are recorded as the supplier sent them, with their method.
- Lock: locking a finished year freezes every line. The database refuses changes to those lines and to activity inside the year from then on.
- Open year: compared with full years on its run rate (what it has so far, scaled to twelve months), and labelled with how many months it covers.

Scope 2 is location-based. This is not an assurance engagement and it lodges nothing with ASIC, the Clean Energy Regulator or the Companies Office.

## Architecture

```
carbon-accounting-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/                  the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     the thesis and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Carbon Accounting for Claude Code for your business, migrates your Persefoni data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=persefoni)
- Read more: [enterprisedna.co/omni/instead-of/persefoni](https://enterprisedna.co/omni/instead-of/persefoni?utm_source=github&utm_medium=readme&utm_campaign=persefoni)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
