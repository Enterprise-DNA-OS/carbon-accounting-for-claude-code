---
description: Draft the reply to a customer's emissions request from the year's figures: scopes, categories, intensity and method.
---

Read CLAUDE.md first.

```bash
npm run carbon -- draft-customer-response --request="harbour"
```

Writes to drafts/. If the year is open, say the figures are provisional. `npm run docs -- customer-emissions-statement` renders the branded version.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
