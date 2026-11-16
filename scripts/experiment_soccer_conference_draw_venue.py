#!/usr/bin/env python3
"""2023 warmup -> 2024 validation -> untouched 2025 holdout.

Experiment-only. The league-wide conference offset is an opponent-strength
residual learned ONLY from matches already played. Never reads 2026 committee
decisions or modifies live ratings. 2026 conference labels are a provisional
historical proxy, not verified 2023-25 membership assignments.
"""
from __future__ import annotations
import argparse
import itertools
import json
import math
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
HISTORY=ROOT/"data/college-soccer-history"
OUTPUT=HISTORY/"elo-conference-draw-venue-holdout.json"
K=36.
EPS=1.e-10

def load():
    years={}
    for year in (2023,2024,2025):
        raw=json.loads((HISTORY/f"men-d1-{year}.json").read_text())
        if not raw.get("coverage_complete") or raw.get("errors") or len(raw.get("checked_dates",[]))!=153:
            raise ValueError(f"{year} historical coverage not complete")
        rows=raw["games"]
        if len(rows)!=len({g["game_id"] for g in rows}):
            raise ValueError(f"{year} contains duplicate match IDs")
        years[year]=sorted(rows,key=lambda g:(g["date"],g["game_id"]))
    raw=json.loads((ROOT/"data/college-soccer-conferences.json").read_text())
    mapping={key.split(":",1)[1]:value for key,value in raw["team_to_conference"].items() if key.startswith("men-d1:")}
    return years,mapping

def verified_context(years, mapping):
    """Return per-season conference maps and only independently verified neutral games."""
    evidence=json.loads((HISTORY/"verified-membership-venue-overrides.json").read_text())
    if evidence.get("schema_version") != 1 or evidence.get("status") != "partial_verified_overrides":
        raise ValueError("Unrecognized historical evidence schema")
    maps={year:dict(mapping) for year in (2023,2024,2025)}
    overrides=0
    for record in evidence["membership_season_2023"]:
        assert record["season"]==2023 and record["source"].startswith("https://")
        for team in record["teams"]:
            maps[2023][team]=record["conference"]
            overrides+=1
    for record in evidence["membership_from_2024"]:
        assert record["season"]==2024 and record["source"].startswith("https://")
        for team in record["teams"]:
            for year in (2024,2025):maps[year][team]=record["conference"]
            overrides+=2
    neutral={}
    index={g["game_id"]:(year,g) for year,items in years.items() for g in items}
    for record in evidence["neutral_site_matches"]:
        if not record["source"].startswith("https://"):raise ValueError("Unverified neutral source")
        for gid in record["match_ids"]:
            if gid in neutral or gid not in index or index[gid][0]!=record["year"]:
                raise ValueError("Neutral venue identity or season mismatch: "+gid)
            neutral[gid]=record["source"]
    return maps,neutral,{"season_membership_overrides":overrides,"verified_neutral_games":len(neutral),
                         "historical_membership_unverified_for_others":True}

def probabilities(p,difference,draw_base,draw_decay):
    draw=draw_base if draw_decay==0 else draw_base*math.exp(-abs(difference)/draw_decay)
    return ((1-draw)*p,draw,(1-draw)*(1-p))

def evaluate(years,mapping,conf_rate,home_adv,draw_base,draw_decay,context=None):
    team={}
    conf={}
    season_maps,verified_neutral,_ = context if context else ({2023:mapping,2024:mapping,2025:mapping},{},{})
    scores={2024:[],2025:[]}
    errors={2024:[],2025:[]}
    uncovered={2024:0,2025:0}
    interconference={2024:0,2025:0}
    for year in (2023,2024,2025):
        for g in years[year]:
            a,b=g["home"],g["away"]
            ra,rb=team.get(a,1500.),team.get(b,1500.)
            ca,cb=season_maps[year].get(a),season_maps[year].get(b)
            comparable=bool(ca and cb and ca!=cb)
            conference_offset=(conf.get(ca,0.)-conf.get(cb,0.)) if comparable else 0.
            advantage=0. if (g.get("neutral_venue") is True or g["game_id"] in verified_neutral) else home_adv
            difference=ra-rb+advantage+conference_offset
            p=1/(1+10**(-difference/400))
            hp,dp,ap=probabilities(p,difference,draw_base,draw_decay)
            hg,ag=g["home_goals"],g["away_goals"]
            outcome=1. if hg>ag else 0. if hg<ag else .5
            actual=(1.,0.,0.) if outcome==1 else (0.,1.,0.) if outcome==.5 else (0.,0.,1.)
            if year>2023:
                ps=(hp,dp,ap)
                scores[year].append((sum((x-y)**2 for x,y in zip(ps,actual)),
                                     -math.log(max(EPS,ps[actual.index(1.)])),
                                     int(ps.index(max(ps))==actual.index(1.))))
                errors[year].append((g["date"],g["game_id"]))
                if not (ca and cb): uncovered[year]+=1
                if comparable: interconference[year]+=1
            margin=abs(hg-ag)
            delta=K*max(1.,math.log1p(margin))*(outcome-p)
            team[a]=ra+delta;team[b]=rb-delta
            if comparable and conf_rate:
                # True cross-conference games only; preserve conference zero-sum.
                adjustment=conf_rate*(outcome-p)
                conf[ca]=conf.get(ca,0.)+adjustment
                conf[cb]=conf.get(cb,0.)-adjustment
    def metrics(rows,year):
        return {"games":len(rows),
                "three_way_brier":round(sum(x[0] for x in rows)/len(rows),8),
                "log_loss":round(sum(x[1] for x in rows)/len(rows),8),
                "pick_accuracy":round(sum(x[2] for x in rows)/len(rows),8),
                "unmapped_opponents":uncovered[year],
                "cross_conference_games":interconference[year]}
    return metrics(scores[2024],2024),metrics(scores[2025],2025)

