#!/usr/bin/env python3
"""CACC men's 2026-27 reciprocal fixtures, preserving NCAA DII membership.

Primary evidence: 11 conference athletics schedule pages. Monroe University
is a CACC member pursuing NCAA DII membership and is NOT a certified DII Elo
opponent in 2026-27. Never infer a broadcast from a generic network homepage.
"""
import datetime as dt
import re
import urllib.request
from collections import defaultdict
from zoneinfo import ZoneInfo

BASE="https://caccathletics.org/schedule.aspx?schedule="
OFFICIAL_NETWORK="https://caccnetwork.com/faq/"
SCHOOLS={
  2377:("Wilmington","wilmington"),
  2380:("Goldey-Beacom","goldey-beacom"),
  2381:("Caldwell","caldwell"),
  2382:("Chestnut Hill","chestnut-hill"),
  2383:("Dominican","dominican-ny"),
  2384:("Bridgeport","bridgeport"),
  2385:("Jefferson","jefferson-thomas-jefferson"),
  2386:("Post","post"),
  2387:("Holy Family","holy-family"),
  2388:("Felician","felician"),
  2389:("Georgian Court","georgian-court"),
}
ALIASES={
 "wilmington":"wilmington","wilmington university":"wilmington",
 "goldey beacom":"goldey-beacom","goldey beacom college":"goldey-beacom",
 "caldwell":"caldwell","caldwell university":"caldwell",
 "chestnut hill":"chestnut-hill","chestnut hill college":"chestnut-hill",
 "dominican":"dominican-ny","dominican university new york":"dominican-ny",
 "bridgeport":"bridgeport","university of bridgeport":"bridgeport",
 "jefferson":"jefferson-thomas-jefferson","thomas jefferson university":"jefferson-thomas-jefferson",
 "post":"post","post university":"post",
 "holy family":"holy-family","holy family university":"holy-family",
 "felician":"felician","felician university":"felician",
 "georgian court":"georgian-court","georgian court university":"georgian-court",
}
def clean(text):
 return " ".join(str(text or "").split())

def opponent_id(name):
 value=clean(name).lower()
 value=re.sub(r"^(at|vs\.?|versus)\s+","",value)
 value=re.sub(r"[^a-z0-9 ]"," ",value)
 return ALIASES.get(" ".join(value.split()))

def eastern_time(value):
 """No ET suffix on CACC pages; all 11 campuses operate on Eastern time."""
 text=clean(value).upper()
 result=re.fullmatch(r"(1[0-2]|0?[1-9]):([0-5]\d)\s*([AP])\.?M\.?",text)
 if not result:return None
 h=int(result[1])%12+(12 if result[3]=="P" else 0)
 return f"{h%12 or 12}:{result[2]} {'AM' if h<12 else 'PM'} ET"

