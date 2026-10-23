#!/usr/bin/env python3
"""Build a complete 365-school ESPN-verified movement audit; not Elo ratings."""
import argparse,json
from pathlib import Path
from collections import Counter,defaultdict

def summarize(identity,registry):
    by_team=defaultdict(list)
    for p in identity["matched"]:by_team[p["team_id"]].append(p)
    teams=[]
    for team in registry["teams"]:
        tid=team["id"]
        players=by_team[tid]
        c=Counter(p["espn_status"] for p in players)
        cross=Counter(p["ncaa_box_status"] for p in players)
        teams.append({"team_id":tid,"team":team["name"],
            "verified_espn_returners":c["verified_espn_returner"],
            "verified_espn_d1_transfers":c["verified_espn_d1_transfer"],
            "ncaa_box_unique_candidates":cross["unique-ncaa-box-candidate"],
            "ncaa_box_identity_verified":False,
            "roster_timing_verified":False,
            "production_elo_approved":False})
    teams.sort(key=lambda x:(-x["verified_espn_d1_transfers"],x["team"]))
    return {"season":"2026-27","teams_audited":len(teams),
        "verified_espn_d1_transfers":sum(t["verified_espn_d1_transfers"] for t in teams),
        "verified_espn_returners":sum(t["verified_espn_returners"] for t in teams),
        "historical_roster_asof_verified":False,"production_elo_approved":False,
        "teams":teams}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--identity",default="data/ncaam-2026-27-espn-identity-continuity.json")
    p.add_argument("--registry",default="data/ncaam-2026-27-team-registry.json")
    p.add_argument("--out",default="data/ncaam-2026-27-verified-movement-team-audit.json")
    a=p.parse_args()
    out=summarize(json.loads(Path(a.identity).read_text()),json.loads(Path(a.registry).read_text()))
    assert out["teams_audited"]==365
    Path(a.out).write_text(json.dumps(out,indent=2)+"\n")
    print(json.dumps({k:v for k,v in out.items() if k!="teams"},indent=2))
if __name__=="__main__":main()
