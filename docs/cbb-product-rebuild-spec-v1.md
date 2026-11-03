# Sporting Life and Times — College Basketball Product Specification v1.0

**Status:** Approved design direction; implementation is not complete.  
**Scope:** NCAA Division I, II and III, men's and women's editions. First production milestone: four connected Division I pages.  
**Identity:** SPORTING LIFE AND TIMES (never "The" in brand lockups), abbreviated SLT. No italic headlines, labels, marks, or scorebugs.  
**Release discipline:** Separate staging branch, test, inspect on desktop and mobile, consolidate changes, then release. Preserve existing workflows, IDs, Elo and feeds. All resources must remain free.

## 0. Locked visual decisions

| Token | Value | Use |
|---|---|---|
| Midnight navy | #071D3C | Masthead, scoreboard chrome, navigation |
| Royal blue | #1355AD | Master SLT brand, highlights |
| Basketball crimson | #A6192E | NCAA basketball-specific edition bars |
| Paper cream | #FFF6E0 | Default scorebug, cards, newspaper areas |
| Broadcast gold | #F1BD39 | Rules, divider details, accents |
| Silver | #C5CFDE | Tertiary strokes, muted rails |
| Body text | #14263C | Readable text on paper |

- Appearance: sophisticated late-1980s/early-1990s televised sports graphics with precise grids, strong horizontal rules, tightly set editorial typography; no distressed textures, faux-3D objects, generic pill cards, random gradients, excessive empty space, or animated tickers.
- Font hierarchy: condensed heavy **upright** display face for headlines and scores; legible upright sans-serif for data; restrained serif acceptable only for article bodies. Do not use italics anywhere in the SLT visual components.
- Primary master masthead shows a globe with North and South America slightly left of center and Europe visible to the right. All brand name text reads **SPORTING LIFE AND TIMES**. Small SLT identification should not crowd the score.
- The page's basketball crimson is the *edition* color, never a replacement for real institution colors or logos. NCAA teams keep authentic logo assets and verified school palettes.
- Team crests: a circular shell with exactly **two rings**, primary and secondary institutional colors; no white ring, no third ring, no clipping, and consistent sizing. Logos and asset mappings must come from the existing shared identity contract.
- Championship pennants: one star for **every verified NCAA championship** within the displayed sport/gender/division, never an arbitrary cap. Center the complete star group above the logo; use school or closely adjacent institutional colors with accessible contrast. No italics on stars. All logos occupy the same horizontal baseline, including teams with zero titles; stars use their own reserved space. Do not conflate NCAA titles with NIT, NAIA or other championships.
- **Away team first, home team second** in scoreboards, box scores and calendars. Never display projected ties for basketball. No fake numbers or data.
- Two scorebug treatments: cream with **thin team-color accent** is the default; whole-row uniform colors are reserved for featured games **only when actual uniforms are verified**. A white jersey may produce a white full-row panel with a clearly contrasting navy border/text; otherwise use school palette accents as *brand colors*, not described as jersey colors. No uniform-shaped icons.

## 1. Sitewide navigation and information architecture

Shared navigation, on every CBB screen: Front Page / Games / Live Game Center / USRS Rankings / Teams / Conferences / Bracket Watch / Players / Arena File. A Men/Women selector is prominent, persists across navigational destinations, and changes the entire data context. Division selector includes Division I, II and III; never mix men's/women's or divisions in ratings, news or schedule calculations. The league must remain usable on a 375px viewport; tables may scroll within their own component but the document must not overflow horizontally.

Common building blocks and semantic names:
- SLTBrandMasthead: globe + official name; condensed title; broadcast-gold rule.
- CBBEditionRibbon: NCAA crimson identity strip, season, gender, division.
- CBBGlobalNav: route-consistent navigation, accessible focus/selected states.
- CBBDateBar: ET date, previous/next controls, today action, native date picker.
- CBBBroadcastBug: game state, two team rows, score, source-aware secondary line.
- CBBTeamIdentity: exact logo, institutional primary/secondary colors, name, optional AP ranking and actual record.
- CBBChampionPennant: centered NCAA stars in reserved space above aligned logos.
- CBBProjectionStrip: USRS win probabilities, spread/score/uncertainty (only where backed by valid model input), visibly distinct from observed results.
- CBBCourtCast: live game / gamefile analysis with known status and source freshness.
- CBBSchoolProfile: school banner, logo, team record, team page.
- CBBConferenceTable: overall and conference-only W-L-PCT, conference tiebreak source/notes.
- CBBSourceStamp: source + retrieved timestamp + verified/live/stale/unavailable state.
- CBBEmptyState: meaningful "not supplied" explanation without invented placeholders.
- CBBStatGraphic: compact comparison with labeled values, appropriate units, dates and attribution.

