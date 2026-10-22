#!/usr/bin/env python3
"""Combine ESPN fallback and official league feeds, retaining conflicts."""
import json
from datetime import datetime,timezone
from pathlib import Path
from reconcile import reconcile
ROOT=Path(__file__).resolve().parents[1]
def load(name):
 try:return json.loads((ROOT/name).read_text(encoding="utf-8"))
 except (FileNotFoundError,json.JSONDecodeError):return {"leagues":[]}
def main():
 espn=load("scoreboards.json");official=load("official_scoreboards.json")
 leagues,conflicts=reconcile(espn.get("leagues",[]),official.get("leagues",[]))
 # For authoritative league-wide snapshots, publish one source per league.
 # Avoid duplicate cross-provider records when team-name schemes differ.
 for block in official.get("leagues",[]):
  if block.get("league") not in ("MLB","NHL") or not block.get("games"):continue
  seen=set();unique=[]
  for game in block["games"]:
   key=str(game.get("id") or "")
   if key and key not in seen:seen.add(key);unique.append(game)
  replacement=dict(block,games=unique,game_count=len(unique))
  leagues=[replacement if x.get("league")==block["league"] else x for x in leagues]
  conflicts=[c for c in conflicts if c.get("league")!=block["league"]]
 result={"schema_version":2,"updated_at":datetime.now(timezone.utc).isoformat(),"source":"ESPN plus official MLB/NHL","leagues":leagues,"conflicts":conflicts,"summary":{"games":sum(len(x.get("games",[])) for x in leagues),"leagues_with_games":sum(bool(x.get("games")) for x in leagues),"conflicts":len(conflicts)}}
 (ROOT/"multi_scoreboards.json").write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
 print(result["summary"])
if __name__=="__main__":main()
