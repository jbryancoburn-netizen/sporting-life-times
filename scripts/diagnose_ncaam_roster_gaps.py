#!/usr/bin/env python3
"""Actionable ESPN roster evidence gap report, not invented roster completion."""
import argparse,json
from pathlib import Path

def diagnose(old,current,registry):
    known={t["id"]:t["name"] for t in registry["teams"]}
    old_map={r["ncaa_id"]:r for r in old["rosters"]}
    now_map={r["ncaa_id"]:r for r in current["rosters"]}
    missing_prior=[{"team_id":k,"team":v} for k,v in known.items() if k not in old_map]
    missing_current=[{"team_id":k,"team":v} for k,v in known.items() if k not in now_map]
    partial_prior=[{"team_id":k,"team":r["school"],"listed_players":len(r["players"])}
        for k,r in old_map.items() if len(r["players"])<8]
    partial_current=[{"team_id":k,"team":r["school"],"listed_players":len(r["players"])}
        for k,r in now_map.items() if len(r["players"])<8]
    return {"historical_season":old["season"],"current_season":current["season"],
        "registry_teams":len(known),"missing_prior":sorted(missing_prior,key=lambda x:x["team"]),
        "missing_current":sorted(missing_current,key=lambda x:x["team"]),
        "partial_prior":sorted(partial_prior,key=lambda x:x["team"]),
        "partial_current":sorted(partial_current,key=lambda x:x["team"]),
        "source_failures_prior":old.get("failed",[]),
        "source_failures_current":current.get("failed",[]),
        "historical_asof_verified":False,"release_approved":False,
        "historical_missing_count":len(missing_prior),
        "historical_partial_count":len(partial_prior),
        "current_missing_count":len(missing_current),
        "current_partial_count":len(partial_current),
        "remediation":"Use timestamped 2025-26 roster snapshots or original provider athlete IDs; do not infer missing players from season endpoint"}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--prior",default="staging/ncaam-2026-roster-evidence.json")
    p.add_argument("--current",default="staging/ncaam-2027-roster-evidence.json")
    p.add_argument("--registry",default="data/ncaam-2026-27-team-registry.json")
    p.add_argument("--out",default="data/ncaam-2026-27-roster-gap-diagnostics.json")
    a=p.parse_args()
    report=diagnose(*[json.loads(Path(x).read_text()) for x in (a.prior,a.current,a.registry)])
    Path(a.out).write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2))
if __name__=="__main__":main()
