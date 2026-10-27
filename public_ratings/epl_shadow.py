"""Research-only public soccer goal-model shadow over the already-public EPL feed.

Never replaces production EPL Elo, match-center, score predictions, or ratings.
The public match-center's expected goals are heuristic inputs, not trained Poisson
goals. The output compares two *different* forecast models, not exact parity.
"""
import argparse
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

from public_ratings.soccer_goal_model import score_distribution


def build_shadow(feed):
    if feed.get("competition") != "EPL" or feed.get("schema_version") != 1:
        raise ValueError("Unexpected public EPL match-center schema")
    fixtures = feed.get("fixtures")
    if not isinstance(fixtures, list) or not fixtures:
        raise ValueError("No public EPL fixtures available")
    seen = set()
    rows = []
    for match in fixtures:
        ident = str(match["fixture_id"])
        if ident in seen:
            raise ValueError("Duplicate EPL fixture " + ident)
        seen.add(ident)
        home, away = match["home"], match["away"]
        if str(home["id"]) == str(away["id"]):
            raise ValueError("Fixture teams must be different")
        h, a = home["expected_goals"], away["expected_goals"]
        if any(type(x) not in (int, float) or not math.isfinite(x) or not 0 < x < 20 for x in (h, a)):
            raise ValueError("Invalid existing expected-goals input")
        baseline = match["probabilities"]
        old = [baseline[k] for k in ("home", "draw", "away")]
        if any(type(x) not in (int, float) or not math.isfinite(x) or not 0 <= x <= 1 for x in old):
            raise ValueError("Invalid baseline probability")
        if abs(sum(old) - 1) > 1e-6:
            raise ValueError("Baseline probabilities do not sum to one")
        research = score_distribution(h, a)
        new = [research["p_" + k] for k in ("home", "draw", "away")]
        if any(not 0 <= x <= 1 for x in new) or abs(sum(new) - 1) > 1e-9:
            raise ValueError("Research probabilities invalid")
        rows.append({
            "fixture_id": ident,
            "kickoff_utc": match["kickoff_utc"],
            "home": home["name"],
            "away": away["name"],
            "baseline_probabilities": dict(zip(("home", "draw", "away"), old)),
            "research_probabilities": dict(zip(("home", "draw", "away"), new)),
            "delta_percentage_points": dict(zip(("home", "draw", "away"), [round(100 * (n - o), 3) for n, o in zip(new, old)])),
            "research_over_2_5_probability": research["over_2_5"],
            "research_both_score_probability": research["btts"],
        })
    return {
        "status": "research_shadow_not_validated_not_for_publication",
        "source": "published_epl_match_center",
        "source_issued_at_utc": feed.get("issued_at_utc"),
        "competition": "EPL",
        "model": "portable_poisson_v1_independent_research",
        "baseline_model": "current_published_epl_heuristic",
        "fixture_count": len(rows),
        "mean_absolute_probability_gap_percentage_points": round(
            sum(abs(v) for r in rows for v in r["delta_percentage_points"].values()) / (len(rows) * 3), 3
        ),
        "limitations": [
            "Research output only; no live replacement or calibration claim.",
            "Both models consume the same previously published heuristic expected goals.",
            "Differences from production are expected and are not a correctness failure.",
            "Only pregame outcome grading across subsequently verified finals can assess improvement.",
        ],
        "fixtures": rows,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="data/epl-match-center.json")
    parser.add_argument("--output", default="/tmp/epl-public-goal-shadow.json")
    args = parser.parse_args()
    source = Path(args.input)
    feed = json.loads(source.read_text())
    result = build_shadow(feed)
    result["input_sha256"] = hashlib.sha256(source.read_bytes()).hexdigest()
    result["evaluated_at_utc"] = datetime.now(timezone.utc).isoformat()
    destination = Path(args.output)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"status": result["status"], "fixtures": result["fixture_count"],
                      "mean_abs_probability_gap_pp": result["mean_absolute_probability_gap_percentage_points"],
                      "output": str(destination)}))


if __name__ == "__main__":
    main()
