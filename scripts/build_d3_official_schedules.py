#!/usr/bin/env python3
"""DIII official university basketball calendar importer: 2026-27 nationwide crawl.

Never guess team identities, conditional games, actual Eastern time, or scores.
A source calendar is only an available calendar, NOT certified complete.
"""
import argparse
import concurrent.futures
import datetime as dt
import json
import re
import urllib.request
from urllib.parse import urlsplit
from collections import defaultdict, Counter
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SEASON_START = dt.date(2026, 11, 6)
SEASON_END = dt.date(2027, 4, 15)
HEADERS = {"User-Agent": "SportingLifeTimes/1.0 (NCAA public schedule audit)",
           "Accept": "text/html"}

# Individually confirmed official university URLs take precedence over automatic discovery.
# orgId is the year-specific NCAA directory identity, not an ESPN game/team ID.
SOURCES = {
    "men": [
        (30037, "https://trinethunder.com/sports/mens-basketball/schedule/2026-27?grid=true"),
        (286, "https://athletics.hope.edu/sports/mens-basketball/schedule/2026-27?grid=true"),
        (45, "https://babsonathletics.com/sports/mens-basketball/schedule/2026-27?grid=true"),
        (114, "https://calvinknights.com/sports/mens-basketball/schedule/2026-27?grid=true"),
        (398, "https://mitathletics.com/sports/mens-basketball/schedule/2026-27?grid=true"),
        (122, "https://athletics.case.edu/sports/mens-basketball/schedule/2026-27?grid=true"),
        (713, "https://bantamsports.com/sports/mens-basketball/schedule/2026-27?grid=true"),
        (715, "https://trinitytigers.com/sports/mens-basketball/schedule/2026-27?grid=true"),
        (21, "https://almascots.com/sports/mens-basketball/schedule/2026-27?grid=true"),
        (4, "https://adrianbulldogs.com/sports/mens-basketball/schedule/2026-27?grid=true"),
        (656, "https://corsairathletics.com/sports/mens-basketball/schedule/2026-27?grid=true"),
        (326, "https://hornets.kzoo.edu/sports/mens-basketball/schedule/2026-27?grid=true"),
        (520, "https://battlingbishops.com/sports/mens-basketball/schedule/2026-27?grid=true"),
    ],
    "women": [
        (30037, "https://trinethunder.com/sports/womens-basketball/schedule/2026-27?grid=true"),
        (286, "https://athletics.hope.edu/sports/womens-basketball/schedule/2026-27?grid=true"),
        (45, "https://babsonathletics.com/sports/womens-basketball/schedule/2026-27?grid=true"),
        (114, "https://calvinknights.com/sports/womens-basketball/schedule/2026-27?grid=true"),
        (713, "https://bantamsports.com/sports/womens-basketball/schedule/2026-27?grid=true"),
        (271, "https://hsuathletics.com/sports/womens-basketball/schedule/2026-27?grid=true"),
        (122, "https://athletics.case.edu/sports/womens-basketball/schedule/2026-27?grid=true"),
        (326, "https://hornets.kzoo.edu/sports/womens-basketball/schedule/2026-27?grid=true"),
        (21, "https://almascots.com/sports/womens-basketball/schedule/2026-27?grid=true"),
        (4, "https://adrianbulldogs.com/sports/womens-basketball/schedule/2026-27?grid=true"),
        (398, "https://mitathletics.com/sports/womens-basketball/schedule/2026-27?grid=true"),
        (1203, "https://cruathletics.com/sports/womens-basketball/schedule/2026-2027?grid=true"),
        (770, "https://westconnathletics.com/sports/womens-basketball/schedule/2026-27?grid=true"),
        (163, "https://camelathletics.com/sports/womens-basketball/schedule/2026-27?grid=true"),
        (722, "https://coastguardathletics.com/sports/womens-basketball/schedule/2026-27?grid=true"),
        (142, "https://cmsathletics.org/sports/womens-basketball/schedule/2026-27?grid=true"),
        (300, "https://www.iwusports.com/sports/womens-basketball/schedule/2026-27?grid=true"),
    ],
}
# Institutional nicknames are used only when explicitly unambiguous.
# "Trinity" deliberately has no alias: Connecticut and Texas are distinct.
ALIASES = {
    "trine": 30037, "hope": 286, "babson": 45, "calvin": 114,
    "mit": 398, "case western": 122, "case western reserve": 122,
    "kalamazoo": 326, "alma": 21, "albion": 15, "adrian": 4,
    "hardin simmons": 271,
    "trinity college conn": 713, "trinity college ct": 713,
    "trinity university tx": 715, "trinity university texas": 715,
    "olivet": 525, "the university of olivet": 525,
    "lasell": 8486, "oswego state": 530, "wpi": 808, "umass dartmouth": 656,
    "anderson ind": 939, "anderson in": 939, "redlands": 567,
    "brandeis": 73, "coast guard": 722, "franklin": 2694,
    "saint johns": 602, "st johns": 602,
    "saint johns minnesota": 602, "st johns minnesota": 602,
    "johnson and wales university": 22626, "uw eau claire": 793,
    "uw oshkosh": 798, "uw stevens point": 802,
}
# Official athletics domains independently verified against 2026–27 school sites.
# The NCAA member directory sometimes exposes an old generic campus URL.
# Every candidate still must pass exact 2026–27, sex, row and NCAA-opponent tests.
OFFICIAL_ATHLETICS_HOST_OVERRIDE = {
    53: "beloitcollegeathletics.com", 549: "sagehens.com",
    1450: "wcbluejays.wcmo.edu",
    58: "athletics.baruch.cuny.edu", 82: "gobrynmawr.com",
    151: "colbyathletics.com", 1111: "greenvillepanthers.com",
    69: "athletics.bowdoin.edu", 117: "athletics.capital.edu",
    126: "athletics.central.edu", 168: "www.cortlandreddragons.com",
    192: "udspartans.com", 266: "gogusties.com",
    267: "athletics.hamilton.edu", 336: "kingscollegeathletics.com",
    372: "luthernorse.com", 376: "athletics.macalester.edu",
    420: "athletics.middlebury.edu", 496: "athletics.northpark.edu",
    581: "uofrathletics.com", 673: "springfieldcollegepride.com",
    764: "athletics.wesleyan.edu", 773: "mcdanielathletics.com",
    780: "whitmanblues.com", 1094: "athletics.georgefox.edu",
    1112: "guilfordquakers.com", 1203: "cruathletics.com",
    1451: "athletics.westminster.edu", 1461: "wilmingtonquakers.com",
    16142: "athletics.misericordia.edu", 30041: "salemcollegeathletics.com",
    30064: "athletics.stvincent.edu",
}