Data contract: each visual feature accepts explicit metadata including gender, division, season, game ID, school IDs, source URL/type, checked_at, and status. Reuse permanent IDs. No new importer, no paid services, no extra GitHub workflow unless separately approved.

## 2. First four pages: fixed wireframe and acceptance contract

### A. NCAA Front Page — ncaam.html

**Above the fold, desktop:** SLT masthead → crimson NCAA edition ribbon → top navigation with gender/division switches → compact four-column editorial layout:
1. Lead headline block: greatest newsworthy story supported by actual published facts; prominent team branding; no fake "breaking" story.
2. National scoreboard rail: live first, then imminent games and verified finals. Cream mini scorebugs with real logos and readable scores.
3. USRS top-five panel: leaderboard with movement, Elo, records, verification date, explicit model/poll labels.
4. News desk: multi-source published headlines, source, publication timestamp, image only if authentic/licensed.

**Below the fold:** Conference Race (leading teams + conference W-L), Upset Watch (valid model only), Today's Leaders (sourced stats), Tournament Outlook (explicit provisional label), Find Every School, newspaper story modules, freshness/coverage disclosures.

**Must not:** show empty chart placeholders as complete data, pass off predictions as real scores, label USRS rank as AP rank, show a single sport palette for all school logos, imply women/DII/DIII are the same Elo system.

**Code:** ncaam.html; mbb-newspaper.js; mbb-newspaper.css; college-basketball-gender.js; cbb-live-center.js; cbb-live-center.css; shared SLT components.

**Acceptance:** four above-fold zones visibly legible at 1440px and 390px, real links, school identities verified, ET date visible, scoreboard order away/home, news updates attributed, zero page overflow, no unrelated duplicated feed rail.

### B. Daily Slate — ncaam-slate.html

**Above the fold:** condensed brand + edition strip → **TODAY ON THE COURT** → functional native ET date navigation → gender/division selector → fixed filter rail (Live / Finals / Upcoming / Ranked / Conference / Upset Watch). Filters must be genuine and work after a live refresh.

**Game tile:** slim status/TV/date header; cream two-team scoreboard, each name starts at the same position beside an approved crest; AP poll ranking only when sourced; school record; large numerals for sourced scores; thin institutional or confirmed uniform-color accent. Two rows per team for live metadata when available. Bottom features venue/city, tipoff network, USRS model estimate (clearly projected), and Gamefile link. The feature card may use the expanded full-uniform treatment only when actual uniform data is sourced. A title pennant uses verified centered stars in a separate lane; team logos remain level.

**Game grouping:** On Now / Coming Up / Finals; featured games and conference sections after the core chronological ledger. Exclude exhibition games from regular-season Elo; label exhibitions visibly if shown as informational fixtures. Never duplicate an event under different IDs.

**Code:** ncaam-slate.html; ncaam-slate.js; ncaam-slate.css; mbb-slate-insights.js; mbb-logo-system.js / .css; compatible CBB game link helper.

**Acceptance:** matching official fixture ID/team pairing; correct date in ET; changing dates and gender filters updates the *whole* slate; no schedules rendered as finals, no mismatched opponent logos, no phantom arenas/broadcasts; verified star count, alignment and mobile fidelity.

### C. Live Game Center — cbb-game-center.html

**Above the fold:** date and Men/Women/D-I selector; live game count and source freshness; one genuine live spotlight (or an honest upcoming/final state when no games live); responsive quick jump list; cream live scoreboard rails. Do not show decorative "LIVE" when data is final/stale.

**Each team's two-line scorebug:**
- First line: AP ranking where verified; authentic two-ring school logo; full/short institution name; actual W-L; current score.
- Second line: **TO** timeout dots, **CH** coach's challenge dots, numeric period/team fouls, rules-correct **BONUS** label, and held-ball/alternating-possession arrow **on the relevant team row**. These are independently sourced values; omit or show "—" when unavailable. Dots are never used as bonus indicators. A possession arrow never represents live offensive ball possession.
- Separate compact shared status cell: period, game clock, and source freshness. Avoid extra faux jersey shapes.

**Below:** box-score source statistics, named points/rebounds/assists leaders, scoring-run timeline only if sourced, USRS upset indicator with explicitly pregame model context, non-live replay/latest-final view.

**Code:** cbb-game-center.html; cbb-live-center.js; cbb-live-center.css; slt-basketball-indicators.js; cbb-live-court.js / .css (when providing live court visual).

**Acceptance:** real live/final state transitions on same game ID; update without duplication; timer label always correct; meaningful unknown-data display; team-specific indicator accessibly labeled; no invented possession; non-DI coverage must not be silently presented as DI.

