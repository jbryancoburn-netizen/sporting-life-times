#!/usr/bin/env python3
"""GLIAC 2026-27 basketball: 22 official school schedule sources, both sexes.

Only the exact DATE + both verified member team IDs + mutually corroborated
home/away designation produces a fixture. Ambiguous or unavailable source
pages never manufacture a basketball game. League calendar time zones are
NOT established from the displayed plain-time table: raw posted tipoff is
kept separate from independently verified Eastern timestamps.
"""
from __future__ import annotations

import datetime as dt
import re
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

URL = "https://gliac.org/schedule.aspx?schedule="
SCHOOLS = {
    "men": {
        2593: ("Davenport", "davenport"),
        2594: ("Ferris State", "ferris-state"),
        2595: ("Grand Valley State", "grand-valley-state"),
        2597: ("Lake Superior State", "lake-superior-state"),
        2598: ("Michigan Tech", "michigan-tech"),
        2599: ("Northern Michigan", "northern-michigan"),
        2600: ("Parkside", "parkside-wisconsin-parkside"),
        # The school itself appears in every other GLIAC schedule. 2601 is
        # kept as a guarded source candidate, NOT assumed valid before a
        # title/season/team check proves it.
        2601: ("Purdue Northwest", "purdue-northwest"),
        2602: ("Roosevelt", "roosevelt"),
        2603: ("Saginaw Valley State", "saginaw-valley-state"),
        2604: ("Wayne State University", "wayne-state-mi"),
    },
    "women": {
        2605: ("Davenport", "davenport-university"),
        2607: ("Ferris State", "ferris-state-university"),
        2608: ("Grand Valley State", "grand-valley-state-university"),
        2609: ("Lake Superior State", "lake-superior-state-university"),
        2611: ("Michigan Tech", "michigan-technological-university"),
        2612: ("Northern Michigan", "northern-michigan-university"),
        2613: ("Parkside", "university-of-wisconsin-parkside"),
        2614: ("Purdue Northwest", "purdue-university-northwest"),
        2615: ("Roosevelt", "roosevelt-university"),
        2616: ("Saginaw Valley State", "saginaw-valley-state-university"),
        2617: ("Wayne State University", "wayne-state-university-michigan"),
    },
}
IDENTITIES = {
    gender: {
        # All aliases resolve only to a conference member in the exact gender.
        "davenport": maps[next(k for k, (label, _) in maps.items() if label == "Davenport")][1],
        "ferris state": maps[next(k for k, (label, _) in maps.items() if label == "Ferris State")][1],
        "grand valley state": maps[next(k for k, (label, _) in maps.items() if label == "Grand Valley State")][1],
        "lake superior state": maps[next(k for k, (label, _) in maps.items() if label == "Lake Superior State")][1],
        "michigan tech": maps[next(k for k, (label, _) in maps.items() if label == "Michigan Tech")][1],
        "northern michigan": maps[next(k for k, (label, _) in maps.items() if label == "Northern Michigan")][1],
        "parkside": maps[next(k for k, (label, _) in maps.items() if label == "Parkside")][1],
        "purdue northwest": maps[next(k for k, (label, _) in maps.items() if label == "Purdue Northwest")][1],
        "roosevelt": maps[next(k for k, (label, _) in maps.items() if label == "Roosevelt")][1],
        "saginaw valley state": maps[next(k for k, (label, _) in maps.items() if label == "Saginaw Valley State")][1],
        "wayne state university": maps[next(k for k, (label, _) in maps.items() if label == "Wayne State University")][1],
    }
    for gender, maps in SCHOOLS.items()
}
for g in SCHOOLS:
    IDENTITIES[g]["wayne state"] = IDENTITIES[g]["wayne state university"]
    IDENTITIES[g]["uw parkside"] = IDENTITIES[g]["parkside"]
    IDENTITIES[g]["university of wisconsin parkside"] = IDENTITIES[g]["parkside"]
    IDENTITIES[g]["purdue university northwest"] = IDENTITIES[g]["purdue northwest"]
    IDENTITIES[g]["gvsu"] = IDENTITIES[g]["grand valley state"]
    IDENTITIES[g]["lssu"] = IDENTITIES[g]["lake superior state"]
    IDENTITIES[g]["nmu"] = IDENTITIES[g]["northern michigan"]
    IDENTITIES[g]["mtu"] = IDENTITIES[g]["michigan tech"]
    # University athletics' official grids often use the full legal name,
    # while the conference publishes a shortened school label.
    for official,conference in (
        ("davenport university","davenport"),
        ("ferris state university","ferris state"),
        ("grand valley state university","grand valley state"),
        ("lake superior state university","lake superior state"),
        ("michigan technological university","michigan tech"),
        ("northern michigan university","northern michigan"),
        ("roosevelt university","roosevelt"),
        ("saginaw valley state university","saginaw valley state"),
    ):
        IDENTITIES[g][official] = IDENTITIES[g][conference]


