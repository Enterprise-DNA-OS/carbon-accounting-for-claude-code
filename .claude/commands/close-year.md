---
description: Run the year-end close: check, chase or fix with approval, lock, then render the inventory document.
---

Read CLAUDE.md first.

```bash
npm run carbon -- lock-check --inventory=<year>
```

Steps: 1. /lock-check. 2. For missing months, draft the chase list from /data-gaps. 3. For suppliers, /draft-supplier-request or agree an override. 4. Show /footprint and /trend and wait for a yes. 5. /lock-inventory. 6. `npm run docs -- emissions-inventory` and give the file path.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
