# DIII men's MASCAC / AMCC published fixture reconciliation — 2026-11-02

This audit directly inspected the published 2026–27 men's DIII fixture blob SHA `d63085e9fa22577598b1aec55c4a630ff3b8d011`, generated 2026-11-02T16:09:38Z. It has **4,298 fixtures** and reports **357 verified school calendars**. Compared 16 cross-source records from `data/d3-mascac-amcc-cross-source-recovery-2026-27.md` using NCAA org IDs, date, normalized unordered matchup, existing ID and known home/away. No changes to games, game IDs, scores, Elo, source status or workflows.

## Verified present, one exact fixture, site consistent (11)

| Date | Published fixture ID |
|---|---|
| 2026-11-17 | `d3-men-2026-11-17-227-401` |
| 2026-11-30 | `d3-men-2026-11-30-76-401` |
| 2026-11-14 | `d3-men-2026-11-14-401-621` |
| 2027-01-30 | `d3-men-2027-01-30-1163-30036` |
| 2027-02-13 | `d3-men-2027-02-13-25719-30036` |
| 2027-02-20 | `d3-men-2027-02-20-30036-30253` |
| 2026-11-24 | `d3-men-2026-11-24-19-538` |
| 2026-12-12 | `d3-men-2026-12-12-19-30253` |
| 2026-11-07 | `d3-men-2026-11-07-1315-30069` |
| 2026-11-14 | `d3-men-2026-11-14-538-30069` |
| 2026-11-17 | `d3-men-2026-11-17-25719-30069` |

## Present, independently verify WPI venue (3)

| Date | Published fixture ID | Current assignment |
|---|---|---|
| 2026-11-13 | `d3-men-2026-11-13-808-809` | WPI home |
| 2026-11-14 | `d3-men-2026-11-14-238-808` | WPI home |
| 2026-11-24 | `d3-men-2026-11-24-227-808` | WPI home |

WPI's opponent list in the original cross-source file did not independently establish physical venue. These are **not** certified reciprocal venue confirmations.

## Missing from published fixture ledger (2)

| Date | School-hosted game in cross-source evidence | Publisher |
|---|---|---|
| 2027-02-06 | Pitt-Bradford (NCAA 1315) at Mount Aloysius (30036) | `https://mountieathletics.com/sports/mens-basketball/schedule/2026-27?grid=true` |
| 2027-02-10 | Penn State Behrend (538) at Mount Aloysius (30036) | Same school source |

Both are absent from the 4,298-game fixture set at that snapshot, **not automatically proven to be valid current games**. The importer report marks Mount Aloysius's source as parsed with 29 rows, so investigate whether those dates/opponents were revised or misrecorded in the earlier cross-source document. Recheck the live university page and opposing school page before inserting any fixture. Do not create or patch scores, do not claim a full missing school calendar, and preserve existing deterministic IDs.

**Result: 11 exact known-site matches; 3 exact matchup/date matches with venue still unconfirmed independently; 2 missing; 0 duplicate matches in the checked 16.**

No certification count is reduced on the strength of this check. The previously reported 38 unresolved program calendars remains a prior baseline, not a refreshed count.
