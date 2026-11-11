#!/usr/bin/env python3
"""Independent integrity gate: every preserved eligible MBB forecast must be audited.

Do not substitute postgame predictions for missing original pretipoff captures.
"""
from collections import Counter
from retro_spread_accuracy import DATA, load, pretipoff_capture_is_valid

def key(row, date_key="date", id_key="id"):
    return (row[date_key], row[id_key])

def main():
    archive = load(DATA / "retro-pregame-archive-2026-27.json")
    captures = load(DATA / "mbb-retro-pregame-spreads-2026-27.json")
    finals = load(DATA / "ncaam-2026-27-retro-primary.json")
    report = load(DATA / "retro-spread-accuracy-2026-27.json")
    if any(data.get("season") != "2026-27" for data in (archive, captures, finals, report)):
        raise AssertionError("Season mismatch in RETRO accuracy coverage gate")
    saved = archive["predictions"]
    saved_by_key = {key(p): p for p in saved}
    if len(saved_by_key) != len(saved):
        raise AssertionError("Duplicate forecasts in frozen archive")
    verified_captures = [p for p in captures["forecasts"] if pretipoff_capture_is_valid(p)]
    not_archived = [p["game_id"] for p in verified_captures
                    if key(p, "game_date", "game_id") not in saved_by_key]
    if not_archived:
        raise AssertionError("Verified pretipoff captures absent from accuracy archive: " + str(not_archived[:15]))
    final_by_key = {key(g): g for g in finals["events"]}
    scored = report["games"]
    scored_by_key = {key(g): g for g in scored}
    if len(scored_by_key) != len(scored):
        raise AssertionError("Duplicate games in scored accuracy report")
    mismatches = set(report.get("excluded_orientation_mismatches", []))
    expected = set()
    actual_mismatches = set()
    for k, prediction in saved_by_key.items():
        final = final_by_key.get(k)
        if not final:
            continue
        if (str(prediction.get("home_id")) != str(final.get("home_id")) or
                str(prediction.get("away_id")) != str(final.get("away_id"))):
            actual_mismatches.add(k[1])
            continue
        expected.add(k)
        scored_row = scored_by_key.get(k)
        if scored_row is None:
            raise AssertionError("Confirmed final missing from accuracy report: " + str(k))
        margin = final["home_score"] - final["away_score"]
        if (scored_row["actual_home_margin"] != margin or
                scored_row["predicted_home_margin"] != prediction["projected_home_margin"] or
                scored_row["home_id"] != prediction["home_id"] or
                scored_row["away_id"] != prediction["away_id"]):
            raise AssertionError("Reported game not aligned with immutable forecast: " + str(k))
    if set(scored_by_key) != expected:
        raise AssertionError("Scored accuracy report includes unverified or extra games")
    if mismatches != actual_mismatches:
        raise AssertionError("Orientation exception registry does not match actual identity errors")
    by_date = Counter(g["date"] for g in scored)
    if {d: m["games"] for d, m in report["by_date"].items()} != dict(by_date):
        raise AssertionError("Daily accuracy counts do not match scored games")
    if report["summary"]["games"] != len(scored):
        raise AssertionError("Summary game count does not match actual scored games")
    if report["archived_predictions"] != len(saved):
        raise AssertionError("Archive count does not match published coverage")
    print("PASS: RETRO accuracy coverage:", len(verified_captures),
          "valid captured forecasts;", len(saved), "frozen;",
          len(scored), "scored;", len(actual_mismatches),
          "excluded identity exceptions")

if __name__ == "__main__":
    main()
