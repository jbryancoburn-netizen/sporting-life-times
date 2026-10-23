#!/usr/bin/env python3
"""Source health for NCAA men's D1: prefer NCAA, fallback only with disclosure.

Before first game, 404 for season-specific scoreboard is NOT a feed outage.
Sources are never used to fabricate results or venue classifications.
"""
import argparse,json,urllib.error,urllib.request
from datetime import date,datetime,timezone
from pathlib import Path

RELEASE="https://api.github.com/repos/sportsdataverse/sportsdataverse-data/releases/tags/"
FEEDS={
 "ncaa_team_ids":RELEASE+"ncaa_mbb_team_ids",
 "ncaa_schedule":RELEASE+"ncaa_mbb_schedule",
 "espn_fallback":RELEASE+"espn_mens_college_basketball_schedules",
}
def request(url):
 req=urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimes/1.0","Accept":"application/vnd.github+json"})
 with urllib.request.urlopen(req,timeout=25) as f:return json.loads(f.read(2000000))
def check(season=2027,reader=request):
 out={"season":"2026-27","status":"not_released","official_first":True,"sources":{},
      "requirements":["2026-27 membership crosswalk","verified finals","venue verification"]}
 for k,url in FEEDS.items():
  try:
   j=reader(url);assets=[a for a in j.get("assets",[]) if str(season) in a.get("name","") and a.get("name","").endswith(".csv.gz")]
   a=assets[0] if assets else None
   out["sources"][k]={"available":bool(a),"asset":a["name"] if a else None,
    "url":a.get("browser_download_url") if a else None,"repository":url}
  except urllib.error.HTTPError as exc:
   if exc.code!=404:raise
   out["sources"][k]={"available":False,"reason":"release tag absent","repository":url}
 if out["sources"]["ncaa_schedule"]["available"] and out["sources"]["ncaa_team_ids"]["available"]:
  out["status"]="ncaa_origin_available_for_reconciliation"
 elif out["sources"]["espn_fallback"]["available"]:
  out["status"]="fallback_available_not_authorized_for_elo"
 return out
def main():
 p=argparse.ArgumentParser();p.add_argument("--output",type=Path,default=Path("data/ncaam-feed-health.json"));p.add_argument("--season",type=int,default=2027)
 a=p.parse_args();state=check(a.season);a.output.parent.mkdir(parents=True,exist_ok=True)
 a.output.write_text(json.dumps(state,indent=2)+"\n")
 print(json.dumps(state,indent=2))
if __name__=="__main__":main()
