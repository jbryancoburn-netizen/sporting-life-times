#!/usr/bin/env python3
"""Research audit: does larger preseason player adjustment improve held-season games?
This replays games day-batched for the 2025 and 2026 seasons; buckets use
preseason-only retrospective-derived features (not outcomes). Never promote.
"""
import json,math,statistics,argparse
from pathlib import Path
from collections import defaultdict
from itertools import groupby
from calibrate_ncaam_independent_stat_weights import data
from backtest_ncaam_combined_elo import CARRY,K,MOV
from backtest_ncaam_turnover_update_speed import prob

def run(games,features,origin,multi,weights):
    ratings={};records={}
    for year in (2023,2024,2025,2026):
        g=games[year];teams={t for v in g for t in (v["home"],v["away"])}
        f=features.get(year,{})
        good=[r for r in f.values() if r["covered"]]
        pivot=statistics.median((1-r["r"] for r in good)) if good else 0.
        base={t:1500+CARRY*(ratings.get(t,1500)-1500)+
               (f[t]["minute_adj"]+1200*f[t]["q_centered"]+25*origin.get(year,{}).get(t,0.)
                 if t in f and f[t]["covered"] else 0.) for t in teams}
        change={t:sum(weights[k]*multi.get(year,{}).get(t,{}).get(k,0.) for k in weights)
                if t in f and f[t]["covered"] else 0. for t in teams}
        alt={t:base[t]+change[t] for t in teams};old=base.copy()
        categories={}
        for t in teams:
            size=abs(change[t]);categories[t]=("0-20" if size<20 else "20-40" if size<40 else "40-70" if size<70 else "70+")
        buckets=defaultdict(lambda:dict(n=0,ll_new=0.,ll_old=0.,brier_new=0.,brier_old=0.))
        for day,batch in groupby(g,key=lambda v:v["day"]):
            updates_a=defaultdict(float);updates_b=defaultdict(float)
            for v in batch:
                h,a=v["home"],v["away"];out=float(v["home_score"]>v["away_score"])
                pa=prob(alt[h],alt[a]);pb=prob(old[h],old[a])
                if year>=2025:
                    # Both teams appear in a game; use max adjustment to label game exposure.
                    size=max(abs(change[h]),abs(change[a]))
                    key="0-20" if size<20 else "20-40" if size<40 else "40-70" if size<70 else "70+"
                    b=buckets[key];b["n"]+=1
                    for prefix,p in (("new",pa),("old",pb)):
                        b["ll_"+prefix]-=out*math.log(max(p,1e-12))+(1-out)*math.log(max(1-p,1e-12))
                        b["brier_"+prefix]+=(p-out)**2
                early=(day-g[0]["day"]).days<45
                turn=sum(1-f[t]["r"]-pivot for t in (h,a) if t in f and f[t]["covered"])/2
                speed=max(.5,min(1.5,1+turn)) if early else 1.
                factor=K*speed*(1+MOV*math.log10(1+abs(v["home_score"]-v["away_score"])))
                delta_a=factor*(out-pa);delta_b=factor*(out-pb)
                updates_a[h]+=delta_a;updates_a[a]-=delta_a
                updates_b[h]+=delta_b;updates_b[a]-=delta_b
            for t,v in updates_a.items():alt[t]+=v
            for t,v in updates_b.items():old[t]+=v
        if year>=2025:
            records[str(year)]={"team_adjustment_counts":{cat:sum(x==cat for x in categories.values()) for cat in ("0-20","20-40","40-70","70+")},
              "game_bucket_by_max_team_adjustment":{cat:{**v,**{k+"_mean":v[k]/v["n"] for k in ("ll_new","ll_old","brier_new","brier_old")}} for cat,v in buckets.items() if v["n"]}}
        # Preserve best-model history for the next season rather than leaking baseline future.
        ratings=alt
    return {"status":"RETROSPECTIVE_ONLY","production_promotion_allowed":False,
      "label":"Game category uses max absolute opening-season player-stat adjustment",
      "reference":"Identical underlying Elo replay with the player-stat term removed, using same season-opening previous-year ratings",
      "limitations":["Historical rosters are not verified preseason snapshots","2025/26 previously inspected",
        "No venue correction; category includes unmatched-player zero adjustments"],
      "results":records}

if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--source",type=Path,required=True)
    p.add_argument("--out",type=Path,default=Path("historical-report/ncaam-continuous-size-buckets.json"))
    a=p.parse_args();g,f,o,m=data(a.source)
    weights=json.loads(Path("data/ncaam-continuous-stat-optimizer.json").read_text())["selected_weights"]
    out=run(g,f,o,m,weights);a.out.parent.mkdir(parents=True,exist_ok=True)
    a.out.write_text(json.dumps(out,indent=2)+"\n")
    print(json.dumps(out,indent=2))
