#!/usr/bin/env python3
"""Reconcile multiple legitimately acquired historical college basketball season archives.
Never automatically scrape Sports Reference. All files require source and reuse metadata.
Merges deduplicated fixtures with conflict quarantine, per-school-season audit.
"""
import argparse,csv,hashlib,json,collections,datetime
from pathlib import Path
from import_ncaam_pre1985_national import canonical
COLUMNS=("season","date","homeTeam","awayTeam","homePoints","awayPoints")
def main():
 p=argparse.ArgumentParser();p.add_argument("--manifest",type=Path,required=True)
 p.add_argument("--output-dir",type=Path,default=Path("historical-normalized/pre1985-approved"))
 p.add_argument("--report",type=Path,default=Path("data/ncaam-pre1985-approved-national-inventory.json"));a=p.parse_args()
 manifest=json.loads(a.manifest.read_text());files=manifest.get("sources",[])
 if not files:raise ValueError("No explicitly approved historical sources in manifest")
 retained={};conflicts=[];school=collections.defaultdict(lambda:{"games":0,"opponents":set()});source_reports=[]
 for spec in files:
  if not spec.get("reuse_authorized",False):raise ValueError("Source requires documented authorization: "+str(spec.get("name")))
  if not spec.get("source_url") or not spec.get("license_or_permission"):raise ValueError("Source provenance missing")
  path=Path(spec["path"]);raw=path.read_bytes();digest=hashlib.sha256(raw).hexdigest()
  if digest!=spec.get("sha256"):raise ValueError("SHA256 mismatch "+str(path))
  accepted=0
  for row in csv.DictReader(raw.decode("utf-8-sig").splitlines()):
   if any(not row.get(x) for x in COLUMNS):continue
   try:
    y=int(row["season"]);date=datetime.date.fromisoformat(row["date"][:10]);x=canonical(row["homeTeam"]);z=canonical(row["awayTeam"])
    xs=int(row["homePoints"]);zs=int(row["awayPoints"])
    if not 1950<=y<=1984 or not x or not z or x==z or min(xs,zs)<0 or xs==zs:continue
    if not (y-1<=date.year<=y):continue
   except ValueError:continue
   key=(y,date.isoformat(),tuple(sorted((x,z))))
   score=tuple(sorted(((x,xs),(z,zs))))
   value={"season":y,"date":date.isoformat(),"team_a":score[0][0],"team_b":score[1][0],
          "score_a":score[0][1],"score_b":score[1][1],"sources":[spec["name"]]}
   if key in retained:
    previous=retained[key]
    if (previous["score_a"],previous["score_b"])!=(value["score_a"],value["score_b"]):
     conflicts.append({"season":y,"date":date.isoformat(),"teams":key[2],"prior_sources":previous["sources"],"conflict_source":spec["name"]})
    else:previous["sources"].append(spec["name"])
   else:retained[key]=value;accepted+=1
  source_reports.append({"source":spec["name"],"sha256":digest,"new_unique_games":accepted})
 # Do not publish contested fixtures as valid.
 contested={(r["season"],r["date"],tuple(r["teams"])) for r in conflicts}
 games=[g for key,g in sorted(retained.items()) if key not in contested]
 for g in games:
  for x,z in ((g["team_a"],g["team_b"]),(g["team_b"],g["team_a"])):
   slot=school[(g["season"],x)];slot["games"]+=1;slot["opponents"].add(z)
 a.output_dir.mkdir(parents=True,exist_ok=True)
 clean=a.output_dir/"verified-national-fixtures.csv"
 with clean.open("w",newline="") as stream:
  w=csv.DictWriter(stream,fieldnames=("season","date","team_a","team_b","score_a","score_b","sources"))
  w.writeheader()
  for g in games:w.writerow({**g,"sources":";".join(g["sources"])})
 report={"status":"SOURCE_AUTHORIZED_PARTIAL_GAME_EVIDENCE_ONLY","games_accepted":len(games),
  "conflicting_games_quarantined":len(contested),"source_reports":source_reports,
  "fixture_file":str(clean),"source_manifest_sha256":hashlib.sha256(a.manifest.read_bytes()).hexdigest(),
  "seasons":[{"season":y,"games":sum(g["season"]==y for g in games),
              "school_seasons_observed":sum(k[0]==y for k in school)} for y in range(1950,1985)],
  "school_seasons":[{"season":k[0],"school":k[1],"games":v["games"],"opponents":len(v["opponents"])}
                    for k,v in sorted(school.items())],
  "national_completeness_certified":False,"production_elo_promotion":False,
  "warning":"No team-season coverage threshold has been proven against an independently verified schedule registry"}
 a.report.parent.mkdir(parents=True,exist_ok=True);a.report.write_text(json.dumps(report,indent=2)+"\n")
 print(json.dumps({"games":len(games),"quarantined":len(contested),"school_seasons":len(school)}))
if __name__=="__main__":main()
