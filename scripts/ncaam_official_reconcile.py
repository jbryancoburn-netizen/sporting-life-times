#!/usr/bin/env python3
"""Independent NCAA.com scoreboard crosscheck of ESPN finals.

Source adapter is intentionally separate from ESPN; we do NOT manufacture
official availability when the NCAA website has no scoreboard. Matching
requires unique same-date home/away program IDs and a verified final.
Conflicting verified finals are quarantined from the Elo replay.
"""
import json,urllib.request,urllib.error
from collections import Counter,defaultdict
from datetime import date,timedelta
from pathlib import Path
from update_ncaam_season import school_key,numeric_score

NCAA="https://data.ncaa.com/casablanca/scoreboard/basketball-men/d1/{day}/scoreboard.json"

def fetch_day(day):
    url=NCAA.format(day=day.strftime("%Y/%m/%d"))
    request=urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimes/1.0"})
    try:
        with urllib.request.urlopen(request,timeout=25) as rsp:
            return json.load(rsp),None
    except (urllib.error.HTTPError,urllib.error.URLError,TimeoutError,ValueError) as error:
        return None,str(error)[:200]

def official_final(game):
    # NCAA Casablanca published format: {game:{home,away,gameState,...}}.
    payload=game.get("game",game)
    home=payload.get("home") or {}
    away=payload.get("away") or {}
    status=str(payload.get("gameState") or payload.get("gameStatus") or payload.get("status") or "").lower()
    is_final=status.startswith("final") or status in ("completed","post","official")
    hs=numeric_score(home.get("score"))
    aws=numeric_score(away.get("score"))
    if not is_final or hs is None or aws is None or hs==aws:return None
    def identity(team):
        names=team.get("names") or {}
        return [team.get("name"),names.get("short"),names.get("full"),names.get("seo"),names.get("char6")]
    return {"home_names":identity(home),"away_names":identity(away),
            "home_score":hs,"away_score":aws,
            "source_id":str(payload.get("gameID") or payload.get("gameId") or payload.get("url") or "")}

def verify(rows,official_games,baseline,date_string):
    """Return verified ESPN rows (minus contested finals) and complete audit.

    Missing NCAA games are not negative confirmations: they remain
    single-source ESPN finals and are explicitly marked as such.
    """
    names=defaultdict(set)
    for t in baseline["rankings"]:
        names[school_key(t["team"])].add(t["team_id"])
    id_to_name={t["team_id"]:t["team"] for t in baseline["rankings"]}
    official={}
    ambiguities=0
    for item in official_games:
        result=official_final(item)
        if result is None:continue
        def resolve(labels):
            ids=set()
            for label in labels:
                if label:ids.update(names.get(school_key(label),set()))
            return next(iter(ids)) if len(ids)==1 else None
        h=resolve(result["home_names"]);a=resolve(result["away_names"])
        if not h or not a or h==a:
            ambiguities+=1;continue
        k=(date_string,h,a)
        if k in official and official[k]!=(result["home_score"],result["away_score"]):
            raise ValueError("NCAA official source inconsistent on same game "+str(k))
        official[k]=(result["home_score"],result["away_score"])
    approved=[];conflicts=[];confirmed=[];unconfirmed=[]
    for row in rows:
        # ESPN rows already normalized through audited team IDs and stable IDs.
        hids=names.get(school_key(row["home"]),set())
        aids=names.get(school_key(row["away"]),set())
        if len(hids)!=1 or len(aids)!=1:
            raise ValueError("ESPN crosswalk team no longer uniquely mapped")
        key=(row["game_date"],next(iter(hids)),next(iter(aids)))
        if row["status"]!="final":
            approved.append(row);continue
        if key in official:
            hs,aws=official[key]
            if (hs,aws)!=(int(row["home_score"]),int(row["away_score"])):
                conflicts.append({"espn_event_id":row["contest_id"],"date":row["game_date"],
                                  "home":id_to_name[key[1]],"away":id_to_name[key[2]],
                                  "espn_score":[int(row["home_score"]),int(row["away_score"])],
                                  "ncaa_score":[hs,aws]})
                continue  # QUARANTINE: no Elo, W-L or prediction updates
            confirmed.append(row["contest_id"])
        else:
            unconfirmed.append(row["contest_id"])
        approved.append(row)
    return approved,{"ncaa_resolved_final_count":len(official),
                     "ncaa_ambiguous_final_count":ambiguities,
                     "crosschecked_espn_finals":len(confirmed),
                     "espn_only_finals":len(unconfirmed),
                     "espn_only_final_ids":unconfirmed[-40:],
                     "score_conflicts":conflicts,
                     "score_conflict_count":len(conflicts),
                     "independent_source":"NCAA.com scoreboard (Casablanca JSON)"}

def reconcile(rows,baseline,through,fetcher=fetch_day,lookback=4):
    # Recheck recent results; preserve history of conflict resolution.
    start=max(date(2026,11,1),through-timedelta(days=lookback))
    count=0;available=[];unavailable=[]
    approved=rows
    audits=[]
    for offset in range((through-start).days+1):
        day=start+timedelta(days=offset)
        doc,error=fetcher(day)
        if not isinstance(doc,dict) or not isinstance(doc.get("games"),list):
            unavailable.append({"day":day.isoformat(),"reason":error or "NCAA scoreboard missing games array"})
            continue
        available.append(day.isoformat())
        subset=[r for r in approved if r["game_date"]==day.isoformat()]
        revised,audit=verify(subset,doc["games"],baseline,day.isoformat())
        ids={r["contest_id"] for r in subset}-{r["contest_id"] for r in revised}
        approved=[r for r in approved if r["contest_id"] not in ids]
        audits.append(audit)
    result={"provider":"NCAA.com independent scoreboard",
            "available_days":available,"unavailable_days":unavailable,
            "official_days_checked":len(available),
            "conflict_count":sum(a["score_conflict_count"] for a in audits),
            "conflicts":[c for a in audits for c in a["score_conflicts"]],
            "official_crosschecked_espn_finals":sum(a["crosschecked_espn_finals"] for a in audits),
            "not_independently_verified":"ESPN-only finals are used when NCAA data is unavailable; only directly observed conflicts are quarantined.",
            "official_source_absence_is_not_agreement":True}
    return approved,result
