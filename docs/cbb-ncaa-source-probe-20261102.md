# CourtCast NCAA vs ESPN — measured real-game pilot

**Date of games:** November 2, 2026 (ET). **Sampled:** 2026-11-03T03:41:49.283+00:00 through 2026-11-03T03:43:25.195+00:00 UTC, about 96 seconds.  
**Scope:** 4 matched NCAA Division I games (3 men's, 1 women's); four observations. Source-backed team IDs, both official NCAA and ESPN event IDs; no fuzzy joins.
**Status:** Research only. ESPN remains primary. NCAA play logs have NOT been promoted to automatic in-game display.

## Real coverage

| Matchup | NCAA game ID | ESPN event ID | NCAA plays, first→last | ESPN plays, first→last |
|---|---|---|---:|---:|
| UT Martin @ Tulane (men) | 6653942 | 401919001 | 574→583 | 559→570 |
| Nevada @ LMU (CA) (women) | 6648906 | 401917682 | 219→232 | 204→216 |
| Alcorn @ Ole Miss (men) | 6652236 | 401925683 | 594→601 | 552→560 |
| Florida St. @ Florida A&M (men) | 6652251 | 401909694 | 338→347 | 334→340 |

- **All 4 of 4 games:** Both NCAA and ESPN returned text-bearing play-by-play arrays.
- **HTTP:** NCAA 16 of 16 successful; ESPN 16 of 16 successful. Failures: none in this short window.
- **HTTP response time (not game-event publication delay):** NCAA median 1531 ms (range 615–2183 ms); ESPN median 117.5 ms (range 90–188 ms). This measures how quickly the APIs answered the GitHub runner, not the time between a play and publication.
- NCAA play counts were static in observations 1, 2 and 3, then grew in observation 4. ESPN counts grew at every observation. The NCAA API project documents a ~45-second game-route cache.
- **Event cross-source matching:** zero exact fingerprint matches after period, clock, and text; providers' text formats differ, so exact matching is too strict. We cannot calculate credible on-court-to-provider lag from this run.
- In the final sample, NCAA's latest listed game-clock event for UT Martin–Tulane was 3:25 in 2OT versus ESPN's latest listed play at 3:48; Florida State–Florida A&M was 14:04 versus 14:31 (2nd half). For Nevada–LMU it was 2:05 versus 2:06 (2nd); for Alcorn–Ole Miss both had 1:29. These are **play log positions**, not verified absolute timestamps; do not describe the differences as actual latency measurements.

## Decision

**Continue a limited NCAA supplement, not an automatic live-source replacement.** NCAA supplied complete usable play logs for the four sampled games, with no HTTP errors, and appeared to include later game events in some snapshots. However, a single short sample does not establish season-wide reliability or an authoritative event-arrival latency. Keep the primary live scores/status sourced from ESPN and official-final crosschecks; show NCAA as an attributed alternate timeline only where game identities are matched. Before automatic promotion, use normalized player/event/period/clock matching and multiple game nights, including outage reporting, scorer-level discrepancies, and time coverage. Missing sources must never generate fabricated plays or stats.

Source service: https://ncaa-api.henrygd.me/openapi (community NCAA.com relay; subject to public rate limits and availability). Existing service: https://site.api.espn.com/apis/site/v2/sports/basketball/.  
Frozen machine-readable first run: `data/cbb-ncaa-source-audit-20261102-first-run.json`. Latest re-run (if present): `data/cbb-ncaa-source-audit.json`. Collection code: `scripts/probe_cbb_ncaa_pbp.py`. One-off manual workflow: `.github/workflows/cbb-ncaa-source-probe.yml`.
