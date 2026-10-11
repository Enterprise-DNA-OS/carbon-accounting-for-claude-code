---
description: Move a reduction action on: status, due date, saving or notes.
---

Read CLAUDE.md first.

```bash
npm run carbon -- update-action --action="electric vans" --status=underway --due=2026-12-01 --actor="<name>"
```

Statuses: idea, approved, underway, done, dropped.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
