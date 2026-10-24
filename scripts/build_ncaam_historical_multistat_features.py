#!/usr/bin/env python3
"""Historical multistat player signal from prior-season boxes and later roster.
Retrospective only: roster timestamps not certified as opening-day.
"""
import math
from collections import defaultdict
from backtest_ncaam_quality_retrospective import collect_prior_stats,player_key,school_key,number

def multistat_features(roster,prior_box):
    # Exclude ambiguous names appearing at multiple prior-season schools.
    person=defaultdict(lambda:defaultdict(lambda:defaultdict(float)))
    for r in prior_box:
        name=player_key(r.get("player"));school=school_key(r.get("team"))
        minutes=number(r.get("mins"))
        if not name or not school or not 0<minutes<=70:continue
        p=person[name][school]
        p["minutes"]+=minutes
        for col in ("fgm","fga","ftm","fta","ast","tov","stl","blk"):
            p[col]+=number(r.get(col))
    unique={n:next(iter(s.values())) for n,s in person.items() if len(s)==1}
    teams=defaultdict(set)
    for r in roster:
        n=player_key(r.get("player"));school=school_key(r.get("team"))
        if n and school:teams[school].add(n)
    raw={};counts=defaultdict(int)
    for school,names in teams.items():
        total=defaultdict(float)
        for n in names:
            p=unique.get(n)
            if p is None:continue
            for k,v in p.items():total[k]+=v
            counts[school]+=1
        minutes=total["minutes"]
        if minutes>=200:
            # Four disjoint, observed per-minute production signals.
            # FG misses and FT misses capture shot efficiency; AST-TOV
            # playmaking; STL+BLK defensive box contributions.
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
       "unique_prior_player_names":len(unique),
       "matched_player_counts":sum(counts.values()),
       "metrics":list(keys),"roster_asof_preseason_certified":False}
