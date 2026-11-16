#!/usr/bin/env python3
"""RETRO score-only, same-day-batch Elo research; intentionally NOT the live 160-pass model.

Strict chronological evaluation. Select K/MOV solely on games before --split.
Test the selected challenger once after the split. Venue alternatives remain
separate diagnostics because the current final-site flag is not trustworthy.
Requires no other provider's odds, ratings, or predictions.
"""
import argparse
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "ncaam-2026-27-retro-primary.json"
CAL = ROOT / "data" / "ncaam-score-calibration.json"
K_GRID = (12., 24., 40., 60.)
MOV_GRID = (0., .55, 1.1)
BONUS_GRID = (0., 50., 100.)

def valid_games(doc, end):
    seen = set()
    games = []
    for event in doc["events"]:
        date = event.get("date")
        if not date or date >= end:
            continue
        if not all(isinstance(event.get(k), (int, float)) and not isinstance(event.get(k), bool)
                   for k in ("home_score", "away_score")):
            continue
        h, a = event.get("home_id"), event.get("away_id")
        if not h or not a or h == a:
            continue
        key = (date, event["id"])
        if key in seen:
            raise ValueError("Duplicate historical event " + str(key))
        seen.add(key)
        games.append(event)
    return sorted(games, key=lambda x: (x["date"], str(x["id"])))

def replay(games, k, mov, slope, home_elo=0.):
    """All events from the same date are forecast before any of their scores update Elo."""
    elo = {}
    per_day = defaultdict(list)
    for game in games:
        per_day[game["date"]].append(game)
    rows = []
    for date in sorted(per_day):
        changes = defaultdict(float)
        for game in per_day[date]:
            h, a = game["home_id"], game["away_id"]
            hd, ad = elo.get(h, 1500.), elo.get(a, 1500.)
            verified_flag = game.get("site_verified") is True and game.get("neutral") is False
            # This is an intentionally unverified *diagnostic* policy, never a live venue fix.
            bonus = home_elo if verified_flag else 0.
            gap = hd-ad+bonus
            p = 1/(1+10**(-max(-1800., min(1800., gap))/400.))
            actual = float(game["home_score"])-float(game["away_score"])
            pred = gap*slope
            rows.append({"date": date, "id":game["id"], "actual":actual,
                         "predicted":pred, "abs_error":abs(actual-pred),
                         "signed_error":actual-pred, "home_site_flag":verified_flag})
            change = k*(1+mov*math.log10(1+abs(actual)))*((1 if actual>0 else 0)-p)
            changes[h] += change
            changes[a] -= change
        for team, change in changes.items():
            elo[team] = elo.get(team,1500.) + change
    return rows

def summarize(rows):
    if not rows:
        raise ValueError("No games to score")
    return {"games":len(rows),
            "margin_mae":round(sum(g["abs_error"] for g in rows)/len(rows),5),
            "signed_home_margin_error":round(sum(g["signed_error"] for g in rows)/len(rows),5)}

def experiment(doc, slope, split="2026-11-11", end="2026-11-16"):
    games = valid_games(doc, end)
    if not any(g["date"] < split for g in games) or not any(g["date"] >= split for g in games):
        raise ValueError("Train/test chronological split has insufficient games")
    trials = []
    for k in K_GRID:
        for mov in MOV_GRID:
            result = replay(games,k,mov,slope,0.)
            train = summarize([r for r in result if r["date"] < split])
            trials.append({"k":k,"mov":mov,"training":train})
    selected = min(trials, key=lambda x:(x["training"]["margin_mae"],x["k"],x["mov"]))
    baseline_rows = replay(games,24.,.55,slope,0.)
    champion_rows = replay(games,selected["k"],selected["mov"],slope,0.)
    holdout = lambda rows: summarize([r for r in rows if split <= r["date"] < end])
    venue_diagnostics = []
    for bonus in BONUS_GRID:
        rows = replay(games,selected["k"],selected["mov"],slope,bonus)
        venue_diagnostics.append({"diagnostic_site_bonus_elo":bonus, "holdout":holdout(rows)})
    return {"model":"retro-chronological-simple-elo-mae-research-v1",
            "status":"RESEARCH_ONLY_NOT_LIVE_ENGINE_NOT_PROMOTED",
            "data_source":"Own 2026-27 verified score ledger",
            "source_season":doc.get("season"),"train_before":split,"test_before":end,
            "slope_from_existing_score_calibration":slope,
            "incumbent_simple_elo":{"k":24,"mov":.55,"venue_elo":0,
                                    "training":summarize([r for r in baseline_rows if r["date"]<split]),
                                    "holdout":holdout(baseline_rows)},
            "selected_training_only":{"k":selected["k"],"mov":selected["mov"],
                                      "training":selected["training"],"holdout":holdout(champion_rows)},
            "venue_diagnostics_NOT_selected_for_release":venue_diagnostics,
            "training_parameter_grid":trials,
            "disclosures":[
                "NOT an exact reproduction of the current all-games 160-pass RETRO rating engine.",
                "The live production margin slope is reused; its current historical status is extrapolation-unvalidated.",
                "All teams start at 1500; forecasts are frozen per date before updates on that date.",
                "Only training dates select Elo learning speed; venue scenarios are diagnostics inspected on holdout.",
                "Final-ledger site_verified and neutral flags are incomplete and must not determine a new production policy.",
                "Current-season results are not a pristine new unseen season; repeat on future locked dates.",
                "Does not access sportsbooks, external forecasts, or opponent rating providers.",
                "No automatic parameter promotion or alteration of original forecast archive."
            ]}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=Path, default=SOURCE)
    ap.add_argument("--calibration",type=Path,default=CAL)
    ap.add_argument("--split",default="2026-11-11")
    ap.add_argument("--end",default="2026-11-16")
    ap.add_argument("--output",type=Path)
    args = ap.parse_args()
    raw = args.source.read_bytes()
    doc = json.loads(raw)
    cal = json.loads(args.calibration.read_text(encoding="utf-8"))
    out = experiment(doc,float(cal["parameters"]["elo_margin_slope"]),args.split,args.end)
    out["source_sha256"] = hashlib.sha256(raw).hexdigest()
    payload = json.dumps(out,indent=2,sort_keys=True)+"\n"
    if args.output:
        args.output.write_text(payload,encoding="utf-8")
    print(payload,end="")

if __name__ == "__main__":
    main()