# Published 2026-27 team-specific pages on OFFICIAL NCAA member conferences.
# A conference source is reported separately from the school's own calendar.
# IDs were individually checked against conference page headings, not assumed
# from neighboring season IDs.
OFFICIAL_CONFERENCE_SCHEDULES = {
    "men": {
        53: ("https://midwestconference.org/schedule.aspx?schedule=3999", "Beloit"),
        218: ("https://sliac.org/schedule.aspx?schedule=2031", "Eureka"),
        684: ("https://cnesports.org/schedule.aspx?schedule=4107", "Suffolk"),
        64: ("https://sliac.org/schedule.aspx?schedule=2030", "Blackburn"),
        119: ("https://uaasports.info/schedule.aspx?schedule=1162", "Carnegie Mellon"),
        525: ("https://miaa.org/schedule.aspx?schedule=2283", "Olivet"),
    },
    "women": {
        53: ("https://midwestconference.org/schedule.aspx?schedule=3989", "Beloit"),
        218: ("https://sliac.org/schedule.aspx?schedule=2038", "Eureka"),
        449: ("https://newmacsports.com/schedule.aspx?schedule=3965", "Mount Holyoke"),
        64: ("https://sliac.org/schedule.aspx?schedule=2029", "Blackburn"),
        119: ("https://uaasports.info/schedule.aspx?schedule=1154", "Carnegie Mellon"),
        525: ("https://miaa.org/schedule.aspx?schedule=2274", "Olivet"),
    },
}

DATE = re.compile(
    r"^([A-Za-z]+)\s+(\d{1,2}),?\s+(2026|2027)(?:\s+\([^)]+\))?$")
MONTHS = {m: i for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June", "July",
     "August", "September", "October", "November", "December"], 1)}
BAD_OPPONENT = re.compile(
    r"(?:\bor\b|tba|to be (?:determined|announced)|winner of|"
    r"\bvs\.?\b.+\bvs\.?\b|round of|semifinal|championship|tournament|"
    r"exhibition|scrimmage|junior varsity|\bjv\b)", re.I)


def compact(s):
    return " ".join(str(s or "").replace("\xa0", " ").split())


def key(s):
    s = compact(s).lower().replace("&", " and ")
    s = re.sub(r"\b(?:the|university|college|of|at)\b", " ", s)
    return "".join(re.findall(r"[a-z0-9]+", s))


def official_index(teams):
    by_org = {int(t["ncaa_org_id"]): t for t in teams
              if t.get("membership_year") == 2027 and t.get("d3_confirmed")}
    exact = defaultdict(set)
    for org, t in by_org.items():
        exact[key(t["name"])].add(org)
    return by_org, exact


def resolve(label, by_org, exact):
    label = compact(label)
    if not label or BAD_OPPONENT.search(label):
        return None
    x = key(label)
    ids = exact.get(x, set())
    if len(ids) == 1:
        return next(iter(ids))
    if len(ids) > 1:
        return None
    normalized = compact(label).lower().replace(".", "").replace("(", " ").replace(")", " ")
    normalized = " ".join(normalized.replace("-", " ").split())
    org = ALIASES.get(normalized)
    return org if org in by_org else None


def calendar_date(s):
    m = DATE.match(compact(s))
    if not m:
        return None
    month = MONTHS.get(m[1].title())
    if not month:
        return None
    try:
        value = dt.date(int(m[3]), month, int(m[2]))
    except ValueError:
        return None
    return value.isoformat() if SEASON_START <= value <= SEASON_END else None


def eligible_row(cells):
    if len(cells) < 5:
        return False
    return bool(calendar_date(cells[0]) and
                compact(cells[2]).lower() in ("home", "away", "neutral"))


