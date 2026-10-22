# Sports Data Acquisition and Arbitration Policy

## One canonical publishing pipeline
Provider adapters -> raw provider observations -> normalized game identity -> arbitration -> conflict quarantine -> approved publication -> analytics/USRS.

Never allow a provider adapter to write directly to a published canonical game record. Preserve provider IDs, source URLs, timestamps, raw result snapshots where terms permit, and per-field provenance.

## Precedence
- MLB official Stats API for MLB, NHL official Web API for NHL.
- NCAA/school official results for college games, only after explicit team-ID mapping and coverage checks.
- ESPN as broad fallback, not as a competing override of official data.
- Advanced analytics (Statcast, MoneyPuck, nflverse) enrich records but must never overwrite authoritative final scores.
- Providers requiring paid or restricted access are not eligible for unattended collection without credentials and permission.

## Canonical IDs
Use provider event IDs as external identifiers, not universal IDs. Match across providers using sport, competition, scheduled local date, normalized team IDs and home/away designation. **Name-only matching is provisional**, and the current engine implements a conservative normalized-name/date identity until a maintained alias registry exists. Avoid automatically merging doubleheaders, tournaments, or two matches between the same teams on one date; require additional event disambiguation.

## Conflicts and publication
When two sources disagree on a final score, quarantine the record and emit a structured conflict report. Do not publish a disputed result until independently reconciled. Keep scheduled and in-progress data separate from final results. Never infer missing game time or score. Never treat a blank schedule as proof there are no games.

## Monitoring
Per provider: HTTP status, data age, request latency, number of events, schema failures, failed fetches, rights clearance, and last successful check. Automatically disable repeated failing providers only after a reviewed threshold. Do not let one provider outage fail the entire publication.

## Operational status
The initial reconciliation engine is implemented in `scripts/reconcile.py`, exercised by `scripts/test_reconcile.py`, and used by `scripts/collect_multisource.py`. Its team/date matching is an initial layer, not a complete production-grade entity-resolution system. The next required improvements are canonical team IDs, sport-specific doubleheader matching, freshness policy, provider health dashboard, and verified end-to-end workflow results.
