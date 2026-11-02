# Division II basketball — recovery checkpoint (Sporting Life & Times)

> **Project continuity document.** Read this file first after any ChatGPT conversation error or interrupted work. The repository and its committed artifacts, NOT chat claims, are the source of truth. This document is a point-in-time snapshot; regenerate counts from the current publication audit before reporting newer progress.

## Nonnegotiable constraints

- **$0 budget.** No paid APIs, data vendors, subscriptions, hosting, premium CI capacity, cloud charges, or enabling billing. Use public/official free sources and existing no-cost infrastructure only. If a proposed operation may cost money, do not do it; find a free alternative or report the blocker.
- Maintain **separate Division II men's and women's** basketball editions, game ledgers, team registries, forecasts and Elo ratings. Do not overwrite Division I or Division III datasets.
- **Independent retro Elo:** each gender and each school begins the 2026–27 season at **1500**. Do not carry previous-season ratings forward. Historical games are for parameter calibration, not legacy rankings.
- Preserve canonical team/game IDs, home/away order (away first), source URL/provenance, NCAA-confirmed final scores, and conflict quarantine. Never invent games, scores, tipoffs, arenas, broadcasts, teams, or completion claims.
- All school logos use **exactly two circular rings** in two actual institutional colors, centered without clipping. No generic gold fallback, white rings, triple rings, or unringed logos.
- **Keep using existing pipelines** rather than creating replacements. Preserve and test existing workflows; do not change workflow schedules or add billable services to solve chat errors.
- Commit real work in substantive tested batches, document exact improvements and remaining gaps, and distinguish *commit*, *workflow pass*, and *public publication*. Never say a task was published when only committed.

## Point-in-time published-data audit (2026–27 season)

Source of truth: `data/d2-publishing-audit.json`, as inspected from GitHub main on **2026-11-02 03:21 UTC**. The audit's own status is **"PASS — school schedules remain uncertified."** A passing integrity check is not evidence that every institution's schedule has been recovered.

| Metric | Men | Women |
|---|---:|---:|
| Schools listed in registry | 301 | 298 |
| Published game ledger records | 2,930 | 3,744 |
| Verified Elo final games in current ledger | 26 | 33 |
| Programs without a published fixture | 6 | 1 |
| Programs with only 1–6 published fixtures | 22 | 4 |
| Games missing venue | 2,795 | 3,573 |
| Games missing network/broadcast | 2,800 | 3,606 |
| Games missing tipoff | 933 | 334 |
| Games missing source URL (audit field) | 0 | 0 |
| Full-season date scan flagged complete | Yes | Yes |
| Every university's full schedule certified | **NO** | **NO** |

**Important:** The school counts include rows flagged for membership review. Do not assume all are confirmed NCAA DII members. Similarly, a source URL being present does not by itself prove a complete season or that all metadata is correct.

**Men's zero-fixture list (live audit):** Azusa Pacific, Lackawanna College, Loyola University New Orleans, Monroe University, Texas Wesleyan University, and West Florida. **All six are marked ineligible for 2026–27 DII Elo** due to transition or future-membership status; West Florida moved to Division I. Do not invent schedules or add Elo ratings for these teams. Salem men's zero-fixture gap was resolved through official school schedules.

**Women's zero-fixture recovery queue:** **Texas A&M University–Texarkana only**, a first-year reclassifying school. Its available 2026–27 opponents seen so far include Division I/other-division programs. Do not create a false DII-v-DII fixture merely to clear the zero count. Lincoln (PA), Salem (WV), Charleston and Puerto Rico–Mayagüez now have official sourced fixtures in the current ledger.

For the full school-by-school one-to-six-game triage queue and conference-level gaps, **read the live audit JSON**, not a copied chat list. Schools flagged as membership-pending must be validated before adding DII fixtures.

## Historical Elo evidence

Source: `data/d2-elo-parameters-2026-27.json`, based on 2025–26 NCAA results and separately fit for men/women.

| Parameter / result | Men | Women |
|---|---:|---:|
| Season starting Elo | 1500 | 1500 |
| Historical fitted K | 38 | 38 |
| Historical fitted home Elo advantage | 60 | 40 |
| Accepted historical final-game sample | 569 | 1,014 |
| Historical unseen-test log loss | 0.65135 | 0.58065 |
| Previous-year rating carryover | No | No |

