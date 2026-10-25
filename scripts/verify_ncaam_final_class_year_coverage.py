#!/usr/bin/env python3
"""Verify every player in the 2,014-ID class-year recovery population is accounted for.

Verified academic years and documented unresolved exceptions are separate.
This does NOT authorize historical identity joins or certify experimental Elo.
"""
import csv
import json
from pathlib import Path

DATA=Path(__file__).resolve().parents[1]/"data"
queue=json.loads((DATA/"ncaam-2026-27-final-489-unclassified-targets.json").read_text())
crosswalk=json.loads((DATA/"ncaam-2026-27-direct-player-crosswalk.json").read_text())
exceptions=json.loads((DATA/"ncaam-2026-27-final-class-year-exceptions.json").read_text())
with (DATA/"ncaam-2026-27-school-roster-class-years.csv").open(newline="",encoding="utf-8") as f:
    rows=list(csv.DictReader(f))
ids=[r["current_athlete_id"] for r in rows]
assert len(ids)==len(set(ids)), "Duplicated officially classified player ID"
assert len(crosswalk["unlinked_espn_ids"])==2014, "Original recovery cohort changed"
cohort={str(x) for x in crosswalk["unlinked_espn_ids"]}
assert set(ids)<=cohort, "Official class-year CSV includes outside-cohort ID"
exc=exceptions["items"]
excids=[x["id"] for x in exc]
assert len(excids)==len(set(excids)), "Duplicated exception ID"
assert set(excids)<=cohort, "Exception outside the target population"
assert not set(ids)&set(excids), "Classified ID still reported as unresolved"
assert set(ids)|set(excids)==cohort, "Unaccounted ID in class-year recovery population"
qids={x["current_athlete_id"] for x in queue["players"]}
assert qids & set(excids)==set(excids), "Final exception was not in last-489 queue"
assert exceptions["remaining_count"]==len(exc)
assert exceptions["verified_records"]==len(rows)
assert all(r["class_year"].strip() and r["official_roster_url"].startswith("https://") for r in rows)
print(f"PASS: {len(rows)} classified + {len(exc)} documented exceptions = {len(cohort)} IDs")
print("NOTICE: complete accounting is not complete academic-year verification or player-value Elo certification.")
