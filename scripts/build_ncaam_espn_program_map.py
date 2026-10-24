#!/usr/bin/env python3
"""Audited ESPN D1 team-ID to owned NCAA Elo team-ID crosswalk.

Map only unique deterministic school-name identities. Unmatched or ambiguous
programs remain excluded from game ingestion, not guessed.
"""
import json,urllib.request
from collections import defaultdict
from pathlib import Path
from update_ncaam_season import school_key

URL="https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?limit=500&groups=50"

def get():
    req=urllib.request.Request(URL,headers={"User-Agent":"SportingLifeTimes-CBB-Elo/1.0"})
    with urllib.request.urlopen(req,timeout=55) as rsp:
        return json.load(rsp)

def mapping(snapshot,baseline):
    entries=snapshot.get("sports",[])
    teams=[]
    for sport in entries:
        for league in sport.get("leagues",[]):
            for entry in league.get("teams",[]):
                team=entry.get("team",entry)
                if team.get("id"):teams.append(team)
    if not teams:raise ValueError("ESPN team source returned no NCAA programs")
    canonical=defaultdict(set)
    for t in baseline["rankings"]:
        canonical[school_key(t["team"])].add(t["team_id"])
    crosswalk={}
    unmatched=[]
    ambiguous=[]
    used=set()
    for team in teams:
        e_id=str(team["id"])
        labels=[team.get(k,"") for k in ("location","shortDisplayName","displayName")]
        found=set()
        for label in labels:
            found.update(canonical.get(school_key(label),set()))
        if len(found)!=1:
            (ambiguous if found else unmatched).append(
                {"espn_id":e_id,"names":labels,"possible_ncaa_ids":sorted(found)})
            continue
        target=next(iter(found))
        if target in used:
            ambiguous.append({"espn_id":e_id,"names":labels,"reason":"repeated target","possible_ncaa_ids":[target]})
            continue
        used.add(target)
        match=[t for t in baseline["rankings"] if t["team_id"]==target][0]
        crosswalk[e_id]={"team_id":target,"team":match["team"],
                         "conference":match.get("conference"),
                         "espn_team_name":team.get("displayName")}
    return {
        "season":"2026-27","source":URL,"match_method":"unique exact normalized aliases for ESPN school labels; no fuzzy matching",
        "matched_team_count":len(crosswalk),"missing_ncaa_teams":[t["team"] for t in baseline["rankings"] if t["team_id"] not in used],
        "espn_team_count":len(teams),"ambiguous_espn_teams":ambiguous,
        "unmatched_espn_teams":unmatched,
        "crosswalk":crosswalk,"production_approved":False,
        "production_note":"Crosswalk must be reviewed for missing NCAA teams before claiming complete live coverage; matched games alone may publish."
    }

def main():
    baseline=json.loads(Path("data/ncaam-2026-27-preseason-roster-informed.json").read_text())
    d=mapping(get(),baseline)
    if d["matched_team_count"]<362:
        raise ValueError("ESPN 2026-27 D1 mapping regression: expected at least 362 verified school IDs, got "+str(d["matched_team_count"]))
    path=Path("data/ncaam-2026-27-espn-program-crosswalk.json")
    path.write_text(json.dumps(d,indent=2)+"\n")
    print(json.dumps({"matched":d["matched_team_count"],"espn_teams":d["espn_team_count"],
         "unmatched_espn":len(d["unmatched_espn_teams"]),
         "ambiguous_espn":len(d["ambiguous_espn_teams"]),
         "missing_owned":d["missing_ncaa_teams"]},indent=2))

if __name__=="__main__":main()
