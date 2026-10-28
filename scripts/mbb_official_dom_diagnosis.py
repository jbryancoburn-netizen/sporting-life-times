#!/usr/bin/env python3
"""Read-only forensic HTML probe. Inspect actual game element structure, no site edits."""
import json,requests,re,collections
from bs4 import BeautifulSoup
SOURCES={
 "Alabama A&M":"https://aamusports.com/sports/mens-basketball/schedule/2026-27",
 "App State":"https://appstatesports.com/sports/mens-basketball/schedule/2026-27",
 "A&M-Corpus Christi":"https://goislanders.com/sports/mens-basketball/schedule/2026-27",
}
def walk_parents(n):
 out=[]
 for x in list(n.parents)[:6]:
  if not getattr(x,'name',None):continue
  t=x.get_text(" ",strip=True)
  out.append({"tag":x.name,"class":x.get("class",[]),"attrs":{k:str(v)[:110] for k,v in x.attrs.items() if k.startswith("data-")},"text":t[:350],"length":len(t)})
 return out
rows=[]
for school,url in SOURCES.items():
 result={"school":school,"url":url}
 try:
  r=requests.get(url,timeout=20,headers={"User-Agent":"Mozilla/5.0"});result["status"]=r.status_code;result["bytes"]=len(r.content)
  soup=BeautifulSoup(r.text,"html.parser")
  result["selectors"]={sel:len(soup.select(sel)) for sel in [".sidearm-schedule-game",".sidearm-schedule-game-row","[class*='schedule-game']","[class*='schedule_game']","[data-game-id]","li","time","script[type='application/ld+json']"]}
  for term in ["Oakwood","DePaul","Auburn","North Texas","Merrimack"]:
   found=soup.find_all(string=lambda s: bool(s and term.lower() in s.lower()))
   if found:result.setdefault("examples",{})[term]=[walk_parents(n) for n in found[:2]]
 except Exception as e:result["error"]=str(e)[:250]
 rows.append(result)
out={"results":rows,"purpose":"Identify the actual official game card element and fields before writing a production parser"}
open("data/mbb-official-dom-diagnosis.json","w").write(json.dumps(out,indent=2)+"\n")
print(json.dumps([{"school":r["school"],"status":r.get("status"),"selectors":r.get("selectors"),"examples":list(r.get("examples",{}))} for r in rows],indent=2))
