#!/usr/bin/env python3
"""Apply evidence-backed identity annotations without pretending IDs are cross-provider joins.

A confirmed school/transfer history is NOT a verified historical NCAA athlete ID.
Previous D-I box-score minutes remain excluded until individually linked.
"""
import argparse
import json
from collections import Counter
from pathlib import Path

AMBIGUOUS = "id-not-found-name-ambiguous"
CLASSES = {"returner", "transfer", "new-to-d1"}

def resolve(movement, official):
    if movement.get("season") != "2026-27" or official.get("season") != "2026-27":
        raise ValueError("Wrong season")
    if movement.get("roster_teams") != 365 or len(movement.get("teams", [])) != 365:
        raise ValueError("Expected 365 audited school rosters")
    players = {}
    counts = Counter()
    for school in movement["teams"]:
        for athlete in school["players"]:
            counts[athlete["status"]] += 1
            if athlete["status"] != AMBIGUOUS:
                continue
            eid = str(athlete["current_id"])
            if not eid or eid in players:
                raise ValueError("Duplicate ambiguous ESPN athlete ID: " + eid)
            players[eid] = (school, athlete)
    if sum(counts.values()) != movement.get("players_audited"):
        raise ValueError("Raw movement audit player-count mismatch")
    if dict(counts) != movement.get("player_status_counts"):
        raise ValueError("Raw audit status summary mismatch")
    observed = set()
    records = []
    for proof in official.get("records", []):
        eid = str(proof.get("espn_athlete_id", "")).strip()
        if eid in observed or eid not in players:
            raise ValueError("Unknown or duplicated evidence athlete ID: " + eid)
        observed.add(eid)
        school, athlete = players[eid]
        if (proof.get("name") != athlete["player"] or
                proof.get("team_id") != school["team_id"] or
                proof.get("team") != school["team"]):
            raise ValueError("Evidence does not match roster: " + eid)
        category = proof.get("classification")
        previous = proof.get("prior_team_id")
        if category not in CLASSES:
            raise ValueError("Unknown identity category: " + eid)
        if category == "returner" and previous != school["team_id"]:
            raise ValueError("Returner prior school disagrees: " + eid)
        if category == "transfer" and (not isinstance(previous, str) or
                                        previous == school["team_id"]):
            raise ValueError("Transfer prior school invalid: " + eid)
        if category == "new-to-d1" and previous is not None:
            raise ValueError("New-to-DI prior team must be unset: " + eid)
        url = proof.get("source_url")
        if (not isinstance(url, str) or not url.startswith("https://") or
                proof.get("source_type") != "institutional-athletics"):
            raise ValueError("Missing attributable institutional evidence: " + eid)
        records.append({
            "espn_athlete_id": eid, "player": proof["name"],
            "school": school["team"], "team_id": school["team_id"],
            "category": category, "prior_team_id": previous,
            "institutional_source": url,
            "school_history_corrobated": True,
            "historical_ncaa_player_id": None,
            "historical_ncaa_box_match_verified": False,
            "eligible_for_player_minutes_input": False
        })
    uncorroborated = sorted(set(players) - observed)
    records.sort(key=lambda r:(r["school"],r["player"],r["espn_athlete_id"]))
    status = Counter(x["category"] for x in records)
    return {
        "season": "2026-27",
        "status": "institutional biographical evidence linked; historical NCAA athlete IDs unverified",
        "teams_checked": 365,
        "players_in_movement_audit": movement["players_audited"],
        "raw_ambiguous_name_count": len(players),
        "institutional_source_confirmations": len(records),
        "institutional_categories": dict(status),
        "uncorroborated_ambiguous_athlete_ids": uncorroborated,
        "uncorroborated_ambiguous_count": len(uncorroborated),
        "unmatched_prior_d1_box_count": counts.get("no-prior-d1-box", 0),
        "unique_name_candidates_still_need_cross_provider_id": (
            counts.get("unique-name-returner-candidate", 0) +
            counts.get("unique-name-transfer-candidate", 0)),
        "historical_ncaa_player_id_verifications_from_biographies": 0,
        "transfer_minutes_authorized_from_biographies": 0,
        "production_elo_approved": False,
        "warning": "A school-history confirmation does not establish NCAA historical player-ID equivalence, 2025-26 minutes, or eligibility for a roster-driven Elo adjustment.",
        "records": records
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--movement", type=Path,
                        default=Path("data/ncaam-2026-27-player-movement-audit.json"))
    parser.add_argument("--official", type=Path,
                        default=Path("data/ncaam-2026-27-official-player-resolutions.json"))
    parser.add_argument("--out", type=Path,
                        default=Path("data/ncaam-2026-27-identity-resolved.json"))
    args = parser.parse_args()
    result = resolve(json.loads(args.movement.read_text(encoding="utf-8")),
                     json.loads(args.official.read_text(encoding="utf-8")))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n",
                        encoding="utf-8")
    print(json.dumps({key:result[key] for key in
                      ("institutional_source_confirmations","uncorroborated_ambiguous_count",
                       "unique_name_candidates_still_need_cross_provider_id",
                       "production_elo_approved")}, indent=2))
    if result["uncorroborated_ambiguous_count"]:
        raise SystemExit("Missing institutional corroboration for ambiguous players")

if __name__ == "__main__":
    main()