### D. Single Gamefile — cbb-gamefile.html

**Above the fold:** source-backed game masthead (away top, home bottom), record/rank/score, game state and clock, venue + location + network and source label. Featured full-color jersey treatment allowed *only with verified uniforms*. Immediately beneath: game result narrative **generated from source-backed data** (if no factual narrative is available, show structured event summary, not fabricated text).

**Middle:** quarter/half score grid, game flow / lead changes (if actual play-by-play exists), side-by-side team efficiency and traditional stats, player leader images/headshots if authentic, full sortable player box-score, sources and last checked time.

**Below:** pregame model snapshot frozen at tip; model calibration disclaimer, upcoming schedule for both schools, clickable opponent/team pages, Arena File module, scouting notes grounded in source stats. Projected final scores must never replace live scores. Completed-game views must show the model's archived *pregame* prediction if available, not a postgame reconstruction.

**Code:** cbb-gamefile.html; cbb-live-center.js; cbb-live-center.css; cbb-live-court.js / .css; cbb-radio-companion.js / .css; existing certified team/player-box data.

**Acceptance:** valid deep link to one game ID and selected date; complete stats attribution, state transitions, easy back links, clear missing-data states, readable 390px / 1440px; no fabricated commentary, possession detail or uniforms.

## 3. Connected pages — build to equal design quality

| Page | Present page / renderer | Locked content contract |
|---|---|---|
| Team Desk | ncaam-team.html, mbb-newspaper.js, mbb-current-roster.js, mbb-team-calendar-boot.js | Authentic school crest, colors, fully sourced season schedule, venue/city, network/time, validated roster/headshots, stats, coach, conference, Elo and arena links |
| Conference Desk | ncaam-conference.html, mbb-newspaper.js | Complete school directory, conference-specific W-L-PCT, tiebreak evidence, race story, sourced schedule/results, conference tournament bracket |
| USRS Rankings | ncaam-elo.html, mbb-elo-primary.js / .css | D-I men's own 1500 start and current validated ranking, arrows, team crest, W-L, conference, one-to-one team IDs, explicit filter source |
| Bracket Watch | ncaam-tournament.html, mbb-selection-comparison.js | 68-team projection labeled unofficial, projected auto bids and First Four, bubble movement and source criteria; no false NCAA committee designation |
| Player Leaders | ncaam-players.html and existing player loader | Category toggles, school + logo + authentic athlete image, denominator/missing-data eligibility, sortable stats |
| Arena File | ncaam-arena.html, mbb-arena-file.js / .css | Source-verified venue/city/capacity/history/photos with attribution, school connections; missing fields visibly marked |
| D-II men/women | d2-mens-basketball.html / d2-womens-basketball.html, d2-basketball.js / .css | Same SLT visual contract, isolated calendars/ratings, accurate conference standings, verified logos, full schedule certification |
| D-III men/women | d3-mens-basketball.html / d3-womens-basketball.html, d3-basketball.js / .css | Same contract; championships by correct division/gender, verified arena and fixtures, no false certified-count claim |
| D-I women | Existing women toggle, ncaaw.html / ncaaw-team.html and college-basketball-gender.js | Entire-page gender switch, independent roster/rank/schedule/metrics and authentic crests; no men/women cross-contamination |

## 4. Design-specific data and source rules

- The school identity registry is a **single source of truth**: ID, school official name, approved logo artwork, primary and secondary verified colors; all divisions map IDs separately and explicitly. No initial-letter fake logo when a genuine identity is known.
- Each game has one canonical ID with away/home school IDs, season, division, gender, event kind (regular season, exhibition, postseason), official/provisional status, and provenance.
- Competition and period rules **depend on season and governing body**. NCAA men's/women's bonus rules are not interchangeable. A team bonus is the result of opponent fouls, not the team's own.
- Timeout and challenge dots show **remaining / allowance** only if both are supplied and plausible for that particular game. If the feed lacks those values, display a dash or omit, never estimate.
- Coaches' challenges: do not hard-code a universal maximum across leagues or seasons; use the regulation applicable to the competition and the sourced current state.
- Alternating possession arrow: show only when a reliable feed explicitly supplies the team entitled to the next alternate-possession award. Never infer it from offensive possession.
- Uniform colors: use only if game-specific evidence confirms what is worn. White must be distinguishable from cream with a dark outline. Otherwise the thin stroke uses institution colors **without claiming it depicts the jersey**.
- Data integrity labels: Verified official, Source-reported provisional, Delayed/stale, Not available. Show source date on scoreboard, statistic and prediction.
- Model forecast must use a chronologically proper pregame state: team-only, independent gender/division Elo and season reset to 1500. No exhibition contamination, no postgame input leakage, no projected basketball ties.
- Bracket forecasts are **editorial probability models** and not NCAA committee rankings. AP and Coaches polls and USRS rankings must remain distinctly labeled.
- Headlines/photographs: real publishers/assets with permitted use; not fabricated photos, stories or atmosphere. No invented arena capacities, attendance, rivalries, broadcasts, officials or records.
- Keep existing no-cost public sources, GitHub Pages, existing deployment and refresh workflows. No new paid APIs.

