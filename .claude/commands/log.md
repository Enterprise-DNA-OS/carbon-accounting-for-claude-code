---
description: Record a bill, fuel card statement, freight report or travel report for a source: the quantity, the period and the evidence.
---

Read CLAUDE.md first.

```bash
npm run carbon -- log --source="Plant electricity" --month=2026-09 --quantity=181500 --evidence="Meridian invoice 88123" --actor="<name>"
```

Use --from and --to for bills that do not run calendar months. An estimate needs --estimated and --method. Read the quantity and unit back before saving, then show the tonnes it produced.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
