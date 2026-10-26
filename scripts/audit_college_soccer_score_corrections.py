"""Compare unresolved NCAA score disputes against the latest online scoreboard audit.
Never rewrites Elo scores; an offline run is not evidence that a conflict cleared.
"""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def run():
    watch_path=ROOT/"data/college-soccer-score-correction-watch.json"
    audit_path=ROOT/"data/college-soccer-elo-live-audit.json"
    watch=json.loads(watch_path.read_text())
    audit=json.loads(audit_path.read_text())
    online=(audit.get("scoreboard_checks",0)>0 and
            audit.get("verification_mode","online_source_check")=="online_source_check")
    observed={x["match_id"]:x for x in audit.get("unresolved_source_corrections",[])}
    rows=[]
    for item in watch["issues"]:
        match=item["match_id"]
        problem=observed.get(match)
        # Missing from a bounded four-day scoreboard recheck does NOT prove resolution.
        status="not_reverified" if not online else "requires_individual_game_verification"
        if problem:
            status="still_conflicting"
        rows.append({"match_id":match,"source_game":item["source_game"],"status":status,
                     "latest_observed":problem["source"] if problem else None})
    out={"schema_version":1,"checked_through":audit.get("checked_through"),
         "scoreboard_checks":audit.get("scoreboard_checks",0),
         "status":"online_audit_required" if not online else "partial_online_audit",
         "issues":rows,"unresolved_count":sum(x["status"]!="verified_resolved" for x in rows)}
    (ROOT/"data/college-soccer-score-correction-status.json").write_text(json.dumps(out,indent=2)+"\n")
    print("Outstanding manual verifications:",out["unresolved_count"])
if __name__=="__main__":run()