These are committed historical calibration artifacts, **not proof of full 2026–27 schedule coverage or final USRS production release**. Keep model backtesting transparent and respect `USRS_RELEASE_POLICY.md`.

## Where the existing implementation lives

- `d2-mens-basketball.html`, `d2-womens-basketball.html`, `d2-basketball.js`, `d2-basketball.css`: existing site editions and shared presentation.
- `data/d2-men-2026-27.json`, `data/d2-women-2026-27.json`: published separate-season ledgers, registry and Elo outputs.
- `data/d2-publishing-audit.json`: current published snapshot's quantitative integrity and recovery report.
- `data/d2-elo-parameters-2026-27.json`: historical parameter-fit evidence.
- `scripts/build_d2_basketball.py`: existing main collector and game reconciliation entry point.
- `data/d2-official-school-grids-2026-27.json`: official university 2026–27 school-grid evidence and conservative canonical opponent labels for Salem men, Salem women, Lincoln (PA) women, Charleston women, Upper Iowa women. The Upper Iowa neutral-site Puerto Rico–Mayagüez game is sourced to its athletics schedule. `tests/test_d2_official_school_grids.py` and `tests/d2-basketball.test.cjs` guard those fixtures.
- `scripts/audit_d2_publication.py --strict`: offline publication integrity check and per-school triage.
- `scripts/d2_*_official.py`: official conference/school reciprocal schedule collectors; keep working through outstanding gaps with conservative matching.
- `scripts/d2_calibrate_historical_elo.py`: historical calibration.
- `.github/workflows/d2-basketball.yml`: current automated publisher, with existing no-cost public-repo GitHub Actions infrastructure and verification steps. **Do not replace merely because a chat failed.**
- `tests/test_d2_*.py`, `tests/d2-basketball.test.cjs`: regressions. Read and run applicable tests before altering production logic.
- `DATA_ACQUISITION_POLICY.md`, `USRS_RELEASE_POLICY.md`: provenance, conflict-handling and release constraints.

Recent confirmed DII merge / mainline checkpoints at time of inspection:
- PR #205 / merge `9d85c13c875ecf98b04541ae81bcbb91549f2d05`: Upper Iowa women's 26 official 2026–27 fixtures, including neutral Puerto Rico–Mayagüez on 2026-11-22; full DII publisher action **41382550184 SUCCESS**, strict audit and tests passed, with automated published ledger commit after the build.
- PR #193: 28 University of Charleston women's schedule rows; all 28 now matched after seven canonical opponent identity corrections in later mainline changes. PRs #194, #196 and #197 protected the importer and fixed regression-test blockers.
- Current point-in-time main audit: 2,930 men / 3,744 women games, 26 / 33 Elo finals, 6 / 1 zero-fixture registrants. No university full-season certification. **GitHub Pages deployment must be separately checked**; do not infer publication from a passing DII builder.
- `6ccb60cc6e85af243e8f2e8714d0bb04d520d5d8`: MIAA men's/women's reciprocal recovery and tests.
- `3a72c9b08ce3b35c9a9e570bdc8f299aba5d70b5`: GMAC official schedules.
- `7740ce89096974df1c6e35dad1defdd9cebfd7f1`: school schedule audit / clickable queues.
- `3e82131c521d89260707dd684fd62ab196e9b002`: verified DII men/women game-ledger refresh.
Always use the **latest main HEAD** rather than assuming these remain the newest commits.


## 2026-11-02 recovery facts and next priority