def parse_calendar(html, gender, owner, url, by_org, exact):
    doc = BeautifulSoup(html, "html.parser")
    visible = compact(doc.get_text(" ", strip=True)).lower()
    title = compact(doc.title.get_text(" ", strip=True)) if doc.title else ""
    # Require a year/sport-specific headline rather than unrelated sidebar links.
    # Important: "men's basketball" is a substring of "women's basketball".
    headlines = " ".join(compact(h.get_text(" ", strip=True)) for h in doc.select("h1")[:3])
    identity_text = (title + " " + headlines).lower().replace("’", "'")
    if not re.search(r"2026\s*[-–]\s*(?:27|2027)", identity_text):
        raise ValueError("No 2026–27 season in the actual page title/heading")
    if gender == "men":
        # Some all-male athletic programs (e.g., Wabash) title the page
        # "Basketball Schedule" rather than "Men's Basketball Schedule".
        # The official, gender-specific URL + season-heading + dated grid
        # must ALL agree; never accept this exception on a women's path.
        mens_path = "/sports/mens-basketball/schedule" in urlsplit(url).path.lower()
        explicit_men = bool(re.search(r"(?<![a-z])men's\s+basketball", identity_text))
        basketball_schedule = bool(re.search(r"\bbasketball\s+schedule\b", identity_text))
        if ("women's basketball" in identity_text or
                not (explicit_men or (mens_path and basketball_schedule))):
            raise ValueError("Wrong men's sport or women's calendar")
    if gender == "women":
        womens_path = "/sports/womens-basketball/schedule" in urlsplit(url).path.lower()
        explicit_women = bool(re.search(r"women's\s+basketball", identity_text))
        basketball_schedule = bool(re.search(r"\bbasketball\s+schedule\b", identity_text))
        if ("men's basketball" in identity_text and not explicit_women) or not (
                explicit_women or (womens_path and basketball_schedule)):
            raise ValueError("Wrong women's sport or men's calendar")
    matches = []
    inspected = 0
    omitted = defaultdict(int)
    for table in doc.select("table"):
        header = " ".join(compact(t.get_text(" ", strip=True)).lower()
                          for t in table.select("th"))
        if not all(k in header for k in ("date", "time", "opponent", "location")):
            continue
        for tr in table.select("tr"):
            cells = [compact(c.get_text(" ", strip=True))
                     for c in tr.find_all(["td", "th"], recursive=False)]
            if not eligible_row(cells):
                continue
            inspected += 1
            date, time, at, opponent, location = cells[:5]
            # School grids mix scrimmages/exhibitions with regular fixtures.
            # Never publish them as games, even when the opponent is a DIII member.
            result_text = cells[8] if len(cells) > 8 else ""
            tournament_text = cells[7] if len(cells) > 7 else ""
            if re.search(r"\b(scrimmage|exhibition|exh\.?|joint practice)\b",
                         " ".join((time, opponent, tournament_text, result_text)), re.I):
                omitted["preseason_or_exhibition"] += 1
                continue
            opponent_id = resolve(opponent, by_org, exact)
            if not opponent_id or opponent_id == owner:
                omitted["unknown_or_conditional_opponent"] += 1
                continue
            at = at.lower()
            # At neutral sites, source team does not claim home-court advantage.
            away = owner if at == "away" else opponent_id
            home = opponent_id if at == "away" else owner
            site = compact(location)
            parts = [compact(x) for x in site.split(" / ", 1)]
            venue = parts[1] if len(parts) == 2 else ""
            tv = cells[5] if len(cells) > 5 else ""
            radio = cells[6] if len(cells) > 6 else ""
            tournament = cells[7] if len(cells) > 7 else ""
            # Do not treat an icon's text ("Image") as a confirmed TV network.
            if tv.lower() in ("image", "video", "watch", "-"):
                tv = ""
            if radio.lower() in ("image", "audio", "listen", "-"):
                radio = ""
            matches.append({
                "date": calendar_date(date), "away_org_id": away,
                "home_org_id": home, "neutral": at == "neutral",
                "source_owner_org_id": owner, "source_url": url,
                "source_kind": "official_school",
                "tipoff_as_posted": compact(time), "venue": venue,
                "venue_location": parts[0], "network_as_posted": tv,
                "radio_as_posted": radio, "tournament": tournament,
            })
    if inspected < 4:
        raise ValueError(f"Fewer than 4 readable grid rows ({inspected}); no publish")
    if len(matches) < 3:
        raise ValueError(f"Only {len(matches)} eligible matches from {inspected} rows; no publish")
    return matches, {"owner_org_id": owner, "source_url": url,
                     "readable_rows": inspected, "verified_member_opponents": len(matches),
                     "excluded_rows": dict(omitted), "status": "parsed"}



