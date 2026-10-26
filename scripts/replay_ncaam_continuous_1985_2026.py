#!/usr/bin/env python3
"""Continuous 1985–2026 Elo from preserved 1985–2019 Kaggle IDs and later NCAA scores.
Explicitly reject ambiguous team aliases and count excluded non-D1 fixtures.
"""
import argparse,collections,csv,datetime,hashlib,io,json,math,re,urllib.request
from pathlib import Path
BASE="https://raw.githubusercontent.com/zachmayer/kaggleNCAA/master/inst/kaggle_data/"
def norm(s):return re.sub(r"[^a-z0-9]","",str(s).lower().replace("&","and"))
def acquire(url):
 request=urllib.request.Request(url,headers={"User-Agent":"SLAT-historical-Elo/1.0"})
 with urllib.request.urlopen(request,timeout=120) as r:return r.read()
def main():
 ap=argparse.ArgumentParser()
 ap.add_argument("--historical",type=Path)
 ap.add_argument("--historical-teams",type=Path)
 ap.add_argument("--historical-spellings",type=Path)
 ap.add_argument("--later-dir",type=Path,default=Path("historical-normalized/sportsdataverse"))
 ap.add_argument("--output",type=Path,default=Path("data/ncaam-continuous-elo-1985-2026.json"))
 a=ap.parse_args()
 raw=a.historical.read_bytes() if a.historical else acquire(BASE+"RegularSeasonCompactResults.csv")
 teamsraw=a.historical_teams.read_bytes() if a.historical_teams else acquire(BASE+"teams.csv")
 spellraw=a.historical_spellings.read_bytes() if a.historical_spellings else acquire(BASE+"TeamSpellings.csv")
 mapping=collections.defaultdict(set)
 teams={}
 for x in csv.DictReader(io.StringIO(teamsraw.decode("utf-8-sig"))):
  tid=x["TeamID"];teams[tid]=x
  mapping[norm(x["TeamName"])].add(tid)
 for x in csv.DictReader(io.StringIO(spellraw.decode("utf-8-sig"))):
  if x["TeamID"] in teams:mapping[norm(x["TeamNameSpelling"])].add(x["TeamID"])
 # Unique, reviewable override map for modern names not present in historic 2019 spellings.
 # No fuzzy guessing; only a unique verified alias or exact canonical team name may join.
 historic=collections.defaultdict(list)
 for x in csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))):
  y=int(x["Season"])
  if y<1985 or y>2019:continue
  historic[y].append(x)
 assert sorted(historic)==list(range(1985,2020))
 ratings={};reports=[];joined=0;excluded=collections.Counter();unknown=collections.Counter()
 for year in range(1985,2027):
  fixtures=[]
  if year<=2019:
   for x in historic[year]:
    w=x["WTeamID"];l=x["LTeamID"]
    fixtures.append((int(x["DayNum"]),w,l,int(x["WScore"]),int(x["LScore"])))
  else:
   p=a.later_dir/f"ncaa-{year}-verified-results.csv"
   if not p.exists():raise FileNotFoundError(str(p))
   with p.open(newline="",encoding="utf-8-sig") as f:
    for x in csv.DictReader(f):
     ids=[]
     for label in (x["homeTeam"],x["awayTeam"]):
      options=mapping.get(norm(label),set())
      # Do not conflate current non-DI schools with 1985–2019 Kaggle team IDs
      options={i for i in options if int(teams[i]["FirstD1Season"])<=year}
      if len(options)!=1:
       if not options:excluded["unmatched_or_non_d1"]+=1
       else:excluded["ambiguous_alias"]+=1
       unknown[label]+=1;ids=[];break
      ids.append(next(iter(options)))
     if len(ids)!=2:continue
     if ids[0]==ids[1]:excluded["identity_collision"]+=1;continue
     try:
      date=datetime.date.fromisoformat(x["date"])
      hs=int(x["homePoints"]);aws=int(x["awayPoints"])
      if hs==aws:raise ValueError("tie")
      w,l=(ids[0],ids[1]) if hs>aws else (ids[1],ids[0])
      fixtures.append(((date-datetime.date(year-1,10,1)).days,w,l,max(hs,aws),min(hs,aws)))
     except (ValueError,KeyError):excluded["bad_score"]+=1
  if not fixtures:raise ValueError("No verified games in "+str(year))
  roster={t for _,w,l,ws,ls in fixtures for t in (w,l)}
  # Keep history from inactive programs in memory, but regress active teams each new season
  for team in roster:ratings[team]=1500+.65*(ratings.get(team,1500)-1500)
  fixtures.sort(key=lambda x:x[0]);ll=br=0
  for i in range(len(fixtures)):
   day,w,l,ws,ls=fixtures[i]
   # Same-day batch: score all games against pre-day Elo then commit movement
   if i==0 or fixtures[i-1][0]!=day:changes=collections.defaultdict(float)
   prob=1/(1+10**(-(ratings[w]-ratings[l])/400))
   ll-=math.log(max(1e-12,prob));br+=(1-prob)**2
   delta=24*(1+.55*math.log10(1+ws-ls))*(1-prob)
   changes[w]+=delta;changes[l]-=delta
   if i==len(fixtures)-1 or fixtures[i+1][0]!=day:
    for t,d in changes.items():ratings[t]+=d
  if year>=2020:joined+=len(fixtures)
  reports.append({"season":year,"games":len(fixtures),"teams":len(roster),"log_loss":round(ll/len(fixtures),6),"brier":round(br/len(fixtures),6),
    "highest_elo":[{"team_id":id,"team":teams[id]["TeamName"],"elo":round(elo,2)}
    for id,elo in sorted(((t,ratings[t]) for t in roster),key=lambda x:-x[1])[:10]]})
 assert len(reports)==42
 audit={"model":"SLAT continuous NCAA Elo with verified 1985 historical IDs","status":"PARTIAL_CROSS_ERA_MATCH_REQUIRES_COVERAGE_REVIEW",
  "coverage":{"earliest":1985,"latest":2026,"seasons":42,"replayed_games":sum(x["games"] for x in reports),
              "later_matched_games":joined},"source_sha256":hashlib.sha256(raw).hexdigest(),
  "excluded_later_reasons":dict(excluded),"unmatched_later_school_names":unknown.most_common(150),
  "params":{"k":24,"mov":.55,"carryover":.65},
  "limitations":["Post-2019 nonmatches are excluded rather than fabricated","Imported recent fixtures may include tournament games; older historical source covers regular season only",
    "Full continuity of ratings does not mean complete correspondence of historical season scopes"],
  "seasons":reports,"end_2026_all_ratings":[{"team_id":id,"team":teams[id]["TeamName"],"elo":round(v,3)} for id,v in sorted(ratings.items())]}
 a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(audit,indent=2)+"\n")
 print(json.dumps({"total":audit["coverage"],"excluded":dict(excluded),"unmatched_team_labels":len(unknown)},indent=2))
if __name__=="__main__":main()
