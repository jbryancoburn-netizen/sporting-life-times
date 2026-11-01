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
