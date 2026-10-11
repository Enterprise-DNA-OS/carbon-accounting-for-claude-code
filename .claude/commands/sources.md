---
description: List every emission source (meters, fuel cards, freight contracts, travel accounts) with its scope, supplier and how far its data runs.
---

Read CLAUDE.md first.

```bash
npm run carbon -- sources
```

Group by site. Flag any source whose data stops more than two months ago.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
