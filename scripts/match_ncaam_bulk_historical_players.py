#!/usr/bin/env python3
"""Join all published historical school player names to NCAA season rosters in bulk.

Historical matches are diagnostic only; season roster data may contain hindsight.
"""
import json,re,unicodedata,collections
from pathlib import Path
from backtest_ncaam_roster_elo import fetch
from backtest_ncaam_quality_retrospective import school_key
def normalize(v):
    v=unicodedata.normalize("NFKD",str(v or "")).encode("ascii","ignore").decode().upper()
    return re.sub("[^A-Z0-9]","",v)
def strip_suffix(name):
    return re.sub(r"(JR|SR|II|III|IV|V)$","",name)

def safe_unique_suffix_match(name,known):
    key=strip_suffix(normalize(name))
    return sum(strip_suffix(n)==key for n in known)==1

def run():
    reconciled=json.loads(Path("data/ncaam-historical-bulk-player-reconciliation.json").read_text())
    official={};season_indexes={}
    for year in (2024,2025,2026):
        rows=fetch("ncaa_mbb_rosters",year)
        index=collections.defaultdict(set)
        for r in rows:
            school=school_key(r.get("team"))
            name=normalize(r.get("player") or r.get("name"))
            if school and name:index[school].add(name)
        season_indexes[str(year)]=index
    teams=reconciled["team_seasons"]
    results=[];matched=0;total=0;school_years=0
    for school,seasons in sorted(teams.items()):
        for year,entry in sorted(seasons.items()):
            known=season_indexes[year].get(school_key(school),set())
            names=entry["names"]
            exact=[n for n in names if normalize(n) in known]
            remaining=[n for n in names if normalize(n) not in known]
            suffix=[n for n in remaining if safe_unique_suffix_match(n,known)]
            found=exact+suffix
            missed=[n for n in remaining if n not in suffix]
            matched+=len(found);total+=len(names);school_years+=1
            results.append({"school":school,"season_end_year":int(year),
                "extracted_names":len(names),"ncaa_matched_names":len(found),"exact_matches":len(exact),"unique_suffix_matches":len(suffix),
                "unmatched_names":missed,"matched_names":found,
                "ncaa_team_name_matched":bool(known),
                "source":entry["source"],"preopening_membership_certified":False})
    report={"status":"BULK_HISTORICAL_NAME_CONCORDANCE_NOT_PRESEASON_ASOF",
        "summary":{"school_seasons":school_years,"extracted_names":total,
            "matched_to_historical_ncaa_season_rosters":matched,
            "unmatched":total-matched,"match_fraction":round(matched/total,4) if total else 0,
            "team_seasons_with_match":sum(r["ncaa_team_name_matched"] for r in results),
            "exact_name_matches":sum(r["exact_matches"] for r in results),
            "unique_suffix_matches":sum(r["unique_suffix_matches"] for r in results)},
        "seasons":[2024,2025,2026],"source_roster_timing_verified":False,
        "preopening_production_approved":False,"results":results}
    Path("data/ncaam-historical-player-concordance.json").write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report["summary"],indent=2))
if __name__=="__main__":run()
