#!/usr/bin/env python3
"""Player-name match evidence behind NCAA historical preseason feature adjustments.
Not athlete-ID verification or preseason-as-of certification.
"""
import argparse,json,statistics
from pathlib import Path
from collections import defaultdict
from calibrate_ncaam_independent_stat_weights import data
from backtest_ncaam_quality_retrospective import read_gz,player_key,school_key,number

def evidence(roster,old_box):
    sources=defaultdict(lambda:defaultdict(float));members=defaultdict(set)
    for r in old_box:
        n=player_key(r.get("player"));sc=school_key(r.get("team"))
        mins=number(r.get("mins"))
        if n and sc and 0<mins<=70:sources[n][sc]+=mins
    unique={n:next(iter(s.values())) for n,s in sources.items() if len(s)==1}
    for r in roster:
        sc=school_key(r.get("team"));n=player_key(r.get("player"))
        if sc and n:members[sc].add(n)
    out={}
    for sc,names in members.items():
        valid=[unique[n] for n in names if n in unique]
        out[sc]={"roster_players":len(names),"matched_players":len(valid),
          "matched_roster_fraction":len(valid)/len(names),
          "matched_prior_minutes":sum(valid),
          "matched_prior_minutes_per_rostered_player":sum(valid)/len(names)}
    return out
def main():
    p=argparse.ArgumentParser();p.add_argument("--source",type=Path,required=True)
    p.add_argument("--out",type=Path,default=Path("historical-report/ncaam-stat-player-match-audit.json"))
    a=p.parse_args();_,features,_,multi=data(a.source)
    weights=json.loads(Path("data/ncaam-continuous-stat-optimizer.json").read_text())["selected_weights"]
    years={}
    for year in (2024,2025,2026):
        roster=read_gz(a.source,"team_rosters",year);box=read_gz(a.source,"player_box",year-1)
        ev=evidence(roster,box);items=[]
        for t,row in ev.items():
            f=features.get(year,{}).get(t)
            if not f or not f["covered"] or t not in multi[year]:continue
            delta=sum(weights[k]*multi[year][t][k] for k in weights)
            items.append({"team":t,"player_stat_adjustment":delta,**row})
        bands={}
        for label,lo,hi in (("under_20",0,20),("20_to_39",20,40),("40_to_69",40,70),("70_plus",70,float("inf"))):
            block=[r for r in items if lo<=abs(r["player_stat_adjustment"])<hi]
            bands[label]={"teams":len(block),"median_matched_roster_fraction":statistics.median([r["matched_roster_fraction"] for r in block]) if block else None,
              "median_matched_players":statistics.median([r["matched_players"] for r in block]) if block else None,
              "median_prior_minutes":statistics.median([r["matched_prior_minutes"] for r in block]) if block else None}
        years[str(year)]={"teams":len(items),"bands":bands,
           "largest_adjustments":sorted(items,key=lambda r:-abs(r["player_stat_adjustment"]))[:15]}
    result={"model":"ncaam-player-match-coverage-audit-v1","production_promotion_allowed":False,
      "identity_matching":"Unique player name across previous-year schools only; not verified NCAA athlete ID",
      "roster_asof_verified":False,"years":years}
    a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({y:{"teams":v["teams"],"bands":v["bands"]} for y,v in years.items()},indent=2))
if __name__=="__main__":main()
