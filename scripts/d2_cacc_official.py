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
# Game-by-game host athletics source, not a league-wide inferred time or venue.
# Used only for a date/team pair already confirmed by BOTH CACC schedules.
HOST_VERIFIED={
 ("2026-12-02","wilmington","goldey-beacom"):("7:30 PM ET","Joseph West Jones Center · Wilmington, DE","https://www.gbcathletics.com/sports/mens-basketball/schedule/2026-2027?grid=true"),
 ("2026-12-05","goldey-beacom","post"):("7:30 PM ET","Drubner Center · Waterbury, CT","https://posteagles.com/sports/mens-basketball/schedule/2026-27?grid=true"),
 ("2027-01-13","chestnut-hill","georgian-court"):("7:00 PM ET","GCU Wellness Center · Lakewood, NJ","https://gculions.com/sports/mens-basketball/schedule/2026-27"),
 ("2027-02-10","chestnut-hill","goldey-beacom"):("7:30 PM ET","Joseph West Jones Center · Wilmington, DE","https://www.gbcathletics.com/sports/mens-basketball/schedule/2026-2027?grid=true"),
 ("2027-02-16","jefferson-thomas-jefferson","chestnut-hill"):("8:00 PM ET","Sorgenti Arena · Philadelphia, PA","https://griffinathletics.com/sports/mens-basketball/schedule/2026-2027?grid=true"),
 ("2027-02-16","wilmington","georgian-court"):("7:00 PM ET","GCU Wellness Center · Lakewood, NJ","https://gculions.com/sports/mens-basketball/schedule/2026-27"),
 ("2027-02-20","chestnut-hill","caldwell"):("1:00 PM ET","George R. Newman Center · Caldwell, NJ","https://caldwellathletics.com/sports/mens-basketball/schedule/2026-27?grid=true"),
}
HOST_WATCH_CONFIRMED={
 ("2027-01-13","chestnut-hill","georgian-court"),
 ("2027-02-16","wilmington","georgian-court"),
}
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
 # Some Sidearm calendars include the same fixture twice, once without
 # a venue city. Collapse only IDENTICAL date, schools, home/away and time;
 # conflicting source data must still stop certification.
 by_game={}
 for game in chosen:
  key=(game["date"],game["away"],game["home"])
  prior=by_game.get(key)
  if prior is None:
   by_game[key]=game
  elif prior["tipoff"]==game["tipoff"]:
   if game.get("city") and not prior.get("city"):
    by_game[key]=game
  else:
   raise ValueError("Conflicting duplicate CACC date/opponent/tipoff: "+str(key))
 chosen=list(by_game.values())
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
  "host_sourced_resolutions":0,"verified_watch_links":0,
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
   host_evidence=HOST_VERIFIED.get((date,away,home))
   host_row=next((row for row in rows if row["source_team"]==home),None)
   if host_evidence and host_row and host_evidence[2].startswith("https://"):
    time,venue,source=host_evidence
    game["start_time"]=time
    game["venue"]=venue
    game["venue_source_url"]=source
    game["tipoff_source_url"]=source
    report["host_sourced_resolutions"]+=1
   else:
    report["time_disagreements"]+=1
    if len(report["quarantined"])<18:report["quarantined"].append({"date":date,"away":away,"home":home,"reason":"opposing posted times disagree"})
  else:report["empty_tipoffs"]+=1
  if (date,away,home) in HOST_WATCH_CONFIRMED and game.get("network") in (None,"","CACC Network"):
   # The GCU athletics fixture explicitly includes a WATCH link.
   game["network"]="CACC Network"
   game["stream_url"]="https://caccnetwork.com/"
   game["broadcast_type"]="Streaming"
   game["broadcast_source_url"]=HOST_VERIFIED[(date,away,home)][2]
   report["verified_watch_links"]+=1
  # CACC has an official streaming network, but broadcast coverage is not
  # proven game-by-game; do NOT assign it to every game.
  game["conference_game"]=True
  game["conference_schedule_sources"]=[r["source_url"] for r in rows]
  game["venue_city"]=next((r["city"] for r in rows if r["source_team"]==home and r["city"]),rows[0]["city"])
 return report

