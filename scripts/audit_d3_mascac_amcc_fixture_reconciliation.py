#!/usr/bin/env python3
"""Read-only reconciliation of 2026-27 MASCAC/AMCC opponent-sourced DIII fixtures.

Does not modify fixtures, Elo, results, source status or workflow files.
Exits nonzero if any source-backed entry is missing, conflicts, or is ambiguous.
"""
import argparse
import datetime as dt
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
EVIDENCE = DATA / "d3-mascac-amcc-cross-source-recovery-2026-27.md"

# Explicit orientation means away/home, never inferred from an unprefixed opponent.
# The three WPI entries are intentionally "unknown" until venue is corroborated.
RECORDS = [
    ("2026-11-17", "UMass Boston", "Fitchburg State", "away"),
    ("2026-11-30", "UMass Boston", "Bridgewater State", "home"),
    ("2026-11-14", "UMass Boston", "Salem State", "home"),
    ("2026-11-13", "WPI", "Worcester State", "unknown"),
    ("2026-11-14", "WPI", "Framingham State", "unknown"),
    ("2026-11-24", "WPI", "Fitchburg State", "unknown"),
    ("2027-01-30", "Mount Aloysius", "La Roche", "away"),
    ("2027-02-06", "Mount Aloysius", "Pitt-Bradford", "home"),
    ("2027-02-10", "Mount Aloysius", "Penn State Behrend", "home"),
    ("2027-02-13", "Mount Aloysius", "Penn State Altoona", "away"),
    ("2027-02-20", "Mount Aloysius", "Carlow", "home"),
    ("2026-11-24", "Allegheny", "Penn State Behrend", "away"),
    ("2026-12-12", "Allegheny", "Carlow", "home"),
    ("2026-11-07", "Franciscan", "Pitt-Bradford", "away"),
    ("2026-11-14", "Franciscan", "Penn State Behrend", "away"),
    ("2026-11-17", "Franciscan", "Penn State Altoona", "home"),
]
ALIASES = {
    "UMass Boston": ["umass boston", "university of massachusetts boston"],
    "WPI": ["wpi", "worcester polytechnic institute"],
    "Mount Aloysius": ["mount aloysius", "mount aloysius college"],
    "Allegheny": ["allegheny", "allegheny college"],
    "Franciscan": ["franciscan", "franciscan university of steubenville"],
    "Fitchburg State": ["fitchburg state", "fitchburg state university"],
    "Bridgewater State": ["bridgewater state", "bridgewater state university"],
    "Salem State": ["salem state", "salem state university"],
    "Worcester State": ["worcester state", "worcester state university"],
    "Framingham State": ["framingham state", "framingham state university"],
    "La Roche": ["la roche", "la roche university"],
    "Pitt-Bradford": ["pitt bradford", "university of pittsburgh bradford"],
    "Penn State Behrend": ["penn state behrend", "pennsylvania state univ erie the behrend college"],
    "Penn State Altoona": ["penn state altoona", "penn state university altoona"],
    "Carlow": ["carlow", "carlow university"],
}
def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", str(s).lower()).strip()

def team_id(name, teams):
    choices = {norm(n) for n in ALIASES[name]}
    hits = [int(t["ncaa_org_id"]) for t in teams
            if str(t.get("ncaa_org_id", "")).isdigit()
            and (norm(t.get("name", "")) in choices)]
    if len(set(hits)) != 1:
        raise ValueError(f"Cannot safely identify {name}: {hits}")
    return hits[0]

def main():
    assert len(RECORDS) == 16
    evidence = EVIDENCE.read_text()
    source_rows = [x for x in evidence.splitlines() if x.startswith("| ") and "https://" in x]
    if len(source_rows) != 16:
        raise ValueError(f"Expected 16 official source rows, found {len(source_rows)}")
    for date, owner, other, _ in RECORDS:
        dt.date.fromisoformat(date)
        formatted = f"{dt.date.fromisoformat(date):%b} {dt.date.fromisoformat(date).day}, {dt.date.fromisoformat(date):%Y}"
        if not any(formatted in x and other.lower() in x.lower() for x in source_rows):
            raise ValueError(f"Evidence missing for {date}: {owner} / {other}")

    teams = json.loads((DATA / "d3-men-2026-27.json").read_text())["teams"]
    # Honor NCAA identity; if roster schema differs, refuse rather than guess.
    ids = {name: team_id(name, teams) for _, a, b, _ in RECORDS for name in (a, b)}
    ledger = json.loads((DATA / "d3-men-official-fixtures-2026-27.json").read_text())
    fixtures = ledger["fixtures"]
    report = []
    for day, owner, other, orientation in RECORDS:
        pair = {ids[owner], ids[other]}
        candidates = [x for x in fixtures if x.get("date") == day and
                      {int(x.get("away_org_id") or -1),
                       int(x.get("home_org_id") or -1)} == pair]
        if not candidates:
            state = "missing_in_published_fixture_ledger"
        elif len(candidates) > 1:
            state = "duplicate_fixture_conflict"
        elif orientation == "unknown":
            state = "matched_pair_date_site_needs_independent_check"
        else:
            x = candidates[0]
            correct = (int(x.get("home_org_id") or -1) == ids[owner]) if orientation == "home" else (
                int(x.get("away_org_id") or -1) == ids[owner])
            state = "matched" if correct else "home_away_conflict"
        report.append({"date": day, "publisher": owner, "opponent": other,
                       "site_from_publisher": orientation, "status": state,
                       "existing_game_ids": [x.get("id") or x.get("game_id") for x in candidates]})
    print(json.dumps({"scope": "read_only", "source_rows": len(RECORDS),
                      "matched": sum(x["status"] == "matched" for x in report),
                      "requires_attention": [x for x in report if x["status"] != "matched"],
                      "games": report}, indent=2))
    if any(x["status"] != "matched" for x in report):
        raise SystemExit(1)

if __name__ == "__main__":
    main()
