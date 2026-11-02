#!/usr/bin/env python3
"""Offline preflight for staged DII official-school calendar captures.

This checks source integrity, not independent full-season certification.
It does not edit any files, assign school membership, or create games.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DEFAULT = ROOT / "data" / "d2-official-school-grids-2026-27.json"
VALID_ROLES = {"home", "away", "neutral"}
START, END = dt.date(2026, 7, 1), dt.date(2027, 6, 30)


def official_url(value):
    if not isinstance(value, str):
        return False
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc) and "." in parsed.netloc


def check_registry(data):
    errors, warnings = [], []
    schools = data.get("schools")
    if data.get("season") != "2026-27":
        errors.append("Registry season must be 2026-27")
    if not isinstance(schools, list):
        return ["schools must be a list"], [], {}
    seen_schools = set()
    gender_totals = Counter()
    fixture_total = 0
    for index, school in enumerate(schools):
        label = f"schools[{index}]"
        if not isinstance(school, dict):
            errors.append(f"{label}: school must be an object")
            continue
        gender, owner = school.get("gender"), school.get("owner_id")
        if gender not in ("men", "women") or not isinstance(owner, str) or not owner.strip():
            errors.append(f"{label}: invalid gender or owner_id")
            continue
        label = f"{gender}/{owner}"
        identity = (gender, owner)
        if identity in seen_schools:
            errors.append(f"{label}: duplicated school capture")
        seen_schools.add(identity)
        if not official_url(school.get("source_url")):
            errors.append(f"{label}: primary source must be an https URL")
        fixtures = school.get("fixtures")
        if not isinstance(fixtures, list):
            errors.append(f"{label}: fixtures must be a list")
            continue
        if not fixtures:
            warnings.append(f"{label}: empty calendar capture")
        seen_rows = set()
        gender_totals[gender] += 1
        for n, row in enumerate(fixtures):
            location = f"{label}/fixtures[{n}]"
            fixture_total += 1
            if not isinstance(row, dict):
                errors.append(f"{location}: fixture must be an object")
                continue
            date, role, opponent = row.get("date"), row.get("role"), row.get("opponent")
            try:
                parsed_date = dt.date.fromisoformat(date)
                if not START <= parsed_date <= END:
                    errors.append(f"{location}: date is outside 2026-27 season")
            except (ValueError, TypeError):
                errors.append(f"{location}: invalid ISO game date")
            if role not in VALID_ROLES:
                errors.append(f"{location}: invalid role {role!r}")
            if not isinstance(opponent, str) or not opponent.strip():
                errors.append(f"{location}: missing literal opponent")
                continue
            key = (date, opponent.strip().casefold(), role)
            if key in seen_rows:
                errors.append(f"{location}: duplicate dated opponent/role row")
            seen_rows.add(key)
            tipoff = row.get("start_time", "")
            if not isinstance(tipoff, str):
                errors.append(f"{location}: start_time must be a string")
            elif not tipoff.strip():
                warnings.append(f"{location}: no verified posted tipoff")
    assertions = data.get("certification_assertions", [])
    if not isinstance(assertions, list):
        errors.append("certification_assertions must be a list")
    else:
        for i, record in enumerate(assertions):
            if not isinstance(record, dict) or not record.get("reviewed_by") or not record.get("independent_source_url"):
                errors.append(f"certification_assertions[{i}]: missing reviewer or independent source")
    summary = {"schools": len(seen_schools), "men": gender_totals["men"],
               "women": gender_totals["women"], "source_rows": fixture_total,
               "assertions": len(assertions) if isinstance(assertions, list) else 0}
    return errors, warnings, summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--path", type=Path, default=DEFAULT)
    args = parser.parse_args()
    try:
        data = json.loads(args.path.read_text(encoding="utf-8"))
        errors, warnings, summary = check_registry(data)
    except (OSError, ValueError) as error:
        print(f"FAIL: {error}")
        return 1
    print(json.dumps({"status": "FAIL" if errors else "PASS", "summary": summary,
                      "errors": errors, "warnings": warnings[:20],
                      "total_warnings": len(warnings)}, indent=2))
    print("NOTE: Passing preflight does not certify any school or validate ledger reconciliation.")
    return int(bool(errors))


if __name__ == "__main__":
    raise SystemExit(main())
