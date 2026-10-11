---
description: Record a supplier's reply: the tonnes CO2e they allocated to you and how they worked it out.
---

Read CLAUDE.md first.

```bash
npm run carbon -- record-supplier --supplier="Southern Proteins" --inventory=FY2027 --tco2e=820 --basis="Supplier-specific, per kg supplied" --actor="<name>"
```

Read the basis back. A figure with no method is not good enough for scope 3: ask.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
