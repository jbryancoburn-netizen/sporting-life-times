#!/usr/bin/env python3
import json,urllib.request
tests=[
"https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/333/roster?season=2027",
"https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/333?enable=roster&season=2027",
"https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/333?enable=roster",
"https://site.api.espn.com/apis/common/v3/sports/basketball/mens-college-basketball/teams/333/roster?season=2026",
"https://site.api.espn.com/apis/common/v3/sports/basketball/mens-college-basketball/teams/333/roster?season=2027"
]
for url in tests:
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimes/1.0"}),timeout=12) as r:j=json.loads(r.read(5000000))
  team=j.get("team") or {}
  print(url,"keys",list(j)[:14],"athletes",len(j.get("athletes") or []),"team keys",list(team)[:14],"team athletes",len(team.get("athletes") or []))
 except Exception as e:print(url,type(e).__name__,str(e)[:100])
