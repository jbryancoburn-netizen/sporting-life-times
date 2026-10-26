#!/usr/bin/env python3
"""Convert historical UNC/Duke season schedules into deduplicated dated Elo fixtures.
Source: joongsup/uncmbb CRAN dataset, independently documented 1949-50 onward.
Only known source-team games; missing games and teams are never manufactured.
"""
import argparse,csv,json,datetime,collections
from pathlib import Path
def clean(s):return " ".join(str(s).lower().replace("&","and").replace(".","").split())
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--input",type=Path,required=True);ap.add_argument("--output",type=Path,default=Path("data/ncaam-pre1985-unc-duke-replay.json"));a=ap.parse_args()
 rows=list(csv.DictReader(a.input.open(encoding="utf-8")))
 seen={};errors=collections.Counter();games=[]
 for r in rows:
  try:
   date=datetime.date.fromisoformat(r["Game_Date"]);season=int(r["Season"])
   if not 1949<=season<=1984:continue
   school=clean(r["Source_Team"]);other=clean(r["Opponent_School"])
   if school==other or not school or not other:errors["team_missing"]+=1;continue
   tm=int(r["Tm"]);opp=int(r["Opp"])
   if tm==opp or min(tm,opp)<0:errors["score_invalid"]+=1;continue
   key=(date.isoformat(),tuple(sorted((school,other))))
   identity=(school,other,tm,opp)
   if key in seen:
    if seen[key]!=identity and seen[key]!=(other,school,opp,tm):
     errors["cross_source_conflicting_fixture"]+=1
    else:errors["duplicate_fixture"]+=1
    continue
   seen[key]=identity
   games.append({"date":date.isoformat(),"season":season,"a":school,"b":other,"a_score":tm,"b_score":opp})
  except (KeyError,ValueError,TypeError):errors["malformed"]+=1
 games.sort(key=lambda g:(g["date"],g["a"],g["b"]))
 if not games:raise ValueError("No pre-1985 source fixtures ingested")
 # Same-date batch updates. Outcomes scored against preceding-date values.
 rating={};report=[];daily=collections.defaultdict(list)
 for g in games:daily[g["date"]].append(g)
 aggregate=collections.defaultdict(lambda:{"games":0,"teams":set(),"logloss":0.})
 current=None
 for date,day in sorted(daily.items()):
  year=day[0]["season"]
  if current!=year:
   rating={t:1500+.65*(v-1500) for t,v in rating.items()}
   current=year
  delta=collections.defaultdict(float)
  for g in day:
   x,y=g["a"],g["b"];rating.setdefault(x,1500.);rating.setdefault(y,1500.)
   p=1/(1+10**(-(rating[x]-rating[y])/400))
   actual=int(g["a_score"]>g["b_score"])
   import math
   aggregate[year]["logloss"]-=math.log(max(1e-12,p if actual else 1-p))
   aggregate[year]["games"]+=1;aggregate[year]["teams"].update((x,y))
   d=24*(1+.55*math.log10(1+abs(g["a_score"]-g["b_score"])))*(actual-p)
   delta[x]+=d;delta[y]-=d
  for x,d in delta.items():rating[x]+=d
 for year,x in sorted(aggregate.items()):
  report.append({"season":year,"observed_games":x["games"],"observed_team_names":len(x["teams"]),"logloss":round(x["logloss"]/x["games"],5),"partial_coverage":True})
 out={"status":"PARTIAL_1949_1984_SCHOOL_SAMPLE_NOT_FULL_NCAA_ELO",
  "source":"uncmbb R package (Sports Reference and Tar Heel Times UNC/Duke schedules)",
  "source_game_scope":"Games of UNC and Duke, not a complete NCAA Division I schedule",
  "verified_imported_rows":len(games),"seasons_present":len(report),
  "observed_date_range":[games[0]["date"],games[-1]["date"]],
  "exclusions":dict(errors),"season_coverage":report,
  "not_a_national_rankings_history":True,
  "methodology":"school schedule rows, opponent and date deduplication, venue neutral, same-date Elo changes, 65 percent yearly carryover",
  "minimum_acceptance":"All source rows have dates, final scores and named opponents. This does NOT certify national completeness."}
 a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(out,indent=2)+"\n")
 print(json.dumps({"rows":len(games),"seasons":len(report),"first":report[0],"last":report[-1],"errors":dict(errors)},indent=2))
if __name__=="__main__":main()
