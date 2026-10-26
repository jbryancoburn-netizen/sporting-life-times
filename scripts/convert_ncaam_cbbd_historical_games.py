#!/usr/bin/env python3
"""Convert acquired CBBD historical JSON into national Elo fixture CSV.
Fail if scores, stable team identities, or dates cannot be verified.
"""
import argparse,csv,datetime,json,collections
from pathlib import Path
def pick(row,*names):
 for name in names:
  if row.get(name) is not None:return row[name]
 return None
def main():
 p=argparse.ArgumentParser();p.add_argument("--source-dir",type=Path,default=Path("historical-normalized/cbbd"));p.add_argument("--output",type=Path,default=Path("historical-normalized/cbbd-national-fixtures.csv"));a=p.parse_args()
 files=sorted(a.source_dir.glob("cbbd-games-*.json"))
 if not files:raise ValueError("No acquired national season files")
 rows=[];errors=collections.Counter();seen=set()
 for path in files:
  for g in json.loads(path.read_text()):
   try:
    season=int(pick(g,"season"))
    raw=pick(g,"startDate","start_date","date")
    day=datetime.date.fromisoformat(str(raw)[:10])
    home=pick(g,"homeTeam","home_team")
    away=pick(g,"awayTeam","away_team")
    if isinstance(home,dict):home=pick(home,"school","name","id")
    if isinstance(away,dict):away=pick(away,"school","name","id")
    hscore=pick(g,"homePoints","homeScore","home_score")
    ascore=pick(g,"awayPoints","awayScore","away_score")
    if isinstance(hscore,dict):hscore=pick(hscore,"points","score")
    if isinstance(ascore,dict):ascore=pick(ascore,"points","score")
    if not home or not away or home==away or hscore is None or ascore is None:errors["missing_completed_game_fields"]+=1;continue
    hscore=int(hscore);ascore=int(ascore)
    if min(hscore,ascore)<0 or hscore==ascore:errors["invalid_final"]+=1;continue
    if not 1950<=season<=1984:errors["outside_requested_era"]+=1;continue
    gid=str(pick(g,"id","gameId"))
    if gid=="None":raise ValueError("missing game identifier")
    k=(season,gid)
    if k in seen:errors["duplicate_ids"]+=1;continue
    seen.add(k)
    rows.append({"season":season,"date":day.isoformat(),"homeTeam":home,"awayTeam":away,"homePoints":hscore,"awayPoints":ascore})
   except (ValueError,TypeError,KeyError):errors["malformed"]+=1
 if not rows:raise ValueError("No valid historical final scores; schema may differ")
 a.output.parent.mkdir(parents=True,exist_ok=True)
 with a.output.open("w",newline="") as f:
  w=csv.DictWriter(f,fieldnames=["season","date","homeTeam","awayTeam","homePoints","awayPoints"]);w.writeheader();w.writerows(rows)
 print(json.dumps({"files":len(files),"accepted_finals":len(rows),"excluded":dict(errors)},indent=2))
if __name__=="__main__":main()
