---
description: Record that you asked a supplier for their emissions for a year, with spend and a due date.
---

Read CLAUDE.md first.

```bash
npm run carbon -- request-supplier --supplier="Pacific Cartons" --inventory=FY2027 --spend=240000 --due=2026-11-30 --actor="<name>"
```

Then /draft-supplier-request for the email.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