def parse_conference_calendar(html, gender, owner, url, subject, by_org, exact):
    """Read an explicitly selected OFFICIAL conference team season table.

    Conference-hosted calendars can cover a member whose school domain is
    blocked, but cannot retroactively certify that school's athletics website.
    """
    doc = BeautifulSoup(html, "html.parser")
    heads = " ".join(compact(h.get_text(" ", strip=True))
                     for h in doc.select("h1, h2, h3")[:7])
    title = compact(doc.title.get_text(" ", strip=True)) if doc.title else ""
    identity = (heads + " " + title).lower().replace("’", "'")
    if not re.search(r"2026\s*[-–]\s*(?:27|2027)", identity):
        raise ValueError("Conference calendar wrong season")
    expected = ("women's basketball" if gender == "women" else "men's basketball")
    if expected not in identity:
        raise ValueError("Conference calendar wrong basketball gender")
    if gender == "men" and "women's basketball" in identity:
        raise ValueError("Conference calendar women's sport on men's source")
    if key(subject) not in key(heads or title):
        raise ValueError("Conference page does not identify expected member")
    entries, inspected, excluded = [], 0, defaultdict(int)
    for table in doc.select("table"):
        heads = [compact(x.get_text(" ", strip=True)).lower()
                 for x in table.select("thead th")]
        if not heads:
            first = table.select_one("tr")
            heads = [compact(x.get_text(" ", strip=True)).lower()
                     for x in first.find_all("th", recursive=False)] if first else []
        def column(name):
            return next((i for i, x in enumerate(heads) if name in x), None)
        idx_date, idx_opponent = column("date"), column("opponent")
        idx_loc = column("location")
        idx_time = next((i for i, x in enumerate(heads)
                         if "time" in x or "result" in x), None)
        if idx_date is None or idx_opponent is None or idx_time is None:
            continue
        for tr in table.select("tbody tr") or table.select("tr"):
            cells = [compact(x.get_text(" ", strip=True))
                     for x in tr.find_all(["td", "th"], recursive=False)]
            if max(idx_date, idx_opponent, idx_time) >= len(cells):
                continue
            raw_date = cells[idx_date]
            if not re.fullmatch(r"\d{1,2}/\d{1,2}/202[67]", raw_date):
                continue
            try:
                date = dt.datetime.strptime(raw_date, "%m/%d/%Y").date()
            except ValueError:
                continue
            if date < SEASON_START or date > SEASON_END:
                continue
            inspected += 1
            opponent = cells[idx_opponent]
            if BAD_OPPONENT.search(opponent):
                excluded["conditional_or_unverified_opponent"] += 1
                continue
            neutral = bool(re.match(r"(?i)^(?:vs\.?|versus)\s+", opponent))
            away_site = bool(re.match(r"(?i)^at\s+", opponent))
            if neutral or away_site:
                opponent = re.sub(r"(?i)^(?:vs\.?|versus|at)\s+", "", opponent).strip()
            opp_id = resolve(opponent, by_org, exact)
            if opp_id is None or opp_id == owner:
                excluded["missing_or_ambiguous_ncaa_opponent"] += 1
                continue
            if not (away_site or neutral) and re.match(r"(?i)^vs", opponent):
                excluded["ambiguous_home_away"] += 1
                continue
            away = owner if away_site else opp_id
            home = opp_id if away_site else owner
            location = cells[idx_loc] if idx_loc is not None and idx_loc < len(cells) else ""
            entries.append({
                "date": date.isoformat(), "away_org_id": away,
                "home_org_id": home, "neutral": neutral,
                "source_owner_org_id": owner, "source_url": url,
                "source_kind": "official_conference",
                "tipoff_as_posted": cells[idx_time], "venue": "",
                "venue_location": location, "network_as_posted": "",
                "radio_as_posted": "", "tournament": ""
            })
    if inspected < 8 or len(entries) < 4:
        raise ValueError(f"Conference source insufficient identifiable 2026-27 rows: {inspected}/{len(entries)}")
    return entries, {"owner_org_id": owner, "source_url": url,
                     "status": "parsed_conference", "calendar_origin": "official_conference_team_calendar",
                     "readable_rows": inspected, "verified_member_opponents": len(entries),
                     "excluded_rows": dict(excluded)}


def fetch_calendar(source):
    owner, url = source
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=11) as response:
        return owner, url, response.read().decode("utf-8", "replace")



def source_candidates(gender, by_org):
    """One guaranteed official NCAA-listed athletics hostname per program.

    A guessed schedule PATH is never trusted: the returned document must
    certify season, sport, NCAA member opponent, and substantial real rows.
    """
    explicit = dict(SOURCES[gender])
    sources = []
    unlisted = 0
    for org, team in sorted(by_org.items()):
        if org in explicit:
            sources.append((org, explicit[org], True))
            continue
        official = str(team.get("athletics_site") or "").strip()
        host = OFFICIAL_ATHLETICS_HOST_OVERRIDE.get(org)
        if not host:
            host = urlsplit(official).hostname if official.startswith("https://") else ""
        if not host or not re.fullmatch(r"[a-z0-9][a-z0-9.-]*\.[a-z]{2,}", host, re.I):
            unlisted += 1
            sources.append((org, "", False))
            continue
        sport = "mens-basketball" if gender == "men" else "womens-basketball"
        sources.append((org, f"https://{host}/sports/{sport}/schedule/2026-27?grid=true", False))
    return sources, unlisted


