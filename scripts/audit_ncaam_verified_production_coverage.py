#!/usr/bin/env python3
"""Quantify actual prior-season box production reachable through verified ESPN movement.

Stable ESPN athlete ID proves same-provider identity only. NCAA box school/name
joins remain candidates, never independently verified cross-provider identities.
This is an audit, not an Elo adjustment.
"""
import json,argparse
from pathlib import Path
from collections import Counter,defaultdict

def audit(identity,ledger,registry):
    box=defaultdict(list)
    for p in ledger["player_records"]:
        box[(p["team_id"],str(p["player_id"]))].append(p)
    teams={t["id"]:{"team_id":t["id"],"team":t["name"],
        "verified_espn_returners":0,"verified_espn_transfers":0,
        "unique_ncaa_box_candidates":0,"candidate_minutes":0.,
        "candidate_points":0.,"candidate_transfer_minutes":0.,
        "candidate_returner_minutes":0.,"unresolved_box_candidates":0,
        "cross_provider_identity_verified":False,"production_elo_approved":False}
        for t in registry["teams"]}
    if len(teams)!=365:raise ValueError("Registry must have 365 unique teams")
    counts=Counter()
    for p in identity["matched"]:
        target=p["team_id"];source=p["prior_team_id"]
        if target not in teams:raise ValueError("Unknown current school "+target)
        if p["espn_status"] not in ("verified_espn_returner","verified_espn_d1_transfer"):
            raise ValueError("Unexpected identity status")
        team=teams[target]
        kind="verified_espn_returners" if source==target else "verified_espn_transfers"
        team[kind]+=1;counts[kind]+=1
        pid=p.get("ncaa_box_player_id")
        matches=box.get((source,str(pid)),[]) if pid else []
        if p.get("ncaa_box_status")!="unique-ncaa-box-candidate" or len(matches)!=1:
            team["unresolved_box_candidates"]+=1;counts["unresolved_box_candidates"]+=1
            continue
        observed=matches[0]
        if observed["minutes"]<0:raise ValueError("Negative player minutes")
        team["unique_ncaa_box_candidates"]+=1
        team["candidate_minutes"]+=observed["minutes"]
        team["candidate_points"]+=observed["totals"]["pts"]
        field="candidate_returner_minutes" if source==target else "candidate_transfer_minutes"
        team[field]+=observed["minutes"]
        counts["unique_ncaa_box_candidates"]+=1
    for team in teams.values():
        for key in ("candidate_minutes","candidate_points","candidate_transfer_minutes","candidate_returner_minutes"):
            team[key]=round(team[key],2)
    return {"season":"2026-27","teams_audited":len(teams),
        "counts":dict(counts),"source":"2026 NCAA box production and stable ESPN 2026/2027 athlete IDs",
        "cross_provider_identity_verified":False,
        "historical_roster_asof_verified":False,"production_elo_approved":False,
        "notes":["Candidate minutes and points are descriptive only; school/name link unverified",
                 "Partial historical rosters can undercount movement",
                 "No team rating changes authorized"],
        "teams":sorted(teams.values(),key=lambda t:t["team"])}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--identity",default="data/ncaam-2026-27-espn-identity-continuity.json")
    p.add_argument("--ledger",default="data/ncaam-2025-26-player-production-ledger.json")
    p.add_argument("--registry",default="data/ncaam-2026-27-team-registry.json")
    p.add_argument("--out",default="data/ncaam-2026-27-verified-production-coverage.json")
    a=p.parse_args()
    result=audit(json.loads(Path(a.identity).read_text()),json.loads(Path(a.ledger).read_text()),
                 json.loads(Path(a.registry).read_text()))
    Path(a.out).write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({k:v for k,v in result.items() if k!="teams"},indent=2))
if __name__=="__main__":main()
