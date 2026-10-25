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

## Reconciled identity evidence (2026-10-24)
- 365 programs, 5,537 roster players, 3,523 candidate crosswalk links, 2,014 unlinked current ESPN player IDs.
- 2,923 accepted prior-stat histories; targeted triage: 587 without prior D-I game box, 7 confirmed prior-school conflicts, 6 fuzzy exclusions. Source: data/ncaam-2026-27-player-identity-triage.json.
- The separate coverage report lists 594 broad prior-school-conflict classifications; these are NOT 594 confirmed errors. Do not conflate broad coverage with the seven confirmed conflicts.
- Institutional biographical evidence resolves 34 ambiguous names at a school-history level, but is not automatic validation of cross-provider numeric athlete IDs.
- Retrospective model improvements do not establish a valid as-of-preseason holdout. Keep the provisionally published Elo unchanged.

## Next priority
1. P01/P02: Produce reproducible cross-season athlete-ID collisions, migration, and evidence exception reports. Never infer identity solely from similar names or numeric IDs in different providers.
2. P05/R02: Resolve high-impact unlinked arrivals, departures and prior-school conflicts with dated source evidence.
3. P06/V03: Obtain archived, date-stamped preseason roster snapshots for historical train and holdout seasons.
4. M07/V04/V05: Refit coefficients and compare on identical, leakage-controlled games with venue treatment and both log loss/Brier.
5. R04-R07: Test live final-score exactly-once handling, official reconciliation, deployed page freshness, then record approval.

## Latest verified origin milestone (2026-10-24)
- 34 school-athletics-supported origin labels (16 returners, 14 transfers, 4 new-to-D-I) are now separately published in `data/ncaam-2026-27-official-player-origin-overlay.json`.
- CI independently reconciles each label and current roster athlete ID/name/team with official evidence; it also blocks use of these records as unauthorized 2025-26 NCAA box-stat joins. Evidence: workflow run 40156483759 (PASS).
- Scope: this certifies the **34 documented origin labels within the recorded source snapshot**, not the full 5,537-player origin classification and not cross-provider historical numeric ID equivalence. P03/P05 remain open.
- The existing 365-team preseason Elo ratings were not modified; roster validation and time-correct predictive holdout remain release blockers.

## Corroborated player integration finding (2026-10-24)
- Independently compared all 30 source-correlated NCAA 2025-26 athlete history links with the 2026-27 direct crosswalk: **30/30 already linked to the same NCAA historical player IDs**; 0 new identity links or historical minutes eligible from this set. Evidence: `data/ncaam-2026-27-corroborated-player-overlap-audit.json`.
- Added automated duplicate-input guard `scripts/test_ncaam_corroborated_player_overlap.py` and `.github/workflows/ncaam-corroborated-player-overlap.yml`.
- Do not claim a new backtest improvement from an unchanged candidate. The primary preseason Elo and release gate remain unchanged; seek **new** validated player histories and time-stamped preseason rosters for substantive model improvement.

## 2,014-unlinked-player recovery audit (2026-10-24)
- All 2,014 existing unlinked ESPN roster IDs accounted for in `data/ncaam-2026-27-unlinked-2014-recovery-queue.json`: 1,984 no recorded previous D-I box, 26 unverified unique-name transfer candidates and four ambiguous-name cases. Four already have independently documented new-to-D-I origins; four have prior-school biographical/box correlations, still not production ID bridges. Test workflow 40156772501 passed.
- Direct official athletics review identified three **false D-I transfer candidates**, now recorded in `data/ncaam-2026-27-unlinked-official-corrections-batch-01.json`: Kansas freshman Trent Perry; Southern Utah freshman DJ Smith; Citadel transfer Marcus Banks from D-II Shepherd. Reject assignment of unrelated D-I historical minutes; these candidates were already unlinked and therefore no live Elo was altered.
- Remaining unreviewed high-priority name-only transfer candidates: 23. Separate immutable original candidate names from official-source corrections; do not infer the remaining 1,984 are all freshmen.

## 26-name-candidate investigation (2026-10-24)
- Reviewed all **26** unlinked player records labeled possible transfers by name: **21 false matches for the proposed 2025-26 D-I box**, **4 source-correlated genuine prior D-I histories**, and **1 source school unresolved (Kenyon Giles, UMass Lowell)**. These are audit categories, not automatic permissions to add 2025-26 player minutes.
- New 16-case evidence: `data/ncaam-2026-27-unlinked-transfer-final-16-review.json`; earlier ten cases: `data/ncaam-2026-27-unlinked-official-corrections-batch-01.json`.
- Additional important distinction: Josiah Sanders and Isaiah Griffin have older college histories; classification as a false *2025-26 D-I name match* does not mean they never played Division I.
- A complete 26-case identity regression test and workflow now exist. Keep P01/P03 and full production certification open until verified cross-provider identity and as-of roster checks. Zero Elo changes made.

## Identity collision evidence — Kenyon Giles (2026-10-24)
- UMass Lowell lists junior Kenyon Giles from Cleveland, Ohio; Wichita State lists a fifth-year Kenyon Giles from Chesapeake, Virginia. These are incompatible profiles for an automatic same-name historical join. See `data/ncaam-2026-27-kenyon-giles-identity-collision.json`.
- Reject the proposed Wichita State approximately 1,300-minute statistical link for the UMass Lowell athlete. Do not treat secondary reports of Florida SouthWestern as independently verified prior-school evidence; historical minutes remain excluded.
- `scripts/test_ncaam_kenyon_giles_collision.py` was added for regression testing. End-to-end CI for that test has not yet been confirmed; production ratings unchanged.
- Full 2,014-player classification remains open. The 26 candidate-name review is complete, but that is only one subset; a verified entire-history/backtest certification is not achieved.
