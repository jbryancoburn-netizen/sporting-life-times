#!/usr/bin/env python3
"""Audit sourced opening-night games against official-season D1 team registry.

Never automatically equate a fuzzy display name with a canonical school.
Matched names are candidates for an identity crosswalk, not Elo input.
"""
import json,re
from pathlib import Path
def norm(s):
    s=str(s or "").lower().replace("&","and")
    s=re.sub(r"\b(university|college|of|the)\b"," ",s)
    return re.sub("[^a-z0-9]","",s)
def audit(data,registry):
    teams=registry["teams"];index={}
    for t in teams:
        k=norm(t["name"])
        if k in index:raise ValueError("Ambiguous canonical name "+k)
        index[k]=t
    matched=[];unmatched=[];neutral=0
    for g in data["games"]:
        result={"game_id":g["source_event_id"],"source_url":g["source_url"],
                "venue_neutral":g["venue_neutral"],"home":g["home"],"away":g["away"]}
        for role in ("home","away"):
            team=index.get(norm(g.get(role+"_location"))) or index.get(norm(g.get(role+"_short"))) or index.get(norm(g[role]))
            result[role+"_canonical_id"]=team["id"] if team else None
            result[role+"_match_method"]="exact_school_location_or_short_name" if team else None
        if result["venue_neutral"] is True:neutral+=1
        if result["home_canonical_id"] and result["away_canonical_id"]:matched.append(result)
        else:unmatched.append(result)
    return {"date":data["date"],"total_games":len(data["games"]),
        "venue_neutral_games":neutral,"complete_canonical_pairs":len(matched),
        "unmatched_games":len(unmatched),"resolved_candidates":matched,
        "unresolved_candidates":unmatched,
        "release_status":"secondary evidence only; no new ratings published"}
def main():
    root=Path("data")
    games=json.loads((root/"ncaam-2026-27-opening-schedule-candidates.json").read_text())
    teams=json.loads((root/"ncaam-2026-27-team-registry.json").read_text())
    obj=audit(games,teams)
    (root/"ncaam-2026-27-opening-identity-audit.json").write_text(json.dumps(obj,indent=2)+"\n")
    print("Identity audit:",obj["total_games"],"games,",obj["complete_canonical_pairs"],
          "exact team pairs,",obj["unmatched_games"],"need crosswalk")
if __name__=="__main__":main()
