#!/usr/bin/env python3
"""Safe replay of NCAA-origin 2026-27 men D1 final scores. No fabricated venue."""
import csv,gzip,json,math,re,urllib.error,urllib.request
from collections import Counter
from pathlib import Path
from datetime import datetime

BASE="https://github.com/sportsdataverse/sportsdataverse-data/releases/download/"
def key(x):return re.sub("[^a-z0-9]","",str(x).lower().replace("&","and"))
def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimes/1.0"})
    with urllib.request.urlopen(req,timeout=60) as r:raw=r.read(15000000)
    return list(csv.DictReader(gzip.decompress(raw).decode("utf-8-sig").splitlines()))
def calculate(pre,old,current,games):
    if len(current)!=365:raise ValueError("Expected complete 365-team registry")
    oldmap={key(t["name"]):t for t in old["teams"]}
    if len(oldmap)!=len(old["teams"]):raise ValueError("Duplicate old names")
    currentmap={key(t["team"]):t for t in current}
    if len(currentmap)!=len(current):raise ValueError("Duplicate new names")
    previous={t["team_id"]:t["elo"] for t in pre["rankings"]}
    old_by_id={t["id"]:t for t in old["teams"]}
    if len(previous)!=len(pre["rankings"]) or set(previous)!=set(old_by_id):
        raise ValueError("Preseason Elo must cover each registered team ID exactly once")
    r={};meta={};names={};changes=[];current_ids=set()
    for name,t in currentmap.items():
        if not t["id"].isdigit():raise ValueError("Invalid new team ID")
        uid="ncaa:"+t["id"]
        if uid in current_ids:raise ValueError("Duplicate current NCAA team ID: "+uid)
        current_ids.add(uid)
        # Stable NCAA-origin IDs take precedence over names. Renames must not reset Elo.
        older=old_by_id.get(uid) or oldmap.get(name)
        if older and older["id"] in current_ids and older["id"]!=uid:
            raise ValueError("Conflicting crosswalk for "+t["team"])
        names[name]=uid;r[uid]=previous[older["id"]] if older else 1500.
        meta[uid]=t
        if not older:changes.append({"kind":"added","team":t["team"]})
    for name,t in oldmap.items():
        if name not in currentmap:changes.append({"kind":"removed","team":t["name"]})
    ledger=[];excluded=[];seen=set()
    for game in games:
        gid=str(game.get("contest_id","")).strip()
        if not gid or gid in seen:raise ValueError("Duplicate/missing contest ID")
        seen.add(gid)
        h=names.get(key(game.get("home")));a=names.get(key(game.get("away")))
        if not h or not a:
            excluded.append({"id":gid,"reason":"non-D1 or unmatched","home":game.get("home"),"away":game.get("away")});continue
        try:
            day=datetime.strptime(game["game_date"],"%m/%d/%Y").date().isoformat()
            hs=int(game["home_score"]);aws=int(game["away_score"])
            if hs==aws or min(hs,aws)<0:raise ValueError()
        except (ValueError,TypeError,KeyError):
            excluded.append({"id":gid,"reason":"not a valid final"});continue
        # NCAA schedule rows can contain future fixtures and non-final rows.
        # Only games with a valid final score AND a date no later than today
        # may alter ratings. A future-dated score is never treated as played.
        if day>datetime.now().date().isoformat():
            excluded.append({"id":gid,"reason":"future-dated result","date":day})
            continue
        ledger.append({"id":gid,"date":day,"home":h,"away":a,"home_score":hs,"away_score":aws})
    ledger.sort(key=lambda x:(x["date"],x["id"]))
    opening_total=sum(r.values())
    counts=Counter()
    for g in ledger:
        h,a=g["home"],g["away"]
        p=1/(1+10**(-(r[h]-r[a])/400))
        delta=24*(1+.55*math.log10(1+abs(g["home_score"]-g["away_score"])))*((g["home_score"]>g["away_score"])-p)
        g["home_elo_before"]=round(r[h],6)
        g["away_elo_before"]=round(r[a],6)
        g["home_win_probability"]=round(p,8)
        r[h]+=delta;r[a]-=delta
        g["home_elo_after"]=round(r[h],6)
        g["away_elo_after"]=round(r[a],6)
        g["home_change"]=round(delta,6)
        counts[h]+=1;counts[a]+=1
    if abs(sum(r.values())-opening_total)>1e-6:
        raise AssertionError("NCAA Elo conservation failure")
    ranked=sorted(r,key=lambda t:(-r[t],t))
    return {"model":"slat-ncaam-d1-elo-v1","season":"2026-27",
      "status":"provisional-current-venue-neutral",
      "note":"Locations unresolved; all games modeled venue-neutral. Predictions not calibrated.",
      "team_count":len(r),"games_played":len(ledger),"membership_changes":changes,
      "excluded_count":len(excluded),"excluded_examples":excluded[:30],
      "prediction_policy":"venue-neutral until venue source verified; no fabricated home advantage",
      "rankings":[{"rank":i,"team_id":t,"team":meta[t]["team"],"conference":meta[t].get("conference"),
                   "elo":round(r[t],4),"games":counts[t]} for i,t in enumerate(ranked,1)],
      "events":ledger}
