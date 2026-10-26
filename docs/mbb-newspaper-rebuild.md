# MBB newspaper rebuild — October 26, 2026

Implemented:
- Shared responsive newspaper design for both MBB entry URLs, conference directory/desks, team desks, bracket watch and player leaders.
- 365 team routes and 32 conference routes driven by the existing registry and ratings. Published Elo formula is unchanged.
- Attributed news with timestamps, current scoreboard with one-minute browser polling and retained snapshot fallback, source status tracking.
- Separate MBB RSS collector (CBS, NCAA, ESPN); 15-minute scheduled collection and explicit Pages deployment after bot commits.
- Roster profiles, 2025–26 player statistics, 5,750-game archive, observed series records with coverage labels, historical Elo sparklines.
- Final box-score collection keyed by event ID, current-season player aggregation, historical/current season selector.
- 76-team provisional NCAA field, 32 projected AQ, 44 at-large, 12 opening games, regional first-round matchups and projected pod venues. Later-round games are unpicked.
- Opening-round paths, bubble, shared venue pods, top-four conference separation checks and BYU no-Sunday placement.
- Standings use actual conference winning percentage and leave unverified ties tied. Projected conference order is labeled separately.
- Rankings, schedule and standings recheck the shared data each minute while a page is visible; news and scores refresh without losing searches or scroll.

Validation:
- Bracket structure and résumé-accounting tests.
- Browser tests at desktop and 390-pixel mobile widths: page rendering, navigation data, team search/paging, conference selector, polls, team opponent comparison, bracket counts, player filters and console errors.
- Collector tests cover replay idempotence, missing news timestamps, and empty scoreboards.

Still required before calling the full original scope complete:
- A validated NCAA-committee selection model using the committee's actual résumé inputs. Current field is explicitly preseason USRS strength; in-season résumé ranking remains experimental.
- Every conference's current tournament field, eligibility, byes, tiebreak rules and official bracket format.
- Complete NCAA postseason eligibility review; campus-mileage allocation, arena usage restrictions, all rematch constraints and regional balance optimization.
- Historical coverage beyond 2025–26 before any series can be labeled all-time.
- Live-game validation after opening night. Current Elo collector remains on its existing 15-minute GitHub schedule; one-minute browser refresh does not guarantee a new Elo snapshot every minute.
- Full current-season player/source completeness reconciliation and complete future schedule coverage.

Sources:
- https://www.ncaa.org/championships/march-madness/selections-101/division-i-mens-basketball-championship/
- https://www.ncaa.org/championships/march-madness/expansion-what-to-know/
- https://www.ncaa.com/mens-final-four/future-info
