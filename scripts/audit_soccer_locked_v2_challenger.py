#!/usr/bin/env python3
"""Compare the 2025-selected soccer challenger to actual locked v2 2026 forecasts.

Pure offline paired diagnostic; never modify predictions or live Elo. All
challenger parameters were fixed from the earlier 2024 validation exercise,
not 2026 results. End-of-day Elo updates prohibit same-day result leakage.
"""
from __future__ import annotations
import collections
import datetime as dt
import hashlib
import json
import math
import random
from pathlib import Path
from zoneinfo import ZoneInfo

from experiment_soccer_conference_draw_venue import probabilities
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data/college-soccer-history/retro-locked-v2-challenger-comparison.json"
PARAMS={"conference_update":20.,"listed_home_advantage":75.,"draw_base":.24,"draw_decay":900.}
EAST=ZoneInfo("America/New_York")

def read(path):
    return json.loads((ROOT/path).read_text())

def timestamp(value):
    t=dt.datetime.fromisoformat(value.replace("Z","+00:00"))
    if t.tzinfo is None or t.utcoffset() is None:
        raise ValueError("Timestamp without timezone")
    return t

def mark(prob,game):
    hg,ag=game["home_goals"],game["away_goals"]
    outcome=2 if hg>ag else 0 if hg<ag else 1
    loss=-math.log(max(1e-15,prob[outcome]))
    brier=sum((p-int(i==outcome))**2 for i,p in enumerate(prob))
    return {"brier":brier,"log_loss":loss,"correct":int(prob.index(max(prob))==outcome)}

def report(rows):
    if not rows:return {"games":0}
    return {"games":len(rows),"mean_brier":round(sum(x["brier"] for x in rows)/len(rows),8),
            "mean_log_loss":round(sum(x["log_loss"] for x in rows)/len(rows),8),
            "pick_accuracy":round(sum(x["correct"] for x in rows)/len(rows),8)}

