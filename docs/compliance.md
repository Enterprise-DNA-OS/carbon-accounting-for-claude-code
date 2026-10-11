# Compliance rules this system checks

Checked 11 October 2026. `/compliance` runs every rule below against the records and reports breaches first, then items due, then warnings. The rules are the ones a New Zealand or Australian business meets when it measures and reports greenhouse gas emissions. This system measures and records; it never lodges anything with ASIC, the Clean Energy Regulator or the Companies Office. Nothing here is legal or assurance advice: confirm each rule with your adviser, and update this file and the check together when a rule changes.

| Rule | What the check looks for | Source |
|---|---|---|
| **Every activity has a published factor.** Emissions are activity data times an emission factor (GHG Protocol Corporate Standard, chapter 6). | Activity in an open year with no factor for its category and region: those tonnes are missing from the total. Breached. | [GHG Protocol Corporate Standard](https://ghgprotocol.org/corporate-standard) |
| **Use the factor for the activity's own year.** New Zealand's Ministry for the Environment publishes a grid electricity factor for each calendar year; Australia's National Greenhouse Accounts (NGA) Factors are re-issued every year. | Activity in a year newer than the newest factor on file (for example 2026 power bills still on the 2025 factor). Warning until the new edition is added with `/add-factor`. | [MfE Measuring Emissions, purchased energy](https://measuringemissionsguide.environment.govt.nz/5_purchased_energy.html), [DCCEEW: NGA Factors](https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors) |
| **Re-check factors every year.** | A factor in use that has not been checked against its publisher in 15 months. | As above |
| **NGER registration.** A corporation must register and report under the National Greenhouse and Energy Reporting Act 2007 when a facility emits 25 kt CO2-e or more in a financial year, or the group 50 kt or more (section 13; energy thresholds of 100 TJ and 200 TJ also apply). Reports are due by 31 October for the year to 30 June (section 19); when that falls on a weekend the regulator sets the next business day, which for 2025-26 is 2 November 2026. | Scope 1 and 2 per Australian site and in total, per Australian financial year, at or over the emissions thresholds. The energy test is not run: it needs energy content, ask your adviser if any site is close. | [Clean Energy Regulator: NGER thresholds](https://cer.gov.au/schemes/national-greenhouse-and-energy-reporting-scheme/assess-your-obligations) |
| **Australian climate reporting (AASB S2).** Under Corporations Act s292A, entities that report under Chapter 2M prepare a sustainability report when they meet two of three size tests at year end. Group 1 (periods from 1 January 2025): revenue $500m, gross assets $1b, 500 employees, or an NGER reporter over the publication threshold. Group 2 (from 1 July 2026): $200m, $500m, 250 employees, or any NGER reporter. Group 3 (from 1 July 2027): $50m, $25m, 100 employees. | Each Australian entity's revenue, gross assets and employees against each group. A group that applies shows as due, with its start date. | [ASIC RG 280: Sustainability reporting](https://asic.gov.au/regulatory-resources/sustainability-reporting/), [AICD summary](https://www.aicd.com.au/risk-management/framework/climate/climate-reporting-legislation-passes-senate-reporting-to-commence-from-1-january-2025.html) |
| **Scope 3 from the second year.** AASB S2's transition relief lets an entity leave out scope 3 in its first reporting period only. | An open year, after an earlier year exists, with no scope 3 recorded. | [AASB S2 Climate-related Disclosures](https://standards.aasb.gov.au/aasb-s2-sep-2024) |
| **New Zealand climate statements.** Climate reporting entities under Part 7A of the Financial Markets Conduct Act 2013 (large listed issuers, registered banks, licensed insurers, credit unions, building societies and managers of registered schemes over the size thresholds) report under the Aotearoa New Zealand Climate Standards. | Set `nz_climate_reporting_entity` on the entity if it is one; the rule then shows as due. | [XRB: Aotearoa New Zealand Climate Standards](https://www.xrb.govt.nz/standards/climate-related-disclosures/) |
| **Recalculate the base year after structural change.** The GHG Protocol asks for the base year to be recalculated when an acquisition, divestment or new site changes the comparison significantly (chapter 5). | A site opened or closed after the base year. Warning: decide whether the change is significant and record the decision. | [GHG Protocol Corporate Standard](https://ghgprotocol.org/corporate-standard) |
| **A locked year never changes.** Not a statute: what you sent a customer, a bank or your auditor must match what is on file. | Enforced by the database: inventory lines, and activity inside a locked year, cannot be added, changed or deleted. | Your own policy |
| **Local rule: estimates under 20% of the total.** Not a statute. Assurance providers look hard at estimated data. | An open year where more than a fifth of the tonnes come from estimated rows. | Your own policy. Change the threshold with `/customise`. |

## Factors on file in the demo

| Category | Factor | Source |
|---|---|---|
| NZ grid electricity 2024 / 2025 | 0.0993596 / 0.0786625 kg CO2-e per kWh | MfE Measuring Emissions Catalogue 2026, Table 5.2 |
| NSW grid electricity 2025 | 0.64 kg CO2-e per kWh | NGA Factors 2025, as used in ASIC's sustainability reporting module 6 |
| Natural gas, stationary commercial | 0.19543 kg per kWh | MfE 2026, fuels |
| Diesel in vehicles / stationary | 2.67177 / 2.6759 kg per litre | MfE 2026, Table 3.3 and fuels |
| Regular petrol | 2.36143 kg per litre | MfE 2026, Table 3.3 |
| LPG, stationary commercial | 2.97164 kg per kg | MfE 2026, fuels |
| Road freight, all trucks | 0.135 kg per tonne-km | MfE 2026, Table 8.11 |
| Container shipping | 0.046 kg per tonne-km | MfE 2026, Table 8.19 |
| Domestic flights / short-haul / long-haul economy | 0.115861 / 0.07435 / 0.06926 kg per passenger-km | MfE 2026, Tables 7.23 and 7.28, no radiative forcing |
| Hotel night NZ / AU | 8.33691 / 29.9039 kg per room-night | MfE 2026, Table 7.31 |
| General waste / food waste to landfill with gas recovery | 0.333843 / 0.971043 kg per kg | MfE 2026, Table 10.3 |
| Composting | 0.1756 kg per kg | MfE 2026, Table 10.6 |

Australian fuel factors are not in the demo. Add them from the current NGA Factors workbook with `/add-factor` before you log Australian fuel.

## What this system does not do

It does not lodge NGER reports, sustainability reports or climate statements, does not provide assurance, and does not buy or retire carbon credits. Scope 2 is location-based; market-based scope 2 (renewable energy certificates and green power contracts) is a customisation.
