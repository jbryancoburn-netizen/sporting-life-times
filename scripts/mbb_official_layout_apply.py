#!/usr/bin/env python3
"""Apply only unambiguous official card date/opponent matches."""
import json,os,pathlib
from mbb_official_layout_discovery import extract,clean
import requests
base=pathlib.Path(__file__).resolve().parents[1]/"data"
teams=json.loads((base/"ncaam-2026-27-espn-team-crosswalk.json").read_text())["teams"]
start=int(os.getenv("START","0"));end=int(os.getenv("END","100"))
summary={"schools_checked":0,"games_corrected":0,"schools_updated":0,"ambiguous":0}
for team in teams[start:end]:
 tid=str(team.get("espn_id",""));p=base/"mbb-schedules-2026-27"/(tid+".json")
 if not p.exists():continue
 d=json.loads(p.read_text());url=d.get("source_url","")
 if not url.startswith("https://"):continue
 summary["schools_checked"]+=1
 try:
  page=url.replace("/schedule/text/","/schedule/")
  response=requests.get(page,timeout=8,headers={"User-Agent":"Mozilla/5.0"})
  if not response.ok or response.url.split("/")[2]!=url.split("/")[2]:continue
  cards=extract(response.text)
 except requests.RequestException:continue
 count=0
 for event in d.get("events",[]):
  if event.get("site_verified") is True:continue
  ps=(event.get("competitions") or [{}])[0].get("competitors") or []
  own=next((x for x in ps if str((x.get("team") or {}).get("id"))==tid),None)
  opp=next((x for x in ps if x is not own),None)
  if not own or not opp:continue
  other=clean((opp.get("team") or {}).get("displayName",""))
  candidates=[]
  for card in cards:
   if card.get("date")!=str(event.get("date",""))[:10]:continue
   if card.get("method")!="official_schedule_card":continue
   name=clean(card.get("opponent",""))
   if len(name)>=5 and other and (name in other or other in name) and card.get("site") in ("home","away","neutral"):
    candidates.append(card)
  if len(candidates)>1:summary["ambiguous"]+=1
  if len(candidates)!=1:continue
  selected=candidates[0];site=selected["site"]
  own["homeAway"]=site
  opp["homeAway"]={"home":"away","away":"home","neutral":"neutral"}[site]
  event["neutralSite"]=site=="neutral"
  event["site_verified"]=True
  event["site_source_url"]=response.url
  event["site_verified_via"]="unique_official_schedule_card_date_opponent"
  count+=1
 if count:
  p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+"\n")
  summary["games_corrected"]+=count;summary["schools_updated"]+=1
(base/"mbb-alternate-layout-applied.json").write_text(json.dumps(summary,indent=2)+"\n")
print(json.dumps(summary))
