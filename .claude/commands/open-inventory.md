---
description: Open a new reporting year.
---

Read CLAUDE.md first.

```bash
npm run carbon -- open-inventory --name=FY2028 --start=2027-04-01 --end=2028-03-31 --actor="<name>"
```

Years cannot overlap.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
