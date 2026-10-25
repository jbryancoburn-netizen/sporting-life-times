#!/usr/bin/env python3
"""Ensure third-party academic-year research never silently overrides official evidence."""
import json
from pathlib import Path

data = Path(__file__).resolve().parents[1] / "data"
official = json.loads((data / "ncaam-2026-27-final-class-year-exceptions.json").read_text())
research = json.loads((data / "ncaam-2026-27-class-year-third-party-research.json").read_text())
official_ids = {str(item["id"]) for item in official["items"]}
seen = set()
assert research["status"] == "RESEARCH_ONLY_THIRD_PARTY_UNCONFIRMED_OFFICIAL_CLASS_YEAR"
assert research["research_matches"] == len(research["observations"])
for item in research["observations"]:
    ident = str(item["id"])
    assert ident not in seen and ident in official_ids, "Research-only player is not in exceptions"
    seen.add(ident)
    assert item["officially_verified"] is False
    assert item["eligible_for_official_class_year_merge"] is False
    assert item["source_url"].startswith("https://")
    assert item["reported_class"] in {"FR", "SO", "JR", "SR", "GR", "5TH"}
for item in research["special_cases"]:
    assert str(item["id"]) in official_ids
    assert item["academic_class_year"] is None
    assert item["do_not_infer_class_year"] is True
assert official["remaining_count"] == len(official["items"])
print(f"PASS: {len(seen)} third-party research leads preserved without certifying any of {len(official_ids)} official exceptions")
