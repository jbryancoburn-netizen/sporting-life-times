#!/usr/bin/env python3
"""Bulk diagnosis of NCAA historical roster concordance gaps, no speculative player links."""
import json,collections,re
from pathlib import Path
src=Path("data/ncaam-historical-player-concordance.json")
doc=json.loads(src.read_text())
alias={"Charleston":"col. of charleston","Florida Atlantic":"fla. atlantic",
       "Hawai'i":"hawaii","Northern Iowa":"uni","St. John's (NY)":"st. john's",
       "Southern Indiana":"southern ind.","Western Kentucky":"western ky."}
missing_team=[];staff_candidates=[];other=[]
staff_pattern=re.compile(r"(?i)\b(coach|assistant|director|manager|operations|video|trainer)\b")
for row in doc["results"]:
    destination=missing_team if not row["ncaa_team_name_matched"] else other
    for name in row["unmatched_names"]:
        item={"school":row["school"],"season_end_year":row["season_end_year"],"name":name}
        if staff_pattern.search(name):staff_candidates.append(item)
        else:destination.append(item)
by_team=collections.Counter(x["school"] for x in missing_team)
report={"status":"HISTORICAL_GAP_TRIAGE_NOT_AUTO_IDENTIFICATION",
 "summary":{"source_unmatched":doc["summary"]["unmatched"],
    "unmatched_on_team_without_name_alignment":len(missing_team),
    "unmatched_on_aligned_team":len(other),
    "explicit_staff_title_candidates":len(staff_candidates),
    "team_seasons_without_alignment":sum(not r["ncaa_team_name_matched"] for r in doc["results"]),
    "highest_gap_schools":by_team.most_common(35)},
 "alias_candidates_not_automatically_confirmed":alias,
 "team_alignment_gaps":missing_team,
 "remaining_player_or_staff_candidates":other,
 "explicit_staff_title_candidates":staff_candidates,
 "strict_preopening_verified":False,"production_elo_promotion":False}
assert sum(len(report[k]) for k in ("team_alignment_gaps","remaining_player_or_staff_candidates","explicit_staff_title_candidates"))==doc["summary"]["unmatched"]
out=Path("data/ncaam-historical-name-gap-triage.json")
out.write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps(report["summary"],indent=2))
if __name__=="__main__":pass
