---
description: Draft one reminder per data owner listing the bills and reports missing for the open year.
---

Read CLAUDE.md first.

```bash
npm run carbon -- data-gaps --json
```

Group the gaps by data owner and write one short note each to drafts/chase-<owner>-<date>.md: the source, the months, where to find it (the supplier and account). Never send.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