- Existing DII workflow `.github/workflows/d2-basketball.yml` succeeded on run [41382550184](https://github.com/jbryancoburn-netizen/sporting-life-times/actions/runs/41382550184), including JS/Python tests, source build, strict release audit and data commit. The subsequent GitHub Pages deployment run was still pending/in progress when checked, so do not assert it has deployed.
- Newly sourced school grids contain 27 Salem men, 28 Salem women, 28 Lincoln (PA) women, 28 Charleston women, 26 Upper Iowa women = **137 university schedule source rows**. Rows already existing in the ledger or with other-division opponents are not counted as newly created DII games; source rows and game-ledger additions must not be confused.
- Official Upper Iowa opponent evidence confirms the currently first-known DII women's fixture for University of Puerto Rico–Mayagüez, **2026-11-22, neutral, 12:30 PM ET**. Only the university's posted ET clock was imported; other ambiguous local time-zone displays were deliberately not guessed.
- Do not treat the 2026–27 Texas A&M–Texarkana women's zero-fixture row as automatically missing a DII game. Search its official university calendar and reciprocal confirmed **DII-v-DII** opponents. It may chiefly play former NAIA/other-division schools during transition.
- Next large data batches: official school-level 2026–27 confirmation for the remaining **22 thin men's and 4 thin women's schedules**, and missing verified venues/networks/tipoffs. Verify pending membership and exclude future/Division I schools from DII Elo. Historical Elo calibration remains independently reset to 1500 for each season.
- **Zero-dollar constraint remains absolute:** public/free sources, existing public repo and existing workflows only; no paid accounts, paywalled APIs, premium Actions, or extra hosting bills.

## Immediate unfinished work, in priority order

1. Recompute the current ledger audit from main, confirm GitHub Actions status and the live site; check that published files and rendered pages agree. Keep separate labels for *audit pass*, *GitHub commit*, *Action success*, and *deployed*.
2. Recover and cross-check complete **official university** 2026–27 schedules for every eligible DII program, prioritizing zero-fixture and one-to-six-fixture schools and conference coverage gaps from the current JSON. Require exact opponent, date and home/away checks, and reciprocal corroboration where available. Membership-pending schools are **not** presumed eligible.
3. Reduce missing start times, arenas/cities and networks with **sourced, exact-match evidence only**. It is better to display an honest unknown than a guessed value.
4. Re-run historical validation/integrity gates after changing Elo code, ensure both genders start at 1500 each season, chronologically process only actual finals, and do not imply the USRS release gate is approved.
5. Verify edition quality: no duplicates, consistent away/home display, two-color **two-ring** logo system with fallback, accurate game centers and school pages; check both desktop and narrow-mobile output.
6. After each substantial batch, create tested GitHub commits, check that the publisher completed, update the audit/checkpoint with changed counts and exact outstanding blockers, and link commits in the response. No empty claims of "fixed", "published", or "done".

## Recovery protocol after a ChatGPT/API error

1. Reopen `main` in `jbryancoburn-netizen/sporting-life-times`. Find latest DII-related commits and successful Actions; do **not** trust a prior chat's final message as evidence.
2. Read this file and the current `data/d2-publishing-audit.json`, and determine which requirements are **still unfulfilled**.
3. Work in existing source files with tested, substantive batches; avoid building parallel replacement collectors or workflows.
4. Before ending an active work turn, make sure *actual code/data and any tests* are committed and recoverable. Distinguish saved documentation from implemented functionality.
5. Publish concise counts: men/women teams, games, zero/thin schedules, unsourced fields, last verified commits, Actions/deploy result, and specific remaining work.
6. **Budget check**: confirm every new tool, endpoint and runtime step is free and does not trigger paid capacity. Any cost risk is a blocker, not something to silently accept.

**Scope of this checkpoint:** It preserves requirements, audit facts, and recovery instructions. It is not a claim that missing schedules were completed, that all tests were run during this checkpoint write, or that deployment succeeded.

## Recovery batch 2026-11-01: Salem and Lincoln official schedules

**This is a dated snapshot, not a new complete-calendar certification. Read the current live audit after future commits.**

- Committed `cf94a4d`: **83 official school-calendar source rows**, namely Salem men (27), Salem women (28), and Lincoln University (PA) women (28), in `data/d2-official-school-grids-2026-27.json`. The existing DII publisher now conservatively adds only games with uniquely matched eligible DII opponents, preserves existing NCAA IDs/finals and never creates fake historical results. Some official source rows involve non-DII schools and must not be published as DII games.
- Corrected West Florida's 2026–27 **Division I** transition in the official membership notes for both sexes. Its legacy zero-fixture listing does not signify a missing eligible DII schedule.
- Corrected CCAA men's university-grid gender-title validation and reconciliation safeguards; retain two distinct corroborating schools and exclude membership-ineligible schools. Related code and test commits `85ac196d`, `166ff414`, `d0752c09`. **Check latest workflow outcome, not chat assertions.**
- DII workflow run **41380575116** succeeded with existing verification and publication steps. Its success is independent from later regression runs; verify newer changes before declaring green.
- Published audit at blob `7a7e7f417df7179d0fb8dede2103b6b5fa746adc`: men **301 schools / 2925 game records / 26 verified Elo finals / 6 zero schedules / 22 thin (1–6)**; women **298 / 3714 / 33 / 3 / 3** respectively. Changes include concurrent DII commits from other work; do not attribute all additions to one source batch.
- Still missing **men: 2790 arenas, 2795 broadcasts, 933 tipoffs; women: 3566, 3576, 331**. Full institution-by-institution schedules remain **UNCERTIFIED**.
- Hard operating rule: **$0**. No paid APIs, subscriptions, vendor feeds, CI upgrades, premium hosting, or enabling billing. Use existing free sources and current workflows only.

### Latest workflow verification (2026-11-01 Eastern)

- **DII workflow run 41381128079 succeeded** on commit `a8f81f689e05`: GitHub Actions completed Python/Node preflight, existing collection, strict publication audit, and verified DII-only data commit steps without failure. This supersedes the earlier failed validation attempts from simultaneous CCAA edits. As always, this does not certify all institutional schedules.
- **Public GitHub Pages deployment is separate** from DII workflow success; confirm the Pages workflow conclusion and public URL independently before claiming a new deployment.

## Verified recovery checkpoint — 2026-11-01, after Charleston and eligible-gap audit

**Read `data/d2-publishing-audit.json` first for current counts.** The original snapshot at the top of this document is intentionally historical, and all total fixture counts below may change after further independent publisher runs.

- **Latest inspected audit blob:** `377f792909a08c7ff5351a826de8f11cb4dd4ad3`; `PASS — school schedules remain uncertified`. Passing integrity does **not** mean university schedules are certified.
- **Men:** 301 registered schools, 2930 published game records, 26 verified Elo finals; 6 zero-fixture registry records, **0 eligible zero-fixture programs** and 6 excluded-from-Elo registry records; 22 programs with 1–6 fixtures. Missing venues 2795, broadcasts 2800, tipoffs 933.
- **Women:** 298 registered schools, 3735 published game records, 33 verified Elo finals; 2 zero-fixture programs, **2 eligible zero-fixture programs**; 3 programs with 1–6 fixtures. Missing venues 3577, broadcasts 3597, tipoffs 332.
- **Official women’s Charleston recovery:** 28 official dated game rows in `data/d2-official-school-grids-2026-27.json`, together with Salem men (27), Salem women (28), Lincoln (PA) women (28). Publication is limited to matches with uniquely resolved eligible DII opponents; source rows are not automatically 28 added game records. Charleston no longer appears among zero-fixture women in this verified audit.
- **Current eligible women’s zero-fixture targets:** Texas A&M–Texarkana (DII reclassification, no independently confirmed DII-v-DII 2026–27 fixtures yet) and University of Puerto Rico, Mayagüez (listed as active DII by the NCAA, official NCAA institution directory: https://web3.ncaa.org/directory/orgDetail?id=24361). Do not manufacture an entire schedule from non-DII opponents or uncorroborated social posts.
- **Men’s six zero-fixture directory rows are all marked excluded from the DII Elo rating system** for current-season membership/reclassification reasons: Azusa Pacific, Lackawanna, Loyola New Orleans, Monroe, Texas Wesleyan, and West Florida. Keep those rows in the registry for audit but do not treat them as eligible programs with missing DII schedules.
- **Audit correction:** PR #198, merge commit `068c59841f8e1dc6961cec86e2d8f4cd4a271dc5`, adds `eligible_without_games`, `excluded_without_games`, `eligible_zero_game_schools` and conference-level splits, with Python regressions. The old `without_games` figure remains for compatibility.
- **Existing DII Actions workflow** run `41381799384` completed `success` on commit `068c59841f8e1dc6961cec86e2d8f4cd4a271dc5`; previous successful run `41381654086` completed `success`. A successful publisher is not equivalent to a successful GitHub Pages deployment.
- **GitHub Pages workflow observed** run `41381862422` status `in_progress`, conclusion `not yet available`. Do not claim this checkpoint confirms a fresh public page until Pages passes.
- **Next true work:** source-recover full calendars for thin eligible programs (men MEC, CIAA, GNAC prioritized; women Queens College NY, Montana State Billings, UPR Rio Piedras), check two remaining zero-fixture women's teams for current official evidence, then enrich exact venue/tipoff/broadcast data. Never claim completion based on a date scan.
- **Non-negotiable budget:** **$0**; official/public free sources, existing no-cost infrastructure and the existing GitHub Actions publisher only. Do not enable billing, add paid APIs or change workflow schedules.

## Verified continuation: 2026-11-02 (after Charleston and Mayaguez recovery)

**Authoritative source**: `data/d2-publishing-audit.json` read from `main` after GitHub Actions DII workflow **#41382690253** completed **success** (all automated tests, build, strict ledger audit, and verified data commit). [DII Actions success](https://github.com/jbryancoburn-netizen/sporting-life-times/actions/runs/41382690253). GitHub Pages must be checked independently; rapid main pushes may cancel older deployment attempts.

| Latest stored integrity audit | Men | Women |
|---|---:|---:|
| Registry entries, including DII-ineligible transitions | 301 | 298 |
| Published 2026–27 ledger games | **2,930** | **3,746** |
| Verified season Elo final games | 26 | 33 |
| Zero-fixture registered programs | 6 | 1 |
| Zero-fixture **eligible DII Elo** programs | **0** | **0** |
| Programs with only 1–6 fixtures, NOT certified full schedules | 22 | 4 |
| Ledger games missing arena/venue | 2,795 | 3,575 |
| Ledger games missing broadcast/network | 2,800 | 3,608 |
| Ledger games missing tipoff | 933 | 334 |
| University-by-university full-season schedules certified | **NO** | **NO** |

The raw zero-fixture rows above are *not* missing eligible DII calendars: men's Azusa Pacific, Lackawanna, Loyola New Orleans, Monroe, Texas Wesleyan and West Florida are excluded by documented membership transitions; women's Texas A&M–Texarkana competes in NAIA during 2026–27 despite DII reclassification. The registry intentionally retains these identities for traceability. Never add cross-division games to manufacture complete DII coverage. Read `data/d2-membership-notes-2026-27.json` for current status; zero eligible fixture count does NOT mean complete schedules.

**Specific evidence saved and validated in existing systems:**
- [PR #193](https://github.com/jbryancoburn-netizen/sporting-life-times/pull/193): added **28 University of Charleston (WV) women** officially dated rows. [PR #202](https://github.com/jbryancoburn-netizen/sporting-life-times/pull/202): seven source school-name variants reconciled to distinct canonical NCAA program names, retaining the original opponent labels and identity evidence. Direct blob inspection confirmed **28 distinct ledger games** for Charleston with zero duplicates, all scheduled without fabricated finals.
- [PR #194](https://github.com/jbryancoburn-netizen/sporting-life-times/pull/194), [#196](https://github.com/jbryancoburn-netizen/sporting-life-times/pull/196), [#197](https://github.com/jbryancoburn-netizen/sporting-life-times/pull/197): time-zone guard and regression-test repairs; **existing DII workflow** passed after changes. No new workflows or billed services.
- The existing official school-grid file also includes **26 Upper Iowa women** school calendar rows including 2026-11-22 versus Puerto Rico–Mayagüez, 12:30 PM ET (school source: https://uiupeacocks.com/sports/womens-basketball/schedule/2026-27?grid=true).
- [PR #206](https://github.com/jbryancoburn-netizen/sporting-life-times/pull/206): independently sourced **two more Mayagüez women's neutral fixtures** (2026-12-18 Lenoir–Rhyne, 2:00 PM ET, and 2026-12-19 UVA Wise, 9:00 AM ET) from official 2026–27 university calendars. Mayagüez has at least three distinct scheduled games in the stored ledger (Upper Iowa Nov 22 plus these December games); do **not** call this a certified complete Puerto Rico calendar.
- Both divisions retain season-isolated **1500 starting Elo**; publish only verified real finals. There is no authorization to carry historical ratings forward, infer scores or call USRS calibration gate complete.

**Next actual work**: finish full school-by-school schedule **certification** using official university grids and reconciled conference calendars (particularly 22 men's and 4 women's thin schedules); reduce thousands of unsourced venue/network/time fields only with exact-source evidence; preserve IDs, neutral Elo, away-first and exactly two colored logo rings. Check recent DII Actions and GitHub Pages deployments separately after each source/data batch. This checkpoint is a snapshot, not a proof of deployment or all-school certification. **Budget remains $0.**
