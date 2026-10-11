---
description: Bring activity data across from a Persefoni Footprint Ledger export, with a row-by-row check against Persefoni's own totals.
---

Read CLAUDE.md first.

```bash
npm run carbon -- import persefoni --file=imports/ledger.csv --actor="Migration" --dry-run
```

Always run with --dry-run first and show the report, including the reconcile table. Then run without it on a yes. Read docs/replace-persefoni.md. Use --mapping=<file.json> for different headings or categories, and --dates=mdy for month-first dates.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