def run():
    base=read("data/college-soccer-elo-baseline.json")
    ledger=read("data/college-soccer-elo-final-ledger.json")
    archive=read("data/college-soccer-prospective-v2.json")
    scored=read("data/college-soccer-forecast-scores-v2.json")
    confs=read("data/college-soccer-conferences.json")["team_to_conference"]
    if archive["status"]!="prospective_research_only" or len(archive["forecasts"])!=archive["count_locked"]:
        raise ValueError("Locked forecast archive schema mismatch")
    sha=hashlib.sha256(json.dumps(archive,sort_keys=True,separators=(",",":")).encode()).hexdigest()
    if sha!=scored["forecast_archive_canonical_sha256"]:
        raise ValueError("Locked archive hash differs from scored forecast contract")
    scoring_ids={row["match_id"] for row in scored["scores"] if row["cohort"]=="men-d1"}
    if len(scoring_ids)!=scored["cohorts"]["men-d1"]["scored"]:
        raise ValueError("Scored men's DI game identity mismatch")
    locked={f["match_id"]:f for f in archive["forecasts"] if f["cohort"]=="men-d1" and f["match_id"] in scoring_ids}
    games=sorted((g for g in ledger["results"] if g["gender"]=="men"),key=lambda g:(g["date"],g["match_id"]))
    ratings={t["team_id"]:float(t["elo"]) for t in base["cohorts"]["men-d1"]}
    def compute(challenger):
        strengths=dict(ratings)
        adjustments={}
        outcomes={}
        grouped=collections.defaultdict(list)
        for g in games:grouped[g["date"]].append(g)
        for day in sorted(grouped):
            todays=grouped[day]
            for g in todays:
                a,b=g["home_team"],g["away_team"]
                if a not in strengths or b not in strengths:continue
                ca,cb=confs.get("men-d1:"+a),confs.get("men-d1:"+b)
                cross=bool(ca and cb and ca!=cb)
                offset=adjustments.get(ca,0.)-adjustments.get(cb,0.) if cross and challenger else 0.
                neutral=g.get("neutral_site") is True
                advantage=0. if neutral else (PARAMS["listed_home_advantage"] if challenger else 55.)
                diff=strengths[a]-strengths[b]+advantage+offset
                p=1/(1+10**(-diff/400))
                draw_base=PARAMS["draw_base"] if challenger else .24
                decay=PARAMS["draw_decay"] if challenger else 0.
                home,draw,away=probabilities(p,diff,draw_base,decay)
                if g["match_id"] in locked:
                    f=locked[g["match_id"]]
                    if any(f[k]!=g[k] for k in ("home_team","away_team","source_game")):
                        raise ValueError("Locked scored forecast identity shifted "+g["match_id"])
                    kickoff=timestamp(f["kickoff_utc"])
                    created=timestamp(f["forecasted_at_utc"])
                    if not created<kickoff or kickoff.astimezone(EAST).date().isoformat()!=g["date"]:
                        raise ValueError("Locked kickoff or time provenance failed "+g["match_id"])
                    outcomes[g["match_id"]]=mark([away,draw,home],g)
            # End-of-day simultaneous batch ratings: no same-date score is used
            # to forecast another game from that same calendar date.
            deltas=collections.defaultdict(float)
            conf_deltas=collections.defaultdict(float)
            for g in todays:
                a,b=g["home_team"],g["away_team"]
                if a not in strengths or b not in strengths:continue
                ca,cb=confs.get("men-d1:"+a),confs.get("men-d1:"+b)
                cross=bool(ca and cb and ca!=cb)
                offset=adjustments.get(ca,0.)-adjustments.get(cb,0.) if cross and challenger else 0.
                home_adv=0. if g.get("neutral_site") is True else (75. if challenger else 55.)
                p=1/(1+10**(-(strengths[a]-strengths[b]+home_adv+offset)/400))
                hg,ag=g["home_goals"],g["away_goals"]
                actual=1. if hg>ag else .5 if hg==ag else 0.
                change=36.*max(1.,math.log1p(abs(hg-ag)))*(actual-p)
                deltas[a]+=change;deltas[b]-=change
                if cross and challenger:
                    conf_deltas[ca]+=PARAMS["conference_update"]*(actual-p)
                    conf_deltas[cb]-=PARAMS["conference_update"]*(actual-p)
            for key,delta in deltas.items():strengths[key]+=delta
            for key,delta in conf_deltas.items():adjustments[key]=adjustments.get(key,0.)+delta
        return outcomes
    baseline=compute(False)
    challenger=compute(True)
    common=sorted(set(locked)&set(baseline)&set(challenger))
    if len(common)!=len(scoring_ids):
        raise ValueError(f"Paired coverage {len(common)} differs from locked scored DI {len(scoring_ids)}")
    v2={key:mark([f["p_away"],f["p_draw"],f["p_home"]],
                 next(g for g in games if g["match_id"]==key)) for key,f in locked.items() if key in common}
    if set(v2)!=set(common):raise ValueError("Locked forecast probabilities missing")
    reports={"actual_locked_v2":report([v2[k] for k in common]),
             "replay_elo_fixed_draw":report([baseline[k] for k in common]),
             "retrospective_challenger":report([challenger[k] for k in common])}
    diffs=[(k,challenger[k]["log_loss"]-v2[k]["log_loss"],
               challenger[k]["brier"]-v2[k]["brier"]) for k in common]
    # Deterministic date-cluster bootstrap; paired games in each resampled date.
    dates={g["match_id"]:g["date"] for g in games}
    grouped=collections.defaultdict(list)
    for row in diffs:grouped[dates[row[0]]].append(row)
    days=sorted(grouped);rng=random.Random(20261116)
    repeats=[]
    for _ in range(500):
        sample=[entry for d in rng.choices(days,k=len(days)) for entry in grouped[d]]
        repeats.append(sum(x[1] for x in sample)/len(sample))
    repeats.sort()
    return {"status":"experimental_not_deployed","identity":"Same locked 2026 men-d1 final games",
            "sample_policy":"Matched IDs from existing score ledger; validated kickoff and pregame creation",
            "baseline_as_of":base["as_of"],"locked_forecast_archive_sha256":sha,
            "challenger_parameters_selected_on_2024_only":PARAMS,
            "metrics":reports,
            "challenger_minus_locked_log_loss":round(reports["retrospective_challenger"]["mean_log_loss"]-reports["actual_locked_v2"]["mean_log_loss"],8),
            "date_cluster_bootstrap_challenger_minus_locked_log_loss_95pct":[round(repeats[12],8),round(repeats[487],8)],
            "disclaimer":"2026 replay starts from the October 22 pinned snapshot; v2 forecasts may use a different pregame information set. The challenger is retrospective, not prospectively locked; cannot be promoted based on these results.",
            "no_live_model_changes":True}

if __name__=="__main__":
    out=run()
    OUT.write_text(json.dumps(out,indent=2,sort_keys=True)+"\n")
    print(json.dumps(out,indent=2))
