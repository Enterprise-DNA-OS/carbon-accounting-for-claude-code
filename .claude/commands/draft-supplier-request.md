---
description: Draft the email asking a supplier for their emissions for what they sold you.
---

Read CLAUDE.md first.

```bash
npm run carbon -- draft-supplier-request --supplier="Pacific Cartons" --inventory=FY2027
```

Writes to drafts/. A person sends it.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
