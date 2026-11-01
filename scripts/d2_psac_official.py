#!/usr/bin/env python3
"""PSAC 2026-27 men's and women's basketball fixtures from official schedules.

No institutional ID is guessed: the 17 published 2026-27 PSAC calendars for
each sport map to exact season-registry team IDs. New fixtures require a
reciprocal date/opponent/home-away match from BOTH schools. Missing, partial
or contradictory schedules are quarantined. No score/arena/TV/stream inferred.
"""
from __future__ import annotations

import datetime as dt
import re
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT_URL = "https://psacsports.org/schedule.aspx?schedule="
MEN_IDS = (
    "bloomsburg", "california-pa", "clarion", "east-stroudsburg",
    "edinboro", "gannon", "indiana-pa", "kutztown", "lock-haven",
    "mansfield", "millersville", "pittsburgh-johnstown", "shepherd",
    "shippensburg", "slippery-rock", "west-chester", "seton-hill"
)
WOMEN_IDS = (
    "bloomsburg-university-of-pennsylvania",
    "pennsylvania-western-university-california",
    "pennsylvania-western-university-clarion",
    "east-stroudsburg-university-of-pennsylvania",
    "pennsylvania-western-university-edinboro", "gannon-university",
    "indiana-university-of-pennsylvania",
    "kutztown-university-of-pennsylvania",
    "lock-haven-university-of-pennsylvania",
    "mansfield-university-of-pennsylvania",
    "millersville-university-of-pennsylvania",
    "university-of-pittsburgh-johnstown", "shepherd-university",
    "shippensburg-university-of-pennsylvania",
    "slippery-rock-university-of-pennsylvania",
    "west-chester-university-of-pennsylvania", "seton-hill-university"
)
# Calendars 5961-5976 and 5977-5992 are the official league 16-school
# roster; Seton Hill has later source IDs 6034/6033. The provisional
# Lackawanna program is NOT an NCAA DII opponent in 2026-27.
LABELS = (
    "Bloomsburg", "California (Pa.)", "Clarion", "E. Stroudsburg",
    "Edinboro", "Gannon", "IUP", "Kutztown", "Lock Haven", "Mansfield",
    "Millersville", "Pitt-Johnstown", "Shepherd", "Shippensburg",
    "Slippery Rock", "West Chester", "Seton Hill"
)
SCHEDULE_IDS = {
    "men": tuple(range(5961, 5977)) + (6034,),
    "women": tuple(range(5977, 5993)) + (6033,),
}
CANONICAL = {
    "men": dict(zip(LABELS, MEN_IDS)),
    "women": dict(zip(LABELS, WOMEN_IDS)),
}
SCHOOLS = {
    gender: {sid: (LABELS[i], CANONICAL[gender][LABELS[i]])
             for i, sid in enumerate(schedules)}
    for gender, schedules in SCHEDULE_IDS.items()
}
ALIASES = {
    "bloomsburg": 0, "bloomsburg university": 0,
    "california pa": 1, "california pennsylvania": 1, "cal u": 1,
    "clarion": 2, "clarion university": 2,
    "e stroudsburg": 3, "east stroudsburg": 3, "east stroudsburg university": 3,
    "edinboro": 4, "edinboro university": 4,
    "gannon": 5, "gannon university": 5,
    "iup": 6, "indiana pa": 6, "indiana university of pennsylvania": 6,
    "kutztown": 7, "kutztown university": 7,
    "lock haven": 8, "lock haven university": 8,
    "mansfield": 9, "mansfield university": 9,
    "millersville": 10, "millersville university": 10,
    "pitt johnstown": 11, "pittsburgh johnstown": 11,
    "university of pittsburgh johnstown": 11,
    "shepherd": 12, "shepherd university": 12,
    "shippensburg": 13, "shippensburg university": 13,
    "slippery rock": 14, "slippery rock university": 14,
    "west chester": 15, "west chester university": 15,
    "seton hill": 16, "seton hill university": 16,
}
assert all(len(v) == 17 and len(set(v)) == 17 for v in SCHEDULE_IDS.values())
assert all(len(v) == 17 and len(set(v)) == 17 for v in (MEN_IDS, WOMEN_IDS))


