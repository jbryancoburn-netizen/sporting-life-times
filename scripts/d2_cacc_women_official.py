#!/usr/bin/env python3
"""2026-27 women's CACC games: corroborate both official university calendars.

The CACC publishes each school calendar separately. Only the same date and
opponent HOME/AWAY pairing attested by BOTH members may become a game. An
unavailable schedule reduces coverage; it never causes fabricated fixtures.
Monroe, exhibitions, neutral showcases and unknown opponents are excluded.
"""
from __future__ import annotations

import datetime as dt
import re
from collections import defaultdict

from d2_cacc_official import BASE, read_page, eastern_time

# Exact 2026-27 CACC school-calendar IDs, checked against caccathletics.org.
# Canonical team IDs come from the women's 2026-27 school directory.
SCHOOLS = {
    2378: ("Wilmington", "wilmington-university-delaware"),
    2390: ("Goldey-Beacom", "goldey-beacom-college"),
    2391: ("Caldwell", "caldwell-university"),
    2392: ("Chestnut Hill", "chestnut-hill-college"),
    2393: ("Dominican", "dominican-university-new-york"),
    2394: ("Bridgeport", "university-of-bridgeport"),
    2395: ("Jefferson", "thomas-jefferson-university"),
    2396: ("Post", "post-university"),
    2397: ("Holy Family", "holy-family-university"),
    2398: ("Felician", "felician-university"),
    2399: ("Georgian Court", "georgian-court-university"),
}
# Known CACC athletics names, never a global fuzzy matchup.
ALIASES = {
    "wilmington": "wilmington-university-delaware",
    "wilmington university": "wilmington-university-delaware",
    "wilmington university del": "wilmington-university-delaware",
    "wilmington university delaware": "wilmington-university-delaware",
    "goldey beacom": "goldey-beacom-college",
    "goldey beacom college": "goldey-beacom-college",
    "caldwell": "caldwell-university",
    "caldwell university": "caldwell-university",
    "chestnut hill": "chestnut-hill-college",
    "chestnut hill college": "chestnut-hill-college",
    "dominican": "dominican-university-new-york",
    "dominican university new york": "dominican-university-new-york",
    "bridgeport": "university-of-bridgeport",
    "university of bridgeport": "university-of-bridgeport",
    "jefferson": "thomas-jefferson-university",
    "thomas jefferson university": "thomas-jefferson-university",
    "post": "post-university",
    "post university": "post-university",
    "holy family": "holy-family-university",
    "holy family university": "holy-family-university",
    "felician": "felician-university",
    "felician university": "felician-university",
    "georgian court": "georgian-court-university",
    "georgian court university": "georgian-court-university",
}


def normalized(text):
    text = re.sub(r"^(?:at|vs\.?|versus)\s+", "", " ".join(str(text or "").strip().lower().split()))
    text = re.sub(r"[^a-z0-9 ]+", " ", text)
    return " ".join(text.split())


def parse_women_calendar(html, owner, schedule_id):
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    full = " ".join(soup.get_text(" ", strip=True).lower().split())
    school = SCHOOLS[schedule_id][0].lower()
    if ("2026-27" not in full and "2026-2027" not in full) or "women's basketball" not in full or school not in full:
        raise ValueError(f"Incorrect CACC women's calendar {schedule_id}")
    largest = []
    for table in soup.select("table"):
        header = " ".join(cell.get_text(" ", strip=True).lower() for cell in table.select("th"))
        if not all(word in header for word in ("date", "opponent", "location")):
            continue
        rows = []
        for tr in table.select("tr"):
            cells = [" ".join(c.get_text(" ", strip=True).split())
                     for c in tr.find_all(["td", "th"], recursive=False)]
            if len(cells) < 5:
                continue
            day, time, opponent, city = cells[:4]
            if not re.fullmatch(r"\d{1,2}/\d{1,2}/202[67]", day):
                continue
            date = dt.datetime.strptime(day, "%m/%d/%Y").date()
            if not (dt.date(2026, 11, 1) <= date <= dt.date(2027, 2, 28)):
                continue
            # The opposite school must be a confirmed CACC member, not
            # a schedule-only provisional program or a nonconference guest.
            raw = opponent.lower().strip()
            if raw.startswith(("vs ", "vs.")):
                continue
            other = ALIASES.get(normalized(opponent))
            if not other or other == owner:
                continue
            away, home = (owner, other) if raw.startswith("at ") else (other, owner)
            rows.append({"date": date.isoformat(), "away": away, "home": home,
                         "tipoff": eastern_time(time), "city": city,
                         "source_team": owner, "source_url": BASE + str(schedule_id)})
        if len(rows) > len(largest):
            largest = rows

    # Source pages occasionally repeat identical fixtures. Conflicting
    # duplicates cannot be assigned a verified time.
    by_match = {}
    for row in largest:
        key = (row["date"], row["away"], row["home"])
        before = by_match.get(key)
        if not before:
            by_match[key] = row
        elif before["tipoff"] != row["tipoff"]:
            raise ValueError(f"Conflicting duplicate women's CACC fixture {key}")
        elif not before.get("city") and row.get("city"):
            by_match[key] = row
    rows = list(by_match.values())
    if len(rows) < 13 or len(rows) > 26:
        raise ValueError(f"2026-27 CACC women's calendar {schedule_id}: only {len(rows)} member matchups")
    return rows