def main():
    base=Path("data")
    schedule=BASE+"ncaa_mbb_schedule/ncaa_mbb_schedule_2027.csv.gz"
    members=BASE+"ncaa_mbb_team_ids/ncaa_mbb_team_ids_2027.csv.gz"
    state={"season":"2026-27","ready":False,"schedule_source":schedule,"membership_source":members}
    try:
        current=fetch(members);games=fetch(schedule)
    except urllib.error.HTTPError as exc:
        if exc.code!=404:raise
        state["reason"]="2026-27 season source not released (HTTP 404)"
        (base/"ncaam-source-readiness.json").write_text(json.dumps(state,indent=2)+"\n")
        print(state["reason"]);return
    if len(current)!=365 or len({str(t.get('id')) for t in current})!=365:
        raise ValueError(f'2026-27 membership source incomplete: {len(current)} rows; expected 365 unique teams')
    # The identity-linked 365-team roster-informed edition is our PROVISIONAL
    # preseason opening seed. Older exact-name shadow ratings remain research
    # only; never mistake them for production-approved roster adjustments.
    roster_informed=base/"ncaam-2026-27-preseason-roster-informed.json"
    chosen=base/"ncaam-2026-27-preseason-provisional.json"
    if roster_informed.is_file():
        proposed=json.loads(roster_informed.read_text(encoding="utf-8"))
        items=proposed.get("rankings",[])
        evidence=proposed.get("evidence",{})
        if (proposed.get("season")=="2026-27" and
            proposed.get("status")=="provisional-roster-identity-linked" and
            proposed.get("preseason_roster_informed") is True and
            proposed.get("production_elo_approved") is False and
            proposed.get("team_count")==365 and
            proposed.get("games_played")==0 and
            len(items)==365 and len({i["team_id"] for i in items})==365 and
            evidence.get("roster_programs")==364 and
            evidence.get("players_with_verified_historical_minutes",0)>=2500):
            chosen=roster_informed
        else:
            raise ValueError("Published provisional roster-informed preseason ratings failed release gate")
    pre=json.loads(chosen.read_text(encoding="utf-8"))
    old=json.loads((base/"ncaam-2026-27-team-registry.json").read_text())
    result=calculate(pre,old,current,games)
    result["preseason_seed"]=str(chosen)
    result["preseason_roster_adjusted"]=(chosen==roster_informed)
    (base/"ncaam-2026-27-current-provisional.json").write_text(json.dumps(result,indent=2)+"\n")
    state.update({"ready":True,"teams":result["team_count"],"games":result["games_played"]})
    (base/"ncaam-source-readiness.json").write_text(json.dumps(state,indent=2)+"\n")
    print("Replayed",result["games_played"],"finals for",result["team_count"],"programs")
if __name__=="__main__":main()
