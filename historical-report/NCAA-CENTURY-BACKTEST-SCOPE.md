# NCAA MEN'S BASKETBALL HISTORICAL BENCHMARK — EXTENDED SCOPE

**Scope decision:** Acquire and audit completed men's basketball results as far back as credible sources support, potentially the 1890s. The early 1900s are explicitly in scope.

**Two distinct measurements must never be conflated:**
1. **Game-result Elo backtest:** season-by-season score, opponent, team and date, as complete as the source permits. Test the update algorithm on common fixtures, report source coverage, historical rule changes, team identity and missing/non-DI games.
2. **Full player-enhanced head-to-head:** incumbent and expanded player-stat/roster/transfer challenger on precisely the same games. Require pre-opening rosters, usable individual historical box statistics and source timestamps; otherwise mark ineligible. **It is invalid to use the full roster model's modern inputs for a year where those inputs did not exist.**

**Public source leads (verify license, rate limits, record completeness and NCAA team identity before ingestion):**
- Sports Reference season index covers men back to 1892–93; per-school game result coverage differs: https://www.sports-reference.com/cbb/seasons/
- Sports Reference describes major-school results back to 1949–50, individual box scores from 2010–11: https://www.sports-reference.com/
- NCAA-hosted historical BigQuery dataset describes some team W-L records from 1894–95; scored finals back to 1996; game boxes from 2009. Its listed reuse restrictions require separate review: https://www.kaggle.com/ncaa/ncaa-basketball
- CollegeBasketballData documentation: games from 1949, player boxes mainly 2005 forward; coverage sparse at the earliest dates: https://api.collegebasketballdata.com/data-availability
- March Madness official competition files provide modern historical scores, not an early-1900s complete regular-season slate.

**Non-negotiable acceptance gates:** immutable source/season provenance; unique team identity (including renamed programs); exact date/order; deduplicated contests; complete season-level coverage reports; opponent and score validation; training/test chronological separation; pairwise-identical-game counts and calibration; statistically uncertain results reported separately; no automatic model promotion from retrospective roster snapshots.

**Operational note:** Current repo verified full-game and roster research spans 2023–26. Do not claim earlier backtests have been run until datasets are ingested, reconciled, and results published. `scripts/audit_ncaam_century_backtest_coverage.py` checks future acquisition manifests. Require manifest columns `season,verified_games,verified_teams,verified_player_box_games,verified_preopening_roster_teams,source,verification`.

**Priority:** First recover 1996–2022 scores and validated identities; then progressively backfill 1949–95 and pre-1949, prioritizing source completeness and licensing over oldest advertised season.
