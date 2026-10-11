---
description: Add a published emission factor (a new edition each year) with the page it came from.
---

Read CLAUDE.md first.

```bash
npm run carbon -- add-factor --category=electricity --region=NZ --year=2026 --value=<kg per unit> --edition="MfE 2027" --table="Table 5.2" --url=<page> --checked=<date>
```

Only from the publisher's page (MfE for New Zealand, the NGA Factors for Australia). Never type a factor from memory.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
