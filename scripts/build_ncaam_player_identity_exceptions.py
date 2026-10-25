#!/usr/bin/env python3
"""Regenerate the conservative 2026-27 NCAA player identity exception ledger."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    "data/ncaam-2026-27-player-movement-audit.json",
    "data/ncaam-2026-27-direct-player-crosswalk.json",
    "data/ncaam-2026-27-player-identity-triage.json",
]
DEST = "data/ncaam-2026-27-player-identity-exceptions-complete.json"

def build():
    movement, crosswalk, _triage = [
        json.loads((ROOT / path).read_text()) for path in SOURCES
    ]
    people = {}
    for team in movement["teams"]:
        for person in team["players"]:
            pid = str(person["current_id"])
            if pid in people:
                raise ValueError("Duplicate roster athlete " + pid)
            people[pid] = dict(team=team["team"], team_id=team["team_id"], **person)
    links = {}
    for link in crosswalk["links"]:
        pid = str(link["id"])
        if pid in links or pid not in people:
            raise ValueError("Duplicate/unknown crosswalk athlete " + pid)
        links[pid] = link
    counts, review = {}, []
    for pid, p in people.items():
        link = links.get(pid)
        if link is None:
            status = "unlinked_not_classified"
        elif link["method"] == "jaro_winkler":
            status = "fuzzy_excluded"
        elif not p.get("prior_school_id"):
            status = "linked_no_prior_d1_box"
        elif p["prior_school_id"] != link.get("prior"):
            status = "conflicting_prior_school_excluded"
        elif not isinstance(p.get("prior_minutes"), (int, float)) or p["prior_minutes"] <= 0:
            status = "invalid_prior_minutes_excluded"
        else:
            status = "accepted_existing_stat_link"
        counts[status] = counts.get(status, 0) + 1
        if status != "accepted_existing_stat_link":
            review.append({
                "athlete_id": pid, "player": p["player"], "current_team": p["team"],
                "current_team_id": p["team_id"], "source_roster_candidate": p["status"],
                "classification": status,
                "historical_ncaa_player_id": link.get("pid") if link else None,
                "crosswalk_method": link.get("method") if link else None,
                "roster_prior_school_id": p.get("prior_school_id"),
                "crosswalk_prior_school_id": link.get("prior") if link else None,
                "action": "VERIFY_CURRENT_PLAYER_ORIGIN" if link is None else "DO_NOT_AUTO_JOIN",
            })
    expected = {
        "accepted_existing_stat_link": 2923,
        "linked_no_prior_d1_box": 587,
        "unlinked_not_classified": 2014,
        "conflicting_prior_school_excluded": 7,
        "fuzzy_excluded": 6,
    }
    if counts != expected or len(people) != 5537 or len(links) != 3523:
        raise ValueError("Unexpected identity counts; manually reassess source data before release: " + str(counts))
    review.sort(key=lambda p: (p["classification"], p["current_team"], p["player"]))
    return {
        "season": "2026-27",
        "purpose": "Conservative current-roster identity and prior-history exception ledger",
        "classification_policy": "Classify from recorded evidence only. Name-based status remains a candidate, not official verification. Unlinked is never automatically freshman or transfer. IDs from different providers are not assumed equivalent.",
        "total_roster_players": len(people), "linked_candidates": len(links),
        "category_counts": counts, "review_count": len(review),
        "source_paths": SOURCES, "production_ratings_modified": False,
        "review_queue": review,
    }

if __name__ == "__main__":
    actual = build()
    output = ROOT / DEST
    content = json.dumps(actual, indent=2) + "\n"
    import sys
    if "--check" in sys.argv:
        expected = json.loads(output.read_text())
        assert actual["category_counts"] == expected["category_counts"], "Category counts differ"
        assert actual["review_count"] == expected["review_count"], "Review count differs"
        by_id = lambda rows: {str(p["athlete_id"]): p for p in rows}
        assert by_id(actual["review_queue"]) == by_id(expected["review_queue"]), "Per-athlete classifications differ"
        assert actual["total_roster_players"] == expected["total_roster_players"], "Roster sizes differ"
        assert actual["linked_candidates"] == expected["linked_candidates"], "Crosswalk size differs"
        print("PASS: 365-team NCAA identity ledger matches source evidence")
    else:
        output.write_text(content)
        print("Wrote " + str(output))