def reconcile_women_cacc(calendars, games, teams, today):
    grouped = defaultdict(list)
    for owner, rows in calendars.items():
        for row in rows:
            if row["source_team"] != owner:
                raise ValueError("CACC women's source provenance does not match team")
            grouped[(row["date"], row["away"], row["home"])].append(row)
    audit = {"calendars_read": len(calendars),
             "calendar_rows": sum(len(x) for x in calendars.values()),
             "two_school_matches": 0, "games_added": 0, "games_enriched": 0,
             "single_school_only": 0, "identity_conflicts": 0,
             "time_conflicts": 0, "missing_tipoffs": 0,
             "unresolved_examples": []}
    for key, rows in sorted(grouped.items()):
        date, away, home = key
        owners = {r["source_team"] for r in rows}
        if len(rows) != 2 or owners != {away, home}:
            audit["single_school_only"] += 1
            if len(audit["unresolved_examples"]) < 12:
                audit["unresolved_examples"].append({"date": date, "away": away, "home": home,
                                                     "reason": "missing reciprocal university calendar"})
            continue
        if any(x not in teams or teams[x].get("not_eligible_for_dii_elo") for x in (away, home)):
            audit["identity_conflicts"] += 1
            continue
        collision = [g for g in games.values() if g.get("date") == date and
                     {g.get("away"), g.get("home")} == {away, home}]
        if len(collision) > 1 or (collision and (collision[0]["away"], collision[0]["home"]) != (away, home)):
            audit["identity_conflicts"] += 1
            continue
        audit["two_school_matches"] += 1
        if collision:
            game = collision[0]
            audit["games_enriched"] += 1
        elif date >= today.isoformat():
            gid = "cacc-women-2026-27-" + date + "-" + away + "-" + home
            if gid in games:
                raise ValueError("CACC women fixture ID collision")
            game = {"id": gid, "date": date, "away": away, "home": home,
                    "status": "scheduled", "away_score": None, "home_score": None,
                    "verified": True, "elo_eligible": True, "neutral": False,
                    "source": "CACC two independent women's athletics calendars",
                    "source_url": rows[0]["source_url"]}
            games[gid] = game
            audit["games_added"] += 1
        else:
            # A past fixture without an NCAA result is not a final.
            continue
        # A future schedule verifies the fixture, NOT a published final
        # score. Only the NCAA/verified recap can authenticate final results.
        game["fixture_verified"] = True
        if game.get("status") != "final":
            game["verified"] = True
        game["conference_game"] = True
        game["conference_schedule_sources"] = sorted(x["source_url"] for x in rows)
        times = {r["tipoff"] for r in rows if r["tipoff"]}
        if len(times) > 1:
            audit["time_conflicts"] += 1
            if len(audit["unresolved_examples"]) < 12:
                audit["unresolved_examples"].append({"date": date, "away": away, "home": home,
                                                     "reason": "opposing official tipoff times"})
        elif len(times) == 1:
            tip = next(iter(times))
            if game.get("start_time") and game["start_time"] != tip:
                audit["time_conflicts"] += 1
            else:
                game["start_time"] = tip
                game["tipoff_source_url"] = rows[0]["source_url"]
        else:
            audit["missing_tipoffs"] += 1
        # Conference location is usually a city, NOT a named arena.
        city = next((r["city"] for r in rows if r["source_team"] == home and r["city"]), "")
        if city:
            game["venue_city"] = city
    return audit


def enrich_cacc_women(games, teams, today):
    missing = [name for _, name in SCHOOLS.values() if name not in teams]
    if missing:
        return {"status": "withheld: women's directory identity mismatch",
                "missing_school_ids": missing, "two_school_matches": 0}
    calendars = {}
    failures = []
    for sid, (label, ident) in SCHOOLS.items():
        try:
            calendars[ident] = parse_women_calendar(read_page(BASE + str(sid)), ident, sid)
        except Exception as exc:
            failures.append({"school": label, "schedule": sid, "issue": str(exc)[:150]})
    # An unavailable source cannot be counted as an authenticated fixture.
    # Continue only with the verified two-team subset of accessible schools.
    if len(calendars) < 7:
        return {"status": "withheld: fewer than seven current CACC school calendars",
                "calendars_read": len(calendars), "unavailable_calendars": failures,
                "two_school_matches": 0}
    audit = reconcile_women_cacc(calendars, games, teams, today)
    audit["status"] = ("partial two-school verification: "
                       "unavailable school calendars and disputed fixtures withheld")
    audit["unavailable_calendars"] = failures
    audit["source"] = "CACC official 2026-27 women's basketball university calendars"
    audit["no_blanket_streaming_assumption"] = True
    return audit