def clean(value):
    return " ".join(str(value or "").strip().split())


def norm(value):
    value = clean(value).lower()
    value = re.sub(r"^(?:at|vs\.?|versus)\s+", "", value)
    value = re.sub(r"[^a-z0-9 ]+", " ", value)
    return " ".join(value.split())


def member_id(label, gender):
    return IDENTITIES[gender].get(norm(label))


def posted_tipoff(raw):
    """Preserve plain published wall-clock time; DO NOT pretend it's ET."""
    raw = clean(raw).upper()
    m = re.fullmatch(r"(1[0-2]|0?[1-9]):([0-5]\d)\s*([AP])\.?M\.?", raw)
    if not m:
        return None
    return f"{int(m[1])}:{m[2]} {m[3]}M"


def get_html(schedule_id):
    request = urllib.request.Request(URL + str(schedule_id), headers={
        "User-Agent": "SportingLifeTimes/1.0 (+https://github.com/jbryancoburn-netizen/sporting-life-times)",
        "Accept": "text/html",
    })
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.read().decode("utf-8", "replace")


def read_calendar(html, gender, schedule_id):
    from bs4 import BeautifulSoup
    name, institution = SCHOOLS[gender][schedule_id]
    soup = BeautifulSoup(html, "html.parser")
    full = norm(soup.get_text(" ", strip=True))
    sport = "men s basketball" if gender == "men" else "women s basketball"
    if ("2026 27" not in full or not re.search(r"\b" + sport + r"\b", full)
            or not re.search(r"\b" + norm(name) + r"\b", full)):
        raise ValueError(f"incorrect school/season/sport on official GLIAC calendar {schedule_id}")
    longest = []
    for table in soup.select("table"):
        heads = norm(" ".join(th.get_text(" ", strip=True) for th in table.select("th")))
        if not all(word in heads for word in ("date", "opponent", "result", "location")):
            continue
        candidates = []
        for tr in table.select("tr"):
            cells = [clean(v.get_text(" ", strip=True))
                     for v in tr.find_all(["td", "th"], recursive=False)]
            if len(cells) < 4:
                continue
            date_text, opponent, time_result, location = cells[:4]
            if not re.fullmatch(r"\d{1,2}/\d{1,2}/202[67]", date_text):
                continue
            date = dt.datetime.strptime(date_text, "%m/%d/%Y").date()
            if date < dt.date(2026, 11, 1) or date > dt.date(2027, 3, 1):
                continue
            if opponent.lower().startswith(("vs ", "vs.")):
                continue
            guest = member_id(opponent, gender)
            if not guest or guest == institution:
                continue
            if opponent.lower().startswith("at "):
                away, home = institution, guest
            else:
                away, home = guest, institution
            candidates.append({
                "date": date.isoformat(), "away": away, "home": home,
                "tipoff_as_posted": posted_tipoff(time_result),
                "location_as_posted": location,
                "source_team": institution,
                "source_url": URL + str(schedule_id),
            })
        if len(candidates) > len(longest):
            longest = candidates
    distinct = {}
    for item in longest:
        key = (item["date"], item["away"], item["home"])
        old = distinct.get(key)
        if old and old["tipoff_as_posted"] != item["tipoff_as_posted"]:
            raise ValueError(f"{schedule_id}: different posted times for same matchup {key}")
        distinct[key] = item
    games = list(distinct.values())
    if not 9 <= len(games) <= 29:
        raise ValueError(f"{schedule_id}: only {len(games)} 2026-27 GLIAC games in official calendar")
    return games


