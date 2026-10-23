#!/usr/bin/env python3
"""Publish official league feeds first; attribute fallback and preserve conflicts."""
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
  if block.get("league") not in ("MLB","NHL","NBA") or not block.get("games"):continue
  seen=set();unique=[]
  for game in block["games"]:
   key=str(game.get("id") or "")
   if key and key not in seen:seen.add(key);unique.append(game)
  replacement=dict(block,games=unique,game_count=len(unique))
  leagues=[replacement if x.get("league")==block["league"] else x for x in leagues]
  # Preserve cross-provider discrepancies for audit even when the official
  # snapshot replaces a whole league to avoid duplicate IDs.
 for block in leagues:
  if block.get("provider")=="reconciled":
   providers=sorted({g.get("provider","unknown") for g in block.get("games",[])})
   block["provider"]="mixed" if len(providers)>1 else (providers[0] if providers else "unknown")
  block["source_priority"]="official_first" if block.get("provider") in ("mlb_stats","nhl_web","nba_live") else "fallback_or_mixed"
  block["fallback_used"]=block.get("provider") in ("espn","mixed")
 result={"schema_version":2,"updated_at":datetime.now(timezone.utc).isoformat(),"source":"Official MLB/NHL/NBA preferred; attributed ESPN fallback for unserved coverage","leagues":leagues,"conflicts":conflicts,"summary":{"games":sum(len(x.get("games",[])) for x in leagues),"leagues_with_games":sum(bool(x.get("games")) for x in leagues),"conflicts":len(conflicts)}}
 (ROOT/"multi_scoreboards.json").write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
 print(result["summary"])
if __name__=="__main__":main()
