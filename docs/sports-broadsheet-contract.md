# Sporting Life & Times — reusable sports broadsheet contract

The NBA desk is the reference implementation. Roll the same structure into each sport only after the NBA production data and layout checks pass.

## Editorial geometry
- Desktop: 7–8 underlying newspaper columns; lead stories span multiple columns, standings occupy a narrow rail.
- Tablet: 3 columns; phone: 1 column, with compact tables scrollable if needed.
- No oversized score cards, repeated standings, fixed-height blank panels, or wide empty gutters.
- Standings, W–L/PCT (or sport-appropriate equivalents), and last night's verified scores are adjacent in the same rail.
- Preserve team crests and league-specific visual identity. Every score links to its game detail when a valid source identifier exists.

## Shared data contract
- `edition_updated_at` and per-feed `updated_at`, provider, coverage window and health.
- `games[]`: stable ID, date, participants, home/away, status, final score, box-score link.
- `standings[]`: team, wins/losses (or sport equivalents), percentage/points, independent model rating.
- `stories[]`: title, publisher, original link, timestamp, league, team and news topic; no copied article bodies.
- `availability[]`: official injuries or suspensions, publication time, explicit source.
- `transactions[]`: player, team, transaction, date, source, confirmed vs reported.
- `leaders[]`: player/team, metric, value, game or season context, source.
- `predictions[]`: model version, snapshot, inputs, win probability and update time.
- Missing data is marked unavailable; never infer a result, transaction, injury, or player statistic.

## NBA status
- National + 30 team-local news feeds configured; feed success and headline freshness still require production verification.
- Official NBA current-day box-score collector implemented; does not claim full-season archive.
- Injury and transaction news wires show attributed reporting, **not** official injury/transaction records.
- Six provisional division standings and independent current-season Elo exist; full official standings reconciliation remains open.

## Rollout order
NBA → Premier League → MLB → NHL → NFL → college basketball → college football → other desks.
Use one source registry, editorial template, provenance validator, and compact visual tokens. Sport-specific standings, injury semantics, and Elo methods remain separate.