def reconcile(calendars, games, teams, today):
    groups = defaultdict(list)
    for institution, rows in calendars.items():
        for row in rows:
            if row["source_team"] != institution:
                raise ValueError("GLIAC school source identity mismatch")
            groups[(row["date"], row["away"], row["home"])].append(row)
    index = defaultdict(list)
    for game in games.values():
        index[(game.get("date"), frozenset((game.get("away"), game.get("home"))))].append(game)
    report = {"school_calendars": len(calendars),
              "school_entries": sum(len(r) for r in calendars.values()),
              "two_school_matchups": 0, "new_games": 0, "existing_enriched": 0,
              "single_sided": 0, "identity_or_venue_conflicts": 0,
              "time_disagreements": 0, "consistent_posted_tipoffs": 0,
              "evidence_examples": []}
    for (date, away, home), records in sorted(groups.items()):
        owners = {x["source_team"] for x in records}
        if len(records) != 2 or owners != {away, home}:
            report["single_sided"] += 1
            if len(report["evidence_examples"]) < 18:
                report["evidence_examples"].append({
                    "date": date, "away": away, "home": home,
                    "issue": "one-sided or conflicting home/away calendars"})
            continue
        if (away == home or away not in teams or home not in teams or
                teams[away].get("not_eligible_for_dii_elo") or
                teams[home].get("not_eligible_for_dii_elo")):
            report["identity_or_venue_conflicts"] += 1
            continue
        matching = index.get((date, frozenset((away, home))), [])
        if len(matching) > 1 or (matching and
                (matching[0]["away"], matching[0]["home"]) != (away, home)):
            report["identity_or_venue_conflicts"] += 1
            continue
        report["two_school_matchups"] += 1
        if matching:
            game = matching[0]
            report["existing_enriched"] += 1
        elif date >= today.isoformat():
            game_id = "gliac-2026-27-" + date + "-" + away + "-" + home
            if game_id in games:
                raise ValueError("Duplicate GLIAC official game ID")
            game = {"id": game_id, "date": date, "away": away, "home": home,
                    "status": "scheduled", "away_score": None, "home_score": None,
                    "elo_eligible": True, "verified": True, "neutral": False,
                    "source": "GLIAC 2026-27 reciprocal official school calendars",
                    "source_url": records[0]["source_url"]}
            games[game_id] = game
            index[(date, frozenset((away, home)))].append(game)
            report["new_games"] += 1
        else:
            # An official schedule may verify a historical matchup, not its
            # actual score, so do not create unsourced past contests.
            continue
        game["fixture_verified"] = True
        game["conference_game"] = True
        game["official_schedule_sources"] = sorted(x["source_url"] for x in records)
        posted = {x["tipoff_as_posted"] for x in records if x["tipoff_as_posted"]}
        if len(posted) == 1:
            game["tipoff_as_posted"] = next(iter(posted))
            game["posted_tipoff_timezone"] = "not established by GLIAC source"
            game["posted_tipoff_sources"] = sorted(x["source_url"] for x in records)
            report["consistent_posted_tipoffs"] += 1
        elif len(posted) > 1:
            report["time_disagreements"] += 1
            if len(report["evidence_examples"]) < 18:
                report["evidence_examples"].append({
                    "date": date, "away": away, "home": home,
                    "issue": "school calendars show different, timezone-unlabeled times"})
        # Official 4-column tables say only a city, address, or TBA. Never
        # interpret one of those values as a confirmed named home arena.
        city = next((x["location_as_posted"] for x in records
                     if x["source_team"] == home and x.get("location_as_posted")), None)
        if city and "tba" not in city.lower() and not game.get("venue_city"):
            game["venue_city"] = city
    return report


def enrich_gliac(gender, games, teams, today):
    if gender not in SCHOOLS:
        raise ValueError("GLIAC import requires independent men/women ledgers")
    source_ids = {x[1] for x in SCHOOLS[gender].values()}
    missing = sorted(source_ids - set(teams))
    if missing:
        return {"source": "GLIAC official 2026-27 member calendars",
                "status": "withheld: 2026-27 source institutional IDs do not exist",
                "missing": missing, "two_school_matchups": 0}
    records, failures = {}, []
    with ThreadPoolExecutor(max_workers=5) as pool:
        jobs = {pool.submit(get_html, number): (number, name, key)
                for number, (name, key) in SCHOOLS[gender].items()}
        for job in as_completed(jobs):
            num, name, institution = jobs[job]
            try:
                records[institution] = read_calendar(job.result(), gender, num)
            except Exception as exc:
                failures.append({"school": name, "schedule": num, "issue": str(exc)[:150]})
    if len(records) < 7:
        return {"source": "GLIAC official 2026-27 member calendars",
                "status": "withheld: fewer than seven usable school schedule sources",
                "school_calendars": len(records), "unavailable": failures,
                "two_school_matchups": 0}
    report = reconcile(records, games, teams, today)
    report["source"] = "GLIAC official 2026-27 member calendars"
    report["status"] = "partial verification; only exact reciprocal fixtures published"
    report["unavailable"] = sorted(failures, key=lambda v: v["school"])
    report["time_zone_policy"] = "raw posted game times are not presented as verified Eastern time"
    return report
