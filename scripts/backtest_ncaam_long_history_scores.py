#!/usr/bin/env python3
"""Replay published Kaggle-format NCAA men's results chronologically from 1985.
No player features are manufactured. Game results only; NCAA tournament excluded
unless a distinct validated tournament dataset is supplied.
"""
import argparse,csv,hashlib,json,math,urllib.request
from collections import defaultdict
from pathlib import Path
URL="https://raw.githubusercontent.com/zachmayer/kaggleNCAA/master/inst/kaggle_data/RegularSeasonCompactResults.csv"
REQUIRED={"Season","DayNum","WTeamID","WScore","LTeamID","LScore","WLoc"}
def get_data(path,url):
 if path:return Path(path).read_bytes(),"local:"+str(path)
 if not url.startswith("https://"):raise ValueError("HTTPS source required")
 req=urllib.request.Request(url,headers={"User-Agent":"SLAT-historical-research/1.0"})
 with urllib.request.urlopen(req,timeout=90) as f:
  data=f.read(30_000_000)
 return data,url
def score(rows,carry=.65,k=24.,mov=.55):
 by_year=defaultdict(list)
 seen=set()
 for i,row in enumerate(rows):
  try:
   y=int(row["Season"]);day=int(row["DayNum"]);w=row["WTeamID"];l=row["LTeamID"]
   ws=int(row["WScore"]);ls=int(row["LScore"])
  except (KeyError,TypeError,ValueError) as e:raise ValueError("Malformed result row "+str(i)) from e
  if y<1892 or y>2026 or not (0<=day<=365) or w==l or min(ws,ls)<0 or ws<=ls:raise ValueError("Invalid game "+str(i))
  key=(y,day,tuple(sorted((w,l))))
  if key in seen:raise ValueError("Duplicate team/day match "+str(key))
  seen.add(key)
  by_year[y].append((day,w,l,ws,ls,row["WLoc"]))
 ratings={};season_report=[];total=0
 for y in sorted(by_year):
  games=sorted(by_year[y])
  teams={t for day,w,l,ws,ls,loc in games for t in (w,l)}
  ratings={t:1500+carry*(ratings.get(t,1500)-1500) for t in teams}
  logloss=brier=0.
  # Batch all fixtures on the same day; avoid within-day ordering artifacts
  i=0
  while i<len(games):
   j=i
   while j<len(games) and games[j][0]==games[i][0]:j+=1
   delta=defaultdict(float)
   for day,w,l,ws,ls,loc in games[i:j]:
    diff=ratings[w]-ratings[l]
    p=1/(1+10**(-diff/400))
    logloss-=math.log(max(1e-12,p));brier+=(1-p)**2
    change=k*(1+mov*math.log10(1+ws-ls))*(1-p)
    delta[w]+=change;delta[l]-=change
   for t,d in delta.items():ratings[t]+=d
   i=j
  total+=len(games)
  season_report.append({"season":y,"games":len(games),"teams":len(teams),
   "log_loss":round(logloss/len(games),6),"brier":round(brier/len(games),6),
   "covered_by_source":True,"eligible_for_player_challenger":False,
   "highest_elo":[{"team_id":t,"elo":round(v,2)} for t,v in sorted(ratings.items(),key=lambda x:-x[1])[:5]]})
 return season_report,total
def main():
 p=argparse.ArgumentParser();p.add_argument("--input",type=Path);p.add_argument("--url",default=URL)
 p.add_argument("--output",type=Path,default=Path("data/ncaam-long-history-elo-backtest.json"));a=p.parse_args()
 raw,source=get_data(a.input,a.url)
 import io
 reader=csv.DictReader(io.StringIO(raw.decode("utf-8-sig")))
 if not REQUIRED.issubset(reader.fieldnames or []):raise ValueError("Missing required columns "+str(REQUIRED-set(reader.fieldnames or [])))
 report,n=score(reader)
 if not report:raise ValueError("No historical seasons")
 status="PARTIAL_HISTORICAL_REPLAY_NO_PLAYER_COMPARISON"
 out={"model":"SLAT NCAA long-history Elo score-only v1","status":status,
 "source":source,"sha256":hashlib.sha256(raw).hexdigest(),
 "coverage":{"earliest":min(x["season"] for x in report),"latest":max(x["season"] for x in report),"seasons":len(report),"games":n},
 "parameters":{"elo_K":24,"mov_multiplier":.55,"season_carryover":.65,"venue_adjustment":"none"},
 "methodology":"Kaggle MRegularSeasonCompactResults-style regular-season scores; matched-date simultaneous updates; season-open carryover",
 "cautions":["Historical dataset may be a partial snapshot; no source independently certifies complete seasons",
 "Regular-season scores only: postseason excluded","Historical championship game and venue effects are not included",
 "Outcomes for pre-1985 seasons must be independently acquired","No roster/player/transfer data included in this test",
 "Source contains winner and loser rather than scheduled home/away; evaluated pregame winner probability"],
 "seasons":report}
 a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(out,indent=2)+"\n")
 print(json.dumps({"source":source,"sha256":out["sha256"],"coverage":out["coverage"]},indent=2))
if __name__=="__main__":main()
