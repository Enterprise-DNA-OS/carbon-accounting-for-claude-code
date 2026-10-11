---
description: Mark a customer request as answered once a person has sent the reply.
---

Read CLAUDE.md first.

```bash
npm run carbon -- answer-customer-request --request="harbour" --actor="<name>"
```

Only after the operator confirms it went.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
