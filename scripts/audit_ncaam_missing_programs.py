#!/usr/bin/env python3
"""Find the last ESPN D1 school IDs through actual dated scoreboard events.

Evidence is exact normalized official school labels and event IDs, not fuzzy
search or invented provider IDs.
"""
import json
from pathlib import Path
from datetime import date
from collections import defaultdict
from update_ncaam_season import school_key
from ncaam_espn_source import fetch_day

DATES=[date(2025,12,20),date(2026,11,2),date(2026,11,3),
       date(2026,11,4),date(2027,1,7),date(2027,1,9)]
ALIASES={"queensuniversity":"queensnc","queens":"queensnc",
         "queensuniversityofcharlotte":"queensnc",
         "southernindiana":"southernind","soindiana":"southernind",
         "lindenwood":"lindenwood"}
MISSING=("Queens (NC)","Lindenwood","Southern Ind.")

def audit(fetch=fetch_day):
    baseline=json.loads(Path("data/ncaam-2026-27-preseason-roster-informed.json").read_text())
    target={school_key(x["team"]):x for x in baseline["rankings"] if x["team"] in MISSING}
    sightings=defaultdict(list)
    errors={}
    for day in DATES:
        try:events=fetch(day)
        except Exception as e:
            errors[str(day)]=str(e)[:150]
            continue
        for event in events:
            for comp in event.get("competitions",[]):
                for member in comp.get("competitors",[]):
                    team=member.get("team") or {}
                    labels=[team.get(k,"") for k in ("location","shortDisplayName","displayName")]
                    ids=set()
                    for label in labels:
                        normalized=school_key(label)
                        ids.add(normalized)
                        ids.add(ALIASES.get(normalized,normalized))
                    found=[v for k,v in target.items() if k in ids]
                    if len(found)==1 and team.get("id"):
                        t=found[0]
                        sighting={"provider_team_id":str(team["id"]),"event_id":str(event.get("id")),
                                  "date":str(day),"school":t["team"],"ncaa_id":t["team_id"],"espn_labels":labels}
                        sightings[t["team"]].append(sighting)
    evidence={};unresolved=[]
    for school in MISSING:
        rows=sightings.get(school,[])
        ids={v["provider_team_id"] for v in rows}
        if len(ids)==1:
            evidence[school]={"espn_id":next(iter(ids)),"ncaa_id":rows[0]["ncaa_id"],
                              "source_events":rows[:8]}
        else:unresolved.append({"school":school,"candidate_espn_ids":sorted(ids),
                                 "events":rows[:8]})
    return {"season":"2026-27","method":"Exact school label concordance in ESPN scheduled or completed competitions",
            "dates_checked":[str(x) for x in DATES],"verified_missing_programs":evidence,
            "unresolved":unresolved,"source_errors":errors}

if __name__=="__main__":
    d=audit()
    Path("data/ncaam-2026-27-missing-espn-event-ids.json").write_text(json.dumps(d,indent=2)+"\n")
    print(json.dumps({"verified":{k:v["espn_id"] for k,v in d["verified_missing_programs"].items()},
                      "unresolved":d["unresolved"],"errors":d["source_errors"]},indent=2))
