#!/usr/bin/env python3
"""Merge a completed NCAA DII season scan into the freshest published ledgers.

Safe against concurrent school-page writers: this program is rerun from the
latest origin/main on every push attempt. Never discards official finals,
school-color provenance, source URLs, or existing team IDs.
"""
import argparse
import datetime as dt
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data"

def game_key(g):
    return (str(g.get("date","")),tuple(sorted((str(g.get("away","")),str(g.get("home",""))))))

def score_for(g,team):
    return g.get("away_score") if g.get("away")==team else g.get("home_score")

def quality_rank(g):
    valid_final=(g.get("status")=="final" and g.get("away_score") is not None
                 and g.get("home_score") is not None and g["away_score"]!=g["home_score"])
    return (4 if valid_final and g.get("verified") else
            3 if valid_final else 2 if g.get("verified") else 1)

def union_game(base,incoming,conflicts):
    """Prefer the strongest evidence, preserving verified results and sources."""
    x=dict(base)
    if base.get("status")=="final" and incoming.get("status")=="final":
        if (score_for(base,base.get("away"))!=score_for(incoming,base.get("away"))
            or score_for(base,base.get("home"))!=score_for(incoming,base.get("home"))):
            conflicts.append({"date":base.get("date"),"away":base.get("away"),
                              "home":base.get("home"),"ids":[base.get("id"),incoming.get("id")]})
            return x
    if quality_rank(incoming)>quality_rank(base):
        x={**x,**incoming}
        if base.get("source_url") and not x.get("source_url"):x["source_url"]=base["source_url"]
    else:
        for key in ("start_time","network","venue","source_url","tournament"):
            if not x.get(key) and incoming.get(key):x[key]=incoming[key]
    if base.get("neutral") or incoming.get("neutral"):
        # Organizer-designated neutral-site games always remain neutral.
        x["neutral"]=True
    return x

def rebuild_ratings(teams,games,model):
    elo={t["id"]:1500.0 for t in teams}
    wins={t["id"]:0 for t in teams}
    losses={t["id"]:0 for t in teams}
    eligible={t["id"]:not t.get("not_eligible_for_dii_elo",False) for t in teams}
    k=float(model.get("k",20));edge=float(model.get("home_elo_edge",65))
    played=0
    ordered=sorted(games,key=lambda x:(x["date"],str(x.get("start_time","")),str(x["id"])))
    for g in ordered:
        aa,hh=g.get("away"),g.get("home")
        if (aa not in elo or hh not in elo or aa==hh or not g.get("elo_eligible")
            or not eligible[aa] or not eligible[hh]):
            for fld in ("pregame_elo_away","pregame_elo_home","pred_home_pct",
                        "elo_change_away","elo_change_home"):
                g.pop(fld,None)
            continue
        hc=0 if g.get("neutral") else edge
        expectation=1/(1+10**((elo[aa]-elo[hh]-hc)/400))
        g["pregame_elo_away"]=round(elo[aa],1)
        g["pregame_elo_home"]=round(elo[hh],1)
        g["pred_home_pct"]=round(expectation*100,1)
        g["forecast_model_status"]="experimental; DII historical calibration pending"
        if g.get("status")!="final":
            g.pop("elo_change_away",None);g.pop("elo_change_home",None)
            continue
        home_score=g.get("home_score");away_score=g.get("away_score")
        if not isinstance(home_score,int) or not isinstance(away_score,int) or home_score==away_score:
            continue
        home_won=int(home_score>away_score)
        movement=k*(home_won-expectation)
        g["elo_change_home"]=round(movement,1)
        g["elo_change_away"]=round(-movement,1)
        elo[hh]+=movement;elo[aa]-=movement
        winner=hh if home_won else aa
        loser=aa if home_won else hh
        wins[winner]+=1;losses[loser]+=1
        played+=1
    for t in teams:
        ident=t["id"];t["elo"]=round(elo[ident],1);t["w"]=wins[ident];t["l"]=losses[ident]
    return played

def merge_one(gender,source_dir):
    dest=DATA/f"d2-{gender}-2026-27.json"
    src=source_dir/f"d2-{gender}-2026-27.json"
    published=json.loads(dest.read_text())
    audited=json.loads(src.read_text())
    assert published["gender"]==audited["gender"]==gender
    assert published["starting_elo"]==audited["starting_elo"]==1500
    aq=audited["quality"]
    assert aq["dates_requested"]>=175 and aq["dates_fetched"]>=175
    teams={t["id"]:dict(t) for t in published["teams"]}
    for t in audited["teams"]:
        if t["id"] not in teams:teams[t["id"]]=dict(t)
        else:
            for field,val in t.items():
                if field not in teams[t["id"]] and val not in ("",None):
                    teams[t["id"]][field]=val
    games={str(g["id"]):dict(g) for g in published["games"]}
    bypair={game_key(g):str(g["id"]) for g in games.values()}
    conflict=[];inserted=0;collisions=0
    for g in audited["games"]:
        if g.get("away") not in teams or g.get("home") not in teams:
            continue
        ident=str(g["id"]);pair=game_key(g)
        old_id=ident if ident in games else bypair.get(pair)
        if old_id:
            games[old_id]=union_game(games[old_id],g,conflict);collisions+=1
        else:
            games[ident]=dict(g);bypair[pair]=ident;inserted+=1
    result=list(games.values())
    if len(result)<len(audited["games"]):
        raise RuntimeError(f"{gender}: merged ledger lost scanned games: {len(result)} < {len(audited['games'])}")
    ts=list(teams.values())
    actual=rebuild_ratings(ts,result,published.get("model",audited["model"]))
    now=dt.datetime.now(dt.timezone.utc).isoformat()
    newquality={**published["quality"]}
    newquality.update({
       "status":"PARTIAL — 180 dates scanned, opponent identity and school-specific fields still require certification",
       "verified_dii_finals":actual,"programs_found":len(ts),
       "dates_requested":aq["dates_requested"],"dates_fetched":aq["dates_fetched"],
       "dates_failed":aq["dates_failed"],
       "official_contests_available":True,
       "full_season_scan":{
            "as_of":audited["as_of"],
            "days_checked":aq["dates_requested"],
            "days_retrieved":aq["dates_fetched"],
            "audit_games":len(audited["games"]),
            "added_to_current_snapshot":inserted,
            "duplicate_matches":collisions,
            "unresolved_source_identities":aq.get("ncaa_ingestion",{}).get("unmatched_identity"),
            "source_score_conflicts":conflict[:30],
            "status":"source reconciled; incomplete school-by-school certification"
       }
    })
    published["teams"]=sorted(ts,key=lambda t:t["name"].casefold())
    published["games"]=sorted(result,key=lambda g:(g["date"],str(g["id"])))
    published["as_of"]=now
    published["quality"]=newquality
    published["source"]="180-date NCAA Division II scoreboard scan and preserved university/tournament verified results"
    dest.write_text(json.dumps(published,ensure_ascii=False,separators=(",",":"))+"\n")
    assert len({g["id"] for g in result})==len(result)
    assert sum(t["w"] for t in ts)==actual
    assert sum(t["l"] for t in ts)==actual
    print(gender,"games",len(result),"newly merged",inserted,"finals",actual,
          "dated scans",aq["dates_fetched"],"score conflicts",len(conflict))

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--source-dir",required=True,type=Path)
    args=parser.parse_args()
    for gender in ("men","women"):merge_one(gender,args.source_dir)

if __name__=="__main__":main()