def normal(value):
    value = " ".join(str(value or "").lower().split())
    value = re.sub(r"^(?:at|vs\.?|versus)\s+", "", value)
    value = re.sub(r"[^a-z0-9 ]", " ", value)
    return " ".join(value.split())


def opponent_id(name, gender):
    pos = ALIASES.get(normal(name))
    return (MEN_IDS if gender == "men" else WOMEN_IDS)[pos] if pos is not None else None


def eastern_tipoff(value):
    """All PSAC campuses are ET; noon/midnight and malformed AM/PM are exact."""
    text = " ".join(str(value or "").upper().split())
    match = re.fullmatch(r"(1[0-2]|0?[1-9]):([0-5]\d)\s*([AP])\.?M\.?", text)
    if not match:
        return None
    hour = int(match[1]) % 12 + (12 if match[3] == "P" else 0)
    return f"{hour % 12 or 12}:{match[2]} {'PM' if hour >= 12 else 'AM'} ET"


def read_official_html(sid):
    url = ROOT_URL + str(sid)
    request = urllib.request.Request(url, headers={
        "User-Agent": "SportingLifeTimes/1.0 (+https://github.com/jbryancoburn-netizen/sporting-life-times)",
        "Accept": "text/html",
    })
    with urllib.request.urlopen(request, timeout=25) as response:
        return response.read().decode("utf-8", "replace")


def parse_school_calendar(html, gender, schedule_id):
    from bs4 import BeautifulSoup
    label, owner = SCHOOLS[gender][schedule_id]
    soup = BeautifulSoup(html, "html.parser")
    full = normal(soup.get_text(" ", strip=True))
    sport = "men s basketball" if gender == "men" else "women s basketball"
    expected = normal(label)
    if "2026 27" not in full or not re.search(r"\b" + sport + r"\b", full) or expected not in full:
        raise ValueError(f"wrong PSAC school, year or sport for {schedule_id}")
    longest = []
    for table in soup.select("table"):
        headers = normal(" ".join(c.get_text(" ", strip=True) for c in table.select("th")))
        if not all(word in headers for word in ("date", "conference", "opponent", "location", "time")):
            continue
        rows = []
        for tr in table.select("tr"):
            cells = [" ".join(c.get_text(" ", strip=True).split())
                     for c in tr.find_all(["td", "th"], recursive=False)]
            if len(cells) < 5:
                continue
            rawdate, starred, rawopponent, location, rawtime = cells[:5]
            if not re.fullmatch(r"\d{1,2}/\d{1,2}/202[67]", rawdate):
                continue
            when = dt.datetime.strptime(rawdate, "%m/%d/%Y").date()
            if not (dt.date(2026, 11, 1) <= when <= dt.date(2027, 3, 5)):
                continue
            other = opponent_id(rawopponent, gender)
            if other is None or other == owner or rawopponent.lower().startswith(("vs ", "vs.")):
                # This also excludes Lackawanna's non-member schedule.
                continue
            away, home = ((owner, other) if rawopponent.lower().startswith("at ")
                          else (other, owner))
            rows.append({
                "date": when.isoformat(), "away": away, "home": home,
                "tipoff": eastern_tipoff(rawtime), "city": location,
                "source_team": owner, "source_url": ROOT_URL + str(schedule_id),
                "conference_marked": "*" in starred,
            })
        if len(rows) > len(longest):
            longest = rows
    unique = {}
    for row in longest:
        key = row["date"], row["away"], row["home"]
        previous = unique.get(key)
        if previous and previous["tipoff"] != row["tipoff"]:
            raise ValueError(f"{schedule_id}: conflicting duplicated matchup {key}")
        unique[key] = row
    result = list(unique.values())
    if not (12 <= len(result) <= 26):
        raise ValueError(f"{schedule_id}: only {len(result)} PSAC-institution games")
    return result


