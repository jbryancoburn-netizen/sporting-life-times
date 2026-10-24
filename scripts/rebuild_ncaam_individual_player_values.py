#!/usr/bin/env python3
"""Rebuild and source-check every 2026-27 individual player value.

Use the pinned 2026-27 roster, historical player minutes and direct NCAA
crosswalk. No fabricated historical value for unmatched players. This
checks the frozen experimental scoring model, NOT all-around player impact.
"""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]/"data"
def read(name):
    return json.loads((ROOT/name).read_text(encoding="utf8"))
def rnd(x,n):return float(f"{x:.{n}f}")
def reconstruct():
    movement=read("ncaam-2026-27-player-movement-audit.json")
    cross=read("ncaam-2026-27-direct-player-crosswalk.json")
    model=read("ncaam-2026-27-player-value-experimental-v1.json")
    mean=model["league_player_ppm_mean"]
    beta=model["beta_elo_per_ppm"]
    links={str(x["id"]):x for x in cross["links"]}
    if len(links)!=len(cross["links"]):
        raise ValueError("Duplicate ESPN athlete crosswalk ID")
    out=[]
    seen=set()
    for team in movement["teams"]:
        rows=[]
        for p in team["players"]:
            eid=str(p["current_id"])
            if eid in seen:raise ValueError("Duplicate roster player ID: "+eid)
            seen.add(eid)
            link=links.get(eid)
            good=bool(link and link.get("method") in ("name_jersey","last_jersey","name")
                and p.get("prior_school_id") is not None
                and p["prior_school_id"]==link.get("prior")
                and isinstance(p.get("prior_minutes"),(int,float)) and p["prior_minutes"]>0
                and isinstance(p.get("prior_games"),(int,float)) and p["prior_games"]>0
                and isinstance(p.get("prior_points"),(int,float)) and p["prior_points"]>=0)
            rate=p["prior_points"]/p["prior_minutes"] if good else None
            shrink=p["prior_minutes"]/(p["prior_minutes"]+500) if good else None
            val=mean+shrink*(rate-mean) if good else None
            mpg=min(40,p["prior_minutes"]/p["prior_games"]) if good else 0
            rows.append((p,eid,good,rate,val,mpg))
        minutes=sum(r[5] for r in rows)
        scale=min(1,200/minutes) if minutes>0 else 1
        for p,eid,good,rate,val,mpg in rows:
            out.append({
                "player":p["player"],"current_player_id":eid,
                "team_id":team["team_id"],"team":team["team"],
                "prior_school_id":p["prior_school_id"] if good else None,
                "role":("returner" if p["prior_school_id"]==team["team_id"] else "transfer") if good else "unverified",
                "historical_minutes":p["prior_minutes"] if good else None,
                "historical_points":p["prior_points"] if good else None,
                "historical_games":p["prior_games"] if good else None,
                "historical_ppm":rnd(rate,6) if good else None,
                "shrunk_ppm":rnd(val,6) if good else None,
                "projected_mpg":rnd(mpg*scale,6) if good else 0,
                "player_elo_contribution":rnd(beta*(mpg*scale)*(val-mean)/200,4) if good else None,
                "score_status":"MEASURED_HISTORICAL_SCORING_SHRUNK" if good else "NO_VERIFIED_HISTORICAL_VALUE"
            })
    return out

def main():
    published=read("ncaam-2026-27-individual-player-values.json")
    actual=reconstruct()
    expected=published["players"]
    assert len(actual)==len(expected)==5537
    for i,(a,b) in enumerate(zip(actual,expected)):
        if a!=b:
            differences={k:(a.get(k),b.get(k)) for k in a if a.get(k)!=b.get(k)}
            raise AssertionError(f"Source rebuild mismatch player {i} {a['player']}: {differences}")
    assert sum(x["score_status"]=="MEASURED_HISTORICAL_SCORING_SHRUNK" for x in actual)==2923
    assert published["production_elo_approved"] is False
    print("PASS: independently regenerated 5537 player values from primary historical and current roster evidence")
if __name__=="__main__":
    main()
