#!/usr/bin/env python3
"""Collect exact-date official college schedule rows; never infer kickoff times."""
import json,re
from datetime import datetime,timezone
from pathlib import Path
from urllib.request import Request,urlopen
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[1]
class Tables(HTMLParser):
 def __init__(self):super().__init__();self.tables=[];self.table=None;self.row=None;self.cell=None
 def handle_starttag(self,tag,attrs):
  if tag=="table":self.table=[] 
  if self.table is not None and tag=="tr":self.row=[]
  if self.row is not None and tag in ("td","th"):self.cell=[]
 def handle_data(self,data):
  if self.cell is not None:self.cell.append(data)
 def handle_endtag(self,tag):
  if tag in ("td","th") and self.cell is not None and self.row is not None:self.row.append(" ".join("".join(self.cell).split()));self.cell=None
  if tag=="tr" and self.row is not None and self.table is not None:self.table.append(self.row);self.row=None
  if tag=="table" and self.table is not None:self.tables.append(self.table);self.table=None
def parse(html,team,url):
 p=Tables();p.feed(html);out=[]
 for table in p.tables:
  if not table:continue
  heads=[x.lower() for x in table[0]]
  if not all(x in heads for x in ("date","at","opponent","result")):continue
  d,a,o,r=[heads.index(x) for x in ("date","at","opponent","result")]
  for row in table[1:]:
   if len(row)<=max(d,a,o,r):continue
   m=re.search(r"([A-Za-z]+ \d{1,2}, 20\d{2})",row[d]);opp=row[o].strip();loc=row[a].lower()
   if not m or not opp or loc not in ("home","away","neutral") or opp.lower() in ("tbd","tba"):continue
   try:date=datetime.strptime(m.group(1),"%B %d, %Y").date().isoformat()
   except ValueError:continue
   score=re.match(r"^([WL]),?\s*(\d+)\s*[-–]\s*(\d+)",row[r],re.I)
   ours,theirs=(int(score[2]),int(score[3])) if score else (None,None)
   if score and (ours>theirs)!=(score[1].upper()=="W") and ours!=theirs:continue
   slug=lambda s:re.sub(r"[^a-z0-9]+","-",s.lower()).strip("-")
   out.append({"id":"college-site:"+slug(team)+":"+date+":"+slug(opp),"date":date,"date_precision":"day","status":"Final" if score else "Scheduled","state":"post" if score else "pre","teams":[{"name":team,"score":ours,"home_away":"away" if loc=="away" else "home"},{"name":opp,"score":theirs,"home_away":"home" if loc=="away" else "away"}],"site_location":loc,"url":url,"provider":"sidearm"})
 return out
def collect():
 config=json.loads((ROOT/"data/college-site-registry.json").read_text())
 result={"updated_at":datetime.now(timezone.utc).isoformat(),"source":"Official college athletics schedules","teams":[]}
 for site in config["teams"]:
  block={"team":site["team"],"url":site["url"],"provider":site["provider"],"games":[]}
  try:
   req=Request(site["url"],headers={"User-Agent":"SportingLifeTimes/1.0","Accept":"text/html"})
   with urlopen(req,timeout=15) as resp:html=resp.read(1500000).decode("utf-8","replace")
   block["games"]=parse(html,site["team"],site["url"])
   if not block["games"]:block["warning"]="No supported structured schedule table"
  except Exception as exc:block["error"]=type(exc).__name__+": "+str(exc)[:140]
  result["teams"].append(block)
 (ROOT/"college_schedules.json").write_text(json.dumps(result,indent=2)+"\n")
 print("College schedule rows:",sum(len(x["games"]) for x in result["teams"]))
if __name__=="__main__":collect()
