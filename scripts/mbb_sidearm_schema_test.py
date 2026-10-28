#!/usr/bin/env python3
"""Forensic test: Sidearm official JSON-LD SportsEvent schema for real game records."""
import json,re,requests,pathlib
from bs4 import BeautifulSoup
SOURCES={
"Alabama A&M":"https://aamusports.com/sports/mens-basketball/schedule/2026-27",
"App State":"https://appstatesports.com/sports/mens-basketball/schedule/2026-27",
"A&M-Corpus Christi":"https://goislanders.com/sports/mens-basketball/schedule/2026-27"}
report=[]
for school,url in SOURCES.items():
 r=requests.get(url,timeout=20,headers={"User-Agent":"Mozilla/5.0"})
 soup=BeautifulSoup(r.text,"html.parser")
 ev=[]
 for script in soup.select('script[type="application/ld+json"]'):
  try:arr=json.loads(script.string or script.get_text())
  except (ValueError,TypeError):continue
  if isinstance(arr,dict):arr=arr.get("@graph",[arr])
  for obj in arr:
   if not isinstance(obj,dict):continue
   if not obj.get("startDate"):continue
   ev.append({"name":obj.get("name"),"date":obj.get("startDate"),"homeTeam":obj.get("homeTeam"),"awayTeam":obj.get("awayTeam"),"location":obj.get("location"),"keys":list(obj)})
 cards=[]
 for node in soup.select(".sidearm-schedule-game[data-game-id]")[:3]:
  cards.append({"attributes":{k:v for k,v in node.attrs.items() if k.startswith("data-")},"text":node.get_text(" ",strip=True)[:450],"children": [{"tag":x.name,"class":x.get("class"),"text":x.get_text(" ",strip=True)[:100]} for x in node.find_all(["span","time","div"],recursive=True)[:12]]})
 report.append({"school":school,"url":url,"events_count":len(ev),"events_first":ev[:5],"events_examples":[x for x in ev if any(w in str(x.get("name")) for w in ("Oakwood","DePaul","Auburn","North Texas"))][:8],"cards":cards})
pathlib.Path("data/mbb-sidearm-schema-test.json").write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps([{"school":x["school"],"events":x["events_count"],"examples":x["events_examples"][:3]} for x in report],indent=2))
