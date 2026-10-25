# NCAA Men's Basketball Elo — evidence-gated development checklist

Updated: 2026-10-24. Check items only with passing evidence. No automatic production promotion.

## Player identification and roster accuracy
- [ ] P01 Verify persistent athlete IDs across seasons. Historical player_id stability unproven.
- [ ] P02 Resolve ambiguous historical player identities without guessing.
- [ ] P03 Classify unmatched players as freshmen, transfers, redshirts or unresolved using evidence.
- [x] P04 Recover older playing histories and test predictive value. Evidence: workflows 40149553813 and 40149975701.
- [ ] P05 Verify complete 2026–27 rosters, additions, departures, and returners.
- [ ] P06 Verify historical roster snapshots were available at prediction time.

## Player-stat model
- [x] M01 Optimize shooting/playmaking/defense numerically. Evidence: 40145308508.
- [x] M02 Audit large rating adjustments against historical results. Evidence: 40145623260 and 40146343475.
- [x] M03 Test coverage-related shrinkage (rejected). Evidence: 40147940945.
- [x] M04 Backtest recovered two-year-old statistics. Evidence: 40149975701.
- [ ] M05 Incorporate verified older histories into production model.
- [ ] M06 Verify missing rebound/three-point source fields.
- [ ] M07 Refit and test coefficient robustness after player corrections.

## Historical validation
- [x] V01 Real-game chronological backtests. Evidence: 40149975701.
- [ ] V02 Test genuinely untouched future season.
- [ ] V03 Certify as-of historical data to prevent leakage.
- [ ] V04 Validate opponent strength and venue/home-court treatment.
- [ ] V05 Recalibrate combined model after identity corrections.
- [ ] V06 Produce reproducible uncertainty/no-leakage report.

## 2026–27 production
- [x] R01 Create provisional 365-program independent preseason baseline.
- [ ] R02 Apply verified arrivals, departures and returners.
- [ ] R03 Audit every team's preseason Elo.
- [ ] R04 Verify exactly-once final-score update.
- [ ] R05 Reconcile official standings and results.
- [ ] R06 Verify newspaper page freshness and model predictions.
- [ ] R07 Production sign-off.

## Evidence / limitations
- 2024: 5,669 historical roster entries, 2025: 5,794, 2026: 5,633 accounted for (workflow 40148531899).
- Searching two prior seasons recovered 282 older histories each in 2025 and 2026. Unmatched historical college participation after search: 2,167 (2025), 2,206 (2026), including possible genuine freshmen (workflow 40149553813).
- Retrospective roster archives do not establish pre-opening availability.
- The published Elo has not been replaced by the research player coefficients.

## Next priority
P01/P02: examine availability, consistency, collisions and cross-season agreement of source athlete IDs and create a machine-readable identity-exceptions report. Do not certify IDs merely because a column exists.
