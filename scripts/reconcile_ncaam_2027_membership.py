#!/usr/bin/env python3
"""2026-27 NCAA D1 men's roster reconciliation, preserving historical team IDs.

2026-27 realignment crosschecked with published Sept 30 conference memberships.
West Florida is assigned a clearly temporary project ID pending official NCAA ID.
Never represent the temporary ID as issued by NCAA.
"""
import json
from collections import Counter
from pathlib import Path

SOURCE="https://www.espn.com/mens-college-basketball/story/_/id/49973549/college-basketball-conference-changes-realignment"
SECONDARY="https://www.cbssports.com/college-basketball/news/college-basketball-conference-changes-2026-27-gonzaga-pac-12/"
MOVES={
"Austin Peay":"UAC","Boise St.":"Pac-12","California Baptist":"Big West",
"Central Ark.":"UAC","Colorado St.":"Pac-12","Denver":"WCC",
"Eastern Ky.":"UAC","Fresno St.":"Pac-12","Gonzaga":"Pac-12",
"Hawaii":"MWC","Little Rock":"UAC","Louisiana Tech":"Sun Belt",
"North Ala.":"UAC","NIU":"Horizon","Oregon St.":"Pac-12",
"Sacramento St.":"Big West","San Diego St.":"Pac-12",
"Southern Utah":"Big Sky","Tennessee Tech":"SoCon","Texas St.":"Pac-12",
"UC Davis":"MWC","UTEP":"MWC","Utah St.":"Pac-12",
"Utah Tech":"Big Sky","Utah Valley":"Big West",
"Washington St.":"Pac-12","West Ga.":"UAC"
}
RENAME={"WAC":"UAC","MAAC":"Metro"}
def build(previous):
    entries=previous["teams"]
    if len(entries)!=365 or len({x["id"] for x in entries})!=365:
        raise ValueError("Incorrect or duplicated 2025-26 registry")
    indexed={t["name"]:t for t in entries}
    if set(MOVES)-set(indexed):raise ValueError("Moved team not in old registry: "+str(set(MOVES)-set(indexed)))
    if "Saint Francis" not in indexed or indexed["Saint Francis"]["conference"]!="NEC":
        raise ValueError("Saint Francis 2025-26 identity unexpected")
    result=[];changes=[]
    for old in entries:
        if old["name"]=="Saint Francis":
            changes.append({"team_id":old["id"],"team":old["name"],"kind":"departed_D1",
                            "from":"NEC","to":"Division III"})
            continue
        team=old.copy()
        new=MOVES.get(team["name"],RENAME.get(team["conference"],team["conference"]))
        if new!=team["conference"]:
            changes.append({"team_id":team["id"],"team":team["name"],"kind":"conference",
                            "from":team["conference"],"to":new})
        team["conference"]=new
        team["membership_season"]="2026-27"
        team["identity_status"]="NCAA-origin 2025-26 ID retained"
        result.append(team)
    result.append({"id":"pending-ncaa-id:west-florida","name":"West Florida",
                   "division":"D1","conference":"ASUN","membership_season":"2026-27",
                   "identity_status":"TEMPORARY project ID; official NCAA 2026-27 ID not yet published"})
    changes.append({"team_id":"pending-ncaa-id:west-florida","team":"West Florida",
                    "kind":"joined_D1","from":"Division II","to":"ASUN"})
    result.sort(key=lambda t:(t["name"].lower(),t["id"]))
    if len(result)!=365 or len({x["id"] for x in result})!=365:
        raise ValueError("Invalid final total or identities")
    counts=dict(sorted(Counter(x["conference"] for x in result).items()))
    expected={"ACC":18,"America East":9,"AAC":13,"Atlantic 10":14,"ASUN":8,
              "Big 12":16,"Big East":11,"Big Sky":11,"Big South":9,"Big Ten":18,
              "Big West":12,"CAA":13,"C-USA":10,"Horizon":12,"Ivy League":8,
              "Metro":13,"MAC":12,"MEAC":8,"MVC":11,"MWC":10,"NEC":9,
              "OVC":9,"Pac-12":9,"Patriot":10,"SEC":16,"SoCon":11,
              "Southland":12,"SWAC":12,"Summit League":8,"Sun Belt":14,
              "UAC":9,"WCC":10}
    # Previous registry conference names vary. Build team-level snapshot and
    # fail when totals differ, rather than silently reclassifying unverified teams.
    if counts!=dict(sorted(expected.items())):
        mismatch={c:{"actual":counts.get(c,0),"expected":n} for c,n in expected.items() if counts.get(c,0)!=n}
        mismatch.update({c:{"actual":n,"expected":0} for c,n in counts.items() if c not in expected})
        raise ValueError("Conference counts disagree with published membership: "+json.dumps(mismatch))
    return {"schema_version":"2026-27-v1","season":"2026-27",
            "status":"conference-membership-reconciled; West Florida official team ID pending",
            "sources":[SOURCE,SECONDARY],
            "teams":result,"changes":changes,"conference_counts":counts,
            "team_count":365,"conference_count":32}
def main():
    old=json.loads(Path("data/ncaam-2025-26-team-registry.json").read_text())
    result=build(old)
    target=Path("data/ncaam-2026-27-team-registry.json")
    target.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({"teams":result["team_count"],"conferences":result["conference_count"],"changes":len(result["changes"]),
                      "pending_ids":[t["name"] for t in result["teams"] if t["id"].startswith("pending-")]},indent=2))
if __name__=="__main__":main()