def reconcile(calendars, games, teams, today):
    seen = defaultdict(list)
    for owner, rows in calendars.items():
        for row in rows:
            if owner != row["source_team"]:
                raise ValueError("PSAC official source identity mismatch")
            seen[(row["date"], row["away"], row["home"])].append(row)
    result = {"school_calendars": len(calendars),
              "school_game_entries": sum(len(v) for v in calendars.values()),
              "reciprocal_confirmations": 0, "new_games": 0,
              "existing_games_enriched": 0, "single_sided": 0,
              "conflicting_identity": 0, "conflicting_tipoffs": 0,
              "tipoff_unannounced": 0, "discrepancies": []}
    lookup = defaultdict(list)
    for game in games.values():
        lookup[(game.get("date"), frozenset((game.get("away"), game.get("home"))))].append(game)
    for (date, away, home), rows in sorted(seen.items()):
        owners = {x["source_team"] for x in rows}
        if len(rows) != 2 or owners != {away, home}:
            result["single_sided"] += 1
            if len(result["discrepancies"]) < 20:
                result["discrepancies"].append({"date": date, "away": away, "home": home,
                                                "reason": "not corroborated by both members"})
            continue
        if (away not in teams or home not in teams or away == home
                or teams[away].get("not_eligible_for_dii_elo")
                or teams[home].get("not_eligible_for_dii_elo")):
            result["conflicting_identity"] += 1
            continue
        previous = lookup.get((date, frozenset((away, home))), [])
        if len(previous) > 1 or (previous and (previous[0]["away"], previous[0]["home"]) != (away, home)):
            result["conflicting_identity"] += 1
            continue
        result["reciprocal_confirmations"] += 1
        if previous:
            game = previous[0]
            result["existing_games_enriched"] += 1
        elif date >= today.isoformat():
            ident = "psac-2026-27-" + date + "-" + away + "-" + home
            if ident in games:
                raise ValueError("PSAC official fixture id collision")
            game = {
                "id": ident, "date": date, "away": away, "home": home,
                "status": "scheduled", "away_score": None, "home_score": None,
                "neutral": False, "elo_eligible": True, "verified": True,
                "source": "PSAC 2026-27 reciprocal official school schedules",
                "source_url": rows[0]["source_url"],
            }
            games[ident] = game
            lookup[(date, frozenset((away, home)))].append(game)
            result["new_games"] += 1
        else:
            # Never infer a past outcome from future/past calendars alone.
            continue
        game["fixture_verified"] = True
        game["conference_game"] = True
        game["psac_school_sources"] = sorted(x["source_url"] for x in rows)
        tips = {x["tipoff"] for x in rows if x["tipoff"]}
        if len(tips) > 1:
            result["conflicting_tipoffs"] += 1
            if len(result["discrepancies"]) < 20:
                result["discrepancies"].append({"date": date, "away": away, "home": home,
                                                "reason": "official schools publish different times"})
        elif tips:
            tip = next(iter(tips))
            if game.get("start_time") and game["start_time"] != tip:
                result["conflicting_tipoffs"] += 1
            else:
                game["start_time"] = tip
                game["tipoff_source_url"] = rows[0]["source_url"]
        else:
            result["tipoff_unannounced"] += 1
        host_row = next((r for r in rows if r["source_team"] == home), None)
        if host_row and host_row.get("city"):
            game["venue_city"] = host_row["city"]
        # Source pages do NOT identify the actual gym, TV, or stream.
        # They are never manufactured from league-wide defaults.
    return result