def inspect_source(gender, source, by_org, exact):
    """Reject incorrect seasons/sexes and unknown calendars, even on HTTP 200."""
    org, url, pinned = source
    if not url:
        return None, {"owner_org_id": org, "source_url": "",
                      "status": "no_official_athletics_site",
                      "error": "NCAA directory has no usable athletics URL"}
    attempts = [url]
    if not pinned:
        base = url.split("/sports/", 1)[0]
        sport = "mens-basketball" if gender == "men" else "womens-basketball"
        short = "mbball" if gender == "men" else "wbball"
        # Current-season calendars often live at an unversioned route.
        # Other athletics vendors use the short mbball/wbball slug.
        # URLs are merely candidates; strict actual-page identity and game
        # checks must pass before an entry is accepted.
        attempts.extend([
            f"{base}/sports/{sport}/schedule/2026-2027?grid=true",
            f"{base}/sports/{sport}/schedule?grid=true",
            f"{base}/sports/{sport}/schedule",
            f"{base}/sports/{short}/schedule?grid=true",
            f"{base}/sports/{short}/schedule",
        ])
    errors = []
    for candidate in dict.fromkeys(attempts):
        try:
            _, verified_url, html = fetch_calendar((org, candidate))
            rows, report = parse_calendar(html, gender, org, verified_url, by_org, exact)
            report["calendar_origin"] = ("pinned_official_url" if pinned else "independently_verified_athletics_host" if org in OFFICIAL_ATHLETICS_HOST_OVERRIDE else "NCAA_directory_athletics_hostname")
            report["candidate_urls_tried"] = len(errors) + 1
            return rows, report
        except Exception as ex:
            err = str(ex)
            errors.append(err[:105])
            # A blocked institutional site remains blocked: do not bypass
            # 403s, repeated rate limits, or access controls.
            if re.search(r"HTTP Error (403|429):", err):
                break
    # An independently listed conference's dated team schedule is valid
    # fixture evidence, not proof the institution publishes its own calendar.
    conference = OFFICIAL_CONFERENCE_SCHEDULES[gender].get(org)
    if conference:
        conf_url, subject = conference
        try:
            _, _, conf_html = fetch_calendar((org, conf_url))
            rows, report = parse_conference_calendar(
                conf_html, gender, org, conf_url, subject, by_org, exact)
            report["failed_school_calendar_urls"] = len(errors)
            return rows, report
        except Exception as ex:
            errors.append("Official conference: " + str(ex)[:105])
    return None, {"owner_org_id": org, "source_url": url,
                  "status": "failed", "error": " | ".join(errors)[:260],
                  "candidate_urls_tried": len(errors),
                  "calendar_origin": ("pinned_official_url" if pinned else "independently_verified_athletics_host" if org in OFFICIAL_ATHLETICS_HOST_OVERRIDE else "NCAA_directory_athletics_hostname")}


def canonical_key(item):
    return (item["date"], tuple(sorted(
        (item["home_org_id"], item["away_org_id"]))))


def combine(gender, parsed):
    grouped = defaultdict(list)
    for source_rows in parsed:
        for entry in source_rows:
            grouped[canonical_key(entry)].append(entry)
    fixtures, conflicts = [], []
    for (date, members), evidence in sorted(grouped.items()):
        home_designations = {x["home_org_id"] for x in evidence if not x["neutral"]}
        neutral_designations = {bool(x["neutral"]) for x in evidence}
        if len(home_designations) > 1 or len(neutral_designations) > 1:
            conflicts.append({"date": date, "members": members,
                              "problem": "home/away or neutral-site source disagreement",
                              "source_urls": sorted({x["source_url"] for x in evidence})})
            continue
        neutral = all(x["neutral"] for x in evidence)
        # Neutral host field is an administrative presentation designation only.
        home = next(iter(home_designations)) if home_designations else members[1]
        away = members[0] if home == members[1] else members[1]
        unique = list({(x["source_owner_org_id"], x["source_url"]): x for x in evidence}.values())
        best = next((x for x in unique if x["home_org_id"] == home), unique[0])
        owners = sorted({x["source_owner_org_id"] for x in unique})
        kinds = {x.get("source_kind", "official_school") for x in unique}
        fixture_source_kind = ("official_conference_and_school" if len(kinds) > 1
                               else "official_conference" if kinds == {"official_conference"}
                               else "official_school")
        fixtures.append({
            "id": f"d3-{gender}-{date}-{members[0]}-{members[1]}",
            "date": date, "away_org_id": away, "home_org_id": home,
            "neutral": neutral, "status": "scheduled",
            "source_url": best["source_url"],
            "official_schedule_sources": sorted({x["source_url"] for x in unique}),
            "verified_by_org_ids": owners,
            "source_kind": fixture_source_kind,
            "source_verification": "reciprocal" if len(owners) >= 2 else "single_official_school",
            "tipoff_as_posted": best["tipoff_as_posted"],
            "venue": best["venue"], "venue_location": best["venue_location"],
            "network_as_posted": best["network_as_posted"],
            "radio_as_posted": best["radio_as_posted"],
            "tournament": best["tournament"],
            "neutral_home_designation_unconfirmed": neutral and not home_designations
        })
    return fixtures, conflicts


