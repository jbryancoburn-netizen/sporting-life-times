# Men's NCAA Division I Elo — v1 implementation

Implemented 2026-10-22 in `scripts/ncaam_elo.py`. This is an independent **Sporting Life & Times** model, not an import of NET, KenPom, Bart Torvik, ESPN, or another Elo product.

## Release gate: NOT YET LIVE

The calculation engine and test workflow exist. No genuine current rankings should appear on the newspaper until these release conditions pass:

1. Create a canonical complete, verified season-specific Division I men's team ID/alias registry.
2. Ingest all 2025–26 (and preferably earlier) official finals including conference and postseason games, with original provider URLs; exclude exhibitions, non-DI opponents from this all-DI-only first model and disclose coverage.
3. Detect repeated game IDs across feeds; reconcile discrepant score or venue values without silently choosing a source.
4. Obtain full 2026–27 scheduled fixtures and updates from official NCAA/conference/school sources. The existing `collect_college_schedules.py` is a **partial mixed-sport collector**, not a complete D1 basketball adapter.
5. Backtest model parameters on out-of-sample seasons (log loss, Brier score, calibration, spread MAE), tune home advantage and K, margin adjustment and offseason retention only on training windows. Initial parameter values below are engineering defaults, not calibrated claims.
6. Wire daily official-data ingest and idempotent recomputation from source game ledger. Update rankings only after verifying final scores. Validate outputs before publishing.
7. Connect the computed JSON to the newspaper's rankings, game cards, scoreboard, and predictions, with the provider timestamps, team branding and provenance displayed.

## Inputs

Example CLI (paths must point to **real verified files**; no placeholder CSV is included):

```bash
python scripts/ncaam_elo.py \
  --teams data/ncaam-d1-teams-2025-26.json \
  --games data/ncaam-d1-finals-2025-26.csv \
  --season 2025-26 \
  --output data/ncaam-d1-elo-2025-26.json
python scripts/ncaam_elo.py \
  --teams data/ncaam-d1-teams-2026-27.json \
  --games data/ncaam-d1-finals-2026-27.csv \
  --previous data/ncaam-d1-elo-2025-26.json \
  --season 2026-27 \
  --output data/ncaam-d1-elo-2026-27.json
```

CSV required fields: `game_id,date,home_id,away_id,home_score,away_score,site,status,source_url,provider`. Optional `overtime`. Date uses YYYY-MM-DD. Home/away IDs refer to the same canonical team ID registry. `site=neutral` removes home advantage. For true road-hosted games place the physical host in `home_id`. A nonfinal game is ignored. Unknown teams, duplicate IDs, ambiguous venue and unattested finals block computation.

Team JSON: `{"teams":[{"id":"<stable-id>","name":"<name>","division":"D1","conference":"<conference>"}]}`.

### Current provisional computation (to be calibrated)

- Base Elo = 1500.
- Home advantage = +65 Elo points, neutral = 0.
- Expected home win probability = `1 / (1 + 10 ** (-(home_rating + venue_advantage - away_rating) / 400))`.
- Rating update = `K * [1 + MOV_coefficient * log10(1 + abs(margin))] * (actual_home_win - expected_home_win)`.
- K = 24, margin coefficient = 0.55; multiply K by 0.85 for labeled overtime games.
- Away team always gains the precise negative of the home change; zero-sum within a season.
- Offseason carryover = `1500 + 0.65 * (last_season_elo - 1500)`.
- Predictive point margin = Elo difference including venue divided by 25, **uncalibrated**. No invented injury/roster adjustment.
- Ordered ledger makes ratings auditable. Scores are applied **after the final**, never during the game; live estimated win probability must be a separate real-time model.

Do not display synthetic test scores as actual games. No schedule or team scores should be inferred from NCAA final standings alone.

## Caveats

A zero-sum update does not itself guarantee a quality forecast. An arbitrary 1500 rating for every school without multiple historical seasons will cause early-season distortion, especially across conferences. Across-year registry changes (new D1 teams) currently fail closed until an explicit, documented ID migration procedure is introduced. The full-team feed and temporal validation must be completed before promoting the model to production.

Source policy: [SOURCE_POLICY.md](../SOURCE_POLICY.md). Test: `python -m unittest discover -s scripts -p test_ncaam_elo.py -v`.
