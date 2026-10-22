# Match Center — Development Tracker
Updated: 2026-10-22 — batch 9

Status legend: DONE = implemented and publishing workflow passed; IN PROGRESS = implemented but needs validation or further work; TODO = not implemented. A passing build does not establish real-data completeness.

## Completed foundations
- [x] Dedicated Match Center page and navigation (aa65da86, a366ba94).
- [x] Game selection and deep-linking from The Scoreboard (eec044f7, ca44afcf).
- [x] Match detail collector and scheduled publishing integration (807c4cf2, 7e4c02c5).
- [x] Timeline and team statistics display (fdb63ddf).
- [x] League-level data coverage diagnostics (4c63ab38, c4364a85).
- [x] Sport-aware statistics ordering and timeline labels (3cf14ca8, 49cf1072).
- [x] Period-score collection and display (6f3bbb50, 873dd9a5).
- [x] Soccer summary and team-to-team comparison (3a4f7b0e, 65180a0c).
- [x] Initial player row collection (1b969b7b).
- [x] Prior-match cache and completed-game reuse (f219f303, 2fc743b3).
- [x] Latest published workflow passed at commit 1b969b7b (GitHub Actions run 39829150819).

## Remaining steps — do these in order
- [ ] 01. Verify published match_details.json and actual per-league data coverage; validate cache behavior with provider failure. IMPLEMENTED: coverage invariant fix (f14e211b); source-failure simulation pending; expanded health reporting (3a7a8b4d).
- [ ] 02. Normalize player statistics with column headings and source identity; add schema tests. IMPLEMENTED: heading/category capture (1f44de43), schema checks (a42fcb78); awaiting deployment validation.
- [ ] 03. Build readable basketball player box scores and totals. IMPLEMENTED: player tables (660542c8); source-reported team totals added (75a2fed7, 43ab248e), deployment validation pending; category-aware player tables (b7c9b7d1), overtime labels corrected (4093f29f).
- [ ] 04. Improve source efficiency, retries, concurrency, and rate-limit handling. IMPLEMENTED: bounded transient HTTP retry/backoff (70a67342); bounded concurrency implemented (54bad143); measured rate-limit behavior pending.
- [ ] 05. Expand detailed coverage and validate IDs, freshness, and missing data. IMPLEMENTED: increase from 4 to 12 prioritized games per league (54bad143); deployment and data quality verification pending.
- [ ] 06. Persist a durable, searchable completed-game archive beyond the latest snapshot. IN PROGRESS: archive fallback reader (0fe4fce7), snapshot writer (00fb869e), Actions cache restore/save (d7030540), game metadata (55402603), archived game picker (585e4991). Still limited to 1500 records and cache retention; end-to-end persistence testing pending.
- [ ] 07. Finish soccer scorers, assists, cards, substitutions, formations, and timelines.
- [ ] 08. Finish football drives, scoring plays, and individual player statistics. IN PROGRESS: source-reported player tables added (a6b1fc10); drives and full scoring chronology pending.
- [ ] 09. Finish baseball innings, batting, and pitching displays. IN PROGRESS: source-reported categorized player tables (a6b1fc10); inning and specialized layouts pending.
- [ ] 10. Finish hockey scoring, goalie, and penalty displays. IN PROGRESS: source-reported categorized player tables (a6b1fc10); goalie/penalty layouts pending.
- [ ] 11. Complete remaining leagues and sport-specific fallbacks.
- [ ] 12. Add filters, search, date navigation, and permanent game links. IMPLEMENTED: team/league/game text search and live/upcoming/final/archive filters (f070d42d, f3725cc9); direct links existed previously; date picker and clear filters added (2bc43f80, 1cc33f33); deployment validation pending.
- [ ] 13. Connect verified USRS ratings and model forecasts.
- [ ] 14. Validate forecasts with historical backtesting and calibration.
- [ ] 15. Build the proposed Scenario Lab and evidence-based explanations.
- [ ] 16. Add pregame/postgame editorial analysis and newspaper cross-links.
- [ ] 17. Polish PDF-inspired newspaper styling, logos, and mobile experience.
- [ ] 18. Add source monitoring, fallback diagnostics, and automated regression tests.
- [ ] 19. Run end-to-end acceptance tests for pregame, live, final, and archived games.

## Batch 9 notes
- 1da8c169: multisport player tables and date-filter frontend passed publishing workflow run 39831182376.
- 1f419b7f: backfill navigable game metadata for completed cached games, including final score updates.
- 0d76a4f5: normalize game ID matching for historical deep links.
- b462d79d: add archive navigation coverage diagnostics.
- Latest batch awaiting deployment validation; durable archive remains in progress.

## Batch 8 notes
- 2bc43f80 / 1cc33f33: date filter, reset controls and corrected archive-only filter.
- a6b1fc10: generic source-backed player statistics tables for non-basketball sports.
- 1da8c169: updated frontend asset version for cache invalidation.
- Archive deployment remained queued at start of batch; historical persistence across separate runs unverified.

## Batch 7 notes
- f070d42d / f3725cc9: game search and state filters in Match Center.
- 85822c48: coverage denominator accounts for previously cached finished games.
- Batch 6 archive workflow was still pending at last check; archive persistence is not yet verified.

## Batch 6 notes
- Implemented an archive snapshot written during collection and restored/saved between scheduled GitHub Actions runs.
- Archived games with preserved metadata now appear in Match Center selection.
- Added archived metadata validation (b87165df).
- GitHub Actions cache is best-effort and retention-limited, not a durable database; archive step remains open.
- Deployment verification for batch 6 pending.

## Batch 5 notes
- 41342fdd: latest expanded-coverage batch completed successfully in GitHub Actions run 39830242910.
- 75a2fed7: collect team totals only when the summary provider supplies them.
- 43ab248e: display verified team totals under player box scores.
- bd08120f: validate team total row shapes.
- Source-reported totals are not guaranteed to exist for all games; coverage requires checking published snapshots.

## Batch 4 notes
- 54bad143: concurrent collector with five workers and twelve prioritized games per league.
- b7c9b7d1: category-separated basketball box score tables; do not fabricate team totals.
- e964f44a: stronger schema and coverage invariants.
- Workflow verification pending. No remaining checklist item is closed based solely on implementation.

## Recent batch notes
- 70a67342: bounded retries for temporary source failures and safer player team attribution.
- 4093f29f: correct overtime period headers and prevent EuroLeague from being classified as soccer.
- 3a7a8b4d: publication health report now includes player, event, and team statistics coverage.
- Latest workflow was queued at time of this tracker update; these changes are not yet deployment-verified.

## Acceptance standard
The Match Center is not complete until supported sports show verified scores and relevant player/team statistics, update reliably, retain past games, handle provider failures, work on mobile, and distinguish unavailable forecasts from calibrated predictions.

## Operating rule
New feature suggestions enter the appropriate future step; do not interrupt prerequisite work. Update this tracker as code is merged and tested.
