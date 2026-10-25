#!/usr/bin/env python3
"""Refresh CCIW 2026 men's soccer from its own official standings, fail closed."""
from __future__ import annotations
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from bs4 import BeautifulSoup

SOURCE="https://cciw.org/standings.aspx?path=msoc"
OUT=Path("data/college-soccer-cciw-standings.json")
SCHOOLS={
 "north-central-il":("north central",),
 "north-park":("north park",),
 "ill-wesleyan":("illinois wesleyan","ill. wesleyan"),
 "wheaton-il":("wheaton",),
 "millikin":("millikin",),
 "augustana-il":("augustana",),
 "carroll-wi":("carroll",),
 "elmhurst":("elmhurst",),
 "carthage":("carthage",),
}
REC=re.compile(r"^\s*(\d+)-(\d+)(?:-(\d+))?\s*$")
def rows_from_html(html):
 soup=BeautifulSoup(html,"html.parser")
 for table in soup.find_all("table"):
  results={}
  for tr in table.find_all("tr"):
   cells=[c.get_text(" ",strip=True).lower().replace("\xa0"," ").strip() for c in tr.find_all("td",recursive=False)]
   if len(cells)<4:continue
   name=cells[0].replace("*","").strip()
   found=[id for id,patterns in SCHOOLS.items() if any(q in name for q in patterns)]
   if len(found)!=1:continue
   id=found[0]
   records=[m.group(0).strip() for c in cells[1:] if (m:=REC.fullmatch(c))]
   if len(records)<2:raise ValueError(f"Missing conference and overall records: {id}")
   conf,overall=records[0],records[-1]
   w,l,*d=[int(x) for x in conf.split("-")]
   draws=d[0] if d else 0
   pts=w*3+draws
   if str(pts) not in cells[1:]:
    raise ValueError(f"CCIW listed points mismatch for {id}: expected {pts}")
   row={"team_id":id,"conference_record":conf,"conference_points":pts,
        "overall_record":overall,"conference_games":w+l+draws}
   if id in results and results[id]!=row:raise ValueError(f"Duplicate conflicting team {id}")
   results[id]=row
  if set(results)==set(SCHOOLS):return results
 raise ValueError("Incomplete 9-team CCIW official standings table")
def main():
 req=Request(SOURCE,headers={"User-Agent":"Mozilla/5.0 (compatible; SportingLifeTimes/1.0; standings verification)"})
 with urlopen(req,timeout=35) as response:html=response.read().decode("utf-8","replace")
 current=rows_from_html(html)
 old=json.loads(OUT.read_text(encoding="utf-8"))
 prior={r["team_id"]:r for r in old["rows"]}
 new=[current[id] for id in SCHOOLS]
 for row in new:
  prev=prior.get(row["team_id"],{})
  oldgp=int(prev.get("conference_games",sum(int(x) for x in prev.get("conference_record","0-0").split("-"))))
  if row["conference_games"]<oldgp:raise ValueError(f"Conference games regressed for {row['team_id']}")
  if row["conference_games"]==oldgp and row["conference_record"]!=prev.get("conference_record"):
   raise ValueError(f"Previously published CCIW result corrected: {row['team_id']}. Manual review required.")
 fields=("team_id","conference_record","conference_points","overall_record")
 canonical=lambda rows:[tuple(r.get(k) for k in fields) for r in rows]
 if canonical(old["rows"])==canonical(new):
  print("CCIW official standings unchanged");return
 old["rows"]=new
 old["snapshot_checked_date"]=datetime.now(timezone.utc).date().isoformat()
 old["checked_at_utc"]=datetime.now(timezone.utc).isoformat(timespec="seconds")
 old["last_verified_game_date"]=None
 old["note"]="Complete nine-program CCIW 2026 table retrieved from official source; not guaranteed final tournament seeding."
 OUT.write_text(json.dumps(old,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
 print("Validated and updated all nine CCIW teams")
if __name__=="__main__":main()
