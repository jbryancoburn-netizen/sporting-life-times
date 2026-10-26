#!/usr/bin/env python3
"""Acquire actual NCAA.com men's D1 historical results through the public NCAA API.
Writes evidence and an audit; never promotes unmatched school IDs to historical Elo.
"""
import argparse,collections,csv,datetime,json,time,urllib.error,urllib.request
from pathlib import Path
ROOT="https://ncaa-api.henrygd.me/scoreboard/basketball-men/d1/"
def read(url):
 for attempt in range(4):
  try:
   req=urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimes historical basketball audit (one query per day)","Accept":"application/json"})
   with urllib.request.urlopen(req,timeout=35) as response:return json.loads(response.read())
  except (urllib.error.URLError,TimeoutError,json.JSONDecodeError):
   if attempt==3:raise
   time.sleep(2*(attempt+1))
def game_fields(record,date):
 g=record.get("game",record)
 if not isinstance(g,dict):return None,"malformed"
 state=str(g.get("gameState") or g.get("game_state") or g.get("state") or g.get("status") or "").lower()
 if not (state.startswith("final") or state in ("f","complete","completed")):return None,"not_final"
 home=g.get("home",{});away=g.get("away",{})
 if not isinstance(home,dict) or not isinstance(away,dict):return None,"team_missing"
 def team(t):
  names=t.get("names") if isinstance(t.get("names"),dict) else {}
  return str(names.get("short") or names.get("full") or t.get("name") or t.get("short") or t.get("seo") or "").strip()
 def points(t):
  v=t.get("score")
  if isinstance(v,dict):v=v.get("score") or v.get("total")
  return int(v)
 try:
  hn=team(home);an=team(away);hs=points(home);ads=points(away)
  if not hn or not an or hn==an or min(hs,ads)<0 or hs==ads:raise ValueError()
 except (ValueError,TypeError):return None,"score_or_team_invalid"
 return {"date":date.isoformat(),"season":date.year+1 if date.month>=7 else date.year,"homeTeam":hn,"awayTeam":an,
         "homePoints":hs,"awayPoints":ads,"ncaa_game_id":str(g.get("gameID") or g.get("gameId") or g.get("id") or ""),"source":"ncaa.com"},None
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--season",type=int,required=True)
 ap.add_argument("--out-dir",type=Path,default=Path("historical-normalized/ncaa"))
 ap.add_argument("--report",type=Path);ap.add_argument("--sleep",type=float,default=.4);a=ap.parse_args()
 if not 2020<=a.season<=2026:raise ValueError("Season must be 2020 through 2026")
 begin=datetime.date(a.season-1,11,1);end=datetime.date(a.season,4,30)
 a.out_dir.mkdir(parents=True,exist_ok=True);stats=collections.Counter();rows={};failures=[]
 day=begin
 while day<=end:
  url=ROOT+day.strftime("%Y/%m/%d")+"/all-conf"
  try:
   data=read(url);games=data.get("games",[])
   if not isinstance(games,list):raise ValueError("Missing games array")
   stats["dates_succeeded"]+=1
   for entry in games:
    row,error=game_fields(entry,day)
    if error:stats[error]+=1;continue
    key=row["ncaa_game_id"] or (row["date"],tuple(sorted((row["homeTeam"],row["awayTeam"]))))
    if key in rows:
     if rows[key]!=row:raise ValueError("Conflicting game scores: "+str(key))
     stats["duplicates"]+=1
    else:rows[key]=row;stats["final_games"]+=1
  except Exception as exc:
   failures.append({"date":day.isoformat(),"reason":str(exc)[:150]});stats["dates_failed"]+=1
  day+=datetime.timedelta(days=1)
  time.sleep(a.sleep)
 out=a.out_dir/f"ncaa-{a.season}-finals.csv"
 with out.open("w",newline="") as f:
  writer=csv.DictWriter(f,fieldnames=("season","date","homeTeam","awayTeam","homePoints","awayPoints","ncaa_game_id","source"))
  writer.writeheader();writer.writerows(sorted(rows.values(),key=lambda r:(r["date"],r["homeTeam"])))
 report={"source":"NCAA.com via henrygd/ncaa-api","season":a.season,"date_range":[begin.isoformat(),end.isoformat()],
  "status":"SOURCE_ACQUIRED_UNMATCHED_TEAM_IDS_NOT_REPLAY_READY",
  "games":len(rows),"stats":dict(stats),"failed_dates":failures,"raw_fixture_path":str(out),
  "team_id_reconciled":False,"historical_elo_replayed":False}
 dest=a.report or a.out_dir/f"ncaa-{a.season}-audit.json";dest.write_text(json.dumps(report,indent=2)+"\n")
 print(json.dumps({"season":a.season,"games":len(rows),"dates_failed":len(failures)},indent=2))
 if len(rows)<1000 or failures:raise RuntimeError("Incomplete source retrieval; no historical Elo promotion")
if __name__=="__main__":main()