def run():
    years,mapping=load()
    context=verified_context(years,mapping)
    configs=[]
    # Stage 1: learn conference offsets, with a stable draw/base home setting.
    for conf_rate,home in itertools.product((0.,4.,10.,20.),(35.,55.,75.)):
        valid,hold=evaluate(years,mapping,conf_rate,home,.24,0.,context)
        configs.append({"conference_update":conf_rate,"listed_home_advantage":home,
                        "draw_base":.24,"draw_decay":0.,
                        "validation":valid,"holdout":hold})
    # Stage 2: draw calibration for every selected conference/venue contender.
    # All selection uses 2024 only. Holdout values are for reporting, NEVER tuning.
    candidate_pairs=sorted(configs,key=lambda x:(x["validation"]["log_loss"],x["validation"]["three_way_brier"]))[:4]
    for selected in candidate_pairs:
        for draw_base,decay in itertools.product((.20,.24,.28), (450.,650.,900.)):
            valid,hold=evaluate(years,mapping,selected["conference_update"],selected["listed_home_advantage"],draw_base,decay,context)
            configs.append({"conference_update":selected["conference_update"],
                            "listed_home_advantage":selected["listed_home_advantage"],
                            "draw_base":draw_base,"draw_decay":decay,
                            "validation":valid,"holdout":hold})
    # A separate unchanged live-equivalent baseline; fixed draw is diagnostic,
    # not the deployed v2 forecasting pipeline.
    baseline_valid,baseline_hold=evaluate(years,mapping,0.,55.,.24,0.,context)
    baseline={"conference_update":0.,"listed_home_advantage":55.,"draw_base":.24,
              "draw_decay":0.,"validation":baseline_valid,"holdout":baseline_hold}
    champion=min(configs,key=lambda x:(x["validation"]["log_loss"],x["validation"]["three_way_brier"]))
    report={"status":"evaluated_not_deployed","season_split":{"warmup":2023,"validation":2024,"untouched_holdout":2025},
            "historical_games_by_year":{str(y):len(rows) for y,rows in years.items()},
            "conference_map":{"mapped_teams":len(mapping),"source":"data/college-soccer-conferences.json",
                              "verified_override_source":"data/college-soccer-history/verified-membership-venue-overrides.json",
                              "evidence":context[2],
                              "caveat":"Only sourced realignment overrides have verified historical membership; other team mappings remain provisional"},
            "baseline":baseline,"selected_on_2024_only":champion,
            "holdout_log_loss_improvement":round(baseline_hold["log_loss"]-champion["holdout"]["log_loss"],8),
            "holdout_brier_improvement":round(baseline_hold["three_way_brier"]-champion["holdout"]["three_way_brier"],8),
            "candidate_count":len(configs),"candidate_validation_order":sorted(configs,key=lambda x:x["validation"]["log_loss"]),
            "decision":"CHALLENGER ONLY: no live deployment; require sourced historical conference membership and neutral venues, uncertainty intervals and independent prospective results",
            "limitations":["One 2025 untouched season; selection held to 2024",
                           "Kickoff times unknown; same-date games ordered by game ID",
                           "Most 2026 conference mappings remain unverified for 2023-2025; sourced exceptions applied",
                           "Nine College Cup neutral matches use sourced venues; other historical listed-home classifications remain unverified",
                           "Only men's D-I evaluated; no portability claim for women's or D-II/D-III",
                           "This is three-way win/draw/loss scoring, not tournament field prediction or expected-goals MAE",
                           "2026 NCAA committee selections never read"] }
    return report

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--write",action="store_true",help="Persist audit report, never change ratings")
    args=parser.parse_args()
    result=run()
    if args.write:
        OUTPUT.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"baseline_holdout":result["baseline"]["holdout"],
                      "challenger":result["selected_on_2024_only"],
                      "improvements":{"log_loss":result["holdout_log_loss_improvement"],
                                      "three_way_brier":result["holdout_brier_improvement"]},
                      "evaluated_not_deployed":True},indent=2))
if __name__=="__main__":
    main()