def process(gender, workers=30, dry_run=False):
    current = json.loads((DATA / f"d3-{gender}-2026-27.json").read_text())
    if current["gender"] != gender or current["division"] != "d3" or current["starting_elo"] != 1500:
        raise ValueError("Wrong gender/division/Elo in official NCAA directory")
    by_org, exact = official_index(current["teams"])
    if len(by_org) < (380 if gender == "men" else 390):
        raise ValueError("Official 2026–27 DIII membership incomplete; refuse import")
    prior_file = DATA / f"d3-{gender}-official-fixtures-2026-27.json"
    previous = json.loads(prior_file.read_text()) if prior_file.exists() else {}
    available_previous = defaultdict(list)
    # Bind recovered historical evidence to the actual university URL that
    # passed validation on the earlier run, never an unrelated opponent link.
    previous_good_source = {
        int(org): url
        for org, url in (previous.get("last_verified_school_source") or {}).items()
        if isinstance(url, str) and url.startswith("https://")
    }
    for a in previous.get("source_audit", []):
        if a.get("status") == "parsed" and a.get("source_url", "").startswith("https://"):
            previous_good_source[int(a["owner_org_id"])] = a["source_url"]
    for f in previous.get("fixtures", []):
        for owner in f.get("verified_by_org_ids", []):
            available_previous[owner].append(f)
    gathered, audit = [], []
    sources, missing = source_candidates(gender, by_org)
    assert len(sources) == len(by_org) and len({s[0] for s in sources}) == len(by_org)

    # Bounded workers: independent university hosts, no NCAA scraping flood.
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        results = {pool.submit(inspect_source, gender, source, by_org, exact): source
                   for source in sources}
        for future in concurrent.futures.as_completed(results):
            owner, url, pinned = results[future]
            try:
                rows, report = future.result()
            except Exception as ex:
                rows = None
                report = {"owner_org_id": owner, "source_url": url,
                          "status": "failed", "error": str(ex)[:200]}
            prior = available_previous[owner]
            if rows:
                # Attach evidence type before dedupe so conference pages
                # never masquerade as a university-published schedule.
                for row in rows:
                    row["source_kind"] = ("official_conference" if
                        report.get("status") == "parsed_conference" else "official_school")
                gathered.append(rows)
            else:
                report["retained_previous_fixtures"] = len(prior)
                # Failed sources must not erase last verified fixture snapshots.
                recovered = []
                for f in prior:
                    prev_source = previous_good_source.get(owner, "")
                    if not prev_source:
                        continue  # evidence attribution cannot be proven
                    recovered.append({
                        "date": f["date"], "away_org_id": f["away_org_id"],
                        "home_org_id": f["home_org_id"], "neutral": f["neutral"],
                        "source_owner_org_id": owner, "source_url": prev_source,
                        "source_kind": "official_school",
                        "tipoff_as_posted": f.get("tipoff_as_posted", ""),
                        "venue": f.get("venue", ""),
                        "venue_location": f.get("venue_location", ""),
                        "network_as_posted": f.get("network_as_posted", ""),
                        "radio_as_posted": f.get("radio_as_posted", ""),
                        "tournament": f.get("tournament", "")})
                if recovered:
                    gathered.append(recovered)
            audit.append(report)

    fixtures, conflicts = combine(gender, gathered)
    successful = sum(a["status"] == "parsed" for a in audit)
    if successful < 1:
        raise ValueError(f"No official {gender} calendars parsed; preserving last certified dataset")
    for a in audit:
        if a["status"] == "parsed" and a.get("source_url", "").startswith("https://"):
            previous_good_source[int(a["owner_org_id"])] = a["source_url"]
    count_reciprocal = sum(f["source_verification"] == "reciprocal" for f in fixtures)
    official_conference = sum(a["status"] == "parsed_conference" for a in audit)
    status_counts = Counter(a["status"] for a in audit)
    # A failed school's *own* site can still have dated DIII fixtures verified
    # by official opponent sites. Preserve that provenance, but never call it a
    # certified complete calendar or claim the school published the schedule.
    fixture_index = defaultdict(list)
    for f in fixtures:
        fixture_index[f["away_org_id"]].append(f)
        fixture_index[f["home_org_id"]].append(f)
    missing_school_review = []
    for a in sorted((x for x in audit if x["status"] == "failed"),
                    key=lambda x: x["owner_org_id"]):
        org = a["owner_org_id"]
        other_sourced = [f for f in fixture_index[org]
                         if org not in f["verified_by_org_ids"]]
        reason = (a.get("error") or "").lower()
        if "http error 403" in reason or "http error 429" in reason:
            category = "access_restricted"
        elif "http error 405" in reason:
            category = "server_refused_method"
        elif "http error 404" in reason:
            category = "calendar_path_unavailable"
        elif "wrong " in reason and "sport" in reason:
            category = "gender_or_sport_ambiguous"
        elif "season in the actual" in reason:
            category = "season_heading_not_verified"
        elif "readable grid rows" in reason or "eligible matches" in reason:
            category = "unsupported_calendar_or_opponent_format"
        elif "timed out" in reason or "connection reset" in reason:
            category = "temporary_network_failure"
        else:
            category = "source_unavailable_or_unverified"
        missing_school_review.append({
            "ncaa_org_id": org, "school": by_org[org]["name"],
            "conference": by_org[org].get("conference", ""),
            "category": category, "failed_url": a.get("source_url", ""),
            "opponent_published_fixtures": len(other_sourced),
            "opponent_source_examples": list(dict.fromkeys(
                f["source_url"] for f in other_sourced))[:3]
        })
    review_coverage = {
        "remaining_unverified_school_calendars": len(missing_school_review),
        "missing_schools_with_at_least_10_opponent_sourced_games": sum(
            m["opponent_published_fixtures"] >= 10 for m in missing_school_review),
        "missing_schools_with_zero_opponent_sourced_games": sum(
            m["opponent_published_fixtures"] == 0 for m in missing_school_review),
        "recovery_reason_counts": dict(Counter(m["category"] for m in missing_school_review))
    }
    output = {
        "schema_version": 1, "division": "d3", "gender": gender, "season": "2026-27",
        "generated_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "source": "NCAA 2026-27 member directory + year/gender-validated official school athletics calendars",
        "scope": "NCAA membership-wide first pass; sources without independently validated 2026-27 schedules excluded",
        "ncaa_confirmed_programs": len(by_org),
        "verified_source_calendars": successful,
        "official_conference_calendar_fallbacks": official_conference,
        "school_calendars_checked": len(audit),
        "school_calendars_missing": len(by_org) - successful,
        "school_calendars_unresolved": len(by_org) - successful - official_conference,
        "source_status_counts": dict(status_counts),
        "last_verified_school_source": {str(k): v for k, v in sorted(previous_good_source.items())},
        "unverified_school_review": missing_school_review,
        "unverified_school_summary": review_coverage,
        "no_athletics_host": missing,
        "source_audit": sorted(audit, key=lambda x: x["owner_org_id"]),
        "conflicts": conflicts,
        "fixture_count": len(fixtures),
        "reciprocal_fixtures": count_reciprocal,
        "fixtures": fixtures
    }
    if not dry_run:
        prior_file.write_text(json.dumps(output, indent=2) + "\n")
    print(json.dumps({"gender": gender, "ncaa_members": len(by_org),
                      "calendars_parsed": successful, "conference_sources": official_conference, "fixtures": len(fixtures),
                      "reciprocal": count_reciprocal, "conflicts": len(conflicts),
                      "outcomes": dict(status_counts),
                      "unverified_school_summary": review_coverage}, sort_keys=True), flush=True)
    return output

