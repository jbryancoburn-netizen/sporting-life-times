#!/usr/bin/env python3
"""Validate NCAA official-source evidence against immutable flagged identity cases.
Evidence cannot by itself change crosswalks or preseason production ratings.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / "data/ncaam-2026-27-player-identity-triage.json"
BATCHES = [
    ROOT / "data/ncaam-2026-27-official-identity-evidence-batch-01.json",
    ROOT / "data/ncaam-2026-27-official-identity-evidence-batch-02.json",
]

def verify():
    audit = json.loads(AUDIT.read_text(encoding="utf-8"))
    flagged = {str(p["current_player_id"]): p for p in audit["flagged_cases"]}
    assert len(flagged) == 13, "Audit changed; manually reconcile scope first"
    seen = set()
    statuses = {}
    for path in BATCHES:
        batch = json.loads(path.read_text(encoding="utf-8"))
        assert batch["season"] == audit["season"]
        assert batch["model_mutation"] is False and batch["production_elo_changed"] is False
        for evidence in batch["cases"]:
            key = str(evidence["current_player_id"])
            assert key in flagged, f"Unknown athlete {key}"
            assert key not in seen, f"Duplicate official evidence for {key}"
            seen.add(key)
            assert evidence["player"] == flagged[key]["player"], f"Wrong identity for {key}"
            assert evidence["team"] == flagged[key]["2026_27_team"], f"Wrong team for {key}"
            assert evidence["official_sources"] and all(
                s.startswith("https://") for s in evidence["official_sources"]
            ), f"Missing source URL for {key}"
            assert evidence["evidence_status"], f"Missing evidence status for {key}"
            assert evidence["production_action"].startswith(("KEEP_", "DO_NOT_")), (
                f"Unsafe historical identity acceptance for {key}"
            )
            statuses[key] = evidence["evidence_status"]
    assert len(seen) == 9, f"Expected nine documented cases, got {len(seen)}"
    print(json.dumps({
        "total_flagged": len(flagged),
        "documented_with_official_sources": len(seen),
        "without_evidence_record": len(flagged)-len(seen),
        "pending_player_ids": sorted(set(flagged)-seen),
        "production_elo_changed": False,
        "verified_evidence_statuses": statuses
    }, indent=2))

if __name__ == "__main__":
    verify()