## 5. Build checklist: concrete work packages in order

### P0 — shared foundation (one staging release)
- [ ] P0.1 Inventory every CBB page/renderer and record current visual baseline screenshots at 390px and 1440px.
- [ ] P0.2 Introduce one versioned CBB component stylesheet/script. Reconcile existing slt-retro-identity and slt-broadcast-overhaul styles; do not keep layering contradictory CSS overrides.
- [ ] P0.3 Create shared SLTBrandMasthead, CBBEditionRibbon, CBBGlobalNav, CBBTeamIdentity, CBBBroadcastBug, CBBSourceStamp with a consistent data API.
- [ ] P0.4 Preserve the canonical two-ring logo owner. No multiple decorative wrappers and no clipping.
- [ ] P0.5 Build a verified championship registry with school ID / championship year / gender / division; reserve the centered stars lane so logo baselines stay fixed.
- [ ] P0.6 Validate Men/Women and D-I/D-II/D-III routing, deep links, and accessible mobile navigation.

### P1 — visible complete launch, all four core pages
- [ ] P1.1 Rebuild ncaam.html: editorial four-zone front, real news, scoreboard, rankings, conference and school discovery; instrument real source stamps.
- [ ] P1.2 Rebuild ncaam-slate.html: date, live/final/upcoming segmentation, full two-row source-backed scorebug, verified pennant stars, deep-linked cards and model context.
- [ ] P1.3 Rebuild cbb-game-center.html: live game state, authentic logos, second rows, timeout/challenge/bonus/held-ball indicators, source-safe side rail.
- [ ] P1.4 Rebuild cbb-gamefile.html: single reliable scoreboard, real half-by-half/quarter scoring, player/team sources, roster/venue integration, mobile scroll tables.
- [ ] P1.5 Review actual page screenshots on desktop and mobile; fix layout, identity, typography, links, and any false/unknown states. All four must feel visually related.

### P2 — depth and cross-page completion
- [ ] P2.1 Rebuild ncaam-team.html with arena profile, schedule ledger and school-identity standards. Verify both sides' copies of each game and real broadcast/venue data.
- [ ] P2.2 Rebuild ncaam-conference.html with conference-only standings, tiebreak notes, tournament bracket and news.
- [ ] P2.3 Rebuild ncaam-elo.html, ncaam-tournament.html, ncaam-players.html and ncaam-arena.html; add editorial infographics only where underlying data exists.
- [ ] P2.4 Give women D-I full functional parity on all appropriate pages. Audit independent data and complete logo mapping.
- [ ] P2.5 Extend the same shared system to D-II and D-III men/women, without pretending their incomplete schedules or venues have been certified.

### P3 — release gates, rollback and publication
- [ ] P3.1 Run syntax, static release and existing newspaper/league integrity tests, plus focused source-integrity checks for duplicated games, event IDs, stadiums and gender/division crossover.
- [ ] P3.2 Browser screenshot audit: 375/390/430px phones, 768px tablet, 1280/1440px desktop; verify zero document-level horizontal overflow, no clipped two-ring crests, aligned logo baselines, no italic typography, legible score/foul dots.
- [ ] P3.3 Verify model and live-source correctness against selected games from each phase, including white-jersey/no-jersey-data and missing foul/timeout scenarios.
- [ ] P3.4 Stage changes on one branch, compare before/after, review GitHub Actions failures **before** merge, keep a rollback commit, consolidate release to main once cleared.
- [ ] P3.5 Confirm GitHub Pages deploy and **verify the actual public pages**; provide screenshots and explicit counts: pages reviewed, logos verified, game ledgers reconciled, missing arenas/network/time fields, unresolved failures.

## 6. Definition of done

A product rebuild **does not count as complete** just because HTML/CSS or a PR was merged. It is complete only when each page uses this coherent broadcast language; controls and deep links work; authentic school crests are aligned; championship stars are counted and positioned correctly; sports/gender/division records do not mix; every claim can be traced to its source; data/ratings refresh without regressions; and the deployment is demonstrably visible on public pages at both mobile and desktop widths.

**Minimum release evidence:** before/after screenshots of each of the four first pages at phone + desktop sizes; automated test summary with passes/failures; verified published Pages URLs; itemized remaining gaps. Until then, show implementation as **in progress**, not "done".
