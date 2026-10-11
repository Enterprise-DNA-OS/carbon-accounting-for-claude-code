---
description: Add a site with its entity, grid region (NZ or AU-<state>), kind and data owner.
---

Read CLAUDE.md first.

```bash
npm run carbon -- add-site --name="Hamilton depot" --entity="Kererū Foods Ltd" --region=NZ --kind=depot --owner="<name>" --opened=2026-11-01
```

A site opened after the base year triggers the base year check in /compliance.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
