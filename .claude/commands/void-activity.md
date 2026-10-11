---
description: Remove a wrong activity row in an open year, with the reason, so it can be entered again.
---

Read CLAUDE.md first.

```bash
npm run carbon -- void-activity --activity=<id> --reason="<why>" --actor="<name>"
```

Confirm the row back and wait for a yes. Rows in a locked year cannot be removed.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
