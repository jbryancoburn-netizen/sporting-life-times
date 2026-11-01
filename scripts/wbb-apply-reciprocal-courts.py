#!/usr/bin/env python3
"""Apply exact-ID, triple-sourced women's 2026-27 home-court corrections to both teams."""
import datetime
import json
import pathlib
from zoneinfo import ZoneInfo

ROOT=pathlib.Path(__file__).resolve().parents[1]/"data"
PROOF=ROOT/"ncaaw-2026-27-verified-home-courts.json"
CAL=ROOT/"ncaaw-schedules-2026-27.json"

def day(value):
 return datetime.datetime.fromisoformat(str(value).replace("Z","+00:00")).astimezone(
   ZoneInfo("America/New_York")).date().isoformat()

def apply(calendar,manifest):
 if calendar.get("gender")!="women" or calendar.get("season")!="2026-27" or len(calendar.get("teams",{}))!=363:
  raise RuntimeError("Women-only certified 363-team current calendar required")
 if manifest.get("season")!="2026-27" or manifest.get("gender")!="women" or manifest.get("status")!="reciprocal_official_home_venue_verified":
  raise RuntimeError("Official corrected-site proof is not women's current season")
 games=manifest.get("games")
 if not isinstance(games,list) or not games:raise RuntimeError("Empty verified host evidence")
 used=set()
 for p in games:
  gid=str(p.get("game_id",""))
  home=str(p.get("verified_home_id",""))
  away=str(p.get("verified_away_id",""))
  if not all(x.isdecimal() for x in (gid,home,away)) or home==away or gid in used:
   raise RuntimeError("Duplicate or malformed school/home/opponent identity")
  used.add(gid)
  if home not in calendar["teams"] or away not in calendar["teams"]:
   raise RuntimeError("Unrecognized DI women team")
  if len(p.get("sources",[]))<3 or len(set(p["sources"]))<3 or any(not x.startswith("https://") for x in p["sources"]):
   raise RuntimeError("Three distinct official school/conference HTTPS sources required")
  if not p.get("venue") or not p.get("city"):raise RuntimeError("Missing verified venue or city")
  for tid in (home,away):
   matches=[g for g in calendar["teams"][tid]["games"] if str(g.get("id"))==gid]
   if len(matches)!=1:raise RuntimeError("Non-unique reciprocal women's fixture "+gid+" "+tid)
   g=matches[0]
   if str(g.get("opponent_id"))!=(away if tid==home else home) or {
      str(g.get("home_id")),str(g.get("away_id"))}!={home,away} or day(g["date"])!=p["date"]:
    raise RuntimeError("Current women's fixture identity/date not verified "+gid)
   if g.get("completed") or g.get("home_score") is not None or g.get("away_score") is not None:
    raise RuntimeError("Refusing to rewrite completed women's event "+gid)
 # All evidence is confirmed before any edits to avoid partial mutation.
 for p in games:
  home,away,gid=str(p["verified_home_id"]),str(p["verified_away_id"]),str(p["game_id"])
  for tid in (home,away):
   g=next(g for g in calendar["teams"][tid]["games"] if str(g["id"])==gid)
   g["home_id"]=home;g["away_id"]=away
   g["site"]="home" if tid==home else "away"
   g["venue"]=p["venue"]
   g["city"]=p["city"]
   g["official_venue_verified"]=True
   g["official_venue_name"]=p["venue"]
   g["official_venue_source_url"]=p["sources"][0]
   g["official_site_verified"]=True
   g["official_site_source_urls"]=p["sources"]
   g["official_schedule_verified_fields"]=sorted(set(
     g.get("official_schedule_verified_fields",[])+["scheduled_date","opponent","home_away"]))
 calendar["verified_reciprocal_home_site_games"]=len(games)
 return calendar

def main():
 cal=json.loads(CAL.read_text(encoding="utf-8"))
 proof=json.loads(PROOF.read_text(encoding="utf-8"))
 cal=apply(cal,proof)
 text=json.dumps(cal,ensure_ascii=False,indent=2)+"\n"
 if not CAL.exists() or CAL.read_text(encoding="utf-8")!=text:CAL.write_text(text,encoding="utf-8")
 print("WBB official reciprocal home court corrections:",len(proof["games"]),"games, both team entries each")

if __name__=="__main__":main()
