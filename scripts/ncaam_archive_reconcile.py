#!/usr/bin/env python3
"""Independent NCAA-origin schedule archive crosscheck for ESPN finals.

This archive is not yet published for 2026-27. Fail open on missing archive
with clearly auditable coverage; fail closed on observed score discrepancies.
Historical NCAA-origin schedule is season-level and does NOT establish
real-time correctness or independent preseason player roster evidence.
"""
import csv,gzip,io,urllib.request,urllib.error
from collections import defaultdict
from datetime import date
from update_ncaam_season import SCHEDULE,school_key,numeric_score,parse_day

def fetch_archive(url=SCHEDULE):
    try:
        req=urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimes-CBB-Elo/1.0"})
        with urllib.request.urlopen(req,timeout=40) as response:
            content=response.read(30000000)
        if content[:2]==bytes((31,139)):content=gzip.decompress(content)
        return list(csv.DictReader(io.StringIO(content.decode("utf-8-sig")))),None
    except (urllib.error.HTTPError,urllib.error.URLError,TimeoutError,
            ValueError,UnicodeError,EOFError) as error:
        return None,str(error)[:240]

def reconcile(rows,baseline,through,archive_rows):
    schools=defaultdict(set)
    for t in baseline["rankings"]:
        schools[school_key(t["team"])].add(t["team_id"])
    def resolve(name):
        ids=schools.get(school_key(name),set())
        return next(iter(ids)) if len(ids)==1 else None
    official={}
    ambiguous=0
    for item in archive_rows:
        try:day=parse_day(item.get("game_date"))
        except ValueError:continue
        if day>=through or not date(2026,11,1)<=day<=date(2027,4,30):continue
        hs=numeric_score(item.get("home_score"))
        aws=numeric_score(item.get("away_score"))
        if hs is None or aws is None or hs<1 or aws<1 or hs==aws:continue
        h=resolve(item.get("home"));a=resolve(item.get("away"))
        if not h or not a or h==a:
            ambiguous+=1;continue
        k=(day.isoformat(),h,a)
        score=(hs,aws)
        if k in official and official[k]!=score:
            raise ValueError("Conflicting duplicate NCAA-origin archive finals for "+str(k))
        official[k]=score
    confirmed=[];conflicts=[];approved=[]
    for row in rows:
        if row["status"]!="final":
            approved.append(row);continue
        h=resolve(row["home"]);a=resolve(row["away"])
        if not h or not a:raise ValueError("Unmapped ESPN roster team in archival reconciliation")
        key=(row["game_date"],h,a)
        observed=official.get(key)
        if observed is None:
            approved.append(row);continue
        espn=(int(row["home_score"]),int(row["away_score"]))
        if espn!=observed:
            conflicts.append({"espn_event_id":row["contest_id"],"date":row["game_date"],
                              "home":row["home"],"away":row["away"],
                              "espn_score":list(espn),"ncaa_archive_score":list(observed)})
            continue
        approved.append(row);confirmed.append(row["contest_id"])
    return approved,{"provider":"SportsDataverse NCAA-origin schedule",
                     "archive_games_with_matched_scores":len(official),
                     "archive_unresolved_games":ambiguous,
                     "confirmed_final_count":len(confirmed),
                     "confirmed_final_ids":confirmed[-40:],
                     "score_conflict_count":len(conflicts),
                     "score_conflicts":conflicts,
                     "unmatched_does_not_mean_confirmed":True}

def check(rows,baseline,through,fetcher=fetch_archive):
    archive,error=fetcher()
    if archive is None:
        return rows,{"provider":"SportsDataverse NCAA-origin schedule",
                     "status":"UNAVAILABLE_NOT_INDEPENDENTLY_CONFIRMED",
                     "archive_url":SCHEDULE,"error":error,
                     "confirmed_final_count":0,"score_conflict_count":0,"score_conflicts":[]}
    kept,audit=reconcile(rows,baseline,through,archive)
    audit["status"]="AVAILABLE"
    audit["archive_url"]=SCHEDULE
    audit["archive_source_rows"]=len(archive)
    return kept,audit
