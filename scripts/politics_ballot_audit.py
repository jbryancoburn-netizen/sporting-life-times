#!/usr/bin/env python3
"""Validate actual 2026 state government ballot transcriptions; no vote forecasts.

Only named official source documents may support ballot rows. FEC registration
and third-party race ratings never substitute for state election lists.
"""
from __future__ import annotations
import copy
import datetime as dt
import json
import pathlib
import re
from urllib.parse import urlsplit

ROOT = pathlib.Path(__file__).resolve().parents[1]
ALLOWED_SOURCES = {
    "NCSBE_2026_GENERAL": ("NC", "s3.amazonaws.com", "/dl.ncsbe.gov/Elections/2026/"),
    "FL_DOE_2026_GENERAL": ("FL", "dos.elections.myflorida.com", "/candidates/CanList.asp"),
    "CA_SOS_2026_GENERAL": ("CA", "elections.cdn.sos.ca.gov", "/statewide-elections/2026-general/"),
    "NV_SOS_2026_GENERAL": ("NV", "www.nvsos.gov", "/sos/elections/election-information/2026-election-information"),
    "WY_SOS_2026_GENERAL": ("WY", "sos.wyo.gov", "/Elections/Docs/2026/2026_WY_General_Election_Candidates.pdf"),
    "FL_DOE_2026_UNOPPOSED": ("FL", "dos.elections.myflorida.com", "/candidates/CanDetail.asp"),
    "MD_SBE_2026_HOUSE_GENERAL": ("MD", "elections.maryland.gov", "/elections/2026/general_candidates/2026_GG_statewide_candidatelist.html"),
}
HOUSE_SEATS = {"NC": 14, "FL": 28, "CA": 52, "NV": 4, "WY": 1, "MD": 8}
PARTIES = {"DEM", "REP", "LIB", "GRE", "NPA", "WRI", "IND", "FFP", "LPF", "CST", "OTH"}

