#!/usr/bin/env python3
"""Tune NFL season-reset Elo home-field and K using actual historical results.

Fit on full 2023 and 2024 regular seasons; evaluate once on 2025 held-out
games. Each historical training season also starts at exactly 1500.
Historical results NEVER seed or transfer team ratings to the 2026 edition.
"""
import concurrent.futures
import datetime as dt
import json
import math
from pathlib import Path
from urllib.parse import urlencode

import build_nfl_edition as nfl

YEARS=[2023,2024,2025]
TRAIN_YEARS=[2023,2024]
VALIDATION_YEAR=2025
HOME_GRID=list(range(20,100,10))
K_GRID=[12,16,20,24,28,32,36,40,44]
OUTPUT=nfl.CALIBRATION

def fetch_week(args):
    year,week=args
    url=nfl.API+"scoreboard?"+urlencode({"season":year,"seasontype":2,"week":week,"limit":40})
    raw=nfl.request(url)
    if not isinstance(raw.get("events"),list):
        raise RuntimeError("Historical scoreboard events missing: "+str(args))
    result=[]
    for event in raw["events"]:
        season=event.get("season") or {}
        if int(season.get("type") or 0)!=2 or int(season.get("year") or 0)!=year:
            continue
        comp=(event.get("competitions") or [{}])[0]
        status=((event.get("status") or {}).get("type") or {})
        if not status.get("completed"):
            continue
        ids={};scores={}
        for competitor in comp.get("competitors") or []:
            loc=competitor.get("homeAway")
            ident=nfl.intval((competitor.get("team") or {}).get("id"))
            points=nfl.intval(competitor.get("score"))
            if loc in ("home","away") and ident in nfl.META and points is not None:
                ids[loc]=str(ident);scores[loc]=points
        if set(ids)!={"home","away"}:continue
        event_id=str(event.get("id") or "")
        if not event_id.isdigit():continue
        result.append({"id":event_id,"year":year,"date":event.get("date") or "",
                       "home":ids["home"],"away":ids["away"],
                       "home_score":scores["home"],"away_score":scores["away"],
                       "neutral":bool(comp.get("neutralSite"))})
    return year,week,result

def historical_results():
    entries=[(year,week) for year in YEARS for week in range(1,19)]
    allgames={year:{} for year in YEARS}
    with concurrent.futures.ThreadPoolExecutor(max_workers=7) as pool:
        for year,week,rows in pool.map(fetch_week,entries):
            for row in rows:
                if row["id"] in allgames[year] and allgames[year][row["id"]]!=row:
                    raise RuntimeError("Conflicting historical game identity: "+row["id"])
                allgames[year][row["id"]]=row
    for year,games in allgames.items():
        if len(games)<260 or len(games)>272:
            raise RuntimeError(f"Historical regular-season coverage incomplete: {year} only {len(games)} finals")
        club_ids={x["home"] for x in games.values()}|{x["away"] for x in games.values()}
        if len(club_ids)!=32:raise RuntimeError(f"Historical season {year} missing franchises")
        print("Sourced historical NFL finals",year,len(games),flush=True)
    return {year:sorted(g.values(),key=lambda x:(x["date"],x["id"])) for year,g in allgames.items()}

def score_season(rows,home_advantage,k_base):
    # Evaluates only PRE-GAME probabilities; no leakage from actual final scores.
    ratings={str(t):1500.0 for t in nfl.META}
    loss=0
    for g in rows:
        a,h=g["away"],g["home"]
        hfa=0 if g["neutral"] else home_advantage
        expected=nfl.probability(ratings[a],ratings[h],hfa)
        actual=1.0 if g["home_score"]>g["away_score"] else (
            0.0 if g["home_score"]<g["away_score"] else 0.5)
        loss+=(expected-actual)**2
        margin=abs(g["home_score"]-g["away_score"])
        k=k_base*min(2.0,1+math.log2(1+margin)/4)
        delta=k*(actual-expected)
        ratings[h]+=delta
        ratings[a]-=delta
    assert abs(sum(ratings.values())-48000)<0.000001
    return loss/len(rows)

def calibrate():
    if OUTPUT.exists():
        try:
            old=json.loads(OUTPUT.read_text(encoding="utf-8"))
            if (old.get("status")=="calibrated" and old.get("years")==YEARS
                    and old.get("train_games",0)>=540):
                print("Existing historical calibration retained:",old["home_advantage_elo"],old["k_base"])
                return
        except (OSError,ValueError,KeyError):pass
    games=historical_results()
    candidates=[]
    for hfa in HOME_GRID:
        for kval in K_GRID:
            brier={year:score_season(games[year],hfa,kval) for year in YEARS}
            train=sum(brier[y]*len(games[y]) for y in TRAIN_YEARS)/sum(len(games[y]) for y in TRAIN_YEARS)
            candidates.append((train,hfa,kval,brier))
    # Tune on 2023+2024 ONLY; 2025 reports genuine unseen holdout fit.
    best=min(candidates,key=lambda x:(round(x[0],10),abs(x[1]-55),abs(x[2]-20)))
    default={year:score_season(games[year],55,20) for year in YEARS}
    result={
        "status":"calibrated","source":"ESPN NFL regular-season final scores (2023–2025)",
        "created_at":dt.datetime.now(dt.timezone.utc).isoformat(),
        "years":YEARS,"training_years":TRAIN_YEARS,"validation_year":VALIDATION_YEAR,
        "train_games":sum(len(games[y]) for y in TRAIN_YEARS),
        "validation_games":len(games[VALIDATION_YEAR]),
        "games_by_year":{str(y):len(games[y]) for y in YEARS},
        "home_advantage_elo":best[1],"k_base":best[2],
        "margin_multiplier":"min(2, 1 + log2(1+absolute point margin)/4)",
        "objective":"Minimize chronological pregame Brier error, season reset at 1500",
        "training_brier":round(best[0],6),
        "validation_brier":round(best[3][VALIDATION_YEAR],6),
        "default_validation_brier":round(default[VALIDATION_YEAR],6),
        "yearly_brier":{str(y):round(best[3][y],6) for y in YEARS},
        "neutral_sites_no_home_bonus":True,"historical_elo_carryover":False,
        "candidates_tested":len(candidates)
    }
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    OUTPUT.write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print("NFL historically fitted HFA",result["home_advantage_elo"],"K",result["k_base"],
          "train Brier",result["training_brier"],"2025 holdout Brier",result["validation_brier"],
          "2025 default Brier",result["default_validation_brier"],flush=True)

if __name__=="__main__":
    calibrate()
