# DIII 2026–27 first-party follow-up: Mount Aloysius and WPI
Verified 2026-11-02 against the original institutional/conference calendars. Evidence audit only; no fixtures, results, standings, Elo, workflows, or existing IDs were changed.

## Confirmed on current Mount Aloysius men's 2026–27 institutional schedule
Source: https://mountieathletics.com/sports/mens-basketball/schedule/2026-27?grid=true

- **2027-02-06 2:00 PM**: Pitt-Bradford (NCAA 1315) **away at** Mount Aloysius (30036), Cresson, PA, Athletic, Convocation, and Wellness Center. Previously missing from published fixture snapshot `d63085e9fa22577598b1aec55c4a630ff3b8d011`.
- **2027-02-10 7:00 PM**: Penn State Behrend (538) **away at** Mount Aloysius (30036), same venue. Also missing from that snapshot.
- **Critical additional source conflict:** university page simultaneously lists **2027-02-13 1:00 PM away at Hilbert** and **2027-02-13 7:00 PM away at Penn State Altoona**. Do **not** interpret both as independently certifiable fixture entries until opponents corroborate and school clarifies. Existing published fixtures include both, making this a newly identified scheduling anomaly. Do not infer a score or canceled game.

### Follow-up acceptance gates
1. Reconcile the two confirmed missing source fixtures against the *fresh current* published ledger again before injection. If still absent, add using the importer's existing canonical key/ID logic and preserve the original university URL/time/venue, with no duplicated game.
2. Investigate why the previously parsed Mount Aloysius school source report registered 29 readable rows but 17 matched NCAA opponents and 11 unresolved opponent rows, despite identity aliases for the two current opponents. The source may have changed after the snapshot; don't infer the cause.
3. Flag the two conflicting February 13 away games for manual source-to-source verification, with no forced deletion until resolved.

## WPI 2026–27 conference calendar
Source: https://newmacsports.com/schedule.aspx?schedule=3952

- 2026-11-13: Worcester State, 5:30 PM.
- 2026-11-14: Framingham State, 3:00 PM.
- 2026-11-24: Fitchburg State, 5:30 PM.

The official team-oriented schedule lists these as bare opponents, in contrast with the explicit `at` marking on away games. This **supports** the already-published WPI-home assignment for all three, but is not a separate independent physical gymnasium confirmation. Preserve the existing three game IDs and assignments; no new fixture creation.

**State:** two missing Mount Aloysius fixtures reverified as scheduled (not yet added to ledger), three existing WPI fixtures confirmed on published conference calendar, and an additional possible same-day scheduling conflict explicitly documented. Full-season certification count unchanged.
