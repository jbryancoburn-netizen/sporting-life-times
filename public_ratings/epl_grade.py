"""Lock public EPL shadow forecasts before kickoff; grade only later verified finals.

No data collection, no source changes, no production rating writes.
Persistence is JSON: the first pregame prediction for each fixture is immutable.
"""
import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path

from public_ratings.epl_shadow import build_shadow

OUTCOMES = ("home", "draw", "away")


def timestamp(value):
    result = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError("Timestamps must be timezone-aware")
    return result.astimezone(timezone.utc)


def advance(feed, ledger, now):
    now = timestamp(now) if isinstance(now, str) else now.astimezone(timezone.utc)
    if feed.get("competition") != "EPL" or feed.get("schema_version") != 1:
        raise ValueError("Unexpected EPL feed")
    issued = timestamp(feed["issued_at_utc"])
    if issued > now:
        raise ValueError("Source was issued in the future")
    if (now - issued).total_seconds() > 3600 * 12:
        raise ValueError("EPL source is more than twelve hours old; refusing to lock predictions")
    if ledger.get("schema_version", 1) != 1:
        raise ValueError("Unrecognized archived EPL research schema")
    locked = dict(ledger.get("locked", {}))
    graded = dict(ledger.get("graded", {}))
    shadow = build_shadow(feed)
    new_locks = 0
    new_grades = 0
    for row in shadow["fixtures"]:
        fid = row["fixture_id"]
        kickoff = timestamp(row["kickoff_utc"])
        # At least one minute before kickoff; use source-issued timestamp,
        # not the time this script happens to execute.
        if fid not in locked and issued < kickoff and now < kickoff:
            locked[fid] = {
                "fixture_id": fid,
                "kickoff_utc": row["kickoff_utc"],
                "issued_at_utc": feed["issued_at_utc"],
                "home": row["home"], "away": row["away"],
                "baseline_probabilities": row["baseline_probabilities"],
                "research_probabilities": row["research_probabilities"],
            }
            new_locks += 1
    seen_finals = set()
    for final in feed.get("recent_results", []):
        fid = str(final["fixture_id"])
        if fid in seen_finals:
            raise ValueError("Duplicate final fixture " + fid)
        seen_finals.add(fid)
        if fid not in locked or fid in graded:
            continue
        row = locked[fid]
        if final["home"] != row["home"] or final["away"] != row["away"]:
            raise ValueError("Fixture participants changed for locked forecast " + fid)
        if timestamp(row["issued_at_utc"]) >= timestamp(row["kickoff_utc"]):
            raise ValueError("Postkickoff prediction in locked ledger " + fid)
        if timestamp(final["kickoff_utc"]) != timestamp(row["kickoff_utc"]):
            raise ValueError("Kickoff changed; manual review required " + fid)
        h, a = final["home_score"], final["away_score"]
        if type(h) is not int or type(a) is not int or min(h, a) < 0:
            raise ValueError("Invalid verified final score")
        if timestamp(final["kickoff_utc"]) > now:
            raise ValueError("Future fixture incorrectly marked final")
        result = "home" if h > a else "away" if h < a else "draw"
        metrics = {}
        for model, key in (("baseline", "baseline_probabilities"), ("research", "research_probabilities")):
            probs = row[key]
            if any(type(probs.get(o)) not in (float, int) or not math.isfinite(probs[o]) or not 0 < probs[o] < 1 for o in OUTCOMES):
                raise ValueError("Invalid locked probability")
            if abs(sum(probs[o] for o in OUTCOMES) - 1) > 1e-6:
                raise ValueError("Locked outcome probabilities are not normalized")
            metrics[model] = {
                "log_loss": -math.log(max(probs[result], 1e-15)),
                "brier": sum((probs[o] - int(o == result)) ** 2 for o in OUTCOMES),
            }
        graded[fid] = {
            "fixture_id": fid, "home": row["home"], "away": row["away"],
            "home_score": h, "away_score": a, "outcome": result,
            "baseline": metrics["baseline"], "research": metrics["research"],
        }
        new_grades += 1
    scores = {}
    for model in ("baseline", "research"):
        scores[model] = {
            metric: round(sum(x[model][metric] for x in graded.values()) / len(graded), 6) if graded else None
            for metric in ("log_loss", "brier")
        }
    return {
        "schema_version": 1, "competition": "EPL",
        "status": "research_only_not_for_live_promotion",
        "locked": locked, "graded": graded,
        "summary": {
            "locked_count": len(locked), "graded_count": len(graded),
            "new_locks": new_locks, "new_grades": new_grades,
            "scores": scores,
            "note": "Paired pregame outcomes only; a small sample cannot validate superiority.",
        },
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--feed", default="data/epl-match-center.json")
    p.add_argument("--ledger", default="data/research/epl-shadow-locked.json")
    args = p.parse_args()
    source = json.loads(Path(args.feed).read_text())
    path = Path(args.ledger)
    ledger = json.loads(path.read_text()) if path.exists() else {}
    updated = advance(source, ledger, datetime.now(timezone.utc))
    # Avoid unnecessary commits for ordinary unchanged polls.
    if not path.exists() or updated["locked"] != ledger.get("locked", {}) or updated["graded"] != ledger.get("graded", {}):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(updated, indent=2, sort_keys=True) + "\n")
    print(json.dumps(updated["summary"], sort_keys=True))


if __name__ == "__main__":
    main()
