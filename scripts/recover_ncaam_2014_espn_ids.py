#!/usr/bin/env python3
"""Bulk-recover same-provider athlete identity for the 2,014 unlinked current players.

Matching numeric ESPN IDs across fetched historical/current ESPN rosters is
stronger than NCAA/ESPN name similarity, but the historical endpoint may return
a retrospective/inexact roster. No NCAA box ID is inferred or Elo changed.
"""
import argparse,json
from collections import defaultdict,Counter
from pathlib import Path

def analyze(prior,current,crosswalk):
    pending={str(x) for x in crosswalk["unlinked_espn_ids"]}
    assert len(pending)==2014
    old=defaultdict(list);now=defaultdict(list)
    for team in prior["rosters"]:
        for p in team["players"]:old[str(p["id"])].append((team["ncaa_id"],p["name"]))
    for team in current["rosters"]:
        for p in team["players"]:now[str(p["id"])].append((team["ncaa_id"],p["name"]))
    def norm(s):return "".join(c for c in str(s).casefold() if c.isalnum())
    counts=Counter()
    records=[]
    for ident in sorted(pending):
        current_rows=now.get(ident,[])
        previous_rows=old.get(ident,[])
        if len(current_rows)!=1:
            state="current_espn_roster_missing_or_duplicate"
        elif not previous_rows:
            state="no_prior_espn_roster_id"
        elif len(previous_rows)!=1:
            state="ambiguous_prior_espn_roster_id"
        elif norm(current_rows[0][1])!=norm(previous_rows[0][1]):
            state="same_id_name_conflict"
        else:
            state="same_espn_id_prior_season_candidate"
        counts[state]+=1
        row={"espn_athlete_id":ident,"status":state,"current_team_id":current_rows[0][0] if len(current_rows)==1 else None,
             "current_player":current_rows[0][1] if len(current_rows)==1 else None,
             "prior_team_id":previous_rows[0][0] if len(previous_rows)==1 else None,
             "prior_player":previous_rows[0][1] if len(previous_rows)==1 else None,
             "same_provider_continuity":state=="same_espn_id_prior_season_candidate",
             "historical_ncaa_box_id_verified":False,"eligible_for_automatic_stat_join":False}
        records.append(row)
    assert sum(counts.values())==2014
    assert all(not x["eligible_for_automatic_stat_join"] for x in records)
    return {"season":"2026-27","players_examined":2014,"status":"PROVIDER_ID_BULK_RECOVERY_RESEARCH_NO_ELO_MUTATION",
      "prior_espn_roster_season":prior.get("season"),"current_espn_roster_season":current.get("season"),
      "historical_asof_snapshot_verified":prior.get("source_payload_season_verified") is True,
      "counts":dict(counts),"records":records,"published_elo_changed":False,
      "limitations":["ESPN historical roster endpoint may provide retrospective or current data even when a previous season is requested",
      "No same-name matching, no NCAA numeric ID mapping, no automatic player-stat promotion"]}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--prior",type=Path,default=Path("staging/ncaam-2026-roster-evidence.json"))
    p.add_argument("--current",type=Path,default=Path("staging/ncaam-2027-roster-evidence.json"))
    p.add_argument("--crosswalk",type=Path,default=Path("data/ncaam-2026-27-direct-player-crosswalk.json"))
    p.add_argument("--out",type=Path,default=Path("staging/ncaam-unlinked-2014-espn-id-recovery.json"))
    args=p.parse_args()
    result=analyze(*[json.loads(q.read_text()) for q in (args.prior,args.current,args.crosswalk)])
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({"players_examined":2014,"counts":result["counts"],"historical_asof_snapshot_verified":result["historical_asof_snapshot_verified"]},indent=2))
if __name__=="__main__":main()
