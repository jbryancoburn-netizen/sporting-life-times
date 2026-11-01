# Political Life & Times — House race card, release 2

**Date:** November 1, 2026 · **Surface:** `politics-house-state.html` and its 435 linked district reports.

## Editorial promise

The first screen answers: **Which direction do the available facts point, who is running, and why?** The page should feel like an engaging election-night newspaper while keeping measured votes, reported polls and independent modeling separate. The system does not yet have calibrated or certified 2026 win probabilities. **Never render a 58%-42% win-odds bar as a substitute for a poll's actual 58%-42% response shares.**

## Phone hierarchy — card, top to bottom

| Order | Element | Behavior |
|---|---|---|
| 1 | Deep-ink masthead | Congressional district large; 50–55px party indicator and accessible arrow control; neither is a forecast guarantee. |
| 2 | **Early race read** | Largest information: two-line qualitative label (e.g. “Early Republican edge” or “Signals conflict”). Smaller provenance badge: “2 aligned signals,” “poll only,” “historical only,” or “limited source.” No false precision. |
| 3 | **Candidate faceoff** | Two photo-forward candidate panels if government-verified candidate names exist; official names, party badges, source-matched photographs; initials when a valid licensed portrait is unavailable; show number of additional candidates. No substitution of FEC registration for a ballot roster. |
| 4 | **One honest chart** | 2026 original/secondary named-candidate poll percentages, **or** 2024 comparable actual two-party vote shares. Never plot 2024 under 2026 boundary changes; never mix polls and votes in one bar. If ineligible, use a neutral no-data panel. |
| 5 | **Why this read?** | Up to three scannable facts: 2026 poll (original or compiled), 2024 House margin (comparable or old-map warning), and independently checked candidate or geography status. Reader can see the actual input values. |
| 6 | Footer | “OPEN RACE FILE ↗”; no overly repeated methodological disclaimer. Every entire card is a keyboard-accessible link. |

## Mobile measurements

- Layout: **one column below 720px**, two columns above; 12–18px cards gap.
- Dark masthead: 80–96px; district title 30–36px.
- Early outlook: **23–29px** high-contrast serif; primary message no more than two lines.
- Candidate photo: **84–104px tall**; name at least 12px on phones. Matchup is side-by-side where practical, stacked only at narrow widths.
- SVG/party indicators: 49–55px tap targets.
- Evidence bar: 22px tall; figures 30–36px with party labels and explicit observed-data source.
- Source notes and audits remain expandable beneath the races.

## What counts as a “read,” not a certified forecast?

- **Original, source-checked named district polling**: a *polling direction*; combine with a **comparable, measured 2024 House D/R margin** as an editorial *early edge* only when the signs agree. If signs differ, “Signals conflict.” Poll ties and margins under 3 points are “Close in the poll.” A lone poll is **not a win probability**.
- **Secondary compiled named polling**: “Reported poll: [party] ahead,” or “Close in a reported poll”; never a certified projection, regardless of its numerical lead. Show compilation caveat.
- **Comparable 2024 House actual returns only**: “Historically [party]-leaning,” or “Close in 2024”; explicitly **historical baseline**, not a prediction for 2026.
- **Changed 2026 map without direct named poll**: “New map · outlook unsettled.” A 2024 district carrying the same number is not a forecast baseline.
- **No comparable numerical evidence**: “Insufficient verified data.” Gray is not a toss-up.
- **Multiple input disagreement**: spotlight as **“Race to watch”**, but do not resolve disagreement through arbitrary weighting.
- **Potential poll uncertainty**: no probability or confidence level without pollster validation, a historical error model, redistricting reconciliation, and published backtests.

## Eligibility and safety tests

- Poll D and R values must be finite, between 0 and 100, and total at most 100; identifiable named-house question only. Polls labeled compilation must retain “secondary”.
- Comparable House history requires `same_2026_geography === true`, both major parties and a non-null actual `dem_two_party_margin_pp`.
- Official candidate status is only sourced from `official_2026_candidate_snapshot`. Never infer a contender from the FEC index.
- Original candidate images must match `race_id + candidate_name + party` in `politics-candidate-photos.json`, with a link to identity and permissions. Missing images use initials.
- No probabilistic needles, Monte Carlo percentages, certified forecast claims, maps shaded as forecasts or historical results presented as 2026 model outputs until a separately validated independent model is published.
- Favor data and elegant reading over six-row verification grids. Put analytical provenance in the source section and full profile.

## Planned forecast phase (not in this UI release)

1. Verify candidate slates and district 2024 presidential returns on 2026 boundaries.
2. Train/test a regularized margin model on earlier House cycles, with out-of-sample tests across partisan and competitive districts.
3. Calibrate national/state/district correlated error and Brier scores; incorporate source-verified district polls, dates and sponsorship transparently.
4. Publish separate **MODEL** probability objects only after passing reproducibility, calibration, sourcing, geography and live-update gates.
5. Expose a full methodology link and model vintage; continue to show historical and polling evidence separately.
