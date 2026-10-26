#!/usr/bin/env python3
"""Collect dated NCAA men's D-I soccer final scores for leakage-free USRS backtests.
Never manufacture scores, dates, venues, or team identities.
"""
import argparse, datetime as dt, json, os, pathlib, time, urllib.request, urllib.error
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE="https://ncaa-api.henrygd.me/scoreboard/soccer-men/d1"
def fetch(url):
 for attempt in range(4):
  try:
   req=urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimes-USRS-HistoricalAudit/1.0","Accept":"application/json"})
   with urllib.request.urlopen(req,timeout=25) as r:return json.load(r)
  except (urllib.error.HTTPError,urllib.error.URLError,TimeoutError,ValueError) as e:
   if isinstance(e,urllib.error.HTTPError) and e.code==404:return None
   if attempt==3:raise
   time.sleep(2**attempt)
def parse(g,date):
 x=g.get("game",g)
 if not isinstance(x,dict):return None
 home=x.get("home",{});away=x.get("away",{})
 if not isinstance(home,dict) or not isinstance(away,dict):return None
 def team(v):
  return v.get("names",{}).get("short") or v.get("names",{}).get("full") or v.get("name")
 def score(v):
  z=v.get("score")
  try:return int(z)
  except (ValueError,TypeError):return None
 hs,as_=score(home),score(away)
 status=str(x.get("gameState") or x.get("state") or x.get("status") or "").lower()
 if hs is None or as_ is None or not team(home) or not team(away):return None
 if not any(k in status for k in ("final","complete")):return None
 ident=str(x.get("gameID") or x.get("gameId") or x.get("id") or "")
 if not ident:return None
 return {"game_id":ident,"date":date,"home":team(home),"away":team(away),"home_goals":hs,"away_goals":as_,"neutral_venue":None,"source_url":"https://www.ncaa.com/game/"+ident,"status":"final"}
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--years",nargs="+",type=int,default=[2023,2024,2025]);args=ap.parse_args()
 dest=ROOT/"data"/"college-soccer-history";dest.mkdir(parents=True,exist_ok=True)
 for year in args.years:
  path=dest/f"men-d1-{year}.json"
  old=json.loads(path.read_text()) if path.exists() else {}
  records={r["game_id"]:r for r in old.get("games",[])}
  errors=[];dates=0;valid=0
  for month in [8,9,10,11,12]:
   start=dt.date(year,month,1)
   end=dt.date(year+1,1,1) if month==12 else dt.date(year,month+1,1)
   day=start
   while day<end:
    stamp=day.isoformat()
    url=f"{BASE}/{day:%Y/%m/%d}/all-conf"
    try:
     data=fetch(url);dates+=1
     if data is not None:
      for item in data.get("games",[]):
       result=parse(item,stamp)
       if result:
        valid+=1
        prior=records.get(result["game_id"])
        if prior and (prior["home_goals"],prior["away_goals"])!=(result["home_goals"],result["away_goals"]):
         errors.append({"date":stamp,"game_id":result["game_id"],"error":"conflicting final score"})
         continue
        records[result["game_id"]]=result
    except Exception as e:errors.append({"date":stamp,"error":str(e)[:180]})
    day+=dt.timedelta(days=1)
    time.sleep(.38)
  games=sorted(records.values(),key=lambda x:(x["date"],x["game_id"]))
  output={"schema_version":1,"season":year,"cohort":"men-d1","source":"NCAA.com via ncaa-api compatibility transport","venue_note":"Listed home/away is not proof of actual venue; neutral_venue unknown.","collection_date_utc":dt.datetime.now(dt.timezone.utc).isoformat(),"dates_queried":dates,"finals_seen":valid,"unique_finals":len(games),"errors":errors,"games":games}
  path.write_text(json.dumps(output,indent=2)+"\n")
  print(year,"days",dates,"games",len(games),"errors",len(errors),flush=True)
  if len(games)<100:raise SystemExit(f"Insufficient verified historical coverage for {year}; refusing to certify")
if __name__=="__main__":main()
