# The Political Life & Times · Source and Prediction Policy

**Editorial purpose:** Independent, nonpartisan U.S. politics newspaper. Never substitute a quote, model forecast, or projected seat count for a certified election result.

## Sources, fees and permitted uses

| Desk | Source | Use | Access / conditions |
| --- | --- | --- | --- |
| Historical elections | MIT Election Data + Science Lab, https://electionlab.mit.edu/data | Official/verified returns, backtests and district fundamentals | Harvard Dataverse dataset-specific licenses and attribution |
| Election administration | State election offices / FEC official results | Ballots, certified totals, election calendars | Verify state office, election date, reporting status |
| Polls | VoteHub API, https://votehub.com/polls/api/ | Individually dated public poll records, derived averages | Free beta API; CC BY 4.0 attribution required |
| Campaign finance | FEC / OpenFEC, https://api.open.fec.gov/developers/ | Cash on hand, totals, expenditure reports | Free API key / official downloadable bulk files |
| Congressional actions | Congress.gov API, https://api.congress.gov/ | Bills, votes and legislative actions | Free api.data.gov key |
| Legislative documents | GovInfo, https://www.govinfo.gov/developers | Federal legislation / documents | Free api.data.gov key |
| Demographics | Census APIs, https://api.census.gov/data.html | Official demographic context, not individual voting intentions | Free public datasets |
| Research | Pew Research Center, https://www.pewresearch.org/datasets/ | Issue attitudes, independently cited | May require a free Pew account; obey dataset terms |
| Original reporting | NPR, PBS NewsHour, Axios, ProPublica, POLITICO, BBC | Article HEADLINES, dates, publisher and links only | Feed access can change; no full articles, abstracts, photos or unlicensed excerpts |

Use public records and source-linked headlines. Never scrape articles behind paywalls or republish journalism without rights. Report a publisher as unavailable when their RSS feed is blocked. ProPublica's public-facing RSS is not a license for whole-article reproduction. Link directly to publisher.

## Existing models are benchmarks, not our own model

The initial edition's House, Senate and governor projections come from separately attributed external forecasts. The new original polling average is independent of those model forecasts. **Do not imply the original average establishes district-level win odds or congressional control odds.**

## USRS Polling Lab v1 (working original data product)

Input: VoteHub GET /polls?poll_type=generic-ballot&from_date=YYYY-MM-DD (CC BY 4.0). The Python collector:
1. Excludes self-labeled partisan/internal polls, missing data, malformed sample sizes or answers, and polls older than 35 days.
2. Requires sample size between 250 and 50,000 and a valid end date.
3. Retains at most one poll per pollster and fieldwork end date.
4. Assigns weight = sqrt(min(n, 2,500)/1,000) × 0.5^(age in days/14) × population factor (likely voters 1.15, registered voters 1.0, all adults 0.85, unknown 0.8).
5. Requires >=3 unique polling organizations and >=3 valid poll records before it displays the weighted arithmetic average; reports Democratic %, Republican % and margin.
6. Discloses exclusions, sources, dates and sample records. Publishes nothing if upstream data are insufficient. Website marks the average stale after 48 hours.

This first version has NOT been calibrated for pollster house effects, survey overlap, likely-voter changes, or past polling misses. It is an original weighted *average*, not yet a properly calibrated election prediction.

## Independently built probabilistic model: release gate

A planned version should: (a) download and verify 2018–2024 House/Senate/governor history from original public datasets; (b) identify all 2026 districts including redistricting changes and general-election candidate slates; (c) correct for incumbency, uncontested races, fundraising comparability, quality-adjusted state/district polling and the national climate; (d) quantify national, state and district correlated errors using historical calibration; (e) backtest on held-out 2018, 2020, 2022 and 2024 elections; (f) verify coverage for all 435 House seats, relevant Senate seats and governors; (g) publish methods, source versions, and calibration metrics; and (h) run Monte Carlo simulations. **Until those gates pass, forecast fields must explicitly read "model not yet certified" rather than show fabricated probabilities.**

## News wire and freshness

