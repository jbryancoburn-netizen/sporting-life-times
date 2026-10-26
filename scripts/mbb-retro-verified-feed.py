#!/usr/bin/env python3
"""Enrich existing NCAA forecast IDs with provider UTC tipoff and neutral-site flag.
Provider schedule is secondary evidence; no inferred venues or final scores.
"""
import json,urllib.request
from datetime import datetime,timedelta,timezone
from pathlib import Path
BASE="https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard"
src=Path("data/ncaam-2026-27-upcoming-forecasts.json")
doc=json.loads(src.read_text())
today=datetime.now(timezone.utc).date()
ids={str(g["id"]):g for g in doc["games"]}
verified={}
for offset in range(0,9):
 day=today+timedelta(days=offset)
 url=f"{BASE}?dates={day:%Y%m%d}&limit=500&groups=50"
 try:
  req=urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimes-RETRO/1.0"})
  with urllib.request.urlopen(req,timeout=40) as response: events=json.load(response).get("events",[])
 except Exception as exc:
  print(f"Skipped {day}: {exc}")
  continue
 for e in events:
  key="espn:"+str(e.get("id",""))
  if key not in ids:continue
  comp=(e.get("competitions") or [{}])[0]
  members=comp.get("competitors") or []
  if len(members)!=2 or type(comp.get("neutralSite")) is not bool:continue
  try:
   tip=datetime.fromisoformat(str(e["date"]).replace("Z","+00:00"))
   if tip.tzinfo is None or tip<=datetime.now(timezone.utc):continue
  except (KeyError,ValueError,TypeError):continue
  if (e.get("status") or {}).get("type",{}).get("completed") is True:continue
  verified[key]={"tipoff_at":tip.isoformat(),"site":"neutral" if comp["neutralSite"] else "home"}
for key,fields in verified.items():ids[key].update(fields)
out={"season":"2026-27","as_of":doc.get("as_of"),"verified_at":datetime.now(timezone.utc).isoformat(),"games":list(ids.values())}
Path("data/mbb-retro-verified-upcoming-2026-27.json").write_text(json.dumps(out,indent=2)+"\n")
print(f"Verified tipoff and venue for {len(verified)} of {len(ids)} scheduled games")
