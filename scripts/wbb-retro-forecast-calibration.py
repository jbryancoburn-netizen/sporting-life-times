#!/usr/bin/env python3
"""Women's RETRO held-out forecast study using the *actual* all-games 160-pass engine.

Every game's forecast uses only completed results from strictly earlier dates.
No historical ratings are carried into another season or the 2026-27 live model.
Only training data (2021-22 through 2024-25) select coefficients; the 2025-26
season remains an untouched, chronological out-of-sample test.
"""
import json
import math
import pathlib
from collections import defaultdict
import numpy as np

ROOT = pathlib.Path("data")
TRAIN = (2022, 2023, 2024, 2025)
HOLDOUT = 2026
EDGE = 75  # Existing women-specific selected historical home edge; NOT reselected on holdout.
PASSES = 160
STEP = 18.0
BASE = 1500.0
OUTPUT = ROOT / "ncaaw-score-calibration.json"


def read(year):
    path = ROOT / f"wbb-{year-1}-{year}-results.json"
    doc = json.loads(path.read_text(encoding="utf-8"))
    if doc.get("audit", {}).get("complete") is not True or len(doc.get("games", [])) < 2500:
        raise RuntimeError(f"Incomplete historical women's season {year}")
    clean, seen = [], set()
    for g in doc["games"]:
        game_id = str(g.get("id", ""))
        h, a = str(g.get("home_id", "")), str(g.get("away_id", ""))
        day = str(g.get("date", ""))[:10]
        hs, aws = g.get("home_score"), g.get("away_score")
        if not game_id or game_id in seen or not h or not a or h == a or len(day) != 10:
            raise RuntimeError(f"Duplicate or invalid history identity: {year}, {game_id}")
        if any(isinstance(v, bool) or not isinstance(v, int) or v <= 0 for v in (hs, aws)) or hs == aws:
            raise RuntimeError(f"Invalid women's final score: {year}, {game_id}")
        seen.add(game_id)
        clean.append((day, game_id, h, a, int(hs), int(aws), g.get("neutral") is True))
    return sorted(clean)


def replay(home, away, hs, aws, neutral, until, nteams):
    """Vectorized but algebraically identical to mbb-retro.js calculate().

    We recompute from baseline for each date; no ratings from the future,
    and never warm-start the 160-pass solver from its eventual full-season fit.
    """
    rating = np.full(nteams, BASE, dtype=np.float64)
    if not until:
        return rating
    h, a = home[:until], away[:until]
    sh, sa = hs[:until], aws[:until]
    n = neutral[:until]
    counts = np.bincount(h, minlength=nteams) + np.bincount(a, minlength=nteams)
    actual = (sh > sa).astype(np.float64)
    mov = np.minimum(2.5, 1.0 + np.log1p(np.abs(sh-sa)) / 3.0)
    edge = np.where(n, 0.0, float(EDGE))
    for _ in range(PASSES):
        probability = 1.0 / (1.0 + np.power(10.0, (rating[a] - rating[h] - edge) / 400.0))
        residual = mov * (actual - probability)
        gradient = (np.bincount(h, weights=residual, minlength=nteams) -
                    np.bincount(a, weights=residual, minlength=nteams))
        rating = np.clip(rating + STEP * (gradient - .006*(rating-BASE)) / (3.0+counts),
                         1100.0, 1900.0)
    return rating


def snapshots(year):
    season = read(year)
    ids = {v for row in season for v in (row[2], row[3])}
    index = {k:i for i,k in enumerate(sorted(ids))}
    h = np.array([index[g[2]] for g in season], dtype=np.int32)
    a = np.array([index[g[3]] for g in season], dtype=np.int32)
    hs = np.array([g[4] for g in season], dtype=np.int32)
    aws = np.array([g[5] for g in season], dtype=np.int32)
    neutral = np.array([g[6] for g in season], dtype=np.bool_)
    date = [g[0] for g in season]
    rows = []
    offset = 0
    while offset < len(season):
        end = offset + 1
        while end < len(season) and date[end] == date[offset]:
            end += 1
        before = replay(h, a, hs, aws, neutral, offset, len(index))
        diff = before[h[offset:end]] - before[a[offset:end]] + np.where(neutral[offset:end], 0.0, EDGE)
        for i, value in enumerate(diff, offset):
            rows.append({"season":year,"day":date[i],"id":season[i][1],
                         "elo_edge":float(value),"home_score":int(hs[i]),
                         "away_score":int(aws[i]),"home_win":int(hs[i] > aws[i]),
                         "neutral":bool(neutral[i])})
        offset = end
    if len(rows) != len(season):
        raise RuntimeError("Retrospective forecast count differs from verified games")
    print(f"Women's exact RETRO replay {year}: {len(rows)} leakage-free forecasts", flush=True)
    return rows


def score(rows, scale, slope, mean):
    x = np.array([g["elo_edge"] for g in rows], dtype=np.float64)
    outcome = np.array([g["home_win"] for g in rows], dtype=np.float64)
    hs = np.array([g["home_score"] for g in rows], dtype=np.float64)
    aws = np.array([g["away_score"] for g in rows], dtype=np.float64)
    p = np.clip(1.0 / (1.0 + np.power(10.0, -scale * x / 400.0)), 1e-8, 1-1e-8)
    margin = slope*x
    return {"games":len(rows),
            "brier":float(np.mean((p-outcome)**2)),
            "log_loss":float(np.mean(-(outcome*np.log(p)+(1-outcome)*np.log1p(-p)))),
            "margin_mae":float(np.mean(np.abs((hs-aws)-margin))),
            "team_score_mae":float(np.mean((np.abs(hs-(mean+margin/2))+
                                          np.abs(aws-(mean-margin/2)))/2)),
            "prediction_win_rate":float(np.mean((p>=.5)==outcome))}