A separate GitHub Actions workflow runs on a 30-minute schedule. It attempts six feeds and collects publisher title, direct original URL, publisher attribution, and publication date. It rejects malformed URLs and entries older than 72 hours, and checks broad-feed titles for political topics. It records source health. It will not replace the last successful dataset unless at least two publisher feeds are accessible and at least four timely news stories pass validation. Site banner marks the last good dataset stale once six hours old. **GitHub schedule is best-effort, not guaranteed exactly every 30 minutes.** No AI-written article summaries or unlicensed images are imported.

## Source changes

If a public API or RSS feed discontinues access or changes schema, leave the last valid dataset intact with its original timestamp and surface the failure. Never silently replace actual records with guessed data, another provider's unlabelled figures, or a hard-coded fallback.


## Historical Desk v1: sourced evidence before predictions

We independently process MEDSL historical results accessed through the CC0 electiondata.dev mirrors:
- House general elections: 2018, 2020, 2022, 2024; exclude specials and runoffs.
- Senate general elections: the same four cycles; exclude specials and runoffs.
- Missing numeric vote totals are excluded, never imputed; candidate total votes include fusion-ticket votes without double-counting the candidate.
- Derive major-party vote percentages and historical elected-candidate party counts from the original vote rows.
- Store complete per-year coverage and excluded/missing-vote counts in politics-history.json. Require at least 425 valid House contests and 24 valid Senate contests per year before publication.

The first unadjusted *arithmetic benchmark* compares same-ID House district two-party vote margins 2018→2020 and 2022→2024. It reports mean/median absolute margin error and sign changes, with sample size. **It is NOT a predictive backtest or calibrated model**: district boundaries, runoffs, candidate exits and uncontested elections need more careful modeling. Historical 2024 district close-race rankings must not be represented as 2026 competitive race ratings.

A separate weekly-refresh workflow validates this independently of sports, and keeps last verified data on network failure. Future releases will combine redistricting-adjusted district history with polls, incumbency and funding, then test actual 2018–2024 out-of-sample predictions and correlated errors before any 2026 probabilistic label.


## Experimental holdout diagnostic: logistic regression v0 (no publication of 2026 odds)

A prototype uses only prior House district two-party margin divided by 10 to estimate the following election's probability that the Democrat wins. Logistic intercept and slope are fitted with an L2 penalty using **2018 House -> 2020 House** outcomes. The entire **2022 House -> 2024 House** paired set is held out from fitting. The Brier score and calibration bins are calculated on 2024 outcomes only, alongside a constant-probability baseline learned from the training set. Fitting iterations and samples are deterministic and stored in the code. These are real historical holdout statistics, but **not certified forecasting accuracy**: unchanged district ID does not guarantee boundaries and candidate effects are not included; the national election error shared across races is not modeled. No 2026 probability may be generated from this first-stage diagnostic. When any input fails validation, the published data remains unchanged.


## Official House result reconciliation, required before model certification

We cross-check each historical House cycle against the independent U.S. House Historian / Clerk published election outcome, rather than interpreting a partially parsed candidate-vote file as all 435 certified election results.

2018: 235 D, 199 R and 1 election unresolved (NC-09).
2020: 222 D and 213 R after the eventual resolution of NY-22.
2022: 213 D and 222 R.
2024: 215 D and 220 R.

Official sources: https://history.house.gov/Institution/Party-Divisions/Party-Divisions/ and https://history.house.gov/Institution/Election-Statistics/Election-Statistics/

House charts display only these separately attributed *official seat winners*. MIT vote-record counts are visibly labeled incomplete whenever they fail reconciliation, with explicit excluded/unknown candidate records in politics-history.json. We do not fill missing candidate votes from party totals. If any of the four historical cycles are not reconciled, the experimental calibration figures are not displayed in the newspaper even when an exploratory diagnostic can be computed. This is a prerequisite for dependable independent 2026 predictions.

## Poll source coverage and honest non-publication

The VoteHub beta API may provide fewer than three distinct eligible pollsters over the last 35 days. The national average is withheld in that case; the pipeline instead publishes `politics-poll-health.json` containing the last attempted refresh time, candidate count, valid poll count, independent pollsters, excluded records, and reasons for withholding. It does not extend the lookback to an unjustifiably stale window or backfill with invented polling numbers.


