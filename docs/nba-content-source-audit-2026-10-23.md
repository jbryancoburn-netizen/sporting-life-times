# NBA news and statistics source audit · October 23, 2026

## Existing pipeline
- `feeds.json`: Before this audit, 51 registered feeds, including three dedicated national NBA feeds (CBS Sports, ESPN, Yahoo), 30 team-local Google News search feeds, plus broader multisport and basketball sources.
- The 30 local wires are **search aggregations**, not 30 direct beat-reporter or team-media integrations. Stories must retain their original publisher and linked URL.
- `articles.json` powers NBA news, front-page news and injury/transaction reporting. Independent publishers' articles are **linked and attributed**, not reproduced.
- `scripts/collect_nba_game_center.py` is the official NBA CDN scoreboard + game box-score collector, updating `data/nba-game-center.json`. It collects current scoreboard dates and preserves captured prior games. This is **not a guaranteed full-season history**.
- At audit time the `data/nba-game-center.json` file was absent from the default branch. A workflow exists, but successful publication has **not been established**. Until present, the box-score panel should show an explicit unavailable state with official NBA links.
- `data/nba-2026-27-current-provisional.json` is the independent NBA Elo ledger; it cannot provide individual player box scores.

## News source expansion
Added the following specialist NBA feeds to `feeds.json`:
- Hoops Rumors: `https://www.hoopsrumors.com/feed` — sourced transactions, contracts, salary moves; verify individual claims before writing original reporting.
- RealGM wiretap: `https://basketball.realgm.com/rss/wiretap/15/0.xml` — actively updated NBA wire; verify links and avoid treating rumors as settled facts.
- HoopsHype NBA rumors: `https://feeds.hoopshype.com/xml/rumors.xml` — transaction and personnel reporting.
- ClutchPoints NBA: `https://clutchpoints.com/nba/feed` — broader player and team coverage.

All additions remain **candidate feeds** pending a collector-run result showing successful HTTP, valid RSS, current dated items and original-article destinations. A listed feed is not automatically a working or endorsed source.

## Recommended additional desks to evaluate next
- National: The Athletic NBA (already registered as broader Basketball), Associated Press NBA, NBA.com official news, NBC Sports NBA, CBS, Yahoo, Sports Illustrated, SLAM.
- Specialist: RealGM, Hoops Rumors, HoopsHype, TrueHoop, Dunc'd On.
- Each team: direct local newspaper / radio / official club news feeds where available, replacing reliance on Google News search with verified beat sources.
- Official statistics: NBA LiveData boxscores and scheduled game feeds; NBA.com Stats traditional and advanced leaders. Preserve original NBA URLs and label snapshot freshness.
- Injury reporting: official NBA injury reports; transaction confirmation from NBA and club releases.

## Quality checks
1. Track per-feed success, HTTP code, items found, newest published item, unique publishers and 24-hour story counts.
2. Reject duplicates after canonicalizing links and comparing decoded titles.
3. Decode HTML entities, normalize Eastern-time publication display and suppress boilerplate before publishing.
4. Use one or two team crests when a story explicitly names those clubs; otherwise use the NBA league mark. Do not guess team association from a player name alone.
5. Never label rankings from captured incomplete boxscores as full-league NBA leaders.
6. Ensure the official NBA file actually exists on GitHub Pages before claiming that embedded player stats are operational.
7. Confirm permissible RSS/feed use and attribution for every new source; avoid redistributing paywalled full text.

## Operational follow-ups
- Verify the official game-center scheduled workflow successfully commits `data/nba-game-center.json` and its boxscore player coverage; catch/report official endpoint failures.
- Establish official daily/season-to-date leaders once the captured coverage is complete.
- Verify added specialist feeds are live and resolve to valid source stories.
