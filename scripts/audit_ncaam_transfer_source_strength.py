#!/usr/bin/env python3
"""Opponent/context proxy for verified 2026-27 NCAA D1 transfers.

Reports historical source-school strength of incoming players using OWN
2025-26 Elo. A school rating is only a context proxy, NOT a player value.
Unverified player-ID links and schools lacking a source rating get null.
This feature is research only until calibrated on preseason-as-of history.
"""
import json
from pathlib import Path
def build(prior,movement,crosswalk,roster):
    historical=prior["ratings"]
    teams={x["team_id"]:x for x in movement["teams"]}
    current={str(p["current_id"]):(tid,p) for tid,t in teams.items() for p in t["players"]}
    approved={}
    for link in crosswalk["links"]:
        eid=str(link["id"])
        if (link.get("method") not in ("name","name_jersey","last_jersey")
            or eid not in current):continue
        tid,person=current[eid]
        if (person.get("prior_school_id")!=link.get("prior")
            or not isinstance(person.get("prior_minutes"),(int,float))
            or person["prior_minutes"]<=0):continue
        approved[eid]=(tid,person)
    out={}
    for tid,t in teams.items():
        known=0;missing=0;retained=0;weighted=0.;minute_total=0.
        sources={}
        for p in t["players"]:
            eid=str(p["current_id"])
            if eid not in approved:continue
            source=p.get("prior_school_id")
            if source==tid:
                retained+=1;continue
            m=float(p["prior_minutes"])
            if source not in historical:
                missing+=1;continue
            strength=float(historical[source])
            known+=1
            weighted+=m*strength;minute_total+=m
            bucket=sources.setdefault(source,{"players":0,"minutes":0.})
            bucket["players"]+=1;bucket["minutes"]+=m
        out[tid]={"team_id":tid,"team":t["team"],
          "linked_transfers_with_source_elo":known,
          "linked_transfers_without_source_elo":missing,
          "verified_returners":retained,
          "transfer_source_weighted_2025_26_elo":round(weighted/minute_total,4) if minute_total else None,
          "verified_source_transfer_minutes":round(minute_total,2),
          "source_programs":len(sources)}
    ranked=list(out.values())
    return {"season":"2026-27","model":"transfer-context-own-prior-school-elo-v1",
      "status":"UNVALIDATED_CONTEXT_FEATURE_DO_NOT_PROMOTE",
      "historical_rating_source":"data/ncaam-2025-26-elo-bootstrap.json",
      "player_join":"approved linked 2026-27 current ID to 2025-26 NCAA player and school",
      "teams":ranked,"team_count":len(out),
      "teams_with_verifiable_transfer_source":sum(x["linked_transfers_with_source_elo"]>0 for x in ranked),
      "missing_source_rating_transfers":sum(x["linked_transfers_without_source_elo"] for x in ranked),
      "limitations":["Previous school Elo is a contextual proxy, not individual talent",
        "No unverified identities or previous-school ratings imputed",
        "Historical 2025-26 Elo was calculated with venue-neutral games",
        "No numerical transfer-strength weight selected without matched-game holdout"]}
def main():
    d=Path("data");load=lambda p:json.loads((d/p).read_text())
    x=build(load("ncaam-2025-26-elo-bootstrap.json"),
      load("ncaam-2026-27-player-movement-audit.json"),
      load("ncaam-2026-27-direct-player-crosswalk.json"),
      load("ncaam-2026-27-preseason-roster-informed.json"))
    assert x["team_count"]==365
    (d/"ncaam-2026-27-transfer-source-strength-audit.json").write_text(json.dumps(x,indent=2)+"\n")
    print(json.dumps({k:v for k,v in x.items() if k!="teams"},indent=2))
if __name__=="__main__": main()
