#!/usr/bin/env python3
"""Read-only forensic HTML probe. Inspect actual game element structure, no site edits."""
import json,requests,re,collections
from bs4 import BeautifulSoup
SOURCES={
 "Alabama":"https://rolltide.com/sports/mens-basketball/schedule/2026-27",
 "North Carolina":"https://goheels.com/sports/mens-basketball/schedule/2026-27",
 "Akron":"https://gozips.com/sports/mens-basketball/schedule/2026-27",
 "UC Riverside":"https://gohighlanders.com/sports/mens-basketball/schedule",
 "Indiana":"https://iuhoosiers.com/sports/mens-basketball/schedule",
 "Villanova":"https://villanova.com/sports/mens-basketball/schedule/2026-27",
 "Howard":"https://hubison.com/sports/mens-basketball/schedule/2026-27",
 "UCLA":"https://uclabruins.com/sports/mens-basketball/schedule/season/2026-27",
 "Kentucky":"https://ukathletics.com/sports/mbball/schedule/season/2026-27/"
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
  result["sample_cards"]=[{"tag":n.name,"class":n.get("class",[]),"data_game_id":n.get("data-game-id"),"text":n.get_text(" ",strip=True)[:330],"opp":(n.select_one("[class*='opponent']") or n).get_text(" ",strip=True)[:180],"network_markup":[{"class":z.get("class"),"text":z.get_text(" ",strip=True)[:100]} for z in n.select("[class*='tv'],[class*='broadcast'],[class*='network']")[:8]]} for n in soup.select(".sidearm-schedule-game,[data-game-id]")[:2]]
  # Capture actual schedule DOM fragments for non-Sidearm athletics platforms.
  result["date_nodes"]=[]
  for el in soup.find_all(string=lambda t: bool(t and re.search(r"Nov\\s+(?:2|3|5|6|9|10)\\b",str(t),re.I))):
   if el.find_parent(["script","style","nav","header","footer"]):continue
   parent=el.parent
   if parent:
    ancestors=walk_parents(el)
    if ancestors and not any(n.get("text")==ancestors[0]["text"] for n in result["date_nodes"]):
     result["date_nodes"].append({"sample":str(el).strip()[:150],"ancestors":ancestors[:4],"html":str(parent.parent or parent)[:1600]})
   if len(result["date_nodes"])>=4:break
  result["schedule_elements"]=[{"tag":el.name,"class":el.get("class"),"id":el.get("id"),"text":el.get_text(" ",strip=True)[:300],"html":str(el)[:1200]} for el in soup.select("[class*='schedule'],[class*='event'],[class*='fixture'],[data-event-id]") if len(el.get_text(" ",strip=True))>15][:6]
  result["table_headers"]=[[x.get_text(" ",strip=True)[:80] for x in table.select("tr th")[:10]] for table in soup.select("table")[:3]]
  result["jsonld_preview"]=[(z.string or z.get_text())[:320] for z in soup.select('script[type="application/ld+json"]')[:1]]
  for term in ["Oakwood","DePaul","Auburn","North Texas","Merrimack"]:
   found=soup.find_all(string=lambda s: bool(s and term.lower() in s.lower()))
   if found:result.setdefault("examples",{})[term]=[walk_parents(n) for n in found[:2]]
 except Exception as e:result["error"]=str(e)[:250]
 rows.append(result)
out={"results":rows,"purpose":"Identify the actual official game card element and fields before writing a production parser"}
open("data/mbb-official-dom-diagnosis.json","w").write(json.dumps(out,indent=2)+"\n")
print(json.dumps([{"school":r["school"],"status":r.get("status"),"selectors":r.get("selectors"),"examples":list(r.get("examples",{}))} for r in rows],indent=2))