def validate(data):
    if data.get("schema_version") != 1 or data.get("election_date") != "2026-11-03":
        raise ValueError("Unexpected ballot election or schema")
    if data.get("status") != "PARTIAL_OFFICIAL_GENERAL_BALLOT_RECORDS":
        raise ValueError("Unreviewed general-election ballot ledger")
    if data.get("model_eligible") is not False or data.get("nationwide_complete") is not False:
        raise ValueError("Never approve partial ballot records for modeling")
    try:
        dt.date.fromisoformat(data["reviewed_at"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("Missing valid review date") from exc
    sources = {}
    for src in data.get("sources", []):
        sid = src.get("id")
        if sid in sources or sid not in ALLOWED_SOURCES:
            raise ValueError("Unknown/duplicate official ballot source")
        state, host, prefix = ALLOWED_SOURCES[sid]
        url = urlsplit(src.get("url", ""))
        if src.get("state") != state or url.scheme != "https" or url.netloc.lower() != host or not url.path.startswith(prefix):
            raise ValueError("Ballot source location or state is not approved")
        if src.get("transcription_status") not in ("reviewed", "reviewed_partial", "not_transcribed"):
            raise ValueError("Unrecognized review status")
        sources[sid] = src
    if not sources:
        raise ValueError("Official source ledger is empty")
    race_ids = set()
    coverage = {}
    count_candidates = 0
    qualified_write_ins = 0
    for race in data.get("races", []):
        rid = race.get("id", "")
        state, office = race.get("state"), race.get("office")
        expected = state + ("-S" if office == "S" else "-"+str(race.get("district", ""))) if isinstance(state, str) else ""
        if rid in race_ids or rid != expected or office not in ("H", "S"):
            raise ValueError("Duplicate or malformed race")
        if office == "H":
            if not re.fullmatch(r"[0-9]{2}", race.get("district", "")):
                raise ValueError("Noncanonical House district")
            if not ((race["district"] == "00" and HOUSE_SEATS.get(state) == 1) or (1 <= int(race["district"]) <= HOUSE_SEATS.get(state, 0) and race["district"] != "00")):
                raise ValueError("House district not valid for this 2026 state")
        elif race.get("district") is not None:
            raise ValueError("Senate race must be statewide")
        sid = race.get("source_id")
        if sid not in sources or sources[sid]["state"] != state or sources[sid]["transcription_status"] == "not_transcribed":
            raise ValueError("Race lacks a reviewed state-government source")
        if race.get("verification") != "source_transcribed_as_of_review_date" or race.get("fec_identity_match_certified") is not False:
            raise ValueError("Uncertified candidate crosswalk disguised as verified")
        contest_status = race.get("contest_status", "general_ballot_listed")
        if contest_status not in ("general_ballot_listed", "unopposed_no_general_ballot"):
            raise ValueError("Unknown official-ballot appearance status")
        if contest_status == "unopposed_no_general_ballot":
            if rid != "FL-10" or sid != "FL_DOE_2026_UNOPPOSED" or len(race.get("candidates", [])) != 1:
                raise ValueError("Unopposed non-ballot office requires its own official state source")
        elif sid == "FL_DOE_2026_UNOPPOSED":
            raise ValueError("Unopposed candidate detail must not be called a general ballot contest")
        candidates = race.get("candidates", [])
        if not 1 <= len(candidates) <= 15:
            raise ValueError("Missing or implausible candidate slate")
        seen = set()
        for c in candidates:
            if set(c) != {"name", "party"}:
                raise ValueError("Keep only ballot name and party; no private contact fields")
            name, party = c.get("name"), c.get("party")
            if not isinstance(name, str) or not 2 <= len(name.strip()) <= 100 or not re.fullmatch(r"[A-Z]{3}", str(party)) or party not in PARTIES:
                raise ValueError("Invalid original candidate name or party")
            if name.casefold() in seen:
                raise ValueError("Duplicate candidate in one race")
            seen.add(name.casefold())
            if party == "WRI":
                qualified_write_ins += 1
        race_ids.add(rid)
        coverage.setdefault(state, {"house": 0, "senate": 0})["house" if office == "H" else "senate"] += 1
        count_candidates += len(candidates)
    for src in sources.values():
        if src["scope"] == "full_federal_house_and_senate_snapshot":
            c = coverage.get(src["state"], {})
            if c.get("house") != HOUSE_SEATS[src["state"]] or c.get("senate") != 1:
                raise ValueError("Claim of complete federal source transcription does not match state races")
    # Maryland has all 8 House races but no regular US Senate election in 2026.
    for src in sources.values():
        if src["scope"] == "full_house_snapshot_no_senate_2026":
            c = coverage.get(src["state"], {})
            if src["state"] != "MD" or c.get("house") != HOUSE_SEATS["MD"] or c.get("senate") != 0:
                raise ValueError("Maryland full House / no Senate 2026 classification is incomplete")
    house = sum(x["house"] for x in coverage.values())
    senate = sum(x["senate"] for x in coverage.values())
    # Florida 10 is absent from the linked qualified-candidate search page.
    # Do not infer that an unlisted district is uncontested or has no candidates.
    florida = {r["district"] for r in data.get("races", []) if r["state"] == "FL" and r["office"] == "H"}
    florida_unknown = sorted({f"{i:02d}" for i in range(1, 29)} - florida)
    if not florida_unknown and not (any(r.get("id")=="FL-10" and r.get("contest_status")=="unopposed_no_general_ballot" and r.get("source_id")=="FL_DOE_2026_UNOPPOSED" for r in data.get("races", []))):
        raise ValueError("Florida complete coverage requires an original unopposed-office record")
    if house >= 435:
        raise ValueError("National ballot coverage cannot be certified by partial-ledger validator")
    unopposed_nonballot = [r["id"] for r in data.get("races", []) if r.get("contest_status")=="unopposed_no_general_ballot"]
    return {
        "status": "PARTIAL_GOVERNMENT_SOURCE_BALLOTS_VALIDATED",
        "checked_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "source_reviewed_at": data["reviewed_at"],
        "official_source_links_located": len(sources),
        "states_with_transcribed_federal_contests": sorted(coverage),
        "house_contests_transcribed": house,
        "house_general_ballot_contests_transcribed": house - len(unopposed_nonballot),
        "unopposed_offices_without_general_ballot": unopposed_nonballot,
        "senate_contests_transcribed": senate,
        "candidate_ballot_entries": count_candidates,
        "qualified_write_in_entries_not_printed_on_ballot": qualified_write_ins,
        "florida_unverified_districts": florida_unknown,
        "state_coverage": {
            state: {**counts, "full_house_snapshot": counts["house"] == HOUSE_SEATS[state]}
            for state, counts in sorted(coverage.items())
        },
        "house_contests_unverified": 435-house,
        "fec_identity_matches_verified": 0,
        "all_435_house_races_covered": False,
        "2026_independent_forecast_certified": False,
        "certified_2026_probability_count": 0,
        "warning": "Official candidate records include state-qualified general ballot contestants, qualified write-ins, and Florida's separately sourced unopposed House office absent from the general ballot. Maryland entries exclude withdrawn or disqualified filings. These are dated government snapshots, not continually synchronized official ballots; all other states and model inputs remain unresolved. No original 2026 prediction is certified."
    }

def main():
    data = json.loads((ROOT / "politics-official-ballots.json").read_text(encoding="utf-8"))
    audited = validate(data)
    (ROOT / "politics-ballot-audit.json").write_text(json.dumps(audited, indent=2)+"\n",encoding="utf-8")
    print("Official ballot audit:",audited["house_contests_transcribed"],"House +",audited["senate_contests_transcribed"],"Senate,",audited["candidate_ballot_entries"],"candidates; 2026 probabilities: 0")

if __name__ == "__main__":
    main()