def read_page(url):
 req=urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimes/1.0 (+https://github.com/jbryancoburn-netizen/sporting-life-times)","Accept":"text/html"})
 with urllib.request.urlopen(req,timeout=20) as response:
  return response.read().decode("utf-8","replace")

def parse_cacc_school(html,identity,schedule_id):
 from bs4 import BeautifulSoup
 soup=BeautifulSoup(html,"html.parser")
 text=clean(soup.get_text(" ",strip=True)).lower()
 label=SCHOOLS[schedule_id][0].lower()
 if "2026-27" not in text or "men's basketball" not in text or label not in text:
  raise ValueError("Wrong season/school CACC schedule "+str(schedule_id))
 chosen=[]
 for table in soup.select("table"):
  header=" ".join(clean(th.get_text(" ",strip=True)).lower() for th in table.select("th"))
  if not all(x in header for x in ("date","opponent","location","event")):continue
  candidates=[]
  for tr in table.select("tr"):
   fields=[clean(td.get_text(" ",strip=True)) for td in tr.find_all(["td","th"],recursive=False)]
   if len(fields)<6:continue
   rawdate,rawtime,opponent,location,result,event=fields[:6]
   if not re.fullmatch(r"\d{1,2}/\d{1,2}/202[67]",rawdate):continue
   date=dt.datetime.strptime(rawdate,"%m/%d/%Y").date()
   if not(dt.date(2026,11,1)<=date<=dt.date(2027,2,28)):continue
   low=opponent.lower().strip()
   if low.startswith("vs ") or low.startswith("vs."):continue
   other=opponent_id(opponent)
   if other is None:continue # Nonconference or provisional Monroe: no DII Elo
   if other==identity:
    raise ValueError("Self opponent on CACC schedule "+str(schedule_id))
   if low.startswith("at "):
    away,home=identity,other
   else:
    away,home=other,identity
   candidates.append({"date":date.isoformat(),"away":away,"home":home,
       "tipoff":eastern_time(rawtime),"source_team":identity,
       "source_url":BASE+str(schedule_id),"city":location})
  if len(candidates)>len(chosen):chosen=candidates
 if len(chosen)<15 or len(chosen)>24:
  raise ValueError(f"CACC {schedule_id} has {len(chosen)} DII conference entries, expected roughly 20")
 if len({(g["date"],g["away"],g["home"]) for g in chosen})!=len(chosen):
  raise ValueError("Duplicate CACC school schedule entries")
 return chosen

def reconcile_cacc(records,games,teams,today):
 grouped=defaultdict(list)
 for owner,rows in records.items():
  for row in rows:
   if owner!=row["source_team"]:raise ValueError("CACC source mismatch")
   grouped[(row["date"],row["away"],row["home"])].append(row)
 report={"schools_read":len(records),"school_entries":sum(map(len,records.values())),
  "confirmed_matchups":0,"added":0,"enriched":0,"unreciprocated":0,
  "identity_conflicts":0,"time_disagreements":0,"empty_tipoffs":0,
  "quarantined":[]}
 for (date,away,home),rows in sorted(grouped.items()):
  owners={r["source_team"] for r in rows}
  if len(rows)!=2 or owners!={away,home}:
   report["unreciprocated"]+=1
   if len(report["quarantined"])<18:report["quarantined"].append({"date":date,"away":away,"home":home,"reason":"one-sided or ambiguous source"})
   continue
  if any(id not in teams or teams[id].get("not_eligible_for_dii_elo") for id in (away,home)):
   report["identity_conflicts"]+=1;continue
  existing=[g for g in games.values() if g.get("date")==date and {g.get("away"),g.get("home")}=={away,home}]
  if len(existing)>1 or (existing and (existing[0]["away"],existing[0]["home"])!=(away,home)):
   report["identity_conflicts"]+=1;continue
  report["confirmed_matchups"]+=1
  if existing:
   game=existing[0];report["enriched"]+=1
  elif date>=today.isoformat():
   gid="cacc-2026-27-"+date+"-"+away+"-"+home
   if gid in games:raise ValueError("CACC game ID collision")
   game={"id":gid,"date":date,"away":away,"home":home,
    "status":"scheduled","away_score":None,"home_score":None,
    "neutral":False,"verified":True,"elo_eligible":True,
    "source":"CACC reciprocal official athletic schedules",
    "source_url":rows[0]["source_url"]}
   games[gid]=game;report["added"]+=1
  else:
   continue # Never fabricate a prior-game result.
  times={x["tipoff"] for x in rows if x["tipoff"]}
  if len(times)==1:
   game["start_time"]=next(iter(times))
   game["tipoff_source_url"]=rows[0]["source_url"]
  elif len(times)>1:
   report["time_disagreements"]+=1
   if len(report["quarantined"])<18:report["quarantined"].append({"date":date,"away":away,"home":home,"reason":"opposing posted times disagree"})
  else:report["empty_tipoffs"]+=1
  # CACC has an official streaming network, but broadcast coverage is not
  # proven game-by-game; do NOT assign it to every game.
  game["conference_game"]=True
  game["conference_schedule_sources"]=[r["source_url"] for r in rows]
  game["venue_city"]=next((r["city"] for r in rows if r["source_team"]==home and r["city"]),rows[0]["city"])
 return report

def enrich_cacc(games,teams,today):
 ids={v[1] for v in SCHOOLS.values()}
 if not ids.issubset(teams):
  return {"status":"withheld: missing certified teams","missing":sorted(ids-set(teams))}
 records={};failed=[]
 for id,(name,key) in SCHOOLS.items():
  try:records[key]=parse_cacc_school(read_page(BASE+str(id)),key,id)
  except Exception as e:failed.append({"school":name,"schedule":id,"issue":str(e)[:170]})
 if failed:
  return {"status":"withheld: one or more official school schedules unavailable",
   "verified_schools":len(records),"errors":failed,"added":0}
 audit=reconcile_cacc(records,games,teams,today)
 audit["status"]="verified reciprocal games only; provisional programs excluded"
 audit["official_network_context"]=OFFICIAL_NETWORK
 audit["streaming_not_blanket_verified"]=True
 audit["school_sources"]=[BASE+str(i) for i in SCHOOLS]
 return audit
