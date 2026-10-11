---
description: Log a customer asking for your emissions: who, which year, what they asked for, and the deadline.
---

Read CLAUDE.md first.

```bash
npm run carbon -- add-customer-request --customer="Harbour Supermarkets" --inventory=FY2026 --asked="Scope 1, 2 and 3" --due=2026-10-17 --actor="<name>"
```

Copy their exact wording into --asked.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
