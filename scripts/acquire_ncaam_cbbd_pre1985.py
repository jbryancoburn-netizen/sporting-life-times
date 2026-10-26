#!/usr/bin/env python3
"""Acquire historical college basketball results with explicit per-window completeness checks.
Requires CBBD API key; no credentials, fabricated records or unverified fill-ins.
"""
import argparse,datetime,json,os,time,urllib.parse,urllib.request
from pathlib import Path
API="https://api.collegebasketballdata.com/games"
def fetch(key,year,start,end):
 params=urllib.parse.urlencode({"season":year,"startDateRange":start.isoformat(),"endDateRange":end.isoformat()})
 url=API+"?"+params
 req=urllib.request.Request(url,headers={"Authorization":"Bearer "+key,"Accept":"application/json","User-Agent":"SLAT-historical-research/1.0"})
 with urllib.request.urlopen(req,timeout=90) as result:
  data=json.loads(result.read())
 if not isinstance(data,list):raise ValueError("Unexpected CBBD response shape")
 if len(data)>=3000:raise ValueError("Potential truncated CBBD window "+url+" records="+str(len(data)))
 return data
def main():
 p=argparse.ArgumentParser()
 p.add_argument("--start-season",type=int,default=1950)
 p.add_argument("--end-season",type=int,default=1984)
 p.add_argument("--output-dir",type=Path,default=Path("historical-normalized/cbbd"))
 p.add_argument("--manifest",type=Path,default=Path("data/ncaam-cbbd-historical-acquisition.json"))
 a=p.parse_args()
 if a.start_season<1949 or a.end_season>2026 or a.end_season<a.start_season:raise ValueError("Bad season range")
 key=os.environ.get("CBBD_API_KEY","").strip()
 if not key:raise SystemExit("CBBD_API_KEY missing. Acquire a permitted API key and add it as a repository Actions secret; no data have been downloaded.")
 a.output_dir.mkdir(parents=True,exist_ok=True)
 manifest=[];all_ids=set()
 for y in range(a.start_season,a.end_season+1):
  begin=datetime.date(y-1,10,1);end=datetime.date(y,6,1);day=begin
  results=[];windows=[]
  while day<end:
   stop=min(end,day+datetime.timedelta(days=28))
   games=fetch(key,y,day,stop)
   windows.append({"start":day.isoformat(),"end":stop.isoformat(),"returned":len(games)})
   results.extend(games)
   day=stop+datetime.timedelta(days=1)
  dedup={}
  for game in results:
   game_id=game.get("id") or game.get("gameId")
   if game_id is None:raise ValueError("Missing stable game ID year "+str(y))
   if game_id in dedup and dedup[game_id]!=game:raise ValueError("Conflicting historical game id "+str(game_id))
   dedup[game_id]=game
  output=a.output_dir/f"cbbd-games-{y}.json"
  output.write_text(json.dumps(list(dedup.values()),ensure_ascii=False)+"\n")
  manifest.append({"season":y,"games":len(dedup),"windows":windows,"file":str(output),"has_complete_national_coverage":False})
  print("CBBD source season",y,"unique game IDs",len(dedup),flush=True)
 a.manifest.parent.mkdir(parents=True,exist_ok=True)
 a.manifest.write_text(json.dumps({"status":"ACQUIRED_NOT_YET_INDEPENDENTLY_RECONCILED","source":"CollegeBasketballData Games API","range":[a.start_season,a.end_season],"seasons":manifest},indent=2)+"\n")
if __name__=="__main__":main()
