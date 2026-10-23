# Sporting Life & Times — Source Ownership Policy

Status: LOCKED editorial and engineering decision (2026-10-22).

## Governing rule
The Sporting Life & Times owns its normalized sports data, reconciliation, historical archive, and independently calculated models. ESPN is an optional, attributed **last-resort fallback**, never the primary source by convenience. A missing logo, fixture, or result does not authorize quietly switching the entire sport to ESPN.

## Source priority
1. Official league, competition, federation, conference, school, and team feeds.
2. Verified specialist sources with sport-specific provenance.
3. Cross-source validation and conflict tracking.
4. ESPN only when approved sources are unavailable, clearly labeled with provider attribution.

## Sport-specific targets
- MLB: MLB Stats API.
- NHL: official NHL API.
- NBA: official NBA data; proprietary NBA Elo is calculated by this project, never substituted from third parties.
- NFL: official NFL and club sources.
- College sports: NCAA, conferences, and school athletics departments.
- Premier League: official competition sources and football-data.co.uk for documented historical/statistical inputs; proprietary USRS stays independent.
- UEFA competitions: UEFA official sources, verified specialist backups.
- EuroLeague: official EuroLeague data.
- Australian NBL: official NBL data.
- Other international leagues: competition-authorized or verified specialist feeds, with explicit provenance.

## Implementation contract
- Each provider adapter emits a common schema with source URL, provider, retrieval timestamp, event ID, teams, status, and field-level provenance where feasible.
- Reconciliation is centralized. Official source takes precedence; conflicts are retained and auditable, not silently overwritten.
- Scoreboard, Match Center, archive, and prediction views consume the same normalized data.
- Do not fabricate missing fixtures, scores, statuses, logos, ranks, or predictions.
- Missing data is explicitly marked as missing; coverage is measured by league and provider.
- Tests enforce schema validity, attribution, source priority, and absence of unapproved provider substitution.
- New source integrations must have documented availability, usage rights, reliability, and fallback behavior.
- Legacy ESPN-first collectors may remain temporarily during migration but are technical debt, not the target architecture. Do not expand ESPN dependence; prioritize replacement by official adapters.

## Change control
Any change to the source hierarchy requires an explicit editorial decision. Convenience, missing logos, or temporary outages are not sufficient justification.
