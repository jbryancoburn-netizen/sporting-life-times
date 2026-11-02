# DII 2026–27 bulk staging and release gate

**Working branch:** `dii-bulk-certification-2026-27`. **Release target:** `main` via one tested squash merge; no direct DII schedule edits to `main` during bulk collection.

## Workflow (do not alter GitHub Actions workflow files)
1. Stage official university 2026–27 full-calendar captures in the existing `data/d2-official-school-grids-2026-27.json`; use the existing importers, collector, and publishing audit. Collect across many schools/conferences, not one small school per release.
2. Preserve the literal official date, opponent, role, local time and source URL. Flag unknown opponents, non-DII/exhibitions, pending membership, tournament TBD, opposing-university disagreements, and disputed UTC/ET conversion rather than inventing data.
3. Reconcile reciprocal entries; preserve canonical game/team IDs and NCAA-confirmed final results. Men and women remain separate. Never insert other-division exhibitions into DII Elo, and reset season Elo to 1500.
4. A complete source snapshot is **not** independent certification. Record a per-school certification assertion only with genuine full-calendar review and an independent official source. See `DII_FULL_SEASON_CERTIFICATION.md`.
5. Recalculate the remaining school counts from the current audit. Report fixture additions, source captures, certification counts, quarantined issues, and missing tipoffs/venues separately.
6. Before release, run:
   - `python -m unittest discover -s tests -p 'test_d2_*.py' -v`
   - `node --test tests/d2-basketball.test.cjs`
   - `python scripts/audit_d2_publication.py --strict`
7. Verify automated publisher results and public GitHub Pages deployment **separately**. Publish to `main` only after test and evidence gates pass; squash-merge the staging branch as the single consolidated release commit. If unresolved records remain, keep them explicitly quarantined and do not claim 100% certification.

**Constraints:** $0 budget. Do not change existing workflows, enable paid services, or change non-DII projects. Commit work-in-progress only to this staging branch. Individual staging commits are for crash recovery; the final release is one squashed merge to `main`.

## Initial staging checkpoint — November 2, 2026
This branch was created from the then-current `main`, including Lake Superior State men's 28-row official capture and other previously committed DII recovery work. The next bulk batch should target Puerto Rico women's short calendars, Salem women, Ferris State men, and other uncertified schools; these targets are not certified claims.
