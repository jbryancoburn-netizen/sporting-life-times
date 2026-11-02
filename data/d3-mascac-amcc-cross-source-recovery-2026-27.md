# DIII 2026–27 MASCAC / AMCC missing-source recovery — November 2, 2026

**Scope:** Evidence for games involving NCAA Division III schools whose *own* full university/conference basketball calendars remain unresolved. This file is a human-auditable first-party cross-source queue. **Not a certification of missing schools' full schedules**, not an alternative scoreboard, not an Elo input, and not permission to fabricate any home/away sites or results.

## MASCAC — games confirmed on opposing schools' official calendars

| Unresolved school / team | Official publisher | Posted event | Original official source |
|---|---|---|---|
| Fitchburg State men | UMass Boston men's athletics | Nov 17, 2026 — UMass Boston **away** at Fitchburg State; Fitchburg listed as home opponent | https://beaconsathletics.com/sports/mens-basketball/schedule/2026-2027?grid=true |
| Bridgewater State men | UMass Boston men's athletics | Nov 30, 2026 — UMass Boston **home** vs Bridgewater State | https://beaconsathletics.com/sports/mens-basketball/schedule/2026-2027?grid=true |
| Salem State men | UMass Boston men's athletics | Nov 14, 2026 — UMass Boston **home** vs Salem State | https://beaconsathletics.com/sports/mens-basketball/schedule/2026-2027?grid=true |
| Worcester State men | WPI men's conference calendar | Nov 13, 2026 — WPI vs Worcester State (WPI home by unprefixed opponent on official publisher's dated team grid; verify location before independently certifying venue) | https://newmacsports.com/schedule.aspx?schedule=3952 |
| Framingham State men | WPI men's conference calendar | Nov 14, 2026 — WPI vs Framingham State (publisher's listed team grid; independent home venue unconfirmed) | https://newmacsports.com/schedule.aspx?schedule=3952 |
| Fitchburg State men | WPI men's conference calendar | Nov 24, 2026 — WPI vs Fitchburg State (publisher's listed team grid; independent home venue unconfirmed) | https://newmacsports.com/schedule.aspx?schedule=3952 |

## AMCC — games confirmed on opposing schools' official calendars

| Unresolved school / team | Official publisher | Posted event | Original official source |
|---|---|---|---|
| La Roche men | Mount Aloysius men's athletics | Jan 30, 2027 — Mount Aloysius **away** at La Roche, Kerr Fitness Center | https://mountieathletics.com/sports/mens-basketball/schedule/2026-27?grid=true |
| Pitt-Bradford men | Mount Aloysius men's athletics | Feb 6, 2027 — Mount Aloysius **home** vs Pitt-Bradford | https://mountieathletics.com/sports/mens-basketball/schedule/2026-27?grid=true |
| Penn State Behrend men | Mount Aloysius men's athletics | Feb 10, 2027 — Mount Aloysius **home** vs Penn State Behrend | https://mountieathletics.com/sports/mens-basketball/schedule/2026-27?grid=true |
| Penn State Altoona men | Mount Aloysius men's athletics | Feb 13, 2027 — Mount Aloysius **away** at Penn State Altoona, Adler Athletic Complex | https://mountieathletics.com/sports/mens-basketball/schedule/2026-27?grid=true |
| Carlow men | Mount Aloysius men's athletics | Feb 20, 2027 — Mount Aloysius **home** vs Carlow | https://mountieathletics.com/sports/mens-basketball/schedule/2026-27?grid=true |
| Penn State Behrend men | Allegheny men's PAC conference calendar | Nov 24, 2026 — Allegheny **away** at Penn State Behrend | https://pacathletics.org/schedule.aspx?schedule=3156 |
| Carlow men | Allegheny men's PAC conference calendar | Dec 12, 2026 — Allegheny **home** vs Carlow | https://pacathletics.org/schedule.aspx?schedule=3156 |
| Pitt-Bradford men | Franciscan men's PAC conference calendar | Nov 7, 2026 — Franciscan **away** at Pitt-Bradford | https://pacathletics.org/schedule.aspx?schedule=3198 |
| Penn State Behrend men | Franciscan men's PAC conference calendar | Nov 14, 2026 — Franciscan **away** at Penn State Behrend | https://pacathletics.org/schedule.aspx?schedule=3198 |
| Penn State Altoona men | Franciscan men's PAC conference calendar | Nov 17, 2026 — Franciscan **home** vs Penn State Altoona | https://pacathletics.org/schedule.aspx?schedule=3198 |

## Acceptance gates / next source steps

1. Match every cross-source game against the existing *unique game ID*, date, team NCAA org IDs and reciprocal home/away assignments in the DIII official fixture ledger. Do not create duplicate matchups by hand.
2. Prefer an official missing school's campus schedule to certify a *full calendar*. Until that works, preserve its `unresolved` source status even when many opponent-sourced fixtures are present.
3. For MASCAC, independently recover each of Bridgewater State, Fitchburg State, Framingham State, MCLA, Salem State, Westfield State and Worcester State — both genders — from the relevant official program's published season calendar or complete conference team grid. The conference-host block and university JavaScript shells cannot be treated as verified full calendars.
4. For AMCC, independently recover each of Carlow, La Roche, Penn State Altoona, Penn State Behrend and Pitt-Bradford — both genders. Carlow's separately archived **partial first-party event list** must *not* be mislabeled full university calendar certification.
5. Keep DIII Elo separate; no exhibition scores in Elo; no score from a future schedule is a final; use the existing free workflows and no paid services.

**Audit baseline:** 821 eligible NCAA program calendars, 38 unresolved as of the source register dated 2026-11-02T16:12:07Z; the recovered Muskingum/Ohio Northern men's conference sources account for 34 previously verified entries. This document adds *no* new certification claims.
