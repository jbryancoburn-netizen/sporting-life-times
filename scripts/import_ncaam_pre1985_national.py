#!/usr/bin/env python3
"""National NCAA pre-1985 game importer. Requires source CSV exports with real scores.
Rows may be combined from several lawful archival exports. Never fabricates results.
"""
import argparse,csv,datetime,json,collections,re,hashlib,math
from pathlib import Path
def canonical(x):
 s=re.sub(r"[^a-z0-9]+"," ",str(x).casefold()).strip()
 return {"unc":"north carolina","north carolina tar heels":"north carolina","duke blue devils":"duke"}.get(s,s)
def first(row,*keys):
 for k in keys:
  if row.get(k) is not None and str(row[k]).strip():return str(row[k]).strip()
 return ""
def read_source(path):
 for r in csv.DictReader(path.open(encoding="utf-8-sig",newline="")):yield r
def main():
 p=argparse.ArgumentParser()
 p.add_argument("--input",type=Path,action="append",required=True)
 p.add_argument("--output",type=Path,default=Path("data/ncaam-pre1985-national-coverage.json"))
 p.add_argument("--fixtures-output",type=Path,default=Path("historical-normalized/ncaam-pre1985-national-verified.csv"))
 a=p.parse_args();seen={};bad=collections.Counter();years=collections.defaultdict(list);sources=[]
 for path in a.input:
  data=path.read_bytes();sources.append({"file":path.name,"sha256":hashlib.sha256(data).hexdigest(),"bytes":len(data)})
  for r in read_source(path):
   try:
    yr=int(first(r,"season","Season","season_year"))
    if not 1950<=yr<=1984:continue
    date=first(r,"date","game_date","Game_Date","startDate")
    day=datetime.date.fromisoformat(date[:10])
    aa=canonical(first(r,"homeTeam","home_team","home","team_a","a"))
    bb=canonical(first(r,"awayTeam","away_team","away","team_b","b"))
    if not aa or not bb or aa==bb:bad["bad_teams"]+=1;continue
    av=int(float(first(r,"homePoints","home_score","homeScore","score_a","a_score")))
    bv=int(float(first(r,"awayPoints","away_score","awayScore","score_b","b_score")))
    if min(av,bv)<0 or av==bv:bad["bad_score"]+=1;continue
    key=(date[:10],tuple(sorted((aa,bb))))
    normalized=tuple(sorted(((aa,av),(bb,bv))))
    if key in seen:
     if seen[key]!=normalized:bad["conflicting_duplicate"]+=1
     else:bad["matching_duplicate"]+=1
     continue
    seen[key]=normalized
    years[yr].append({"season":yr,"date":date[:10],"team_a":aa,"team_b":bb,"score_a":av,"score_b":bv,"source":path.name})
   except (ValueError,KeyError,TypeError):bad["invalid_record"]+=1
 if bad["conflicting_duplicate"]:raise ValueError("Conflicting historical fixtures require manual reconciliation: "+str(bad["conflicting_duplicate"]))
 fixtures=sorted((x for group in years.values() for x in group),key=lambda x:(x["date"],x["team_a"],x["team_b"]))
 if not fixtures:raise ValueError("No verified historical game fixtures")
 a.fixtures_output.parent.mkdir(parents=True,exist_ok=True)
 with a.fixtures_output.open("w",newline="") as f:
  w=csv.DictWriter(f,fieldnames=["season","date","team_a","team_b","score_a","score_b","source"])
  w.writeheader();w.writerows(fixtures)
 seasons=[]
 for yr in range(1950,1985):
  g=years[yr];teams={t for x in g for t in (x["team_a"],x["team_b"])}
  seasons.append({"season":yr,"games":len(g),"distinct_teams":len(teams),"coverage":"OBSERVED_SAMPLE_NOT_CERTIFIED_COMPLETE" if g else "NOT_ACQUIRED","eligible_full_national_elo":False})
 result={"status":"NATIONAL_HISTORICAL_EVIDENCE_INVENTORY_NOT_CERTIFIED","seasons_targeted":35,
  "games_verified":len(fixtures),"sources":sources,"exclusions":dict(bad),"seasons":seasons,
  "warning":"No national completeness threshold alone certifies full fixtures; independent school schedules and seasonal game totals must reconcile.",
  "publication_policy":"Historical evidence only. Do not produce national Elo power ranks without verified coverage."}
 a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(result,indent=2)+"\n")
 print(json.dumps({"games":len(fixtures),"season_count":sum(bool(x["games"]) for x in seasons),"exclusions":dict(bad)},indent=2))
if __name__=="__main__":main()
