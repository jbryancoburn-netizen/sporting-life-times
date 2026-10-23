"""Audit published NCAA Elo baseline, roster shadow, and holdout evidence."""
import json
import math
import sys
from pathlib import Path

def audit(base, shadow, test):
    errors, warnings = [], []
    b, s = base.get("rankings", []), shadow.get("rankings", [])
    for label, rows in (("baseline", b), ("shadow", s)):
        ids = [r.get("team_id") for r in rows]
        if len(rows) != 365 or len(set(ids)) != 365 or any(not x for x in ids):
            errors.append(f"{label}: expected 365 unique identified teams")
        if any(not isinstance(r.get("elo"), (int, float)) or isinstance(r.get("elo"), bool) or not math.isfinite(r["elo"]) for r in rows):
            errors.append(f"{label}: nonfinite/missing Elo")
        if any(r.get("rank") != i for i, r in enumerate(rows, 1)):
            errors.append(f"{label}: rank mismatch")
        if any(rows[i]["elo"] > rows[i - 1]["elo"] for i in range(1, len(rows))):
            errors.append(f"{label}: sorting mismatch")
    bm = {r["team_id"]: r for r in b}
    sm = {r["team_id"]: r for r in s}
    if set(bm) != set(sm):
        errors.append("Team universes differ")
    for tid in set(bm) & set(sm):
        x, y = bm[tid], sm[tid]
        if abs(y.get("base_elo", float("inf")) - x["elo"]) > 0.00011:
            errors.append(f"{tid}: baseline mismatch")
        if abs(y["elo"] - y.get("base_elo", 0) - y.get("offseason_adjustment", 0)) > 0.00021:
            errors.append(f"{tid}: adjustment mismatch")
    if base.get("games_played") != 0 or shadow.get("games_played") != 0:
        errors.append("Preseason games must equal zero")
    evidence = shadow.get("evidence", {})
    if evidence.get("roster_programs", 0) < 365:
        warnings.append("Roster coverage incomplete")
    if evidence.get("player_matches", {}).get("exact_id_matches", 0) == 0:
        warnings.append("Cross-provider player IDs unverified")
    if test.get("approved_for_primary") is not True:
        warnings.append("Holdout report has not approved primary promotion")
    for metric in ("log_loss", "brier"):
        a = test.get("test_baseline", {}).get(metric)
        c = test.get("test_candidate", {}).get(metric)
        if not isinstance(a, (int, float)) or not isinstance(c, (int, float)) or c >= a:
            errors.append(f"Holdout {metric} missing or not improved")
    return {"integrity_pass": not errors, "primary_approved": not errors and not warnings,
            "errors": errors[:50], "warnings": warnings, "baseline_teams": len(b),
            "shadow_teams": len(s), "holdout_games": test.get("test_candidate", {}).get("games")}

if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("usage: python audit_ncaa_elo_release.py BASE SHADOW HOLDOUT")
    result = audit(*(json.loads(Path(p).read_text(encoding="utf-8")) for p in sys.argv[1:]))
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result["integrity_pass"] else 1)
