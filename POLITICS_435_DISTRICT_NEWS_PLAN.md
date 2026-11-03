# Congressional District News: 435-Edition Coverage Plan

## Goal and honest baseline
Every one of the 435 existing district pages gets an independently maintained **district news desk**, not a national-headline feed relabeled as local news. On November 3, 2026, the existing `data/politics-district-desk.json` has sourced stories for **IA-01 only**. The existing 15-minute workflow `.github/workflows/politics-district-service-desk.yml` and importer `scripts/refresh-politics-district-desk.py` currently refresh **IA-01**, not all 435. Do not advertise nationwide news coverage until this changes.

## Content contract for each district
Every story record must include `district_id`, `title`, `source`, `url`, `published_at`, `collected_at`, `topic`, `match_reason`, and `via`. Only publisher-linked HTTPS articles; no republished article text. Preserve the publisher's exact date and title. Deduplicate by canonical URL and normalized title. Reject pages without verifiable publication time, source, or relevant district connection. A story about a state or party alone does **not** establish relevance to each district in the state.

## Matching policy
- **Direct district:** District number plus state or a verified candidate/representative and relevant governmental context. Highest confidence.
- **Local-community policy:** Verified locality *inside that district* plus a material political, policy, economic, infrastructure, government or community impact, supported by the district's current geography crosswalk. A city spanning multiple districts cannot be assigned wholesale.
- **Official action:** A known district representative's named roll call, press release, legislation or official hearing, clearly tagged `OFFICIAL RECORD`, not independent reporting.
- **Ambiguous/redistributed boundaries:** Hold for review; don't fabricate a match from overlapping former district numbers or old county data.
- No generic search results, scraped full articles, unsourced claims, fabricated reporters, party labels as evidence, or 2024 results described as 2026 outcomes.

## Sources (no paid APIs)
Maintain a `district-news-sources.json` registry of vetted publisher RSS/Atom feeds, local public radio, local newspapers, state political reporters, reputable investigative outlets, and official elected-member feeds. Give each feed a geographic service area and approved publisher identity. Obtain free publisher-linked feed items and retain original links. Use Google News RSS *discovery* only; validate publisher/date/attribution before displaying. Respect publisher access policies and host limits.

## Nationwide rollout
1. **Inventory**: use `politics-house-atlas.json` as the authoritative list of 435 IDs and `politics-geometry/` as geographic scope; produce coverage metrics, never rely on a guessed district list.
2. **Source expansion**: curate multiple local/regional providers across all 50 states, prioritizing underserved districts and metro districts crossing jurisdictions. Registry must record source, scope, quality and last successful check.
3. **Collector refactor**: separate the current IA-01-only rules into reusable matcher + per-district registry; run bounded state-by-state batches with free RSS, HTTP timeouts, rate limits, user agent, caching and retry. Avoid 435 independent Google queries every 15 minutes.
4. **Human-verifiable quality**: save only stories with traceable reason and district ID. Quarantine ambiguous placements for manual confirmation instead of putting them on live pages.
5. **Publish and preserve**: merge accepted stories into `data/politics-district-desk.json` without destroying previously verified elections, polling, or representative voting records. Keep recent stories (45-day active window) and distinct dated archive. On feed failures, leave prior verified items in place with transparent timestamps.
6. **Page UI**: existing `#desk-local-news` presents directly relevant linked reporting. Display source, date, district relevance, topic, last verified time and explicit no-stories-yet state. Separate independent reporting from official communications. Continue polling and record tabs without hiding local news.
7. **Release gate**: audit all 435 pages for a functioning news panel; record count of districts with ≥1 current story, ≥2 distinct publishers, stale feeds, quarantined items, and no coverage. Do not claim 435 live feeds while coverage is incomplete.

## Scheduling and budget
Use the existing free GitHub Actions updater, with rate-limited state batches and staggered refreshes, not a new paid feed or scraping vendor. Published news checks may run every 15–60 minutes on a best-effort basis. Per-source RSS change frequency, publisher terms and GitHub scheduled-run reliability control effective freshness. Publish a daily coverage report and a weekly source-quality audit.

## Milestones
- **M0 / now:** retain honest IA-01 coverage and show transparent unavailable notices for other districts; generate a 435-row district news coverage audit.
- **M1:** cover all 50 states with vetted source registries; deliver a small pilot of geographically different states with proven matching, dedupe and provenance.
- **M2:** expand through all 435 districts with explicit coverage counts and zero false assignments in review samples. Any uncovered district stays visibly unfilled.
- **M3:** add district-specific issue coverage, officeholder votes and archives, image licensing checks, and automatic coverage quality reports.

**No invented deadlines, no fictional article counts, no claim that a 435-district importer exists until implemented and certified.**
