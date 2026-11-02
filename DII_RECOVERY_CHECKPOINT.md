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

Source of truth: `data/d2-publishing-audit.json`, as inspected from GitHub main on **2026-11-01**. The audit's own status is **"PASS — school schedules remain uncertified."** A passing integrity check is not evidence that every institution's schedule has been recovered.

| Metric | Men | Women |
|---|---:|---:|
| Schools listed in registry | 301 | 298 |
| Published game ledger records | 2,827 | 3,678 |
| Verified Elo final games in current ledger | 25 | 33 |
| Programs without a published fixture | 7 | 5 |
| Programs with only 1–6 published fixtures | 32 | 3 |
| Games missing venue | 2,698 | 3,545 |
| Games missing network/broadcast | 2,697 | 3,540 |
| Games missing tipoff | 923 | 331 |
| Games missing source URL (audit field) | 0 | 0 |
| Full-season date scan flagged complete | Yes | Yes |
| Every university's full schedule certified | **NO** | **NO** |

**Important:** The school counts include rows flagged for membership review. Do not assume all are confirmed NCAA DII members. Similarly, a source URL being present does not by itself prove a complete season or that all metadata is correct.

**Men's zero-fixture recovery queue (from current audit):** Azusa Pacific (membership pending); Lackawanna College (membership pending); Loyola University New Orleans (membership pending); Monroe University (membership pending); Salem; Texas Wesleyan University (membership pending); West Florida.

**Women's zero-fixture recovery queue:** Lincoln University (Pennsylvania); Salem University (West Virginia); Texas A&M University–Texarkana; University of Charleston (West Virginia); University of Puerto Rico, Mayaguez.

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
- `scripts/audit_d2_publication.py --strict`: offline publication integrity check and per-school triage.
- `scripts/d2_*_official.py`: official conference/school reciprocal schedule collectors; keep working through outstanding gaps with conservative matching.
- `scripts/d2_calibrate_historical_elo.py`: historical calibration.
- `.github/workflows/d2-basketball.yml`: current automated publisher, with existing no-cost public-repo GitHub Actions infrastructure and verification steps. **Do not replace merely because a chat failed.**
- `tests/test_d2_*.py`, `tests/d2-basketball.test.cjs`: regressions. Read and run applicable tests before altering production logic.
- `DATA_ACQUISITION_POLICY.md`, `USRS_RELEASE_POLICY.md`: provenance, conflict-handling and release constraints.

Recent confirmed DII merge / mainline checkpoints at time of inspection:
- `6ccb60cc6e85af243e8f2e8714d0bb04d520d5d8`: MIAA men's/women's reciprocal recovery and tests.
- `3a72c9b08ce3b35c9a9e570bdc8f299aba5d70b5`: GMAC official schedules.
- `7740ce89096974df1c6e35dad1defdd9cebfd7f1`: school schedule audit / clickable queues.
- `3e82131c521d89260707dd684fd62ab196e9b002`: verified DII men/women game-ledger refresh.
Always use the **latest main HEAD** rather than assuming these remain the newest commits.

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
