#!/usr/bin/env python3
"""Import actual SportsDataverse NCAA 2020–26 season schedule parquet data.
Source: sportsdataverse/ncaa-mbb-hoops-data GitHub, stats.ncaa.org provenance.
Raw school names are retained; Elo ID crosswalk is not fabricated.
"""
import argparse,csv,datetime,hashlib,json,urllib.request
from pathlib import Path
def main():
 p=argparse.ArgumentParser();p.add_argument("--output-dir",type=Path,default=Path("historical-normalized/sportsdataverse"))
 p.add_argument("--report",type=Path,default=Path("data/ncaam-2020-2026-sportsdataverse-audit.json"));a=p.parse_args()
 import pyarrow.parquet as pq
 a.output_dir.mkdir(parents=True,exist_ok=True)
 audits=[];allgames=set()
 for season in range(2020,2027):
  url=f"https://raw.githubusercontent.com/sportsdataverse/ncaa-mbb-hoops-data/main/mbb/schedule/parquet/ncaa_mbb_schedule_{season}.parquet"
  request=urllib.request.Request(url,headers={"User-Agent":"Sporting-Life-Times-research/1.0"})
  with urllib.request.urlopen(request,timeout=120) as response:raw=response.read(20_000_000)
  if not raw.startswith(b"PAR1"):raise ValueError("Missing parquet header season "+str(season))
  source=a.output_dir/f"ncaa_mbb_schedule_{season}.parquet";source.write_bytes(raw)
  table=pq.read_table(source)
  needed={"contest_id","game_date","home","away","home_score","away_score","season"}
  if not needed.issubset(table.schema.names):raise ValueError("Missing fields "+str(needed-set(table.schema.names)))
  games={};invalid=0;names=set()
  for rec in table.to_pylist():
   try:
    y=int(rec["season"]);raw_date=str(rec["game_date"]).strip()\n    try:date=datetime.date.fromisoformat(raw_date[:10]).isoformat()\n    except ValueError:date=datetime.datetime.strptime(raw_date,"%m/%d/%Y").date().isoformat()
    home=str(rec["home"] or "").strip();away=str(rec["away"] or "").strip()
    hs=int(rec["home_score"]);aws=int(rec["away_score"])
    if y!=season or not home or not away or home==away or hs==aws or min(hs,aws)<0:invalid+=1;continue
    cid=str(rec["contest_id"] or "").strip()
    if not cid:invalid+=1;continue
    record={"season":season,"date":date,"homeTeam":home,"awayTeam":away,"homePoints":hs,"awayPoints":aws,"contest_id":cid}
    if cid in games and games[cid]!=record:raise ValueError(f"Score conflict {season} {cid}")
    games[cid]=record;names.update((home,away))
   except (ValueError,TypeError):invalid+=1
  csvpath=a.output_dir/f"ncaa-{season}-verified-results.csv"
  with csvpath.open("w",newline="") as f:
   writer=csv.DictWriter(f,fieldnames=["season","date","homeTeam","awayTeam","homePoints","awayPoints","contest_id"])
   writer.writeheader();writer.writerows(sorted(games.values(),key=lambda r:(r["date"],r["contest_id"])))
  audits.append({"season":season,"source_url":url,"source_sha256":hashlib.sha256(raw).hexdigest(),
    "games":len(games),"school_labels":len(names),"invalid_or_unfinished_rows":invalid,"csv_file":str(csvpath),
    "historical_kaggle_team_ids_reconciled":False,"dataset_completeness_uncertified":True})
  print(season,"final scores",len(games),flush=True)
  if len(games)<100:raise ValueError(f"Too few results for {season}: {len(games)}")
 if {x["season"] for x in audits}!=set(range(2020,2027)):raise ValueError("Missing a season")
 a.report.parent.mkdir(parents=True,exist_ok=True)
 a.report.write_text(json.dumps({"status":"ALL_SEVEN_SEASONS_IMPORTED_SCORE_RESULTS_TEAM_ID_JOIN_PENDING",
     "source":"sportsdataverse/ncaa-mbb-hoops-data", "seasons":audits,
     "games":sum(x["games"] for x in audits),"historical_1985_2019_replay_preserved":True,
     "cross_era_elo_certified":False},indent=2)+"\n")
if __name__=="__main__":main()
