#!/usr/bin/env python3
"""Regenerate the 435-district editorial dossier solely from existing verified ledgers.

No district may inherit another district's geography or historical vote.
This source script is intentionally stdlib-only (zero dollars).
"""
import json
from pathlib import Path
from collections import defaultdict
ROOT=Path(__file__).resolve().parents[1]
def get(name): return json.loads((ROOT/name).read_text(encoding="utf-8"))
def build():
 atlas=get("politics-house-atlas.json")
 acs=get("politics-census-inputs.json")
 places=get("data/politics-district-communities.json")
 archive=get("politics-historical-archive.json")
 modern=get("politics-historical-contests.json")
 hist=defaultdict(list)
 for x in archive["house"]+modern["house"]:
  if x.get("year") in (2012,2014,2016,2018,2020,2022,2024):hist[x["id"]].append(x)
 census={x["id"]:x for x in acs["districts"]}
 names=(("population_2020_2024_acs_est","residents"),("median_household_income_est","median_income"),("bachelors_plus_age25_pct_est","bachelors_pct"))
 ranks=defaultdict(dict)
 for field,key in names:
  rows=sorted((r for r in census.values() if isinstance(r.get(field),(int,float)) and r[field]>=0),key=lambda r:r[field],reverse=True)
  states=defaultdict(list)
  for row in rows:states[row["state"]].append(row)
  for index,row in enumerate(rows):
   ranks[row["id"]][key]={"rank":index+1,"of":len(rows),
    "state_rank":sum(z[field]>row[field] for z in states[row["state"]])+1,
    "state_total":len(states[row["state"]])}
 records={}
 for d in atlas["districts"]:
  id=d["id"];h=d.get("2024_house_result_on_prior_boundaries") or {}
  el=[]
  for x in sorted(hist[id],key=lambda r:r["year"],reverse=True):
   y=x["year"]
   finalists=h.get("finalists") if y==2024 else None
   certified=bool(finalists and len(finalists)==2)
   D=x.get("dem_votes");R=x.get("rep_votes")
   both=bool(x.get("both_major_parties") and isinstance(D,int) and isinstance(R,int) and D+R>0)
   url=h.get("candidate_vote_source_url") if certified else x.get("source_url",x.get("source","https://doi.org/10.7910/DVN/IG0UN2"))
   el.append({"year":y,"winner":x.get("winner_name") or h.get("winner"),"winner_party":x.get("party_winner"),
    "party_votes":{"D":D,"R":R,"other":x.get("other_votes")},
    "total_votes":x.get("total_votes"),"two_party_margin_pp":round((D-R)/(D+R)*100,2) if both else None,
    "contested_major_parties":both,"finalists":finalists if certified else None,
    "finalist_gap_votes":h.get("winner_runner_up_margin_votes") if certified else None,
    "historical_vintage":"2010_apportionment_era" if y<=2020 else "2020_apportionment_era",
    "source_url":url,"source_label":h.get("candidate_vote_source_authority") if certified else "MIT Election Data and Science Lab",
    "archive_certified":False,"comparability_to_2024":"same_election" if y==2024 else d.get("2022_to_2024_geography_comparison") if y==2022 else "not_certified"})
  a=census.get(id);p=places["districts"].get(id,{})
  records[id]={"id":id,"state":d["state"],"history":el,"missing_years":[y for y in (2012,2014,2016,2018,2020,2022,2024) if y not in [r["year"] for r in el]],
   "geography":{"status_2024_2026":d.get("2024_to_2026_geography_comparison"),
    "status_2022_2024":d.get("2022_to_2024_geography_comparison"),
    "same_2026_2024_verified":bool(d.get("2024_to_2026_same_geography_verified")),
    "blocks":d.get("2024_to_2026_block_comparison")},
   "census":{"vintage":"2020-2024_ACS_119th_Congress","population":a.get("population_2020_2024_acs_est"),
    "population_moe":a.get("population_moe_est"),"income":a.get("median_household_income_est"),
    "income_moe":a.get("median_household_income_moe_est"),"bachelors_pct":a.get("bachelors_plus_age25_pct_est"),
    "ranks":ranks[id]} if a else None,
   "places":{"kind":"Census representative points, not entire municipality bounds or population ranking",
    "total_verified":p.get("verified_place_point_count",0),"names":[c["name"] for c in p.get("communities",[])[:12]],
    "source_url":places["census_gazetteer_url"]},
   "ballot_2026":{"candidates":d["official_2026_candidate_snapshot"]["candidates"],
    "source_url":d["official_2026_candidate_snapshot"]["source_url"],
    "reviewed_at":d["official_2026_candidate_snapshot"]["reviewed_at"]}
    if d.get("official_2026_candidate_snapshot",{}).get("candidates") else None}
 years=defaultdict(int)
 for d in records.values():years[len(d["history"])]+=1
 coverage={"historyYears":dict(years),"finalistContests":sum(bool(x["finalists"]) for d in records.values() for x in d["history"]),
 "majorPartyContests":sum(x["contested_major_parties"] for d in records.values() for x in d["history"]),
 "localReferenceDistricts":sum(bool(d["places"]["names"]) for d in records.values()),
 "acsCount":sum(bool(d["census"]) for d in records.values()),
 "blockCertified":sum(bool(d["geography"]["blocks"]) for d in records.values()),
 "historical_results":sum(len(d["history"]) for d in records.values()),
 "missing_districts_by_year":[{"year":y,"count":sum(y in d["missing_years"] for d in records.values())} for y in (2012,2014,2016,2018,2020,2022,2024)]}
 if len(records)!=435 or coverage["acsCount"]!=435 or coverage["finalistContests"]!=7 or coverage["blockCertified"]!=28:raise SystemExit("FAILED source audit: "+str(coverage))
 return {"schema_version":1,"built_at":"2026-11-03","district_count":435,
 "scope":"Editorial district research from previously sourced Census ACS, Census Gazetteer, historic MEDSL returns, 2024 certified finalists, certified 2026 ballot records and individually audited boundaries; not a forecast",
 "guidance":{"history":"Election results follow the district boundaries in force for each listed year. The 2012–2020 and 2022–2024 map vintages must not be treated as continuous boundaries.",
 "census":"2020–2024 ACS 5-year estimates use 119th Congress geography; rank is among House districts and does not describe or predict 2026 election outcomes.",
 "communities":"Only verified Census reference points within district polygons, not a list of largest places or an assertion all municipality land is in the district.",
 "rankings":"District rankings are descending by ACS reported estimate, unweighted by population, with ties sharing a rank.",
 "sources":["https://doi.org/10.7910/DVN/IG0UN2",acs["source_url"],places["census_gazetteer_url"]]},
 "coverage":coverage,"districts":records}
if __name__=="__main__":
 output=ROOT/"data"/"politics-district-dossiers.json"
 output.write_text(json.dumps(build(),ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
 print("Wrote",output)
