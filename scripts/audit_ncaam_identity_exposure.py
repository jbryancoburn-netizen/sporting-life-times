#!/usr/bin/env python3
"""Join ESPN-verified movements to NCAA historical opponent exposure candidates.

Only the same-provider transfer/returner classification is verified. Historical
NCAA box ID linkage remains a school/name candidate, not a verified identity.
"""
import argparse,json,re
from collections import Counter,defaultdict
from pathlib import Path
from backtest_ncaam_roster_elo import clean

def norm(x):return re.sub("[^a-z0-9]","",str(x or "").lower())
def reconcile(identity,exposure,box,registry):
    team_names=defaultdict(set)
    for row in box:
        team="ncaa:"+str(row.get("team_ncaa_team_id") or "")
        if team[5:].isdigit() and row.get("team"):
            team_names[team].add(clean(row["team"]))
    observed={(p["team_key"],str(p["historical_player_id"])):p for p in exposure["player_exposure"]}
    teams={t["id"]:{"team_id":t["id"],"team":t["name"],"verified_espn_returners":0,
        "verified_espn_transfers":0,"candidate_exposure_players":0,
        "candidate_exposure_minutes":0.,"candidate_minutes_weighted_opponent_elo":None,
        "candidate_minutes_weighted_opponent_elo_numerator":0.,
        "unresolved_exposure":0,"cross_provider_identity_verified":False,
        "production_elo_approved":False} for t in registry["teams"]}
    if len(teams)!=365:raise ValueError("Expected 365 programs")
    counts=Counter()
    for player in identity["matched"]:
        target=player["team_id"];source=player["prior_team_id"]
        if target not in teams:raise ValueError("Unknown team "+target)
        t=teams[target]
        is_transfer=source!=target
        t["verified_espn_transfers" if is_transfer else "verified_espn_returners"]+=1
        counts["verified_espn_transfers" if is_transfer else "verified_espn_returners"]+=1
        candidates=team_names.get(source,set())
        pid=player.get("ncaa_box_player_id")
        if player.get("ncaa_box_status")!="unique-ncaa-box-candidate" or len(candidates)!=1 or not pid:
            t["unresolved_exposure"]+=1;counts["unresolved_exposure"]+=1;continue
        obs=observed.get((next(iter(candidates)),str(pid)))
        if not obs or obs["minutes"]<200 or obs["opponent_pregame_elo"] is None:
            t["unresolved_exposure"]+=1;counts["unresolved_exposure"]+=1;continue
        t["candidate_exposure_players"]+=1;counts["candidate_exposure_players"]+=1
        t["candidate_exposure_minutes"]+=obs["minutes"]
        t["candidate_minutes_weighted_opponent_elo_numerator"]+=obs["minutes"]*obs["opponent_pregame_elo"]
    for t in teams.values():
        m=t["candidate_exposure_minutes"]
        t["candidate_minutes_weighted_opponent_elo"]=round(t["candidate_minutes_weighted_opponent_elo_numerator"]/m,2) if m else None
        t["candidate_exposure_minutes"]=round(m,2)
        del t["candidate_minutes_weighted_opponent_elo_numerator"]
    return {"season":"2026-27","teams_audited":len(teams),"counts":dict(counts),
        "cross_provider_identity_verified":False,"preseason_roster_asof_verified":False,
        "opponent_adjustment_calibrated_for_verified_identities":False,
        "production_elo_approved":False,
        "teams":sorted(teams.values(),key=lambda x:x["team"])}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--identity",default="data/ncaam-2026-27-espn-identity-continuity.json")
    p.add_argument("--exposure",default="data/ncaam-2025-26-opponent-adjusted-player-exposure.json")
    p.add_argument("--registry",default="data/ncaam-2026-27-team-registry.json")
    p.add_argument("--out",default="data/ncaam-2026-27-verified-movement-opponent-exposure.json")
    a=p.parse_args()
    identity=json.loads(Path(a.identity).read_text())
    exposure=json.loads(Path(a.exposure).read_text())
    registry=json.loads(Path(a.registry).read_text())
    from backtest_ncaam_roster_elo import fetch
    result=reconcile(identity,exposure,fetch("ncaa_mbb_player_box",2026),registry)
    Path(a.out).write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({k:v for k,v in result.items() if k!="teams"},indent=2))
if __name__=="__main__":main()