def enrich_psac(gender, games, teams, today):
    """Season-wide scan; invoked daily or when PSAC has not yet been bootstrapped."""
    if gender not in SCHOOLS:
        raise ValueError("DII PSAC expects men or women")
    registry = SCHOOLS[gender]
    ids = {x[1] for x in registry.values()}
    missing = sorted(ids - set(teams))
    if missing:
        return {"status": "withheld: canonical season IDs absent",
                "missing_ids": missing, "source": "PSAC official 2026-27 school calendars",
                "reciprocal_confirmations": 0}
    calendars, errors = {}, []
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(read_official_html, sid): (sid, label, team)
                   for sid, (label, team) in registry.items()}
        for future in as_completed(futures):
            sid, label, team = futures[future]
            try:
                calendars[team] = parse_school_calendar(future.result(), gender, sid)
            except Exception as exc:
                errors.append({"school": label, "calendar": sid, "reason": str(exc)[:160]})
    # A site outage never invents a result or erases previously certified games.
    if len(calendars) < 12:
        return {"status": "withheld: insufficient official school calendars",
                "source": "PSAC official 2026-27 school calendars",
                "school_calendars": len(calendars), "unavailable": errors,
                "reciprocal_confirmations": 0}
    audit = reconcile(calendars, games, teams, today)
    audit["source"] = "PSAC official 2026-27 school calendars"
    audit["unavailable"] = sorted(errors, key=lambda x: x["school"])
    audit["status"] = "partial: two-school-confirmed matchups only; unverified held back"
    audit["nonmember_lackawanna_excluded"] = True
    return audit


# The university explicitly confirmed that BOTH basketball teams' 2026-27
# "home" games move off campus while Keystone Hall undergoes renovations.
# This is a season-specific exception; it must never carry to 2027-28.
KUTZTOWN_TEMP_HOME = {
    "venue": "Beaver Athletics and Wellness Center · Reading, PA",
    "source": (
        "https://kubears.com/news/2026/7/24/general-kutztown-announces-2026-27-"
        "competition-plan-during-keystone-hall-renovation.aspx"
    ),
    "school_schedules": {
        "men": "https://kubears.com/sports/mens-basketball/schedule/2026-2027?grid=true",
        "women": "https://kubears.com/sports/womens-basketball/schedule/2026-2027?grid=true",
    },
}


def enrich_psac_temporary_court(gender, games):
    """Exact school/calendar/season-qualified Kutztown venue correction.

    Require PSAC match already attested by BOTH PSAC school calendars.
    Source identifies the actual temporary basketball facility. Never assign
    a venue to other schools, neutral games, or an unverified opponent.
    """
    if gender not in ("men", "women"):
        raise ValueError("wrong PSAC basketball gender")
    kt = MEN_IDS[7] if gender == "men" else WOMEN_IDS[7]
    result = {"school": kt, "venue": KUTZTOWN_TEMP_HOME["venue"],
              "source_url": KUTZTOWN_TEMP_HOME["source"],
              "confirmed": 0, "newly_enriched": 0, "already_correct": 0,
              "conflicted": 0, "skipped_unverified": 0, "conflicts": []}
    for game in games.values():
        if game.get("home") != kt:
            continue
        if (not str(game.get("date", "")).startswith(("2026-", "2027-"))
                or not ("2026-11-01" <= str(game.get("date", "")) <= "2027-03-05")
                or not game.get("conference_game") or game.get("neutral")
                or not game.get("fixture_verified")
                or len(set(game.get("psac_school_sources") or [])) != 2):
            result["skipped_unverified"] += 1
            continue
        if set((game.get("away"), game.get("home"))) == {kt}:
            result["skipped_unverified"] += 1
            continue
        old = game.get("venue") or ""
        if old and " ".join(old.lower().split()) != " ".join(KUTZTOWN_TEMP_HOME["venue"].lower().split()):
            # Contradictory game-specific venue evidence is NOT overwritten.
            result["conflicted"] += 1
            if len(result["conflicts"]) < 10:
                result["conflicts"].append({
                    "date": game.get("date"), "away": game.get("away"),
                    "prior_venue": old,
                })
            continue
        result["confirmed"] += 1
        if old:
            result["already_correct"] += 1
        else:
            game["venue"] = KUTZTOWN_TEMP_HOME["venue"]
            result["newly_enriched"] += 1
        game["venue_source_url"] = KUTZTOWN_TEMP_HOME["source"]
        game["venue_source_school"] = kt
        game["venue_source_season"] = "2026-27"
        game["venue_calendar_url"] = KUTZTOWN_TEMP_HOME["school_schedules"][gender]
    return result
