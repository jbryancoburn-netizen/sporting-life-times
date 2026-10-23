# NBA Elo publication operations

## Existing model, not a replacement

The 2025–26 final JSON is frozen permanently. The 2026–27 preseason baseline is a **provisional historical regression** (60% retention); the independently calibrated roster/preseason baseline is **not** available. Never silently substitute the 55% experimental retention discussed in calibration work.

The 2026–27 live-archive calculation reuses the published formula:

- Home expected win probability = `1/(1+10^(-(home_elo + 45 - away_elo)/400))`
- Rating delta for home = `20*(actual-expected)*(1+0.4*log10(1+abs(point_margin)))`
- Away delta = minus home delta.

ESPN is only a score source; **all Elo ratings are calculated independently here**.

## Controlled automation

`.github/workflows/nba-elo-refresh.yml` is scheduled daily at 11:30 UTC and supports manual workflow_dispatch. It first audits, then independently downloads completed ESPN NBA **regular-season** scores starting October 20, 2026, deterministically replays every final from the frozen preseason snapshot, checks that no previously published results disappeared or changed, audits again, and commits only the resulting current provisional JSON if different.

No live/in-progress results, exhibition results, playoffs, fabricated games, or duplicate IDs enter this pipeline. A missing endpoint, bad data, missing previously published result, or Elo mismatch causes an error and **no publication**.

`node scripts/audit-nba-elo.mjs` runs as a separate integrity check when ratings data changes. It checks the archive, 30 franchises, preseason regression, event IDs, scores, sum-zero rating movement, and replay agreement.

Run manually:

```bash
node scripts/audit-nba-elo.mjs
node scripts/update-nba-elo.mjs
node scripts/audit-nba-elo.mjs
```

**Operational limitation:** The refresh schedule and source network access must be verified in GitHub Actions after deployment. The workflow uses GitHub's built-in GITHUB_TOKEN with `contents: write`; repository settings and branch protection can prohibit pushing. Do not claim an automated update until a real run succeeds.

## Still research-grade

This is a working independently calculated **traditional Elo** publication pipeline but not a completed roster-adjusted or independently calibrated prediction engine. The site labels these 2026–27 ratings provisional. Do not publish game-day injury effects, projected scores, or supposedly validated offseason player adjustments without sourced player evidence and independent backtesting.

Archived historical data and model outputs must never be overwritten by a daily update.