## Ranked-choice and uncertified-election safety correction

The source extraction previously treated a ranked-choice administrative row labelled **EXHAUSTED BALLOT** as if it were an individual candidate in Maine's second district. The parser now excludes named ballot-administration categories from candidate vote rankings. Maine's second district in 2022 and 2024 is reconciled to the official state-certified Democratic winner, Jared Golden, and its raw two-party margin is excluded from longitudinal forecasting comparisons until the final round totals and candidate vote decomposition are verified. Official Maine 2022 ranked-choice results: https://www.maine.gov/sos/sites/maine.gov.sos/files/inline-files/Rep%20to%20Congress%20Dist%202%20RCV%20results.pdf ; Maine election archives: https://www.maine.gov/sos/elections-voting/election-results-data/

The uncertified 2018 **NC-09** contest is excluded from recognized winners, even when unofficial rows have numerical vote totals. It is retained in the audit as an unresolved election, matching House Historian documentation. The remaining missing uncontested candidate records are still not imputed. No 2026 election forecast is certified by these repairs alone.


## Census-based completeness audit for every U.S. House election cycle

We independently check the list of House district IDs in MEDSL's raw general election rows against the U.S. Census Bureau's 2010 (for 2018–2020) and 2020 (for 2022–2024) **435-seat state apportionments**: https://www.census.gov/data/tables/time-series/dec/apportionment-data-text.html. The source is the official U.S. Census Bureau, with the 2010 and 2020 historical allocations explicitly encoded and checked to sum to 435. A single-seat state's district is coded 00 as in MEDSL's schema.

District identifiers outside the 50 state allocations, including Washington DC and territories' nonvoting delegates, are excluded from House majority reconstruction even when a news-oriented data file includes them. They remain listed in the audit under `unexpected_districts`. Missing districts, unexpected districts, and empty numerical counts are never guessed or silently resolved. An extraction is not certified as complete until the source list, the official 435-seat totals and all candidate-level results reconcile. We never treat a total House district count alone as proof that individual contests are correct.


## Candidate-by-candidate audit of unopposed seats

The raw MIT election data does not provide numeric votes in several uncontested 2018–2024 House districts. We separately verified the *identity and party of each winner*, without inventing a vote count, using original state election office lists, the official FEC 2022 results, and the official Oklahoma State Election Board 2024 record. District-specific candidates and their government-source links appear in `VERIFIED_UNOPPOSED_WINNERS` in the historical collector; each candidate name is cross-checked against the actual MIT row before being appended as a **winner-only overlay** with `numeric_votes: null`.

These overlays reconcile winner-party counts, not quantitative two-party margins. Candidate/vote-data reconstruction remains uncertified while numeric counts are absent or raw rows have not been verified against authoritative returns. The historical Brier demonstration is not shown publicly until full model calibration gates pass.


## November 2026: provenance-first model input expansion

The independently maintained `politics-historical-contests.json` is a machine-readable, original MEDSL-derived per-contest ledger of House and Senate general elections in 2018, 2020, 2022 and 2024. Rows include actual source vote counts, verified candidate identity fields and the original MEDSL API partition URL. Races lacking vote counts and non-comparable RCV margins are not silently filled. **A district ID is not enough to prove stable geography between elections.**

We separately collect two original government datasets at zero subscription cost:

* `politics-fec-inputs.json`: FEC's **2026 candidate master** (`cn26.zip`) plus original candidate financial summary (`weball26.zip`), joined by immutable FEC candidate identifier. Retain registrations and campaign finance totals only. Never publish candidates' residential/mailing addresses. The candidate master includes filings outside the final general-election ballot and candidates who registered for future or earlier cycles; **it is not a certified 2026 ballot roster**. Candidate finance totals have varying coverage end dates and may include committee-to-committee transfers, so they are not directly comparable without normalization. Source: https://www.fec.gov/campaign-finance-data/candidate-master-file-description/ and https://www.fec.gov/campaign-finance-data/all-candidates-file-description/.
* `politics-census-inputs.json`: U.S. Census Bureau 2020–2024 ACS 5-year profile for the **119th Congress's 435 voting House districts**, recording population, median household income and the age-25+ bachelor's-degree share. These are sampling-based estimates, **not voting results**. The geography must be matched to actual 2026 district boundaries before usage. Source: https://www.census.gov/data/developers/data-sets/acs-5year.html.