def train_parameters(rows):
    x = np.array([g["elo_edge"] for g in rows], dtype=np.float64)
    y = np.array([g["home_win"] for g in rows], dtype=np.float64)
    margin = np.array([g["home_score"]-g["away_score"] for g in rows], dtype=np.float64)
    total = np.array([(g["home_score"]+g["away_score"])/2 for g in rows], dtype=np.float64)
    candidates = np.round(np.arange(.4, 1.601, .025), 3)
    def loss(k):
        p = np.clip(1/(1+np.power(10.0,-k*x/400.0)), 1e-8, 1-1e-8)
        return float(np.mean(-(y*np.log(p)+(1-y)*np.log1p(-p))))
    scale = min(candidates, key=loss)
    slope = max(0.0, float(np.dot(x, margin) / np.dot(x,x)))
    return {"probability_scale":float(scale), "elo_margin_slope":slope,
            "mean_team_points":float(np.mean(total))}


def main():
    training = [g for year in TRAIN for g in snapshots(year)]
    params = train_parameters(training)
    mean = params["mean_team_points"]
    fitted = score(training,params["probability_scale"],params["elo_margin_slope"],mean)
    holdout = snapshots(HOLDOUT)
    tested = score(holdout,params["probability_scale"],params["elo_margin_slope"],mean)
    raw = score(holdout,1.0,params["elo_margin_slope"],mean)
    null = score(holdout,0,0,mean)
    season_days = [str(g["day"]) for g in training]
    heldout_days = [str(g["day"]) for g in holdout]
    distinct = max(season_days) < min(heldout_days)
    # All metrics are on out-of-sample 2025-26 fixtures, with no holdout tuning.
    passed = (distinct and len(training)>=18000 and len(holdout)>=5000 and
              tested["brier"] < null["brier"] and
              tested["log_loss"] < null["log_loss"] and
              tested["margin_mae"] < null["margin_mae"] and
              tested["team_score_mae"] < null["team_score_mae"] and
              tested["brier"] <= raw["brier"] + 0.001 and
              tested["log_loss"] <= raw["log_loss"] + 0.002)
    output = {"model":"ncaaw-retro-exact-160-pass-forecast-v1",
      "status":"HISTORICAL_HOLDOUT_VALIDATED" if passed else "HOLDOUT_EVALUATED_NOT_PROMOTED",
      "sport":"NCAA Division I women's basketball", "gender":"women",
      "training_seasons":["2021-22","2022-23","2023-24","2024-25"],
      "untouched_holdout_season":"2025-26",
      "rating_engine":{"source":"mbb-retro.js calculate() exactly replayed from 1500 before each date",
                       "passes":PASSES,"gradient_step":STEP,"home_edge":EDGE,"initial_elo":1500,
                       "no_prior_season_carryover":True,"no_same_day_leakage":True},
      "parameters":{k:round(v,8) for k,v in params.items()},
      "train":fitted,"holdout":tested,"holdout_unscaled_probability":raw,
      "holdout_constant_baseline":null,
      "release_checks":{"train_games_minimum":18000,"holdout_games_minimum":5000,
                        "strict_date_separation":distinct,
                        "win_loss_better_than_constant":tested["log_loss"]<null["log_loss"] and tested["brier"]<null["brier"],
                        "both_score_and_margin_improve_over_constant":tested["margin_mae"]<null["margin_mae"] and tested["team_score_mae"]<null["team_score_mae"],
                        "probabilities_not_materially_worse_than_raw_elo":tested["brier"]<=raw["brier"]+.001 and tested["log_loss"]<=raw["log_loss"]+.002,
                        "passed":passed},
      "score_method":"Uncapped expected score: mean_team_points +/- 0.5*elo_margin_slope*(home Elo-away Elo+verified home advantage). Home win probability uses the same ratings and verified site, scaled by probability_scale.",
      "limitations":["2021-26 historical source is provider scoreboard with D-I-v-D-I only, limited to current registry; no independent confirmation of every historical final.",
                     "Score predictions are expected means, not guaranteed finals; no possession, injury, overtime or roster information.",
                     "Unverified venue is treated as neutral and must be labeled; disputed venue must suppress forecast.",
                     "Early-season 1500 reset may understate large school-strength mismatches.",
                     "Forecasts cover two rated D-I teams only; outside-D-I opponents have no RETRO rating."]}
    text=json.dumps(output,indent=2,allow_nan=False)+"\n"
    if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8")!=text:
        OUTPUT.write_text(text,encoding="utf-8")
    print(json.dumps({"status":output["status"],"parameters":output["parameters"],
          "holdout":tested,"checks":output["release_checks"]},indent=2),flush=True)
    # A failed holdout is a measured non-promotion, not a workflow failure; the
    # publisher must require status=HISTORICAL_HOLDOUT_VALIDATED explicitly.


if __name__ == "__main__":
    main()
