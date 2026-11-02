# DII staging: first two-ledger reconciliation checkpoint
Date: 2026-11-02

## Verified retrieval
The existing GitHub blob endpoint successfully returned the full production JSON payloads even though `fetch_file` returned empty text for large files. Snapshot used:
- Men: blob `0aafc77a5db78c2d21ab61e7df6626756da754c7` (3,337 games)
- Women: blob `ad4b8c69dbb20bee48042df66b08e667b9926820` (3,802 games)
- Source registry: 24 school captures / 512 dated rows

## Initial owner/date matching (not opponent certification)
- 448 rows match exactly one game by gender + school ID + date.
- 64 rows have no owner/date match.
- 0 rows match more than one game under that key.
- 2 preliminary role conflicts:
  - Women Lenoir–Rhyne vs Lander, 2026-11-15: official grid neutral; game ID 6659271 ledger home Lenoir–Rhyne.
  - Men Lake Superior State vs Minnesota State, 2026-11-20: official grid away; game ID 6664472 ledger home Lake Superior State.

The 448 owner/date matches are not proof that opponents, tipoffs, game IDs, eligibility and arenas match. The 64 unmatched rows are not 64 missing DII games: source rows include exhibitions, non-DII opponents and tournament placeholders. Do not automatically import them.

## Immediate reconciliation queues
- Men Salem: 12 unmatched source rows; women Salem: 16.
- Lake Superior State men: 7; Ferris State men: 4.
- UVA Wise women: 4, including two explicitly named exhibitions.
- Lincoln Pennsylvania women: 3; West Virginia Wesleyan men: 3; Roberts Wesleyan men: 3 (two exhibitions and one other-division opponent).
- Men West Liberty: 2; Fairmont State: 2; Saint Martin's: 2; Minnesota–Duluth: 2; Queens NY women: 2 (Lackawanna, not DII).
- Women Wayne State MI: 1 tournament TBD; men Livingstone: 1.
- All other captures without owner/date gaps must still pass opponent-by-opponent bidirectional review.

## Release block
Do not mark a school independently certified or merge this staging branch into main. Still required: opponent matching and membership classification of all source-only rows; two-way audit for ledger-only rows; independent calendar attestations; clocks/roles conflicts; test execution (`python -m unittest discover -s tests -p 'test_d2_*.py' -v`, `node --test tests/d2-basketball.test.cjs`, `python scripts/audit_d2_publication.py --strict`); explicit published site/deployment verification. Preserve current Actions workflows, main, and $0 budget.
