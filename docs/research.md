# Research notes: Persefoni and carbon accounting software

Checked 11 October 2026.

## What Persefoni charges

- Persefoni's own listing on AWS Marketplace prices its carbon management and accounting platform (CMAP) in 12-month contracts by the buyer's annual revenue: Enterprise Tier 1, organisations below $250M revenue, $55,000; Tier 2, below $1B, $90,000; Tier 3, below $5B, $130,000; Tier 4, below $25B, $260,000 (US dollars). Larger organisations, custom terms or private contracts go to sales. Source: https://aws.amazon.com/marketplace/pp/prodview-xjkwazkrg2b62
- Persefoni Pro is free for one user and covers scope 1, 2 and 3 measurement; the paid tiers add supplier data exchange, APIs, custom emission factors and more users (third-party summaries of Persefoni's plans).

## The rivals NZ and AU buyers meet

- IBM Envizi (founded in Australia) prices by "Accounts", its unit of tracked data: Essentials up to 1,000, Standard 1,001 to 5,000, Premium over 5,000, with ESG reporting, scope 3 and supply chain emissions as add-ons. No dollar figures on the page. Source: https://www.ibm.com/products/envizi/pricing
- Watershed, Sweep and Normative quote privately. Trace (Sydney) and Sumday (Tasmania) sell annual or monthly subscriptions priced by size or turnover, on request.

## What the export gives you

Persefoni's Footprint Ledger exports line by line, with reported energy consumption columns added in October 2024 (Persefoni release log). The data dictionary for the export sits behind customer login, so the import here reads the common headings and takes a mapping file for the rest.

## What a business that measures emissions does every month and year

Collect bills and fuel card statements from each site, chase the ones missing, answer customers who ask for their numbers (often by a supplier portal deadline), chase suppliers for their own figures, add the new factor editions each year, lock the year once the auditor or CFO signs off, report progress on the target to the board, and check which reporting rules now apply (AASB S2 groups, NGER, New Zealand climate statements). Those are the commands in this repo.

## Factor sources

- New Zealand: Ministry for the Environment, Measuring Emissions Catalogue 2026 (fuels, purchased energy, travel, freight, materials and waste chapters): https://measuringemissionsguide.environment.govt.nz/
- Australia: National Greenhouse Accounts Factors, published by DCCEEW each year: https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors. The NSW grid factor in the demo (0.64 kg CO2-e per kWh, 2025) is the figure ASIC uses in its sustainability reporting module 6.
