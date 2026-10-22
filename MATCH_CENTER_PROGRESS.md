# Match Center — Development Tracker
Updated: 2026-10-22

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
- [ ] 01. Verify published match_details.json and actual per-league data coverage; validate cache behavior with provider failure.
- [ ] 02. Normalize player statistics with column headings and source identity; add schema tests.
- [ ] 03. Build readable basketball player box scores and totals.
- [ ] 04. Improve source efficiency, retries, concurrency, and rate-limit handling.
- [ ] 05. Expand detailed coverage and validate IDs, freshness, and missing data.
- [ ] 06. Persist a durable, searchable completed-game archive beyond the latest snapshot.
- [ ] 07. Finish soccer scorers, assists, cards, substitutions, formations, and timelines.
- [ ] 08. Finish football drives, scoring plays, and individual player statistics.
- [ ] 09. Finish baseball innings, batting, and pitching displays.
- [ ] 10. Finish hockey scoring, goalie, and penalty displays.
- [ ] 11. Complete remaining leagues and sport-specific fallbacks.
- [ ] 12. Add filters, search, date navigation, and permanent game links.
- [ ] 13. Connect verified USRS ratings and model forecasts.
- [ ] 14. Validate forecasts with historical backtesting and calibration.
- [ ] 15. Build the proposed Scenario Lab and evidence-based explanations.
- [ ] 16. Add pregame/postgame editorial analysis and newspaper cross-links.
- [ ] 17. Polish PDF-inspired newspaper styling, logos, and mobile experience.
- [ ] 18. Add source monitoring, fallback diagnostics, and automated regression tests.
- [ ] 19. Run end-to-end acceptance tests for pregame, live, final, and archived games.

## Acceptance standard
The Match Center is not complete until supported sports show verified scores and relevant player/team statistics, update reliably, retain past games, handle provider failures, work on mobile, and distinguish unavailable forecasts from calibrated predictions.

## Operating rule
New feature suggestions enter the appropriate future step; do not interrupt prerequisite work. Update this tracker as code is merged and tested.
