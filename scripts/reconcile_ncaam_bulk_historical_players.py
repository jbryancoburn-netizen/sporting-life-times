#!/usr/bin/env python3
"""Reconcile all four extracted historical NCAA player-roster batches at once.

Existing extracts remain historical page reads, not proof of pregame timing.
Exclude navigation labels and flag suspicious staffs/overlarge rosters.
"""
import json,re,collections
from pathlib import Path
ROOT=Path("data/ncaam-historical-roster-extraction")
BAD=re.compile(r"(?i)^(jersey number|full|view|roster|bio|staff|coach|head coach|assistant coach|associate head coach|director|manager|operations|strength coach|print|schedule|stats|number|home|next|previous)\b")
def clean(name):
    name=" ".join(str(name).split())
    if len(name.split())<2 or len(name.split())>5 or len(name)>85 or BAD.search(name):
        return None
    if not re.search("[A-Za-z]",name):return None
    return name
def main():
    files=[ROOT/f"batch-{i:02d}.json" for i in range(4)]
    if not all(p.exists() for p in files):raise RuntimeError("Missing one of four extraction batches")
    schools=collections.defaultdict(dict)
    records=0;raw=0;accepted=0;rejected=collections.Counter();suspicious=[]
    for path in files:
        doc=json.loads(path.read_text())
        for r in doc["records"]:
            records+=1
            key=r["team"];year=str(r["season_end_year"])
            names={}
            for original in r.get("players",[]):
                raw+=1
                name=clean(original)
                if not name:
                    rejected[original]+=1
                    continue
                names[name.casefold()]=name
            names=sorted(names.values())
            accepted+=len(names)
            if len(names)>22 or len(names)<8:
                suspicious.append({"school":key,"season_end_year":int(year),"count":len(names)})
            if year in schools[key]:raise ValueError(f"duplicate school year {key} {year}")
            schools[key][year]={"names":names,"source":r["candidate_url"],
                 "retrieved_sha256":r.get("retrieved_sha256"),"roster_verified_asof":False}
    shared=0;comparisons=0
    for school,seasons in schools.items():
        for start,end in (("2024","2025"),("2025","2026")):
            if start in seasons and end in seasons:
                comparisons+=1
                shared+=len({x.casefold() for x in seasons[start]["names"]}&
                    {x.casefold() for x in seasons[end]["names"]})
    report={"status":"BULK_HISTORICAL_PLAYER_NAMES_CLEANED_NOT_OPENING_DAY_VERIFIED",
       "historical_pages":records,"schools":len(schools),"raw_name_mentions":raw,
       "filtered_name_mentions":accepted,"obvious_page_noise_removed":sum(rejected.values()),
       "top_page_noise":rejected.most_common(25),"suspicious_roster_sizes":suspicious[:250],
       "adjacent_year_school_comparisons":comparisons,"same_name_adjacent_year_mentions":shared,
       "preopening_membership_certified":False,"production_promotion_approved":False,
       "team_seasons":schools}
    target=Path("data/ncaam-historical-bulk-player-reconciliation.json")
    target.write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps({k:v for k,v in report.items() if k not in ("team_seasons","suspicious_roster_sizes","top_page_noise")},indent=2))
if __name__=="__main__":main()
