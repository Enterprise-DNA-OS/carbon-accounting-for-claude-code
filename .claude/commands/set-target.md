---
description: Set or change a reduction target: scopes, base year, target year end and percentage.
---

Read CLAUDE.md first.

```bash
npm run carbon -- set-target --name="Scope 1 and 2 down 42% by FY2030" --scopes=1+2 --base=FY2025 --year-end=2030-03-31 --pct=42 --actor="<name>"
```

Setting a target makes its base year the base year. Confirm the numbers back before running.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
