#!/usr/bin/env python3
"""Historical multistat player signal from prior-season boxes and later roster.
Retrospective only: roster timestamps not certified as opening-day.
"""
import math
from collections import defaultdict
from backtest_ncaam_quality_retrospective import collect_prior_stats,player_key,school_key,number
from reconcile_ncaam_players import reconcile

def multistat_features(roster,prior_box):
    matched,status,details=reconcile(roster,prior_box)
    teams=defaultdict(lambda:defaultdict(float))
    counts=defaultdict(int)
    for (school,_name),records in matched.items():
        for r in records:
            mins=number(r.get("mins"))
            teams[school]["minutes"]+=mins
            for col in ("fgm","fga","ftm","fta","ast","tov","stl","blk"):
                teams[school][col]+=number(r.get(col))
        counts[school]+=1
    raw={}
    for school,total in teams.items():
        minutes=total["minutes"]
        if minutes>=200:
            raw[school]={
              "shooting":(total["fgm"]-(total["fga"]-total["fgm"])+
                          .5*(total["ftm"]-(total["fta"]-total["ftm"])))/minutes,
              "playmaking":(total["ast"]-total["tov"])/minutes,
              "defense":(total["stl"]+total["blk"])/minutes}
    from statistics import median
    keys=("shooting","playmaking","defense")
    centers={key:median(x[key] for x in raw.values()) for key in keys} if raw else {key:0 for key in keys}
    centered={team:{k:value[k]-centers[k] for k in keys} for team,value in raw.items()}
    return centered,{"teams_with_verified_prior_stats":len(centered),
       "player_reconciliation_status":status,
       "matched_player_counts":sum(counts.values()),
       "metrics":list(keys),"roster_asof_preseason_certified":False}
