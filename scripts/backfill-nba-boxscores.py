#!/usr/bin/env python3
"""Backfill completed 2026-27 NBA regular-season game box scores from official CDN.
Read official league schedule, collect in bounded batches, preserve captured archive.
No fabricated box score, no overwritten Elo ratings.
"""
import json,sys
from pathlib import Path
from datetime import datetime,timezone
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
from collect_nba_game_center import fetch,game_record
OUT=ROOT/"data/nba-game-center.json"
def main():
  previous={"games":[]}
  if OUT.exists():
    previous=json.loads(OUT.read_text(encoding="utf-8"))
  prior={str(g["id"]):g for g in previous.get("games",[]) if g.get("id")}
  uri="https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json"
  raw=fetch(uri)
  dates=((raw.get("leagueSchedule") or {}).get("gameDates") or [])
  candidates=[]
  for date in dates:
    for g in date.get("games",[]) or []:
      gid=str(g.get("gameId") or "")
      if not gid.startswith("002") or len(gid)!=10 or g.get("gameStatus")!=3:continue
      if gid in prior and prior[gid].get("players"):continue
      candidates.append(g)
  # Up to 36 new box scores per invocation avoids API bursts and job timeouts.
  candidates=sorted(candidates,key=lambda g:g.get("gameTimeUTC") or "",reverse=True)[:36]
  print("Official NBA schedule dates:",len(dates),"unarchived completed regular-season candidates:",len(candidates))
  if not candidates and not any(g.get("players") for g in prior.values()):
    raise RuntimeError("No completed regular-season games in NBA schedule or prior captured archive; refusing empty publication")
  with ThreadPoolExecutor(max_workers=5) as pool:
    fetched=[g for g in pool.map(game_record,candidates) if g and g.get("state")=="post"]
  for g in fetched:
    old=prior.get(g["id"])
    if old and len(old.get("players") or [])>len(g.get("players") or []):continue
    prior[g["id"]]=g
  games=sorted(prior.values(),key=lambda g:(g.get("date") or "",str(g["id"])),reverse=True)
  coverage={"archived_games":len(games),"boxscores_with_players":sum(bool(g.get("players")) for g in games),
      "first_game_date":min((g.get("date") for g in games if g.get("date")),default=None),
      "last_game_date":max((g.get("date") for g in games if g.get("date")),default=None)}
  result={"updated_at":datetime.now(timezone.utc).isoformat(),"source":"Official NBA LiveData plus NBA schedule; captured regular-season box scores (not guaranteed complete)","games":games,"coverage":coverage}
  OUT.parent.mkdir(parents=True,exist_ok=True)
  if not coverage["boxscores_with_players"]:
    raise RuntimeError("Official NBA box-score backfill captured zero player boxes; refusing empty publication")
  OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
  print("NBA backfill: fetched",len(fetched),"completed NBA games; total full player boxes",coverage["boxscores_with_players"])
if __name__=="__main__":main()
