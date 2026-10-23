# NBA ELO LOCKED RELEASE CONTRACT — 2026-10-22

## Product distinction

**Official historical archive:** 2025–26 final ratings, all 1,230 regular-season and 85 playoff games, frozen and never rewritten.

**Current operating model:** independent traditional Elo, 2026–27 *provisional* preseason carryover, daily final-score replay. No third-party Elo ratings are ingested. Published current ratings do not yet constitute a validated roster-aware or injury-aware forecast.

**Not approved:** any claim that independently calibrated roster adjustments, preseason signal, player impacts, point-spread or total predictions are complete. A previously explored 55% season retention is a candidate, not an approved replacement for the deployed 60% carryover. Do not silently promote it.

## Locked equations

For home team H and away team A, with their **pre-game** ratings:

```
p(H wins) = 1 / (1 + 10 ^ (-(Elo_H + 45 - Elo_A) / 400))
MOV = 1 + 0.4 * log10(1 + abs(home_score - away_score))
delta = 20 * MOV * ((home_score > away_score ? 1 : 0) - p)
Elo_H' = Elo_H + delta
Elo_A' = Elo_A - delta
```

This is exactly consistent with the existing 14-game ledger to within approximately 0.000001 Elo point per update, prior to output rounding. A model change requires its own historical evaluation and explicit version; never silently change the published historical ratings.

## Publication rules

1. ESPN contributes observed final scores only. The Sporting Life & Times independently calculates every rating.
2. Include only genuine 2026–27 regular-season completed games; reject missing results, duplicates, conflicting records, source failure, or removal/revision of a previously published final.
3. Rebuild from the fixed opening baseline in deterministic game-date order, not incrementally from a potentially corrupted ranking.
4. Recompute every rating in the independent audit before commit. Reject Elo mismatch, team coverage errors and zero-sum violations.
5. Keep website language visibly provisional until validated offseason and roster input coverage exists.
6. GitHub Actions contains a 11:30 UTC daily refresh plus a change-triggered integrity gate. The existence of workflow YAML **does not prove** GitHub Actions has executed successfully.

## Approval gates for expanding scope

A roster-aware release requires dated authoritative roster/team affiliation, actual and forecast minutes, auditable player impact estimates, and time-stamped availability, with coverage/reliability thresholds declared in advance. It also requires chronological out-of-sample evaluation against the independent traditional Elo baseline (log loss, Brier, sample size and uncertainty). No evidence, no promotion.

A game score prediction additionally needs an independently fitted scoring model and backtesting of point errors and distributional calibration; an Elo win chance alone is insufficient.

## Operational check

Run [NBA Elo refresh in GitHub Actions](https://github.com/jbryancoburn-netizen/sporting-life-times/actions/workflows/nba-elo-refresh.yml) and confirm its green completion and its updated game count. GitHub Actions results were not available to the assistant at the time this contract was written. Do not describe the scheduled pipeline as successful until observed.
