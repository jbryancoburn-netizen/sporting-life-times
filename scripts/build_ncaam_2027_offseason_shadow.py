#!/usr/bin/env python3
"""Produce evidence-labeled 2026-27 roster-adjusted D1 Elo SHADOW ratings.

Uses NCAA-origin 2025-26 minutes and current 2026-27 ESPN roster IDs/names.
Coefficients ONLY from locked 2024-25 training, approved on 2026 holdout.
All 365 teams included; unmatched schools retain published base Elo.
Never overwrites the original preseason model.
"""
import json,re
from pathlib import Path
from collections import defaultdict
from backtest_ncaam_roster_elo import fetch
def clean(s):return re.sub(r"[^a-z0-9]","",str(s or "").lower().replace("&","and"))

def features(records,current):
    totals=defaultdict(float)
    minute=defaultdict(float)
    identity_by_name=defaultdict(set)
    teams_by_id=defaultdict(set)
    names_by_id=defaultdict(set)
    teams_by_name=defaultdict(set)
    for x in records:
        school="ncaa:"+str(x.get("team_ncaa_team_id") or "").strip()
        pid=str(x.get("player_id") or "").strip()
        name=clean(x.get("clean_name") or x.get("player"))
        if not school[5:].isdigit() or not name:continue
        try:m=float(x.get("mins") or 0)
        except (ValueError,TypeError):continue
        if m<0 or m>75:continue
        ident=pid if pid else "name:"+name
        totals[school]+=m
        minute[(school,ident)]+=m
        identity_by_name[(school,name)].add(ident)
        teams_by_id[ident].add(school)
        names_by_id[ident].add(name)
        teams_by_name[name].add(school)
    output={};stats={"exact_id_matches":0,"exact_name_matches":0,"unmatched_players":0,"ambiguous_players":0}
    for roster in current["rosters"]:
        school=roster["ncaa_id"]
        total=totals[school]
        if total<1000 or len(roster["players"])<8:continue
        used=set();retained=0.;incoming=0.
        for player in roster["players"]:
            pid=str(player.get("id") or "")
            name=clean(player.get("name"))
            possible=set(teams_by_id.get(pid,set())) if pid else set()
            selected=None;source=None;ident=None
            if pid and len(possible)==1:
                source=next(iter(possible));ident=pid;selected="exact_id_matches"
            elif name and len(teams_by_name[name])==1:
                source=next(iter(teams_by_name[name]))
                candidates=identity_by_name[(source,name)]
                if len(candidates)==1:
                    ident=next(iter(candidates));selected="exact_name_matches"
            if not selected:
                stats["ambiguous_players" if possible or (name and len(teams_by_name[name])>1) else "unmatched_players"]+=1
                continue
            if (source,ident) in used:continue
            used.add((source,ident))
            stats[selected]+=1
            if source==school:retained+=minute[(school,ident)]
            else:incoming+=minute[(source,ident)]
        output[school]={"team":roster["school"],"prior_minutes":round(total,1),
            "retention":round(min(1,retained/total),6),
            "incoming_minutes":round(min(1.5,incoming/total),6),
            "matched_returning_minutes":round(retained,1),
            "matched_incoming_transfer_minutes":round(incoming,1),
            "source_roster_url":roster.get("url")}
    return output,stats

def build(preseason,registry,report,rosters,box):
    if not report.get("approved_for_shadow_experiment"):
        raise ValueError("Calibrated roster model did not pass historical holdout")
    if report.get("untouched_holdout_season")!=2026:raise ValueError("Unexpected holdout")
    if preseason.get("season")!="2026-27":raise ValueError("Incorrect season")
    if len(registry["teams"])!=365 or len(preseason["rankings"])!=365:
        raise ValueError("Roster/ratings are incomplete")
    if rosters.get("season")!=2027:raise ValueError("Incorrect current-season roster")
    feat,stats=features(box,rosters)
    if len(feat)<250:raise ValueError("Current roster evidence below 250 programs")
    known=set(feat)
    actual_ids={x["id"] for x in registry["teams"]}
    if known-actual_ids:raise ValueError("Roster crosswalk includes unrecognized canonical IDs")
    k=sorted(f["retention"] for f in feat.values())[len(feat)//2]
    t=sorted(f["incoming_minutes"] for f in feat.values())[len(feat)//2]
    beta_k=report["training"]["retention_beta"];beta_t=report["training"]["transfer_beta"]
    by_id={x["team_id"]:x for x in preseason["rankings"]}
    if set(by_id)!=actual_ids:raise ValueError("Base Elo ID registry mismatch")
    rank=[]
    for team in registry["teams"]:
        uid=team["id"];base=by_id[uid]["elo"]
        if uid in feat:
            adjustment=beta_k*(feat[uid]["retention"]-k)+beta_t*(feat[uid]["incoming_minutes"]-t)
            level="observed-roster"
        else:
            adjustment=0;level="no-current-roster"
        rank.append({"team_id":uid,"team":team["name"],"conference":team["conference"],
            "base_elo":base,"offseason_adjustment":round(adjustment,4),
            "elo":round(base+adjustment,4),"roster_coverage":level,
            "returning_minutes_share":feat[uid]["retention"] if uid in feat else None,
            "incoming_transfer_prior_minutes_share":feat[uid]["incoming_minutes"] if uid in feat else None,
            "season_games":0})
    rank.sort(key=lambda r:(-r["elo"],r["team_id"]))
    for i,x in enumerate(rank,1):x["rank"]=i
    return {"model":"slat-ncaam-offseason-adjusted-elo-v1",
       "season":"2026-27","status":"provisional-roster-adjusted",
       "model_tier":"historically validated SHADOW; independently calculated; identity coverage incomplete",
       "games_played":0,"team_count":len(rank),
       "calibration":"data/ncaam-offseason-transfer-backtest.json",
       "parameters":{"retention_beta":beta_k,"incoming_minutes_beta":beta_t,
                     "median_retention":k,"median_incoming_minutes":t},
       "evidence":{"roster_programs":len(feat),"uncovered_programs":len(rank)-len(feat),
                   "player_matches":stats,
                   "previous_season":"NCAA-origin 2025-26 player box from SportsDataverse",
                   "current_season":"ESPN 2026-27 rosters, independent team ID crosswalk",
                   "uncertainties":["School roster coverage incomplete; uncovered teams use baseline",
                       "Player transfers from D2/international leagues not counted",
                       "Current roster data may change before opening night",
                       "Historical venue-neutral backtest has unverified court effects"]},
       "rankings":rank}
def main():
    root=Path("data")
    baseline=json.loads((root/"ncaam-2026-27-preseason-provisional.json").read_text())
    registry=json.loads((root/"ncaam-2026-27-team-registry.json").read_text())
    report=json.loads((root/"ncaam-offseason-transfer-backtest.json").read_text())
    roster=json.loads(Path("staging/ncaam-2027-roster-evidence.json").read_text())
    result=build(baseline,registry,report,roster,fetch("ncaa_mbb_player_box",2026))
    target=root/"ncaam-2026-27-offseason-shadow.json"
    target.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({"status":result["status"],"source_coverage":result["evidence"]["roster_programs"],
        "player_matches":result["evidence"]["player_matches"],
        "top_10":[{"team":x["team"],"elo":x["elo"],"change":x["offseason_adjustment"]} for x in result["rankings"][:10]]},indent=2))
if __name__=="__main__":main()
