# USRS college football: preseason 2025 first (data acquisition contract)
Status: SOURCE IDENTIFICATION COMPLETE; PLAYER-LEVEL DATA NOT YET INGESTED; NO CERTIFIED PRESEASON ELO.

## Order of operations
1. Acquire 2024 player season statistics and end-of-2024 rosters, plus 2025 preseason rosters, 2025 returning production, 2025 recruiting, and transfers through the 2025 preseason cutoff.
2. Match stable player IDs across teams and seasons. Record transfers once at destination; flag duplicates and ambiguous identities.
3. Score each *2025* roster using prior-to-kickoff player production and preseason talent evidence only. Never use a school's previous Elo, historical wins, 2025 game results, or brand as a preseason input.
4. Backtest 2025 preseason predictions against 2025 games, then freeze parameters. For honest out-of-sample tuning, use earlier preseason years for training and reserve 2025 as a holdout.
5. Only after the 2025 preseason rating passes audit, process 2025 completed games in chronological order, once per game ID. Repeat for 2026 using verified summer 2026 rosters.

## Verified source families (coverage, not downloaded records)
- CollegeFootballData API: https://api.collegefootballdata.com/data-availability
  Rosters and player season stats since 2004; returning production since 2014; transfer portal since 2021; team talent since 2015. API key required: https://api.collegefootballdata.com/
- NCAA 2025-26 school-published roster collection (cross-check only; published 2026, not evidence of preseason availability): https://github.com/Dharit13/NCAA_2025-26-Season-Dataset
- Individual school athletics 2025 preseason roster archives for identity and cutoff verification.

## Mandatory safeguards
- Historical season outcomes must not leak into that season's preseason rating.
- Store source URL, retrieval date, snapshot/cutoff date, player ID, team ID, previous team, position, production and missing-data flags for each record.
- Missing player stats are unknown, not zero production; exclude uncertified team ratings from rankings.
- Use out-of-sample calibration to convert roster score to 1500-centered Elo points.
- Freeze and version preseason snapshots; later corrections require an explicit revision.
- No current rankings or playoff predictions should be relabeled USRS until preseason certification.

The existing cfb-roster-model.js implements validation and calibration gates, but does not contain actual player records. This file is an acquisition specification, not a claim that the data was fetched.
