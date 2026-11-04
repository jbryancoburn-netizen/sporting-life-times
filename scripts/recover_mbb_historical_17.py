#!/usr/bin/env python3
"""Recover men's historical head-to-head files ONLY from matched Kaggle source rows.

Never synthesizes results; never overwrites existing school archives.
Historic names are deliberately linked by reviewed Kaggle IDs, not fuzzy text.
This is *partial* school coverage; it does not certify an all-time series.
"""
import csv
import io
import json
import re
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
ARCHIVE=ROOT/"data/mbb-head-to-head-1985"
BASE="https://huggingface.co/Jensen-holm/Nigl/resolve/main/data/"
SOURCES=("MTeams.csv","MSeasons.csv","MRegularSeasonCompactResults.csv",
         "MNCAATourneyCompactResults.csv","MSecondaryTourneyCompactResults.csv")
# Reviewed aliases from the repository's 2026-11-01 unmatched Kaggle ID ledger.
# These are historical PROGRAM continuities, not claims about a modern school name.
TARGETS={
 1107:("UAlbany","ncaa:609618","SUNY Albany"),
 1111:("App State","ncaa:609621","Appalachian St"),
 1131:("Boston U.","ncaa:609635","Boston Univ"),
 1192:("FDU","ncaa:609729","F Dickinson"),
 1223:("Houston Christian","ncaa:609750","Houston Chr"),
 1230:("UIW","ncaa:609604","Incarnate Word"),
 1237:("IU Indy","ncaa:609601","IUPUI"),
 1254:("LIU","ncaa:609590","LIU Brooklyn"),
 1258:("LMU (CA)","ncaa:609653","Loy Marymount"),
 1282:("Kansas City","ncaa:609602","Missouri KC"),
 1296:("NIU","ncaa:609792","N Illinois"),
 1475:("Southern Ind.","ncaa:609534","Southern Indiana"),
 1477:("East Texas A&M","ncaa:609533","TX A&M Commerce"),
}
SPECIAL_SPELLINGS={
 "appalachianst":"App State","bostonuniv":"Boston U.",
 "fairleighdickinson":"FDU","fdickinson":"FDU",
 "houstonchr":"Houston Christian","incarnateword":"UIW",
 "iupuifortwayne":None,"iupui":"IU Indy","liubrooklyn":"LIU",
 "loymarymount":"LMU (CA)","missourikc":"Kansas City",
 "nillinois":"NIU","southernindiana":"Southern Ind.",
 "txamcommerce":"East Texas A&M","suny albany":"UAlbany",
}
def norm(s):return re.sub("[^a-z0-9]","",str(s or "").lower())
def fetch(name):
 req=Request(BASE+name,headers={"User-Agent":"SportingLifeTimes-historical-backfill/1.0"})
 with urlopen(req,timeout=75) as res: content=res.read(12_000_000)
 text=content.decode("utf-8-sig")
 if not text.startswith(("Season,", "TeamID,")):
  raise ValueError(name+" missing expected CSV header")
 return list(csv.DictReader(io.StringIO(text)))
