"""Fail-closed reconciliation gate for published NCAA soccer ratings and projections."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def get(name):
    return json.loads((ROOT/"data"/name).read_text(encoding="utf-8"))
def verify():
    ledger=get("college-soccer-elo-final-ledger.json")["results"]
    elo=get("college-soccer-elo.json")
    audit=get("college-soccer-elo-live-audit.json")
    projected=get("college-soccer-projected-standings.json")["conferences"]
    selection=get("college-soccer-ncaa-selection-forecast.json")
    ids=[g["match_id"] for g in ledger]
    assert len(ids)==len(set(ids)), "Duplicate game IDs"
    assert len(elo["cohorts"])==6, "Missing division"
    assert audit.get("ledger_finals")==len(ledger), "Audit ledger count mismatch"
    assert audit.get("published_as_of")==elo["as_of"], "Audit/Elo cutoff mismatch"
    assert audit.get("applied_finals")==elo.get("applied_finals_since_baseline"), "Elo/audit applied final mismatch"
    assert len(ledger)==audit.get("applied_finals",0)+audit.get("excluded_finals",0), "Missing ledger game disposition"
    assert not audit.get("replay_required"), "Corrected ledger must be replayed before publishing"
    assert not audit.get("unresolved_source_correction_count"), "Unresolved conflicting source score"
    if audit.get("quarantined_final_rows",0):
        details=audit.get("quarantined_final_details") or []
        assert len(details)==audit["quarantined_final_rows"], "Unidentified quarantined final: online source audit required"
    assert len(projected)==23, "Expected 23 conference projections"
    valid=set(ids)
    for conf, projection in projected.items():
        used=projection.get("applied_match_ids",[])
        assert len(used)==len(set(used)) and set(used)<=valid, "Unknown or duplicate conference final "+conf
    assert selection["rating_cutoff"]==elo["as_of"], "Tournament forecast stale compared with Elo"
    assert len(selection["field"])==48, "Tournament field size changed"
    ratings={x["team_id"]:x for x in elo["cohorts"]["men-d1"]}
    for entry in selection["field"]:
        team=ratings.get(entry["team_id"])
        assert team and abs(float(team["elo"])-float(entry["elo"]))<0.001, "Outdated selection Elo for "+entry["team_id"]
    check=selection.get("elo_reconciliation") or {}
    assert check.get("audit_status")==audit.get("status"), "Forecast missing latest audit status"
    print("PASS: 6 Elo cohorts, canonical game ledger, 23 conference projections and 48 forecast entrants consistent")
    print("Status:",audit.get("status"),"Quarantined:",audit.get("quarantined_final_rows"),"Certified:",audit.get("certified") is True)
if __name__=="__main__":
    verify()
