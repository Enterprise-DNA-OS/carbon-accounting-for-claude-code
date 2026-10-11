---
description: Add a reduction action with its site, owner, expected saving a year and due date.
---

Read CLAUDE.md first.

```bash
npm run carbon -- add-action --name="LED lighting" --site="Christchurch plant" --owner="<name>" --status=approved --saving=4 --cost=18000 --due=2027-02-01 --actor="<name>"
```

Saving in tonnes CO2e a year.

Every command takes --json. Dates are YYYY-MM-DD. A name that matches more than one record lists the candidates and stops: ask which one. Never send, publish or delete from this recipe.
