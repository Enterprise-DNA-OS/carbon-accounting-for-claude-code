# Why there is no front end

Carbon accounting is a spreadsheet problem that grew a subscription. Underneath Persefoni, Envizi or Watershed sit the same few tables: sites, meters and fuel cards, the quantities off each bill, a list of published emission factors, and the years you report. Tonnes are quantity times factor. What the subscription mostly pays for is the layer that lets people who do not write queries get at those tables: upload screens, charts, a supplier portal and a report builder.

That layer was needed because talking to a database was hard. It is not hard any more. Open this folder in Claude Code, say "what stops us closing FY2027?" or "draft the reply to Harbour Supermarkets", and it runs the query, checks the rules and writes the answer.

## What you gain

- **Answers to your own questions.** "Which three sources are 60% of our footprint?" "Are we on track for the 2030 target on a full-year basis?" "Which supplier is holding up scope 3?" A dashboard shows what the vendor chose to chart.
- **A record that cannot drift.** A locked year is frozen in the database, line by line. The number you sent a customer in June is the number on file in December.
- **Every factor with its source.** Each factor carries the publisher's edition, table and page. No black box between your bill and your tonnes.
- **No revenue bands, no seats.** Persefoni's published prices rise with your revenue. Here the bill does not change when the business grows.
- **Your data in your Postgres.** Plain tables. Back them up, query them from Power BI or a spreadsheet, leave any time.

## What a screen gives that this does not

- **A supplier portal.** Persefoni and others let suppliers log in and type their numbers. Here a supplier replies to an email and someone records the figure. For a handful of suppliers that is quicker; for hundreds it is not.
- **Charts for the board.** `npm run view` renders read-only pages and tables in your brand, not interactive charts.
- **Utility feeds.** Some platforms pull bills straight from energy retailers. Here bills come in by import or by hand, unless Enterprise DNA connects your retailer for you.
- **A mobile app.** It runs where Claude Code runs.

## Who this fits

Businesses that report their own footprint, answer customer questionnaires and want the numbers to be theirs: manufacturers, wholesalers, freight firms and the suppliers of companies that now report under AASB S2. If you manage thousands of meters across a property portfolio and need a supplier portal, keep the platform. If you need correct, defensible numbers more than screens, this is cheaper and yours.

Installed and run for you: https://enterprisedna.co/omni/instead-of/persefoni