The reproducible `politics-sim-readiness.json` ledger lists 13 validation inputs and marks all 2026 House, Senate and governor original win probabilities unavailable until the official candidate ballot, redistricting, 2024 presidential district baselines, quality-checked polling, Senate/governor training data and held-out correlated-error calibration are complete. Other organizations' predictions are never used as training features. Automated source failure preserves the last validated data, with timestamps and explicit provider-health information.


## Census API security and no-cost access (November 2026)

As of **May 12, 2026**, the Census Bureau requires a **free API key for every Census Data API request**. The original Census collector received HTML labelled "Missing Key" instead of the 435-district ACS JSON response; it was correctly refused and no fake demographics were published.

The pipeline now reads an optional protected GitHub Actions secret named `CENSUS_API_KEY`; it never writes the credential to JSON, JavaScript, logs or the public repository. Until that secret is configured (or a verified direct Census bulk file is used), `politics-census-inputs.json` remains clearly marked awaiting ingestion. Official key registration (no fee): https://api.census.gov/data/key_signup.html. Documentation: https://www.census.gov/data/developers/guidance/api-user-guide.API_Key.html.

FEC master files also include filings for nonexisting congressional districts; the raw filing is retained but flagged `district_within_2020_apportionment=false`. That candidate must NOT be interpreted as an eligible ballot contender for the 435-seat simulation.


## November 1, 2026 — Original county presidential voting and FEC race inventory

