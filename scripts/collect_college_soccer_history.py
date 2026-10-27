#!/usr/bin/env python3
"""Collect dated NCAA men's D-I soccer final scores for leakage-free USRS backtests.
Never manufacture scores, dates, venues, or team identities.
"""
import argparse, datetime as dt, json, pathlib, time, random
from update_college_soccer_elo import API, scoreboard, normalized_final
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE=API+"/soccer-men/d1"
def parse(raw,day):
 g=normalized_final(raw,"men",day)
 if not g:return None
 return {"game_id":g["match_id"],"date":g["date"],"home":g["home_team"],"away":g["away_team"],"home_goals":g["home_goals"],"away_goals":g["away_goals"],"neutral_venue":None,"source_url":g["source_game"],"status":"final"}
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--years",nargs="+",type=int,default=[2023,2024,2025]);ap.add_argument('--max-days-per-year',type=int,default=153);args=ap.parse_args()
 dest=ROOT/"data"/"college-soccer-history";dest.mkdir(parents=True,exist_ok=True)
 for year in args.years:
  path=dest/f"men-d1-{year}.json"
  old=json.loads(path.read_text()) if path.exists() else {}
  records={r["game_id"]:r for r in old.get("games",[])}
  errors=[];dates=0;valid=0;checked=set(old.get('checked_dates',[]))
  def save_checkpoint():
   games=sorted(records.values(),key=lambda x:(x['date'],x['game_id']))
   output={'schema_version':1,'season':year,'cohort':'men-d1','source':'NCAA.com via ncaa-api compatibility transport','venue_note':'Listed home/away is not proof of actual venue; neutral_venue unknown.','collection_date_utc':dt.datetime.now(dt.timezone.utc).isoformat(),'dates_queried':dates,'checked_dates':sorted(checked),'finals_seen':valid,'unique_finals':len(games),'coverage_complete':len(checked)==153 and len(games)>=100 and not errors,'dates_expected':153,'errors':errors,'games':games}
   path.write_text(json.dumps(output,indent=2)+'\n')
  for month in [8,9,10,11,12]:
   start=dt.date(year,month,1)
   end=dt.date(year+1,1,1) if month==12 else dt.date(year,month+1,1)
   day=start
   while day<end:
    stamp=day.isoformat()
    if stamp in checked:
     day+=dt.timedelta(days=1)
     continue
    if dates>=args.max_days_per_year:break
    url=f"{BASE}/{day:%Y/%m/%d}/all-conf"
    try:
     # Retry a whole missing date after transport failures, not merely one HTTP request.
     # This specifically addresses intermittent NCAA proxy HTTP 502 responses.
     last_error=None
     for attempt in range(8):
      try:
       data=scoreboard(url,retries=2)
       last_error=None
       break
      except Exception as exc:
       last_error=exc
       if attempt<7:time.sleep(min(45,3*(attempt+1))+random.uniform(0,1))
     if last_error is not None:raise last_error
     dates+=1
     if not isinstance(data,dict) or not isinstance(data.get('games'),list):raise ValueError('invalid scoreboard response')
     checked.add(stamp)
     if data is not None:
      for item in data.get("games",[]):
       result=parse(item,day)
       if result:
        valid+=1
        prior=records.get(result["game_id"])
        if prior and (prior["home_goals"],prior["away_goals"])!=(result["home_goals"],result["away_goals"]):
         errors.append({"date":stamp,"game_id":result["game_id"],"error":"conflicting final score"})
         continue
        records[result["game_id"]]=result
    except Exception as e:errors.append({"date":stamp,"error":str(e)[:180]})
    if dates and dates%20==0:save_checkpoint()
    day+=dt.timedelta(days=1)
    time.sleep(.38)
   if dates>=args.max_days_per_year:break
  save_checkpoint()
  games=sorted(records.values(),key=lambda x:(x['date'],x['game_id']))
  print(year,"days",dates,"games",len(games),"errors",len(errors),flush=True)
  if errors:print(f"Collection incomplete for {year}: {len(errors)} source errors; retry next run",flush=True)
if __name__=="__main__":main()