HOST_GRID_SOURCES={
 "caldwell":"https://caldwellathletics.com/sports/mens-basketball/schedule/2026-27?grid=true",
 "chestnut-hill":"https://griffinathletics.com/sports/mens-basketball/schedule/2026-2027?grid=true",
 "goldey-beacom":"https://www.gbcathletics.com/sports/mens-basketball/schedule/2026-2027?grid=true",
 "post":"https://posteagles.com/sports/mens-basketball/schedule/2026-27?grid=true",
}

def parse_host_venues(html,home):
 """School's own actual 2026-27 grid, never a guessed usual campus arena."""
 from bs4 import BeautifulSoup
 soup=BeautifulSoup(html,"html.parser")
 title=clean(soup.get_text(" ",strip=True)).lower()
 if "2026-27" not in title and "2026-2027" not in title:
  raise ValueError("Host schedule not for 2026-27")
 if "men's basketball" not in title:raise ValueError("Host schedule sport not men's basketball")
 matches=[]
 for table in soup.select("table"):
  heads=" ".join(clean(th.get_text(" ",strip=True)).lower() for th in table.select("th"))
  if not all(x in heads for x in ("date","time","at","opponent","location")):continue
  for tr in table.select("tr"):
   cols=[clean(x.get_text(" ",strip=True)) for x in tr.find_all(["th","td"],recursive=False)]
   if len(cols)<5:continue
   day,time,role,opponent,place=cols[:5]
   if role.lower()!="home" or "/" not in place:continue
   date_match=re.search(r"([A-Za-z]+\s+\d{1,2},\s+202[67])",day)
   if not date_match:continue
   try:when=dt.datetime.strptime(date_match[1],"%B %d, %Y").date()
   except ValueError:continue
   if not(dt.date(2026,11,1)<=when<=dt.date(2027,2,28)):continue
   away=opponent_id(opponent)
   if not away or away==home:continue
   city,arena=map(clean,place.split("/",1))
   if not arena or not re.search(r"\b(center|arena|gym(?:nasium)?|fieldhouse|pavilion)\b",arena,re.I):
    continue
   matches.append({"date":when.isoformat(),"away":away,"home":home,
                   "venue":arena+" · "+city})
 # Ambiguous duplicate date/team venues are explicitly withheld.
 grouped=defaultdict(set)
 for r in matches:grouped[(r["date"],r["away"],r["home"])].add(r["venue"])
 return {key:next(iter(venues)) for key,venues in grouped.items() if len(venues)==1}

def enrich_cacc_host_venues(games):
 """Only official 2026-27 HOME game venue names, matched by exact opponent."""
 stats={"official_host_schedules":0,"venues_added":0,"venue_conflicts":0,
        "unavailable":[],"coverage_by_host":{}}
 for home,url in HOST_GRID_SOURCES.items():
  try:
   venues=parse_host_venues(read_page(url),home)
  except Exception as exc:
   stats["unavailable"].append({"host":home,"cause":str(exc)[:150]})
   continue
  if len(venues)<7: # Safeguard against truncated/wrong-year source.
   stats["unavailable"].append({"host":home,"cause":"too few independently matched home game venue rows"})
   continue
  stats["official_host_schedules"]+=1
  found=0
  for game in games.values():
   key=(game.get("date"),game.get("away"),game.get("home"))
   if key not in venues:continue
   verified=venues[key]
   old=game.get("venue")
   if old and old!=verified:
    stats["venue_conflicts"]+=1
    continue
   if not old:
    game["venue"]=verified
    game["venue_source_url"]=url
    found+=1;stats["venues_added"]+=1
  stats["coverage_by_host"][home]=found
 return stats

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
 audit["home_venue_coverage"]=enrich_cacc_host_venues(games)
 audit["status"]="verified reciprocal games only; provisional programs excluded"
 audit["official_network_context"]=OFFICIAL_NETWORK
 audit["streaming_not_blanket_verified"]=True
 audit["school_sources"]=[BASE+str(i) for i in SCHOOLS]
 return audit