We collect the MIT Election Data and Science Lab **2024 county presidential election results** through the free, public electiondata.dev CC0 API partition `https://api.electiondata.dev/v1/county-president/table/2024.json` (original: https://doi.org/10.7910/DVN/VOQCHQ). `politics-2024-county-presidential.json` contains all received 2024 candidate vote records, normalized into county-or-equivalent two-party margins, plus independently computed state summaries. The collector requires all 50 states plus DC, at least 2,300 geographies and at least 100 million two-party votes. Null and duplicate candidate vote rows are disclosed, never synthesized. These are *historical county returns*, **not** district-level 2024 presidential vote results. In particular, no 2026 House-district baseline is constructed by assigning a whole county's votes to districts that split it. Matching precinct voting returns to verified 2026 House boundaries remains a release gate.

An independent zero-cost GitHub Actions workflow ingests and validates the county data, preserves last-good data on failure, and refreshes the simulation-readiness audit. `politics-presidential-source-status.json` transparently dates success/failure. Source-specific licensing and original data credit are included in the file.

`politics-fec-race-index.json` groups the **2026 FEC candidate master registrations** into all 435 voting House districts and 50 states' Senate filing inventories. It includes original FEC candidate IDs, filing-party counts and presence of linked financial summaries, but **zero certified 2026 general-election ballot lists**. A registered candidate may have lost a primary, withdrawn, changed districts, or never appeared on the November general-election ballot. FEC Senate registrants in a state do not prove that state's Senate seat is on the November 2026 ballot. The index rejects registrations outside current Census apportionment rather than inventing a district.

In the FEC all-candidates file, raw receipts/disbursements may include transfers between the same candidate's authorized committees. We now separately retain the FEC's `TRANS_FROM_AUTH` (7th) and `TRANS_TO_AUTH` (9th) columns and calculate receipt/disbursement amounts **excluding** those transfers only when the relevant FEC field is numeric and nonnegative. Missing component figures result in null adjusted totals, never estimated values. The FEC's original methodology explains why internal transfers may be double-counted: https://www.fec.gov/campaign-finance-data/all-candidates-file-description/.

The evidence readiness ledger now tracks 15 independent dimensions. The new datasets remain *partial* inputs. No new Senate, House or governor win probabilities are published without state-certified nominees, district-boundary and precinct vote crosswalks, polling source integrity, and held-out forecast calibration.


## Independent Monte Carlo simulation mechanics v1 — algorithm ready, predictions not released

The new `scripts/politics_sim_engine.py` implements reproducibly seeded Monte Carlo sampling of *two-party Democratic vote margins in percentage points* with three distinct sources of election uncertainty: a **shared national swing**, **shared state swings**, and **race-specific residuals**. The shared shocks create correlated election outcomes, avoiding the severe underestimation of seat uncertainty that comes from independently simulating each contest. A 435-race U.S. House contest can be simulated with the legally relevant 218-seat control threshold. The function supports 2,000+ draws and returns percentile seat distributions and race-level win frequencies **only as internal model results**, never a current published forecast until original sources and error parameters are independently validated.

There are **no default national, state, or race error standard deviations**, and the engine does not import DDHQ or any other forecaster's odds. Those dispersion parameters must be measured from genuine historical out-of-sample calibration. Its `run_certified_2026_house_model` entry point refuses to execute when any required source manifest item is absent: official 2026 nominees, 2024 presidential returns matched to the true 2026 districts, current boundaries, credible individual race surveys, calibrated residuals and all 435 House races. It additionally verifies every model input is independently sourced. The public `politics-engine-status.json` contains only the certification gate and progress evidence; **zero 2026 probabilities and zero toy-demo probabilities**. The unit tests deliberately use made-up toy contests only to verify the algorithm, not to produce a news forecast.

For Senate and governor models, contest sets, incumbent/holdover seat baselines, electoral rules, tied Senate chamber handling, governor election calendars, and office-specific correlated error calibration must be added before publishing election control probabilities. No fictional or borrowed external probability may be used to fill gaps.

## Historical election lookback policy — November 1, 2026

Data retention and forecast training are **different policies**. Retain original, attributed election returns back to 2000 when free and schema-compatible, but weight the more recent comparable cycles more heavily and avoid direct district-margin training across unverified district boundaries. The 1976–1998 archive, where publicly available, may be consulted for historical reporting or rare-event research but is not a default direct 2026 input.

* **Primary House model-training window:** 2012–2024 general elections, with explicit district maps/vintage and separate treatment of uncontested elections. 2000–2010 House returns are archival/reference data; congressional maps were redrawn after the 2000 and 2010 censuses, and some states have additional changes within decades. Historical party labels and district numbers alone do not prove geography continuity.
* **Statewide Senate/presidential archive:** 2000–2024; original election cycles and special elections tracked distinctly, with demographic and time normalization. Since Senate races occur in staggered cycles, the larger statewide archive adds event coverage. Historical governor returns can begin 2010.
* **Recent national/shared swing calibration:** 2012–2024 including both presidential and midterm general election cycles, with strict forward-chaining backtests rather than randomly mixing years. Evaluate model stability under 2016→2018, 2018→2020, 2020→2022 and 2022→2024 (only map-compatible contests), measuring Brier scores, competitive-race calibration, and correlated errors.
* **Stop/go rule for older vintages:** Add further data only if a predeclared held-out test improves, uncertainty calibration meaningfully improves, or scarce events receive a documented larger sample. Otherwise keep the archive but cap the active model window. A model that looks better only in-sample should not gain additional years.
* **2026-specific priority:** Verified candidates, 2026 district boundaries, map-aligned 2024 voting baselines, current survey records, and true historical polling errors are more urgent than pre-2000 returns.

Public historical data: MIT Election Data and Science Lab House 1976–2024 and county presidential 2000–2024 datasets, at https://electionlab.mit.edu/data/; Census Bureau 120th-Congress boundaries https://www.census.gov/programs-surveys/decennial-census/about/rdo/congressional-districts.html. No third-party forecast probabilities are ever training features.

## The independent simulation engine, historical expansion, and publication threshold

`scripts/politics_sim_engine.py` is an implementation of **simulation mechanics**, not a publicly certified 2026 election forecast. Given original independently estimated Democratic-vs-Republican vote margins and empirically calibrated standard deviations, the engine samples a common national error, a common error within each state, and individual district errors. It reports seeded Monte Carlo seat distributions and individual chances of Democratic plurality, with the House majority threshold set to 218 of 435 voting seats. Results cannot be published until `run_certified_2026_house_model` passes explicit official-ballot, 2026 map, precinct-aligned presidential baseline, audited poll records, trained held-out calibration, all-435-race, and error-scale checks. In today's data these gates **fail**, and `politics-engine-status.json` publishes **zero** probabilities. Only synthetic fixture data are used for unit tests; no fabricated probabilities are presented as news.

Original 2012, 2014, and 2016 House and Senate general-election returns are ingested separately into `politics-historical-archive.json`, with fresh source QA, missing numeric vote records disclosed, 2010 Census House apportionment checks, and explicit indicators that district boundaries and official chamber totals are **not reconciled**. The experimental 2018–2024 model remains separate; extending the archive must not silently improve any public win-probability claim. Additional older years should be gathered only when their provenance is clear, they fill a specified validation need, and the data are shown to improve forward-chronological out-of-sample calibration.


## Historical collection STOP rule: the year 2000

Our permanent historical acquisition cutoff is **2000**. The archival desk contains separately sourced House/Senate general-election returns for 2000–2010; a second archive retains 2012–2016, and the primary historic desk retains 2018–2024. These historical election observations are original MIT Election Data and Science Lab returns and are not other organizations' forecasts.

**Do not extend this archival acquisition to 1998 or earlier.** Retain older-vintage historical records strictly for research, broad historical swing statistics and temporal backtesting; do not impute old district numbers onto 2026 geographic boundaries. The source partition for each election year is recorded with the observations, and unopposed/missing numeric vote records are not fabricated.

Further original-data acquisition should prioritize the actual 2026 election: state-certified general-election candidate rosters, district boundaries/precinct crosswalks, 2024 presidential votes recomputed for current districts, original poll releases and historical prediction errors. The strict forecast certification gates remain unchanged.

## 2026 official candidate-source ledger: source review and ballot appearance

The public [official ballot explorer](politics-ballots.html) is backed by `politics-official-ballots.json`, independently checked by `scripts/politics_ballot_audit.py` and summarized in `politics-ballot-audit.json`. Source integrity and availability are monitored separately in `politics-ballot-source-health.json`. These are dated state-government observations, **not** a nationwide certified November ballot file or permission to publish model odds.

In the November 1, 2026 review, North Carolina's state election board supplies all 14 House offices and the Senate contest; Florida's Division of Elections supplies all 28 House offices plus Senate, but **FL-10 must be treated as a separate unopposed office, not a ballot contest**, verified through its individual official state record. Wyoming's Secretary of State original 2026 general-election candidate roster supplies its at-large House office and Senate contest. Together these provide 43 documented House offices (42 of which appear as House general-ballot contests), 3 Senate contests, and 134 candidate entries; 392 House offices remain not yet independently documented. These dated figures change only after independently reviewed source transcriptions.

An original state filing may include qualified write-ins; **write-in candidate names are not printed as regular ballot choices**. An unopposed candidate may be elected without a November contest. `contest_status` is essential to prevent silently treating every listed House office as an actual election-night matchup. No winner probabilities, vote-share projections, or estimated outcomes are inferred from candidate rosters.

California and Nevada state source links have been identified but the candidate lists are not yet source-transcribed. The source monitor encountered access limitations for the California document (too large for the configured transfer limit) and Nevada page (HTTP 403); failure is visible and must not be filled with third-party forecasts or invented slates. SHA-256 changes are prompts for re-review, not proof that candidate names or ballot statuses changed.

Every ballot record must preserve original state publisher/source URL, state and office, actual printed-ballot or unopposed status, original candidate name, official party label, and review date. FEC registrations and campaign-finance reports are **never** treated as certified state ballots or identity matches until independently reconciled. Only the approved government document hosts are allowed in this ledger. The source-probe workflow does not automatically overwrite transcribed names.

**Forecast gate:** `politics-sim-readiness.json` reports a partial government roster. The 2026 House/Senate/governor original forecasting engine remains uncertified and publishes exactly zero independent 2026 winning probabilities. Full state-certified candidate coverage, 2026 district geographies, 2024 presidential precinct crosswalks, original polling and held-out correlated-error calibration are still prerequisites.
