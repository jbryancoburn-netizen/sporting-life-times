#!/usr/bin/env python3
"""Audit NBL source candidate snapshots without promoting them to verified Elo inputs."""
import argparse, collections, hashlib, json, math
from datetime import datetime, timezone, date
from pathlib import Path
from nbl_elo import TEAMS

def audit(items, previous=None):
    games=items.get("games")
    if not isinstance(games,list) or items.get("status")!="uncertified_source_candidates":
        raise ValueError("Invalid staged candidate payload")
    seen=set(); names=set(); last=""; errors=[]; counts=collections.Counter(); months=collections.Counter()
    for g in games:
        gid=str(g.get("id") or "")
        if not gid or gid in seen: errors.append("Duplicate or blank ID "+gid)
        seen.add(gid)
        if g.get("verified") is not False or g.get("state")!="candidate":
            errors.append("Unapproved game certification "+gid)
        if g.get("provider")!="espn" or not str(g.get("source_url") or "").startswith("https://www.espn.com/"):
            errors.append("Missing ESPN game provenance "+gid)
        when=str(g.get("played_at") or "")
        try: datetime.fromisoformat(when.replace("Z","+00:00"))
        except ValueError: errors.append("Invalid date "+gid)
        if last and when<last: errors.append("Out-of-order result "+gid)
        last=when
        if when: months[when[:7]]+=1
        for k in ("home","away"):
            team=g.get(k)
            if team not in TEAMS: errors.append("Unknown NBL team "+str(team))
            else: counts[team]+=1;names.add(team)
        if g.get("home")==g.get("away"): errors.append("Self matchup "+gid)
        hs,aws=g.get("home_score"),g.get("away_score")
        if not isinstance(hs,int) or isinstance(hs,bool) or not isinstance(aws,int) or isinstance(aws,bool) or min(hs,aws)<0 or hs==aws:
            errors.append("Non-final score "+gid)
    if previous:
        overlap=seen & {str(x["id"]) for x in previous.get("games",[])}
        if overlap: errors.append("Cross-season duplicate IDs "+",".join(sorted(overlap)))
    probes=items.get("probes") or []
    if not probes: errors.append("No retrieval provenance")
    if len(names)!=len(TEAMS): errors.append("Incomplete NBL club coverage")
    return {"status":"pass_candidate_integrity" if not errors else "fail",
       "verification_status":"NOT_CERTIFIED","candidate_count":len(games),
       "clubs_seen":len(names),"per_club_appearances":dict(sorted(counts.items())),
       "monthly_game_counts":dict(sorted(months.items())),
       "first_game_at":games[0]["played_at"] if games else None,
       "last_game_at":games[-1]["played_at"] if games else None,
       "request_count":sum(x.get("request_count",0) for x in probes),
       "errors":errors, "release_blockers":[
           "Independent result-source reconciliation is not complete",
           "Historical opening-strength and home-court parameters are not backtested",
           "Unverified candidate games must not enter published Elo"]}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--past",required=True);p.add_argument("--current",required=True);p.add_argument("--output",required=True)
    a=p.parse_args()
    past=json.loads(Path(a.past).read_text());current=json.loads(Path(a.current).read_text())
    results={"generated_at":datetime.now(timezone.utc).isoformat(),"seasons":{
       "2025-26":audit(past),"2026-27":audit(current,past)},"model_publication_approved":False}
    output=Path(a.output);output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(results,indent=2)+"\n")
    print(json.dumps({k:{"status":v["status"],"games":v["candidate_count"],"errors":v["errors"]} for k,v in results["seasons"].items()},indent=2))
    if any(v["errors"] for v in results["seasons"].values()):raise SystemExit(1)

if __name__=="__main__":main()
