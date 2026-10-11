---
description: Lock a finished year: freeze every line so the figures you report never change.
---

Read CLAUDE.md first.

```bash
npm run carbon -- lock-inventory --inventory=FY2027 --note="Reviewed by <name>" --actor="<name>"
```

Run /lock-check first. Locking is permanent: confirm the totals back and wait for a yes. --override="<reason>" locks with known gaps and records the reason.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
