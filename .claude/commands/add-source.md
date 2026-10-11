---
description: Add an emission source at a site: a meter, fuel card, freight contract or travel account, with its category.
---

Read CLAUDE.md first.

```bash
npm run carbon -- add-source --name="Depot electricity" --site="Hamilton depot" --category=electricity --supplier=Contact --account="ICP ..." --frequency=monthly --owner="<name>"
```

Run /categories first if unsure which category fits.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
