# Sports Data Provider Registry — v1.0

Research date: 2026-10-22. Machine-readable registry: [data/sports-source-registry.json](data/sports-source-registry.json).

## What this registry does
Records 38 candidate sources across baseball, hockey, American football, basketball, soccer, motorsport, and multi-sport feeds. **No source is yet marked as live-verified or cleared for republication.** A public website, open-source wrapper, or free personal API key does not itself authorize bulk redistribution.

## Editorial source hierarchy
1. Official league feeds with verified technical and publishing access.
2. Authorized openly published data downloads with attribution and compatible terms.
3. Unofficial public feeds only when stability and permitted use are reviewed.
4. Scrapers and site-dependent reverse-engineered APIs: research-only until approved.

Store provider, retrieval time, event ID, original URL, and update timestamp on every normalized record. Deduplicate by league, date, home and away team, and official event ID. Never silently resolve conflicting final scores. Show stale/unavailable status rather than inventing results.

## Immediate integrations to test
- **MLB:** MLB Stats API game and box score; Baseball Savant/Statcast for advanced metrics.
- **NHL:** NHL Web API; MoneyPuck for xG with attribution and noncommercial/journalistic-use limitations.
- **NCAA:** NCAA site and open-source ncaa-api, testing Trine DIII specifically.
- **ECHL:** HockeyTech/LeagueStat, testing Fort Wayne Komets.
- **EuroLeague:** competition feeds, testing Bayern.
- **NFL:** nflverse for historical EPA/play and ESPN or another game feed for current scores.
- **Soccer:** football-data.org for available fixtures/standings; StatsBomb Open Data for historical analytics (not live EPL); football-data.co.uk for historical results.
- **NBA:** NBA live CDN endpoint for games; NBA Stats only if access is stable and allowed.
- **Australian NBL:** no dependable free official programmatic endpoint verified; do not claim otherwise.

## Quality gates
Run `python scripts/check_sources.py` for registry schema validation.
Run `python scripts/check_sources.py --probe` to make four conservative HTTP reachability probes and write `data/source-health.json`. Probes are opt-in and do not assert rights or full coverage. Do not publish health reports without a fresh run.

For each integration, record: successful requests over seven days, HTTP status, schema compatibility, latency, last successful retrieval, freshness, sport/division coverage, and written redistribution/attribution terms. Mark `verified_live` only after testing in GitHub Actions. Mark `rights_cleared` only after reviewing the applicable provider terms.

## Primary research references
- SportsDataverse sources: https://js.sportsdataverse.org/docs/sources
- SportsDataverse Python: https://sportsdataverse-py.sportsdataverse.org/docs/intro
- MLB Statcast: https://baseballsavant.mlb.com/
- MoneyPuck usage terms: https://moneypuck.com/data.htm
- StatsBomb Open Data and attribution: https://github.com/statsbomb/open-data
- nflverse datasets: https://github.com/nflverse/nflverse-data
- NCAA API wrapper: https://github.com/henrygd/ncaa-api
- football-data.org: https://www.football-data.org/
