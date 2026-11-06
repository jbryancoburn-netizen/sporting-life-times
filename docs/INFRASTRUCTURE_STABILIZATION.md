# Publishing stabilization policy — November 6, 2026

## Production safety
- Do not disable existing data feeds until their owners, trigger rules, output paths and last successful publishes have been checked.
- Development work happens in branches, with one integrated PR per coherent release.
- Data refresh jobs must not rebuild unrelated HTML, CSS, logos or design assets.
- Avoid multiple writers to the same generated file. Assign a single owner per output path and use workflow concurrency on that publisher.
- Publishing must use a single serialized step with an expected branch head; don't force-update production.
- Preserve last known-good data when source ingestion fails, and record the failure without replacing current feeds with blanks.
- Use a single batch commit for related changes across multiple pages instead of per-page commits.

## Release verification
A release is complete only after validating: source content, commit SHA, deployment success, public site version, and critical smoke checks (men's and women's basketball, NBA scoreboard, rankings, front pages). Distinguish source freshness from public-site freshness.

## Cadence
- Live scores: ingest every 1–5 minutes where supported, without whole-site rebuilds.
- Completed games: process at final; recompute records, standings and RETRO from verified finals.
- News and scheduled rankings: refresh at a cadence specific to the data source.
- UI/logos/templates: batch once daily except production emergencies.
- All independent sport outputs should be isolated; shared pages go through a single publisher.

## Audit sequence
1. Run the manually dispatched **Infrastructure workflow audit (read-only)** workflow and capture its summary.
2. Map every scheduled workflow to paths it reads/writes and its trigger frequency.
3. Identify parallel jobs targeting the same paths, recursion from commits, and duplicates.
4. Add scoped concurrency and path/branch filters to the conflicting workflow files.
5. Establish a single site-deployment pipeline and post-deploy smoke test.
6. Move rapidly changing data to a separately published layer only after validating its consumers.
7. Compare before/after counts: commits per hour, workflow failures, overlapping writes, and minutes from verified final to public display.

## Non-goals
This document alone does not change live production configuration; the audit will inform the actual migration. Never claim the website was repaired based solely on a successful commit.
