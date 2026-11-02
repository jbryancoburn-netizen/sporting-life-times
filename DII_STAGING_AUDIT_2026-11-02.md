# DII staging source reconciliation checkpoint — 2026-11-02

Scope: `data/d2-official-school-grids-2026-27.json` on the dedicated staging branch. This is a structural review of the complete available source registry, **not** a complete published-ledger reconciliation, successful test run, or school certification.

| Observed metric | Value |
|---|---:|
| School source captures | 24 |
| Dated official source rows | 512 |
| Duplicate school gender/ID keys | 0 |
| Duplicate within-school date/opponent/role keys | 0 |
| Malformed required date/role/opponent fields | 0 |
| Source rows without verified posted tipoffs | 79 |
| Independently attested certified schools | 0 |

Clearly partial captures (<20 dated rows): Ferris State men (6); Tiffin women (1); Minot State women (1); Walsh women (1); Augustana South Dakota women (2); McKendree women (1). Some other calendars have full dated snapshots but still await independent check and reconciled fixture-by-fixture audit.

**Blocking condition:** Two large production ledger files (`data/d2-men-2026-27.json` and `data/d2-women-2026-27.json`) returned empty content via the GitHub file connector even though their Git blob hashes are nonempty. A direct clone/raw fetch from the execution container failed because network DNS access was unavailable. Therefore no full two-way ledger reconciliation, retro-Elo certification, complete Python/Node test execution, or GitHub Pages deployment verification has been performed here. Do not interpret empty connector content as empty published ledgers.

**Next permitted operations on staging:** Fetch real ledger payloads through a working repository workspace or workflow artifact, compare all 512 source rows against canonical game IDs and reciprocal opponents; resolve source-only/missing ledger games and 79 unverified times by source review (never guess); capture full official calendars for six thin schools and all other uncertified programs; run `python -m unittest discover -s tests -p 'test_d2_*.py' -v`, `node --test tests/d2-basketball.test.cjs`, and `python scripts/audit_d2_publication.py --strict`. Record actual pass/fail outputs and run IDs before merge.

No workflows changed; $0 budget; `main` is not being altered by this checkpoint.
