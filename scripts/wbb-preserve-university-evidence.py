#!/usr/bin/env python3
"""Preserve earlier official women's date/opponent verifications safely.

The newer 363-school university scanner is sometimes unable to read sites
that a previous successful source pass could parse. Compare the established
2026-10-29 baseline with the fresh scan, and retain only historical rows whose
unique women's game ID, Eastern local date, current opponent, and official
HTTPS provenance still match. Prior home/away proof is deliberately NOT
carried forward without a source site field for comparison.

Never add games, invented tipoffs, venue claims, or guessed broadcasts.
"""
import collections
import datetime as dt
import json
import pathlib
import re
import subprocess
from zoneinfo import ZoneInfo

ROOT = pathlib.Path("data")
BASELINE = "23da984d8aabe8210dfec44b910b2e17ba43b621"
EVIDENCE = ROOT / "ncaaw-2026-27-official-schedule-bulk-evidence.json"
AUDIT = ROOT / "ncaaw-2026-27-official-schedule-bulk-audit.json"
SCHEDULE = ROOT / "ncaaw-schedules-2026-27.json"
REVIEW = ROOT / "ncaaw-2026-27-preserved-university-evidence-audit.json"
EASTERN = ZoneInfo("America/New_York")

def load(path):
    return json.loads(path.read_text(encoding="utf-8"))

def identity_text(v):
    s = re.sub(r"^\\s*(?:No\\.\\s*)?#?\\d{1,2}\\s+", "", str(v or ""), flags=re.I)
    s = re.sub(r"\\b(the|university|college|women's|womens)\\b", "", s, flags=re.I)
    return re.sub(r"[^a-z0-9]", "", s.lower())

def opponent_matches(a, b):
    x, y = identity_text(a), identity_text(b)
    if not x or not y:
        return False
    return x == y or (len(x) >= 5 and len(y) >= 5 and (x.startswith(y) or y.startswith(x)))

def date_of(stamp):
    value = dt.datetime.fromisoformat(str(stamp).replace("Z", "+00:00"))
    return value.astimezone(EASTERN).date().isoformat()

def run():
    historical = json.loads(subprocess.check_output(
        ["git", "show", BASELINE + ":" + EVIDENCE.as_posix()], text=True))
    fresh = load(EVIDENCE)
    calendar = load(SCHEDULE)
    meta = load(AUDIT)
    if (historical.get("gender") != "women" or fresh.get("gender") != "women"
            or calendar.get("gender") != "women"
            or historical.get("season") != "2026-27" or fresh.get("season") != "2026-27"
            or len(calendar.get("teams", {})) != 363):
        raise RuntimeError("Women's-only 2026-27 guard failed")
    if len(historical.get("rows", [])) < 7500:
        raise RuntimeError("Historical 7,555-row certification baseline unavailable")
    by_game = {}
    for tid, team in calendar["teams"].items():
        for g in team["games"]:
            key = (str(tid), str(g["id"]))
            if key in by_game:
                raise RuntimeError("Duplicate game on same women's team calendar: " + str(key))
            by_game[key] = g
    stored = {}
    for row in fresh.get("rows", []):
        key = (str(row.get("team_id")),str(row.get("game_id")))
        if key in stored:
            raise RuntimeError("Duplicate current university evidence for " + str(key))
        stored[key] = row
    restored = []
    skipped = collections.Counter()
    for old in historical["rows"]:
        key = (str(old.get("team_id")),str(old.get("game_id")))
        if key in stored:
            continue
        g = by_game.get(key)
        if not g:
            skipped["game_no_longer_on_team_schedule"] += 1
            continue
        if not str(old.get("source_url") or "").startswith("https://"):
            skipped["missing_official_https_citation"] += 1
            continue
        if (date_of(g.get("date")) != str(old.get("verified_date") or "") or
                not opponent_matches(g.get("opponent"), old.get("verified_opponent"))):
            skipped["date_or_opponent_changed"] += 1
            continue
        # The old source's full home/away parse is not necessarily retained
        # in each evidence row, so preserve only date and opponent claims.
        recovered = dict(old)
        recovered["verified_fields"] = ["scheduled_date", "opponent"]
        recovered["preserved_from_commit"] = BASELINE
        stored[key] = recovered
        restored.append(key)
        if not g.get("official_schedule_source_url"):
            g["official_schedule_source_url"] = old["source_url"]
            g["official_schedule_source_type"] = old.get("source_type") or "official_womens_university_schedule"
            g["official_schedule_verified_fields"] = recovered["verified_fields"]
    fresh["rows"] = list(stored.values())
    meta.update({
        "verified_school_count_including_prior": len({key[0] for key in stored}),
        "verified_team_game_rows_including_prior": len(stored),
        "verified_unique_game_ids": len({key[1] for key in stored}),
        "official_home_away_matched": sum("home_away" in r.get("verified_fields",[]) for r in stored.values()),
        "prior_certified_evidence_recovered": len(restored),
        "previously_certified_evidence_quarantined": dict(skipped),
        "current_scan_verified_school_count": meta.get("schools_with_matched_official_calendar"),
        "retention_policy": "Preserve dated official women's source evidence across temporary site failures only when current unique game ID, local date and opponent still match; old site claims are not carried forward."
    })
    review = {
        "season":"2026-27","gender":"women",
        "baseline_commit":BASELINE,
        "baseline_team_game_rows":len(historical["rows"]),
        "fresh_scan_team_game_rows":len(fresh["rows"])-len(restored),
        "safely_recovered_team_game_rows":len(restored),
        "quarantined_prior_rows_by_reason":dict(skipped),
        "merged_verified_team_game_rows":len(stored),
        "merged_verified_schools":len({key[0] for key in stored}),
        "removed_old_site_verification_on_recovered_rows":True
    }
    for p, payload in ((EVIDENCE,fresh),(SCHEDULE,calendar),(AUDIT,meta),(REVIEW,review)):
        content=json.dumps(payload,indent=2,ensure_ascii=False)+"\\n"
        if not p.exists() or p.read_text(encoding="utf-8") != content:
            p.write_text(content,encoding="utf-8")
    print("WBB UNIVERSITY HISTORICAL SOURCE RETENTION:",json.dumps(review))
    if review["merged_verified_team_game_rows"] < len(fresh["rows"])-len(restored):
        raise RuntimeError("Evidence retention lost previously verified source rows")

if __name__ == "__main__":
    run()
