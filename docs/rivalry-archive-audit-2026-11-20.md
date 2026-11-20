# Basketball rivalry archive audit — 2026-11-20

## Men's Division I
- Rivalry registry: 130 men's pairings (145 unique pairings across men/women).
- Every registered pairing has a named series, source URL, and dedicated deeplink into `ncaam-rivalry.html`.
- Men's Rivalry Archive displays available dated meetings, archives, first/most recent/closest/largest-margin and latest NCAA Tournament game from the recorded dataset.
- Existing men's history blends the NCAA historical file, early college results where available, selected pre-1985 extensions and 2026–27 finals. These are **documented-series totals**, NOT universally verified all-time records.
- Main source: https://github.com/zachmayer/kaggleNCAA (1985–2019 historical games); additional datasets are documented on the history page.
- Major rivalry nicknames in the registry are sourced; generic pairings retain neutral school-versus-school names rather than invented titles.

## Women's Division I
- Dedicated women-only history engine and independent game data. Men's results are no longer substituted.
- All **66 registered women's rivalry pairs** map to both schools in the Kaggle team directory.
- Site-local archive: `data/rivalries/womens-registered-series-1998-2026.json`.
- **3,132 results** (3,109 season games and 23 NCAA Tournament games), all within registered pairings; **66/66** pairings have games.
- All records have both team identities, season and scores, with 0 invalid or duplicate game records.
- Regular/conference tournament result seasons: 1998–2026 (1997–98 through 2025–26); NCAA Tournament results in the imported dataset: 1998–2025.
- Women's archive includes per-pair records within coverage, streaks, last ten, biggest victories, decade summaries, notable documented games, NCAA Tournament chapters and chronological games.
- Source: https://github.com/ryanbiancavilla/march-ml-mania-2026 (Kaggle NCAA women's datasets). Season 2026 means 2025–26.

## Known limits / acceptance
1. Neither men's nor women's historical counts should be labeled *all-time* without verified pre-dataset history. Both are explicitly documented-archive counts.
2. Women's 2026 NCAA Tournament results and current 2026–27 finals are not in this women-local archive and require verified subsequent ingestion.
3. Many matchups still lack an independently researched, sourced editorial narrative of legendary plays or off-court origins; documented game milestones are derived without invented claims.
4. Men's 2026–27 live feed, browser rendering, cache delivery, and published GitHub Pages cannot be declared verified using repository syntax and dataset checks alone.
5. No production 24-hour endurance test was performed during this change.

## Offline checks
- Men's and women's history JS parse successfully.
- Women's data: 66 series, 3,132 games, no duplicate or invalid game scores/identities.
- Women's identity mapping: 66 of 66.
- Rivalry links retained on the men's and women's ledger; source links retained on the archive.

This report distinguishes repository changes and data validation from actual public-site verification.