def main():
 cross=json.loads((ROOT/"data/ncaam-2026-27-espn-team-crosswalk.json").read_text())["teams"]
 cross_by_name=defaultdict(set)
 by_id={t["id"]:t for t in cross}
 for row in cross:
  for name in (row["name"],row.get("espn_name")):
   if norm(name):cross_by_name[norm(name)].add(row["id"])
 for alias,modern in SPECIAL_SPELLINGS.items():
  if modern:
   target=next((t["id"] for t in cross if t["name"]==modern),None)
   if target:cross_by_name[norm(alias)].add(target)
 original=json.loads((ARCHIVE/"import-status.json").read_text())
 unknown={int(r["kaggle_id"]):r["name"] for r in original["unmatched_kaggle_teams"]}
 for k,(school,ncaa,source_name) in TARGETS.items():
  assert by_id[ncaa]["name"]==school,(k,school)
  assert norm(unknown[k])==norm(source_name),(k,unknown[k],source_name)
 teams=fetch("MTeams.csv")
 seasons={int(r["Season"]):(date.fromisoformat(r["DayZero"]) if "-" in r["DayZero"] else datetime.strptime(r["DayZero"],"%m/%d/%Y").date()) for r in fetch("MSeasons.csv")}
 lookup={}
 uncertain=[]
 for row in teams:
  kid=int(row["TeamID"])
  if kid in TARGETS:
   expected=TARGETS[kid][2]
   if norm(row["TeamName"])!=norm(expected):
    raise ValueError(f"Unconfirmed reviewed source ID {kid}: {row['TeamName']} versus {expected}")
   lookup[kid]=TARGETS[kid][1]
   continue
  matches=cross_by_name.get(norm(row["TeamName"]),set())
  if len(matches)==1:lookup[kid]=next(iter(matches))
  else:uncertain.append({"id":kid,"name":row["TeamName"],"candidate_count":len(matches)})
 games_by_id=defaultdict(dict)
 unmatched=defaultdict(int)
 source_counts=defaultdict(int)
 for filename,category in (
  ("MRegularSeasonCompactResults.csv","Regular season / conference tournament"),
  ("MNCAATourneyCompactResults.csv","NCAA Tournament"),
  ("MSecondaryTourneyCompactResults.csv","Secondary postseason tournament")):
  for r in fetch(filename):
   try:
    season=int(r["Season"])
    if season>2024 or season<1985:continue
    win,lose=int(r["WTeamID"]),int(r["LTeamID"])
    if win not in TARGETS and lose not in TARGETS:continue
    year=seasons[season];day=int(r["DayNum"])
    when=(year+timedelta(days=day)).isoformat()
    ws,ls=int(r["WScore"]),int(r["LScore"])
    wloc=r["WLoc"].upper()
    if wloc not in ("H","A","N") or not (0<ws<=300 and 0<ls<=300 and ws>ls):
     raise ValueError("Unsafe source location or scores")
   except (KeyError,ValueError,OverflowError) as err:
    raise ValueError(f"Invalid {filename} row {r}: {err}") from err
   if win not in lookup or lose not in lookup:
    for kid in (win,lose):
     if kid in TARGETS:unmatched[TARGETS[kid][0]]+=1
    continue
   if lookup[win]==lookup[lose]:continue
   # Kaggle WLoc denotes winner's location; at neutral sites the
   # 'home' slot is only a conventional placeholder, NOT asserted home court.
   home,away=(lose,win) if wloc=="A" else (win,lose)
   hs,aws=(ls,ws) if wloc=="A" else (ws,ls)
   game={"date":when,"season":season,"home_id":lookup[home],"away_id":lookup[away],
         "home_score":hs,"away_score":aws,"location":wloc,"competition":category,
         "source_url":"https://huggingface.co/Jensen-holm/Nigl/tree/main/data"}
   key=(when,)+tuple(sorted((lookup[win],lookup[lose])))+(ws,ls)
   for kid in (win,lose):
    if kid not in TARGETS:continue
    canon=TARGETS[kid][1]
    old=games_by_id[canon].get(key)
    if old and old!=game:raise ValueError("Conflicting historical data for "+canon)
    games_by_id[canon][key]=game
   source_counts[category]+=1
 reports=[]
 for kid,(name,canon,source_name) in TARGETS.items():
  path=ARCHIVE/(canon.replace(":","-")+".json")
  if path.exists():
   reports.append({"team":name,"team_id":canon,"status":"existing-preserved"})
   continue
  games=sorted(games_by_id[canon].values(),key=lambda x:x["date"],reverse=True)
  if not games:
   reports.append({"team":name,"team_id":canon,"status":"no-confirmed-source-records",
                   "unmatched_opponents":unmatched[name]})
   continue
  payload={"coverage_start_year":min(g["season"] for g in games),
           "coverage_end_year":max(g["season"] for g in games),
           "validated":False,"coverage_status":"PARTIAL_SOURCE_BACKFILL",
           "source":"Historical Kaggle compact results, Jensen-holm/Nigl mirror",
           "school_name":name,"source_kaggle_team_id":kid,
           "source_historical_name":source_name,"unmatched_opponent_games":unmatched[name],
           "note":"Not an all-time record; only exact-ID, source-backed mapped games.",
           "games":games}
  path.write_text(json.dumps(payload,separators=(",",":"),ensure_ascii=False)+"\n")
  reports.append({"team":name,"team_id":canon,"status":"partial-source-backed",
                  "games":len(games),"unmatched_opponents":unmatched[name]})
 all_missing=[t["name"] for t in cross if not (ARCHIVE/(t["id"].replace(":","-")+".json")).exists()]
 report={"source_snapshot_max_year":2024,"schools":len(cross),"recovered_school_files":sum(x["status"]=="partial-source-backed" for x in reports),
         "total_archive_files":len(cross)-len(all_missing),"still_missing":all_missing,
         "source_mapped_team_ids":len(lookup),"unresolved_kaggle_id_count":len(uncertain),
         "reviewed_aliases":reports,"limitations":"Partial source-backed records; not all-time series."}
 (ARCHIVE/"gap-recovery-status.json").write_text(json.dumps(report,indent=2)+"\n")
 print(json.dumps({"recovered":report["recovered_school_files"],
                   "total_archive_files":report["total_archive_files"],
                   "missing":all_missing},indent=2))
if __name__=="__main__":main()
