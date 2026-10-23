#!/usr/bin/env python3
"""Audit all current roster players against prior NCAA box-score identity.

No guessed name merges. Exact player IDs are verified against historical
NCAA names; conflicting ID/name pairs are rejected, not silently counted.
No transfer Elo adjustment is authorized by this ledger.
"""
import json,re,argparse
from collections import defaultdict,Counter
from pathlib import Path
from backtest_ncaam_roster_elo import fetch
def norm(s):return re.sub("[^a-z0-9]","",str(s or "").lower())
def index(rows):
    by_id=defaultdict(lambda:{"teams":set(),"names":set(),"minutes":defaultdict(float),"points":defaultdict(float),"games":defaultdict(set)})
    by_name=defaultdict(set)
    for r in rows:
        pid=str(r.get("player_id") or "").strip()
        team=str(r.get("team_ncaa_team_id") or "").strip()
        name=norm(r.get("clean_name") or r.get("player"))
        gid=str(r.get("contest_id") or "").strip()
        if not pid.isdigit() or not team.isdigit() or not name or not gid:continue
        try:
            mins=float(r.get("mins") or 0);pts=float(r.get("pts") or 0)
        except (ValueError,TypeError):continue
        if not 0<=mins<=75:continue
        obj=by_id[pid];obj["teams"].add("ncaa:"+team);obj["names"].add(name)
        obj["minutes"]["ncaa:"+team]+=mins;obj["points"]["ncaa:"+team]+=pts
        obj["games"]["ncaa:"+team].add(gid)
        by_name[name].add(pid)
    return by_id,by_name
def audit(rosters,rows):
    by_id,by_name=index(rows)
    teams=[];totals=Counter()
    for school in rosters["rosters"]:
        target=school["ncaa_id"];players=[];seen=set()
        for p in school["players"]:
            pid=str(p.get("id") or "").strip()
            name=norm(p.get("name"))
            if not pid or not name:continue
            if pid in seen:
                players.append({"player":p["name"],"current_id":pid,"status":"duplicate-current-id"})
                totals["duplicate-current-id"]+=1
                continue
            seen.add(pid)
            item=by_id.get(pid)
            if item and name in item["names"]:
                previous=sorted(item["teams"])
                if len(previous)==1:
                    source=previous[0]
                    status="returner" if source==target else "transfer-from-d1"
                else:
                    source=None;status="ambiguous-prior-school"
            elif item:
                source=None;status="id-name-conflict"
            else:
                possible=by_name.get(name,set())
                source=None
                if len(possible)==1:
                    candidate=by_id[next(iter(possible))]
                    if len(candidate["teams"])==1 and len(candidate["names"])==1:
                        source=next(iter(candidate["teams"]))
                        status="unique-name-returner-candidate" if source==target else "unique-name-transfer-candidate"
                    else:
                        status="name-match-multiple-prior-schools"
                else:
                    status="id-not-found-name-ambiguous" if len(possible)>1 else "no-prior-d1-box"
            totals[status]+=1
            player={"player":p["name"],"current_id":pid,"status":status,"prior_school_id":source}
            if source is not None:
                historical=item if status in ("returner","transfer-from-d1") else candidate
                player["prior_minutes"]=round(historical["minutes"][source],2)
                player["prior_points"]=round(historical["points"][source],2)
                player["prior_games"]=len(historical["games"][source])
            players.append(player)
        counts=dict(Counter(p["status"] for p in players))
        teams.append({"team_id":target,"team":school["school"],"roster_players":len(players),
            "verified_returners":counts.get("returner",0),
            "verified_d1_transfers":counts.get("transfer-from-d1",0),
            "unverified":sum(n for k,n in counts.items() if k not in ("returner","transfer-from-d1")),
            "status_counts":counts,"players":players})
    teams.sort(key=lambda x:x["team"])
    return {"season":"2026-27","historical_season":"2025-26",
        "current_roster_source":"ESPN roster evidence; NCAA-anchored team crosswalk",
        "historical_source":"NCAA-origin player game box via SportsDataverse",
        "roster_teams":len(teams),"players_audited":sum(t["roster_players"] for t in teams),
        "player_status_counts":dict(totals),"production_elo_approved":False,
        "limitations":["Current ESPN athlete ID vs NCAA player ID identity namespace checked with name equality; still needs source-level validation",
            "Players with multiple historical schools are excluded from transfer identification",
            "Prior NCAA D1 production is unavailable for freshmen, D2, international and other entrants",
            "Opponent-adjusted player quality not yet validated"],
        "teams":teams}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--rosters",type=Path,default=Path("staging/ncaam-2027-roster-evidence.json"))
    p.add_argument("--out",type=Path,default=Path("data/ncaam-2026-27-player-movement-audit.json"))
    a=p.parse_args()
    rosters=json.loads(a.rosters.read_text())
    out=audit(rosters,fetch("ncaa_mbb_player_box",2026))
    a.out.write_text(json.dumps(out,separators=(",",":"))+"\n")
    print(json.dumps({"teams":out["roster_teams"],"players":out["players_audited"],
         "counts":out["player_status_counts"]},indent=2))
if __name__=="__main__":main()