def self_test():
    teams = [
        {"ncaa_org_id": 286, "name": "Hope College", "membership_year": 2027, "d3_confirmed": True},
        {"ncaa_org_id": 30037, "name": "Trine University", "membership_year": 2027, "d3_confirmed": True},
        {"ncaa_org_id": 713, "name": "Trinity College (Connecticut)", "membership_year": 2027, "d3_confirmed": True},
        {"ncaa_org_id": 715, "name": "Trinity University (Texas)", "membership_year": 2027, "d3_confirmed": True},
    ]
    by_org, exact = official_index(teams)
    assert resolve("Hope", by_org, exact) == 286
    assert resolve("Trine University", by_org, exact) == 30037
    assert resolve("Trinity", by_org, exact) is None
    assert resolve("Trine or Hope", by_org, exact) is None
    assert calendar_date("January 6, 2027 (Wednesday)") == "2027-01-06"
    assert calendar_date("January 99, 2027") is None
    assert calendar_date("October 31, 2026 (Saturday)") is None
    assert not re.search(r"(?<![a-z])men's\s+basketball", "women's basketball")
    assert "/sports/mens-basketball/schedule" in "/sports/mens-basketball/schedule/2026-2027"
    assert "women's basketball" not in "2026-2027 Wabash College Basketball Schedule".lower()
    candidates, missing = source_candidates("men", {
        286: {**by_org[286], "athletics_site": "https://athletics.hope.edu/landing/index"},
        30037: {**by_org[30037], "athletics_site": "https://www.trinethunder.com/"}
    })
    assert len(candidates) == 2 and not missing
    assert all(s[2] is True for s in candidates)  # the prior explicit source wins
    assert len({x[0] for x in candidates}) == 2
    # No future-season or wrong-sport page can be accepted just because its
    # URL looks right. Yearless routes must still have the exact 2026-27 title.
    assert OFFICIAL_ATHLETICS_HOST_OVERRIDE[69] == "athletics.bowdoin.edu"
    assert OFFICIAL_ATHLETICS_HOST_OVERRIDE[53] == "beloitcollegeathletics.com"
    assert OFFICIAL_CONFERENCE_SCHEDULES["men"][218][1] == "Eureka"
    assert OFFICIAL_CONFERENCE_SCHEDULES["women"][449][1] == "Mount Holyoke"
    assert OFFICIAL_CONFERENCE_SCHEDULES["men"][64][1] == "Blackburn"
    assert OFFICIAL_CONFERENCE_SCHEDULES["women"][525][1] == "Olivet"
    conf_html = """<html><head><title>2026-27 Blackburn Men's Basketball Schedule</title></head>
    <body><h2>2026-27 Blackburn Men's Basketball Schedule (0-0)</h2>
    <table><thead><tr><th>Date</th><th>Opponent</th><th>Status</th><th>Result</th><th>Location</th></tr></thead><tbody>
    <tr><td>11/6/2026</td><td>Hope College</td><td></td><td>7:00 PM</td><td>Carlinville, IL</td></tr>
    <tr><td>11/7/2026</td><td>at Trine University</td><td></td><td>1:00 PM</td><td>Angola, IN</td></tr>
    <tr><td>11/8/2026</td><td>vs. Hope College</td><td></td><td>2:00 PM</td><td>Detroit, MI</td></tr>
    <tr><td>11/9/2026</td><td>Trine or Hope</td><td></td><td>TBA</td><td>Detroit, MI</td></tr>
    <tr><td>11/10/2026</td><td>Hope College</td><td></td><td>7:00 PM</td><td>Carlinville, IL</td></tr>
    <tr><td>11/11/2026</td><td>at Trine University</td><td></td><td>1:00 PM</td><td>Angola, IN</td></tr>
    <tr><td>11/12/2026</td><td>Hope College</td><td></td><td>7:00 PM</td><td>Carlinville, IL</td></tr>
    <tr><td>11/13/2026</td><td>Hope College</td><td></td><td>7:00 PM</td><td>Carlinville, IL</td></tr>
    </tbody></table></body></html>"""
    conference_rows, conference_report = parse_conference_calendar(
        conf_html, "men", 64, "https://sliac.org/schedule.aspx?schedule=2030",
        "Blackburn", by_org, exact)
    assert conference_report["status"] == "parsed_conference"
    assert conference_report["readable_rows"] == 8
    assert len(conference_rows) == 7
    assert conference_rows[1]["away_org_id"] == 64
    assert conference_rows[2]["neutral"] is True
    try:
        parse_conference_calendar(
            conf_html.replace("Men's Basketball", "Women's Basketball"), "men", 64,
            "https://sliac.org/schedule.aspx?schedule=2030", "Blackburn", by_org, exact)
        raise AssertionError("Wrong gender conference schedule accepted")
    except ValueError:
        pass
    assert OFFICIAL_ATHLETICS_HOST_OVERRIDE[58] == "athletics.baruch.cuny.edu"
    assert OFFICIAL_ATHLETICS_HOST_OVERRIDE[151] == "colbyathletics.com"
    fixes, _ = source_candidates("men", {69: {
        "name": "Bowdoin College", "ncaa_org_id": 69,
        "athletics_site": "https://www.bowdoin.edu/athletics/"}})
    assert len(fixes) == 1 and fixes[0][1].startswith("https://athletics.bowdoin.edu/")


    html = """<html><head><title>2026-27 Men's Basketball Schedule - Hope College</title></head>
      <body><h1>2026-27 Men's Basketball Schedule</h1><table><tr>
      <th>Date</th><th>Time</th><th>At</th><th>Opponent</th><th>Location</th>
      <th>TV</th><th>Radio</th><th>Tournament</th><th>Result</th></tr>
      <tr><td>January 6, 2027 (Wednesday)</td><td>7 PM</td><td>Away</td><td>Trine University</td>
      <td>Angola, IN</td><td></td><td></td><td></td><td></td></tr>
      <tr><td>January 9, 2027 (Saturday)</td><td>3 PM</td><td>Home</td><td>Trine University</td>
      <td>Holland, MI / DeVos Fieldhouse</td><td></td><td></td><td></td><td></td></tr>
      <tr><td>January 11, 2027 (Monday)</td><td>TBA</td><td>Neutral</td><td>Trine or Hope</td>
      <td>Detroit, MI</td><td></td><td></td><td></td><td></td></tr>
      <tr><td>January 15, 2027 (Friday)</td><td>7 PM</td><td>Home</td><td>Trinity</td>
      <td>Holland, MI</td><td></td><td></td><td></td><td></td></tr>
      <tr><td>January 17, 2027 (Sunday)</td><td>7 PM</td><td>Away</td><td>Trine</td>
      <td>Angola, IN</td><td></td><td></td><td></td><td></td></tr>
      </table></body></html>"""
    # Gender-specific official school paths may legitimately use the title
    # "Basketball Schedule" without spelling out men/women; still deny a
    # male page on a women's path and vice versa.
    generic = html.replace("Men's Basketball", "Basketball")
    gr, _ = parse_calendar(generic, "men", 286,
                           "https://athletics.hope.edu/sports/mens-basketball/schedule/2026-27", by_org, exact)
    assert len(gr) == 3
    grw, _ = parse_calendar(generic, "women", 286,
                            "https://athletics.hope.edu/sports/womens-basketball/schedule/2026-27", by_org, exact)
    assert len(grw) == 3
    rows, report = parse_calendar(html, "men", 286, "https://athletics.hope.edu/example", by_org, exact)
    assert report["readable_rows"] == 5 and len(rows) == 3
    assert rows[0]["away_org_id"] == 286 and rows[0]["home_org_id"] == 30037
    assert rows[1]["venue"] == "DeVos Fieldhouse"
    assert rows[0]["tipoff_as_posted"] == "7 PM"
    fixtures, conflicts = combine("men", [rows, [{
        **rows[0], "source_owner_org_id": 30037,
        "source_url": "https://trinethunder.com/test"}]])
    assert len(fixtures) == 3 and not conflicts
    assert any(f["source_verification"] == "reciprocal" for f in fixtures)
    assert all(f["status"] == "scheduled" for f in fixtures)
    try:
        parse_calendar(html.replace("Men's Basketball", "Women's Basketball"),
                       "men", 286, "https://athletics.hope.edu/example", by_org, exact)
        raise AssertionError("Wrong-gender calendar was improperly accepted")
    except ValueError:
        pass

    print("DIII schedule importer: date/identity/conditional/neutral/reciprocal tests PASS")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--test", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--workers", type=int, default=30)
    opts = parser.parse_args()
    if opts.test:
        self_test()
    else:
        for gender in ("men", "women"):
            data = process(gender, max(1, min(opts.workers, 8)), opts.dry_run)
            print(json.dumps({"gender": gender, "school_calendars": data["verified_source_calendars"],
                              "fixtures": data["fixture_count"],
                              "reciprocal": data["reciprocal_fixtures"],
                              "conflicts": len(data["conflicts"]),
                              "audit": [{k: row.get(k) for k in ("owner_org_id", "status",
                                                                 "readable_rows", "verified_member_opponents",
                                                                 "error")} for row in data["source_audit"]]}))
