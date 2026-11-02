#!/usr/bin/env python3
"""DIII official university basketball calendar importer: 2026-27 nationwide crawl.

Never guess team identities, conditional games, actual Eastern time, or scores.
A source calendar is only an available calendar, NOT certified complete.
"""
import argparse
import concurrent.futures
import datetime as dt
import hashlib
import json
import re
import urllib.request
from urllib.parse import urlsplit, urljoin, urldefrag
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
        (118, "https://athletics.carleton.edu/sports/mens-basketball/schedule/2026-27?grid=true"),
        (30067, "https://morrisvillemustangs.com/sports/mens-basketball/schedule/2026-27?grid=true"),
        (348, "https://vikings.lawrence.edu/sports/mens-basketball/schedule/2026?grid=true"),
        (30264, "https://regentroyals.com/sports/mens-basketball/schedule/2026?grid=true"),
        (113, "https://goslugs.com/sports/mens-basketball/schedule/text"),
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
        (376, "https://athletics.macalester.edu/sports/womens-basketball/schedule/2026-27?grid=true"),
        (30067, "https://morrisvillemustangs.com/sports/womens-basketball/schedule/2026-27?grid=true"),
        (348, "https://vikings.lawrence.edu/sports/womens-basketball/schedule/2026?grid=true"),
        (30264, "https://regentroyals.com/sports/womens-basketball/schedule/2026?grid=true"),
        (113, "https://goslugs.com/sports/womens-basketball/schedule/text"),
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
    # NCAA directory names differ from official opponent short names. These
    # deliberately include institution qualifiers; "Trinity" and bare
    # "Saint Joseph" remain ambiguous and must never be guessed.
    "penn state behrend": 538, "penn st behrend": 538,
    "penn state behrend college": 538, "psu behrend": 538,
    "regis college": 569, "regis college mass": 569,
    "regis college ma": 569, "regis mass": 569,
    "regis college massachusetts": 569,
    "suny delhi": 30225, "suny delhi broncos": 30225,
    "st joseph ct": 8687, "saint joseph ct": 8687,
    "st joseph conn": 8687, "saint joseph conn": 8687,
    "university of saint joseph": 8687, "usj": 8687,

    "uw la crosse": 795, "uw platteville": 800,
    "uw river falls": 801, "uw stout": 803, "uw stout polytechnic": 803,
    "uw superior": 804, "uw whitewater": 805,
    # School-brand names used on other universities' official 2026–27 schedules.
    # Do not merge ambiguous bare 'Regis', 'Anderson', 'Centenary' or 'Bridgewater'.
    "penn state behrend": 538, "penn st behrend": 538,
    "penn state erie behrend": 538, "penn state behrend college": 538,
    "penn state altoona": 25719, "penn st altoona": 25719,
    "penn state abington": 30114, "penn st abington": 30114,
    "penn state berks": 30044, "penn st berks": 30044,
    "penn college": 30190, "penn college of technology": 30190,
    "penn state university altoona": 25719,
    "penn state university abington": 30114,
    "pitt bradford": 1315, "pitt greensburg": 11839,
    "university of pittsburgh at bradford": 1315,
    "university of pittsburgh at greensburg": 11839,
    "suny delhi": 30225, "suny delhi broncos": 30225,
    "regis college": 569, "regis college ma": 569,
    "regis college mass": 569, "regis mass": 569,
    "university of saint joseph": 8687,
    "university of st joseph": 8687,
    "university of saint joseph ct": 8687,
    "university of saint joseph conn": 8687,
    "anderson university in": 939, "anderson university ind": 939,
    "anderson indiana": 939, "anderson ind": 939,
    "bridgewater state": 76, "bridgewater college va": 75,
    "centenary college la": 125, "centenary la": 125,
    "centenary university nj": 12884,
    "mcla": 486, "umass boston": 401,
    "uc santa cruz": 113, "ucsc": 113,
}
# Official athletics domains independently verified against 2026–27 school sites.
# The NCAA member directory sometimes exposes an old generic campus URL.
# Every candidate still must pass exact 2026–27, sex, row and NCAA-opponent tests.
OFFICIAL_ATHLETICS_HOST_OVERRIDE = {
    # Live 2026-27 official university athletics calendars; NCAA directory host stale.
    585: "athletics.rose-hulman.edu", 30035: "athletics.crown.edu",
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
        161: ("https://miacathletics.com/schedule.aspx?schedule=3665", "Concordia"),
        376: ("https://miacathletics.com/schedule.aspx?schedule=3662", "Macalester"),
        118: ("https://miacathletics.com/schedule.aspx?schedule=3661", "Carleton"),
        # University 2026–27 athletics schedules unavailable; official SLIAC team grids.
        1450: ("https://sliac.org/schedule.aspx?schedule=2037", "Westminster"),
        53: ("https://midwestconference.org/schedule.aspx?schedule=3999", "Beloit"),
        218: ("https://sliac.org/schedule.aspx?schedule=2031", "Eureka"),
        684: ("https://cnesports.org/schedule.aspx?schedule=4107", "Suffolk"),
        # Exact 2026-27 CNE team calendars; fallback is conference evidence, not school-certified.
        8981: ("https://cnesports.org/schedule.aspx?schedule=4110", "Endicott"),
        762: ("https://cnesports.org/schedule.aspx?schedule=4111", "Wentworth"),
        64: ("https://sliac.org/schedule.aspx?schedule=2030", "Blackburn"),
        119: ("https://uaasports.info/schedule.aspx?schedule=1162", "Carnegie Mellon"),
        525: ("https://miaa.org/schedule.aspx?schedule=2283", "Olivet"),
        # Independent 2026–27 team-specific conference calendars verified by page title.
        170: ("https://cnesports.org/schedule.aspx?schedule=4114", "Curry"),
        348: ("https://midwestconference.org/schedule.aspx?schedule=4005", "Lawrence"),
        641: ("https://rollrivers.com/schedule.aspx?schedule=2841", "Simpson"),
        806: ("https://northcoast.org/schedule.aspx?schedule=2761", "Wittenberg"),
        8597: ("https://umacathletics.com/schedule.aspx?schedule=4445", "Martin Luther"),
        # Official United East 2026–27 university-specific conference calendars.
        30189: ("https://gounitedeast.com/schedule.aspx?schedule=3821", "Penn State Brandywine"),
        30081: ("https://gounitedeast.com/schedule.aspx?schedule=3822", "Penn State Harrisburg"),
        # Published current-season official conference team pages, independently
        # checked for school, basketball sex and 2026-27 year.
        1355: ("https://ascsports.org/schedule.aspx?schedule=6196", "Schreiner"),
        179: ("https://gomacsports.com/schedule.aspx?schedule=7613", "Delaware Valley"),
        455: ("https://oac.org/schedule.aspx?schedule=2381", "Muskingum"),
        517: ("https://oac.org/schedule.aspx?schedule=2382", "Ohio Northern"),
        22235: ("https://nwcsports.com/schedule.aspx?schedule=2501", "Lewis & Clark"),
        # Official HCAC 2026-27 Bluffton men's page (season and member labeled).
        987: ("https://heartlandconf.org/schedule.aspx?schedule=4398", "Bluffton"),
        # Huntingdon's own team-specific 2026-27 published CCS calendar.
        1130: ("https://collegiateconferenceofthesouth.com/schedule.aspx?schedule=542", "Huntingdon"),
    },
    "women": {
        161: ("https://miacathletics.com/schedule.aspx?schedule=3671", "Concordia"),
        118: ("https://miacathletics.com/schedule.aspx?schedule=3675", "Carleton"),
        376: ("https://miacathletics.com/schedule.aspx?schedule=3681", "Macalester"),
        1450: ("https://sliac.org/schedule.aspx?schedule=2045", "Westminster"),
        53: ("https://midwestconference.org/schedule.aspx?schedule=3989", "Beloit"),
        218: ("https://sliac.org/schedule.aspx?schedule=2038", "Eureka"),
        449: ("https://newmacsports.com/schedule.aspx?schedule=3965", "Mount Holyoke"),
        # Exact 2026-27 CNE team calendars; full year, gender and opponent checks still apply.
        170: ("https://cnesports.org/schedule.aspx?schedule=4125", "Curry"),
        8981: ("https://cnesports.org/schedule.aspx?schedule=4121", "Endicott"),
        762: ("https://cnesports.org/schedule.aspx?schedule=4122", "Wentworth"),
        684: ("https://cnesports.org/schedule.aspx?schedule=4118", "Suffolk"),
        64: ("https://sliac.org/schedule.aspx?schedule=2029", "Blackburn"),
        119: ("https://uaasports.info/schedule.aspx?schedule=1154", "Carnegie Mellon"),
        525: ("https://miaa.org/schedule.aspx?schedule=2274", "Olivet"),
        # Independent 2026–27 team-specific conference calendars verified by page title.
        348: ("https://midwestconference.org/schedule.aspx?schedule=3994", "Lawrence"),
        641: ("https://rollrivers.com/schedule.aspx?schedule=2849", "Simpson"),
        806: ("https://northcoast.org/schedule.aspx?schedule=2771", "Wittenberg"),
        30189: ("https://gounitedeast.com/schedule.aspx?schedule=3832", "Penn State Brandywine"),
        30081: ("https://gounitedeast.com/schedule.aspx?schedule=3833", "Penn State Harrisburg"),
        987: ("https://heartlandconf.org/schedule.aspx?schedule=4399", "Bluffton"),
        1467: ("https://landmarkconference.org/schedule.aspx?schedule=2615", "Goucher"),
        325: ("https://landmarkconference.org/schedule.aspx?schedule=2616", "Juniata"),
        443: ("https://landmarkconference.org/schedule.aspx?schedule=2618", "Moravian"),
        685: ("https://landmarkconference.org/schedule.aspx?schedule=2619", "Susquehanna"),
        22235: ("https://nwcsports.com/schedule.aspx?schedule=2504", "Lewis & Clark"),
        785: ("https://nwcsports.com/schedule.aspx?schedule=2511", "Willamette"),
        1355: ("https://ascsports.org/schedule.aspx?schedule=6202", "Schreiner"),
        179: ("https://gomacsports.com/schedule.aspx?schedule=7633", "Delaware Valley"),
        1130: ("https://collegiateconferenceofthesouth.com/schedule.aspx?schedule=549", "Huntingdon"),
    },
}

# GNAC's administrative master schedules (www.quickscores.com/gnac) are
# explicitly labeled AD Council approved 11/27/25. They certify 16 CONFERENCE
# games ONLY and explicitly direct visitors to schools for nonleague games,
# start times and venues. Never call these complete university calendars.
GNAC_APPROVED_CONFERENCE_SCHEDULES = {
    "men": {
        2798: (14300749, "Albertus Magnus"),
        532: (14300753, "Elms"),
        8486: (14300755, "Lasell"),
        30042: (14300756, "Mitchell"),
        569: (14300759, "Regis"),
        8687: (14300762, "Saint Joseph CT"),
    },
    "women": {
        2798: (14305305, "Albertus Magnus"),
        532: (14305309, "Elms"),
        8486: (14305311, "Lasell"),
        30042: (14305312, "Mitchell"),
        569: (14305315, "Regis"),
        8687: (14305318, "Saint Joseph CT"),
    },
}
GNAC_NCAA_OPPONENTS = {
    "albertus magnus": 2798, "colby sawyer": 152, "dean": 30219,
    "elms": 532, "emmanuel": 215, "lasell": 8486,
    "mitchell": 30042, "new england": 467, "norwich": 511,
    "regis": 569, "rivier": 18422, "saint joseph ct": 8687,
    "saint joseph's me": 605,
}
GNAC_LEAGUES = {"men": 1634344, "women": 1634829}


def gnac_schedule_url(gender, team_id):
    if gender not in GNAC_LEAGUES or not isinstance(team_id, int):
        raise ValueError("Invalid GNAC team or gender")
    return (f"https://www.quickscores.com/Orgs/PrintSchedule.php?"
            f"LeagueID={GNAC_LEAGUES[gender]}&OrgDir=gnac&TeamID={team_id}")


def parse_gnac_approved_calendar(html, gender, owner, url, subject, by_org, exact):
    """Read only GNAC AD Council-approved 2026–27 conference fixtures.

    This official master source has NO official school full-season schedule,
    no confirmed time, and no nonconference games. IDs must match the
    independently observed team/season-specific publisher URLs.
    """
    pinned = GNAC_APPROVED_CONFERENCE_SCHEDULES.get(gender, {}).get(owner)
    if not pinned or pinned[1] != subject or url != gnac_schedule_url(gender, pinned[0]):
        raise ValueError("Wrong GNAC league, school or team-specific source URL")
    doc = BeautifulSoup(html, "html.parser")
    visible = compact(doc.get_text(" ", strip=True))
    prefix = visible.lower().split("regular season standings", 1)[0]
    expected_title = "men's basketball" if gender == "men" else "women's basketball"
    if not (expected_title in prefix and
            "ad council approved 11/27/25" in prefix and
            re.search(r"winter\s+2026\s*[-–]\s*2027", prefix) and
            key(subject) in key(prefix) and
            "gnac" in prefix):
        raise ValueError("GNAC official sport, season, approval or subject not verified")
    if gender == "men" and "women's basketball" in prefix:
        raise ValueError("GNAC women's page not a men's calendar")
    found, excluded = [], defaultdict(int)
    inspected = 0
    for table in doc.select("table"):
        for tr in table.select("tr"):
            cells = [compact(c.get_text(" ", strip=True))
                     for c in tr.find_all(["td", "th"], recursive=False)]
            if len(cells) < 5:
                continue
            raw_date = cells[1]
            m = re.search(r"(?<!\d)(\d{1,2})/(\d{1,2})/(26|27)(?!\d)", raw_date)
            if not m:
                continue
            try:
                date = dt.date(2000+int(m[3]), int(m[1]), int(m[2]))
            except ValueError:
                continue
            if not SEASON_START <= date <= SEASON_END:
                continue
            inspected += 1
            home_label = compact(cells[3]).lower().replace("’", "'")
            away_label = compact(cells[4]).lower().replace("’", "'")
            if "bye" in (home_label, away_label) or not home_label or not away_label:
                excluded["bye_or_missing_opponent"] += 1
                continue
            home_id = GNAC_NCAA_OPPONENTS.get(home_label)
            away_id = GNAC_NCAA_OPPONENTS.get(away_label)
            if not home_id or not away_id or home_id == away_id:
                excluded["unknown_or_ambiguous_opponent"] += 1
                continue
            if owner not in (home_id, away_id) or not {home_id, away_id} <= set(by_org):
                excluded["member_or_subject_disagreement"] += 1
                continue
            found.append({
                "date": date.isoformat(), "away_org_id": away_id,
                "home_org_id": home_id, "neutral": False,
                "source_owner_org_id": owner, "source_url": url,
                "source_kind": "official_conference",
                "tipoff_as_posted": "", "venue": "",
                "venue_location": cells[2], "network_as_posted": "",
                "radio_as_posted": "", "tournament": "",
            })
    # A valid league calendar has about 16 fixtures. Refuse partial fragments,
    # the 2027–28 calendar, administrative byes, and nonmember game rows.
    if inspected < 12 or len(found) < 12 or len({x["date"] for x in found}) < 10:
        raise ValueError(f"GNAC official master incomplete: {inspected}/{len(found)}")
    return found, {
        "owner_org_id": owner, "source_url": url,
        "verified_direct_url": url, "status": "parsed_conference",
        "calendar_origin": "GNAC_AD_Council_approved_conference_games_only",
        "readable_rows": inspected, "verified_member_opponents": len(found),
        "excluded_rows": dict(excluded),
        "coverage_note": "Conference games only; school must verify nonconference dates and game times",
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
    # Sidearm year-only archive paths (e.g. /schedule/2026) often put
    # "2026 Men's Basketball Schedule" in <title>, and the ACTUAL full
    # "2026-27 Men's Basketball Schedule" in <h2>. Include only the
    # schedule-specific heading, not general navigation/sidebar text.
    # Important: "men's basketball" is a substring of "women's basketball".
    headlines = " ".join(compact(h.get_text(" ", strip=True)) for h in doc.select("h1")[:3])
    season_schedule_headings = [
        compact(h.get_text(" ", strip=True))
        for h in doc.select("h1, h2, h3")
        if re.search(r"^2026\s*[-–]\s*(?:27|2027)\b", compact(h.get_text(" ", strip=True)), re.I)
        and re.search(r"\bbasketball\b", compact(h.get_text(" ", strip=True)), re.I)
        and re.search(r"\bschedule\b", compact(h.get_text(" ", strip=True)), re.I)
    ]
    identity_text = (title + " " + headlines + " " +
                     " ".join(season_schedule_headings[:3])).lower().replace("’", "'")
    if not re.search(r"2026\s*[-–]\s*(?:27|2027)", identity_text):
        raise ValueError("No 2026–27 season in the actual page title/heading")
    # Some official basketball pages are explicitly sex-labeled (M)/(W)
    # rather than spelled-out Men's/Women's Basketball Schedule. Accept such
    # headings only on the matching gender-specific sport URL, with 2026-27
    # title/heading and real NCAA-opponent dated rows still mandatory.
    mens_path = "/sports/mens-basketball/schedule" in urlsplit(url).path.lower()
    womens_path = "/sports/womens-basketball/schedule" in urlsplit(url).path.lower()
    coded_men = bool(re.search(r"\bbasketball\s*\(\s*m\s*\)\s+schedule\b", identity_text))
    coded_women = bool(re.search(r"\bbasketball\s*\(\s*w\s*\)\s+schedule\b", identity_text))
    generic_schedule = bool(re.search(r"\bbasketball\s+schedule\b", identity_text))
    explicit_men = bool(re.search(r"(?<![a-z])men's\s+basketball", identity_text))
    explicit_women = bool(re.search(r"women's\s+basketball", identity_text))
    if gender == "men":
        if (explicit_women or coded_women or not (
                explicit_men or mens_path and (generic_schedule or coded_men))):
            raise ValueError("Wrong men's sport or women's calendar")
    if gender == "women":
        if (coded_men or explicit_men and not explicit_women or not (
                explicit_women or womens_path and (generic_schedule or coded_women))):
            raise ValueError("Wrong women's sport or men's calendar")
    matches = []
    unresolved_opponents = []
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
            if opponent_id == owner:
                omitted["self_opponent"] += 1
                continue
            if opponent_id is None:
                # A real opponent on a year/gender-validated official school
                # calendar still belongs in the school schedule, but NEVER Elo.
                # Don't turn an ambiguous short college name into a new school.
                term = key(opponent)
                ambiguous = (len(term) < 4 or sum(
                    bool(term) and term in key(team["name"])
                    for other_id, team in by_org.items() if other_id != owner) > 1)
                if BAD_OPPONENT.search(opponent) or ambiguous:
                    omitted["conditional_or_ambiguous_opponent"] += 1
                    continue
                unresolved_opponents.append({
                    "date": calendar_date(date), "source_owner_org_id": owner,
                    "external_opponent_label": compact(opponent),
                    "placement": at.lower(), "tipoff_as_posted": compact(time),
                    "venue_location": compact(location), "source_url": url,
                    "source_kind": "official_school",
                })
                omitted["identity_not_d3_matched_but_posted"] += 1
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
    if len(matches) + len(unresolved_opponents) < 3:
        raise ValueError(
            f"Only {len(matches)} DIII-matched and {len(unresolved_opponents)} "
            f"other real posted games from {inspected} rows; no publish")
    return matches, {"owner_org_id": owner, "source_url": url,
                     "readable_rows": inspected, "verified_member_opponents": len(matches),
                     "unresolved_opponent_rows": unresolved_opponents,
                     "excluded_rows": dict(omitted), "status": "parsed"}




def parse_text_only_school_calendar(html, gender, owner, url, by_org, exact):
    """Read an official Sidearm text-only university grid, not a generic sports page.

    Its rows use 'Nov 6 (Fri)' and date/time/at/opponent/location columns.
    Year inference is permitted ONLY after the actual heading certifies 2026-27,
    with separate 2026-Nov/Dec and 2027-Jan/Apr season ranges.
    """
    sport = "mens-basketball" if gender == "men" else "womens-basketball"
    path = urlsplit(url).path.lower()
    if not re.fullmatch(r"/sports/" + sport + r"/schedule/text(?:/2026-27)?/?", path):
        raise ValueError("Not a gender-specific text-only school schedule URL")
    doc = BeautifulSoup(html, "html.parser")
    headings = [compact(x.get_text(" ", strip=True)).lower().replace("’", "'")
                for x in doc.select("h1")[:3]]
    expected = "men's" if gender == "men" else "women's"
    expected_heading = re.compile(
        r"^2026\s*[-–]\s*(?:27|2027)\s+" + expected +
        r"\s+basketball\s+schedule\b", re.I)
    if not any(expected_heading.search(x) for x in headings):
        raise ValueError("Text-only official schedule lacks exact 2026-27 gender heading")
    if gender == "men" and any("women's basketball" in h for h in headings):
        raise ValueError("Women's basketball on men's university schedule")
    matches, unresolved, inspected = [], [], 0
    omitted = defaultdict(int)
    for table in doc.select("table"):
        headers = [compact(th.get_text(" ", strip=True)).lower()
                   for th in table.select("th")]
        # Avoid team bios, prior-season score summaries, and sidebar tables.
        if not all(any(x == field for x in headers)
                   for field in ("date", "time", "at", "opponent", "location")):
            continue
        for tr in table.select("tbody tr") or table.select("tr"):
            cells = [compact(c.get_text(" ", strip=True))
                     for c in tr.find_all(["td", "th"], recursive=False)]
            if len(cells) < 5:
                continue
            md = re.fullmatch(
                r"([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:\s+\([A-Za-z]{2,10}\))?",
                cells[0])
            if not md:
                continue
            month = next((i for name, i in MONTHS.items()
                          if name.lower().startswith(md[1].lower()[:3])), None)
            if month is None:
                continue
            year = 2026 if month >= 11 else 2027
            try:
                date = dt.date(year, month, int(md[2]))
            except ValueError:
                continue
            if not SEASON_START <= date <= SEASON_END:
                continue
            time, placement, opponent, location = cells[1:5]
            placement = placement.lower()
            if placement not in ("home", "away", "neutral"):
                continue
            inspected += 1
            tournament = cells[5] if len(cells) > 5 else ""
            if (BAD_OPPONENT.search(opponent) or
                    re.search(r"\b(?:exhibition|scrimmage|joint practice)\b",
                              " ".join((opponent, tournament)), re.I)):
                omitted["conditional_or_nonregular_opponent"] += 1
                continue
            opponent_id = resolve(opponent, by_org, exact)
            if opponent_id == owner:
                omitted["self_opponent"] += 1
                continue
            if opponent_id is None:
                token = key(opponent)
                ambiguous = len(token) < 4 or sum(
                    bool(token) and token in key(t["name"])
                    for org, t in by_org.items() if org != owner) > 1
                if ambiguous:
                    omitted["ambiguous_outside_opponent"] += 1
                    continue
                unresolved.append({
                    "date": date.isoformat(), "source_owner_org_id": owner,
                    "external_opponent_label": compact(opponent),
                    "placement": placement, "tipoff_as_posted": compact(time),
                    "venue_location": compact(location), "source_url": url,
                    "source_kind": "official_school"
                })
                continue
            away = owner if placement == "away" else opponent_id
            home = opponent_id if placement == "away" else owner
            matches.append({
                "date": date.isoformat(), "away_org_id": away,
                "home_org_id": home, "neutral": placement == "neutral",
                "source_owner_org_id": owner, "source_url": url,
                "source_kind": "official_school",
                "tipoff_as_posted": compact(time), "venue": "",
                "venue_location": compact(location),
                "network_as_posted": "", "radio_as_posted": "",
                "tournament": compact(tournament)
            })
    if inspected < 4 or len(matches) + len(unresolved) < 3:
        raise ValueError("Too few verified text-grid rows: " +
                         str(inspected) + " dated, " + str(len(matches)) +
                         " DIII and " + str(len(unresolved)) + " other games")
    return matches, {
        "owner_org_id": owner, "source_url": url, "readable_rows": inspected,
        "verified_member_opponents": len(matches),
        "unresolved_opponent_rows": unresolved,
        "excluded_rows": dict(omitted), "status": "parsed",
        "calendar_origin": "official_university_text_schedule"
    }


def conference_markup_evidence(html, url, reason):
    """Small audit-only fingerprint for officially linked conference pages.

    This cannot qualify a fixture: it records only public headings, table
    headers and DOM class names to identify unsupported publisher layouts.
    Do not archive page HTML or create speculative schedule rows.
    """
    doc = BeautifulSoup(html, "html.parser")
    heads = [compact(h.get_text(" ", strip=True))[:115]
             for h in doc.select("h1,h2,h3")[:9]]
    tables = [[compact(c.get_text(" ", strip=True))[:55]
               for c in t.select("th")[:8]]
              for t in doc.select("table")[:3]]
    seen = []
    for tag in doc.select("[class]"):
        for clazz in tag.get("class", []):
            if ("schedule" in clazz or "game" in clazz) and clazz not in seen:
                seen.append(clazz)
                if len(seen) >= 20:
                    break
        if len(seen) >= 20:
            break
    return {"url": url, "reason": str(reason)[:110],
            "headings": heads, "table_headers": tables,
            "schedule_dom_classes": seen,
            "date_text_fragments": len(re.findall(
                r"(?:11|12|1|2|3)/\\d{1,2}/202[67]", doc.get_text(" ", strip=True)))}


def parse_conference_calendar(html, gender, owner, url, subject, by_org, exact, school_legacy=False):
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
    if subject and key(subject) not in key(heads + " " + title):
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
            if neutral and school_legacy:
                # Older school vendors use "vs." both for home and for
                # neutral-site matches. Without an explicit site designation
                # it is unsafe to infer a neutral-site/game-home record.
                excluded["ambiguous_legacy_vs_location"] += 1
                continue
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


# Tight, conference-specific 2026-27 Sidearm schedule-ID ranges.
# IDs are DISCOVERY CANDIDATES, not fixtures: each fetched page must pass
# full season, gender, subject, NCAA-opponent, date and readable-row checks.
# Never crawl a generic search engine, bypass a block, or infer a game.
OFFICIAL_CONFERENCE_RECOVERY_WINDOWS = {
    "men": (
        ("heartlandconf.org", 4465, 4482, {939: "Anderson", 987: "Bluffton"}),
        ("landmarkconference.org", 2535, 2563,
         {1467: "Goucher", 325: "Juniata", 443: "Moravian", 685: "Susquehanna"}),
        ("empire8.com", 3169, 3183, {11036: "Sage"}),
        ("nwcsports.com", 2470, 2481, {785: "Willamette"}),
    ),
    "women": (
        ("heartlandconf.org", 4390, 4412, {939: "Anderson"}),
        ("empire8.com", 3183, 3198, {11036: "Sage"}),
        ("oac.org", 2387, 2402, {455: "Muskingum", 517: "Ohio Northern"}),
    ),
}


def discover_official_conference_fallbacks(gender, by_org, exact, previous_urls):
    """Resolve only real 2026-27, member-specific official conference calendars.

    The scan is bounded to independently identified conference-hosted sport
    season blocks. A numeric ID is *never* considered valid by itself.
    Once verified, URL provenance is persisted for subsequent normal refreshes.
    """
    recovered = {}
    audited = 0
    for domain, first, last, subjects in OFFICIAL_CONFERENCE_RECOVERY_WINDOWS[gender]:
        needed = {org: label for org, label in subjects.items()
                  if org in by_org and org not in OFFICIAL_CONFERENCE_SCHEDULES[gender]
                  and org not in previous_urls}
        if not needed:
            continue
        # No more than 28 requests to any one conference during discovery.
        if not 0 < last - first <= 28:
            raise ValueError("Unbounded DIII conference discovery range")
        candidates = [(0, f"https://{domain}/schedule.aspx?schedule={sid}")
                      for sid in range(first, last)]
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            futures = {pool.submit(fetch_calendar, c): c[1] for c in candidates}
            for future in concurrent.futures.as_completed(futures):
                url = futures[future]
                try:
                    _, _, html = future.result()
                except Exception:
                    continue
                audited += 1
                for org, subject in needed.items():
                    if org in recovered:
                        continue
                    try:
                        rows, report = parse_conference_calendar(
                            html, gender, org, url, subject, by_org, exact)
                    except ValueError:
                        continue
                    if rows and report["verified_member_opponents"] >= 4:
                        recovered[org] = (url, subject)
                        print(json.dumps({
                            "d3_conference_discovered": subject,
                            "gender": gender,
                            "ncaa_org_id": org,
                            "source": url,
                            "opponents": len(rows)
                        }), flush=True)
    print(json.dumps({"gender": gender, "conference_discovery_documents": audited,
                      "independently_verified_new_calendar_urls": len(recovered)}),
          flush=True)
    return recovered


def javascript_only_placeholder(html):
    """Recognize a vendor's JS-only shell, not a genuine official schedule.

    Such documents contain neither a title nor a data table and expose only
    the JavaScript-disabled notice. Retrying 15 URL variants on that hostname
    cannot recover fixture evidence; switch to verified conference sources.
    This is never a browser-emulation or access-control bypass.
    """
    doc = BeautifulSoup(html, "html.parser")
    if doc.title or doc.select_one("table"):
        return False
    headings = [compact(h.get_text(" ", strip=True)).lower()
                for h in doc.select("h1, h2, h3")]
    visible = compact(doc.get_text(" ", strip=True)).lower()
    return (len(headings) == 1 and
            headings[0].startswith("javascript is disabled") and
            len(visible) < 650 and
            "javascript is disabled" in visible)


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



def matching_calendar_links(html, parent_url, gender):
    """Follow only dated, sport-specific schedule links on the school's site.

    This is webpage discovery, not a license to import unverified opponents:
    the full 2026-27 calendar is re-parsed and must pass all strict checks.
    """
    page = BeautifulSoup(html, "html.parser")
    host = (urlsplit(parent_url).hostname or "").lower().removeprefix("www.")
    sport = "mens-basketball" if gender == "men" else "womens-basketball"
    short = "mbball" if gender == "men" else "wbball"
    old_short = "mbkb" if gender == "men" else "wbkb"
    opposite = ("womens-basketball", "wbball", "wbkb") if gender == "men" else (
        "mens-basketball", "mbball", "mbkb")
    matches = []
    for link in page.select("a[href]"):
        raw_href = str(link.get("href", "")).strip()
        if not raw_href or raw_href.startswith(("javascript:", "mailto:", "#")):
            continue
        target = urldefrag(urljoin(parent_url, raw_href))[0]
        u = urlsplit(target)
        target_host = (u.hostname or "").lower().removeprefix("www.")
        if (u.scheme != "https" or target_host != host or
                any(x in u.path.lower().split('/') for x in opposite)):
            continue
        label = compact(link.get_text(" ", strip=True)).lower()
        path = u.path.lower()
        context = path + " " + label
        sport_match = any(v in context for v in (sport, short, old_short))
        season_match = bool(re.search(r"2026\s*[-_/–]\s*(?:27|2027)", context))
        if not sport_match or not (
                "schedule" in path or season_match and "schedule" in label):
            continue
        score = 4 if season_match else 2
        if "schedule" in label:
            score += 1
        if "?grid=true" in target:
            score += 1
        matches.append((score, target))
    return [u for _, u in sorted(set(matches), reverse=True)][:8]


def inspect_source(gender, source, by_org, exact, preferred_url=None, deep_discovery=False):
    """Reject incorrect seasons/sexes and unknown calendars, even on HTTP 200."""
    org, url, pinned = source
    if not url:
        return None, {"owner_org_id": org, "source_url": "",
                      "status": "no_official_athletics_site",
                      "error": "NCAA directory has no usable athletics URL"}
    attempts = [preferred_url, url] if preferred_url else [url]
    if not pinned:
        base = url.split("/sports/", 1)[0]
        sport = "mens-basketball" if gender == "men" else "womens-basketball"
        short = "mbball" if gender == "men" else "wbball"
        old_short = "mbkb" if gender == "men" else "wbkb"
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
            f"{base}/sports/{old_short}/2026-27/schedule",
            f"{base}/sports/{old_short}/schedule",
            f"{base}/sports/{sport}/2026-27/schedule",
        ])
        if deep_discovery:
            # SIDEARM archives sometimes use the starting calendar year
            # ('2026') instead of '2026-27'. Prior failed schools only:
            # do not add requests to 700+ already certified institutions.
            # The actual page must still pass sport + 2026-27 heading,
            # NCAA opponent, date and home/away verification.
            attempts.extend([
                f"{base}/sports/{sport}/schedule/2026?grid=true",
                f"{base}/sports/{sport}/schedule/2026",
                f"{base}/sports/{sport}/schedule/2026-27?print=true",
                f"{base}/sports/{sport}/schedule/text/2026-27",
                f"{base}/sports/{sport}/schedule/2026-27",
                f"{base}/sports/{short}/schedule/2026",
            ])
    errors = []
    # HTML that is reachable but rejected should be diagnosable from the
    # compact public source register without archiving entire websites.
    rejected_page_evidence = []
    observed_links = []
    fetched_html = None
    fetched_from = None
    visited = set()
    attempt_queue = list(dict.fromkeys(attempts))
    javascript_unavailable = False
    for candidate in attempt_queue:
        if not candidate or candidate in visited:
            continue
        visited.add(candidate)
        try:
            _, verified_url, html = fetch_calendar((org, candidate))
            if javascript_only_placeholder(html):
                # Explicitly label the unavailable public DOM once. Don't
                # retry every guessed path on a JS-only publishing host.
                errors.append("JavaScript-only calendar shell; no public schedule table")
                rejected_page_evidence.append({
                    "url": verified_url, "title": "",
                    "headings": ["JavaScript is disabled"],
                    "date_tables": 0,
                    "reason": "JavaScript-only calendar shell",
                })
                javascript_unavailable = True
                break
            if deep_discovery and len(observed_links) < 14:
                observed_links.extend(matching_calendar_links(html, verified_url, gender))
            if candidate == url:
                fetched_html, fetched_from = html, verified_url
            try:
                rows, report = parse_calendar(html, gender, org, verified_url, by_org, exact)
                report["calendar_origin"] = ("pinned_official_url" if pinned else "independently_verified_athletics_host" if org in OFFICIAL_ATHLETICS_HOST_OVERRIDE else "NCAA_directory_athletics_hostname")
            except ValueError as primary_error:
                # Some genuine university athletics pages expose an older
                # schedule table, not the Sidearm "At/Home/Neutral" grid.
                # The same strict year, gender, NCAA opponent and minimum
                # full-calendar test applies; "vs."-only sites are excluded.
                try:
                    rows, report = parse_text_only_school_calendar(
                        html, gender, org, verified_url, by_org, exact)
                except ValueError:
                    try:
                        rows, report = parse_conference_calendar(
                            html, gender, org, verified_url, by_org[org]["name"],
                            by_org, exact, school_legacy=True)
                    except ValueError:
                        raise primary_error
                    report["status"] = "parsed"
                    report["calendar_origin"] = "ncaa_directory_verified_university_legacy_table"
            report["candidate_urls_tried"] = len(visited)
            report["verified_direct_url"] = verified_url
            report["discovery_method"] = (
                "previously_verified_source" if preferred_url == candidate else
                "school_link_discovery" if candidate not in attempts else
                "official_school_url_or_vendor_variant")
            return rows, report
        except Exception as ex:
            err = str(ex)
            errors.append(err[:105])
            if "html" in locals() and "verified_url" in locals() and verified_url == candidate and len(rejected_page_evidence) < 8:
                try:
                    doc = BeautifulSoup(html, "html.parser")
                    label = compact(doc.title.get_text(" ", strip=True)) if doc.title else ""
                    heads = [compact(h.get_text(" ", strip=True)) for h in doc.select("h1,h2,h3")[:6]]
                    rejected_page_evidence.append({
                        "url": verified_url, "title": label[:135],
                        "headings": [x[:110] for x in heads if x][:4],
                        "date_tables": len(doc.select("table")),
                        "reason": err[:110]
                    })
                except Exception:
                    pass
            # A blocked institutional site remains blocked: do not bypass
            # 403s, repeated rate limits, or access controls.
            if re.search(r"HTTP Error (403|429):", err):
                break
    # 2026-27 current schedule is sometimes linked from another official
    # school page rather than living at a predictable vendor URL.
    if deep_discovery and not javascript_unavailable and not any(re.search(r"HTTP Error (403|429):", e) for e in errors):
        if not observed_links:
            # Fetch the school's official athletics landing page once.
            # Never follow a generic campus directory to unrelated hosts.
            landing = "https://" + (urlsplit(url).hostname or "")
            if landing != "https://" and not any("http error 403" in e.lower()
                                                for e in errors):
                try:
                    _, location, landing_html = fetch_calendar((org, landing))
                    observed_links.extend(matching_calendar_links(
                        landing_html, location, gender))
                except Exception as ex:
                    errors.append("Official school landing: " + str(ex)[:90])
        for target in list(dict.fromkeys(observed_links))[:6]:
            if target in visited:
                continue
            visited.add(target)
            try:
                _, verified_url, html = fetch_calendar((org, target))
                try:
                    rows, report = parse_calendar(
                        html, gender, org, verified_url, by_org, exact)
                except ValueError:
                    try:
                        rows, report = parse_text_only_school_calendar(
                            html, gender, org, verified_url, by_org, exact)
                    except ValueError:
                        rows, report = parse_conference_calendar(
                            html, gender, org, verified_url, by_org[org]["name"],
                            by_org, exact, school_legacy=True)
                        report["status"] = "parsed"
                report["calendar_origin"] = "discovered_on_official_school_site"
                report["verified_direct_url"] = verified_url
                report["discovery_method"] = "school_link_discovery"
                report["candidate_urls_tried"] = len(visited)
                return rows, report
            except Exception as ex:
                errors.append("Discovered schedule: " + str(ex)[:100])
    # An independently listed conference's dated team schedule is valid
    # fixture evidence, not proof the institution publishes its own calendar.
    conference = OFFICIAL_CONFERENCE_SCHEDULES[gender].get(org)
    conference_page_evidence = []
    if conference:
        conf_url, subject = conference
        try:
            _, _, conf_html = fetch_calendar((org, conf_url))
            rows, report = parse_conference_calendar(
                conf_html, gender, org, conf_url, subject, by_org, exact)
            report["failed_school_calendar_urls"] = len(errors)
            return rows, report
        except Exception as ex:
            if "conf_html" in locals():
                conference_page_evidence.append(
                    conference_markup_evidence(conf_html, conf_url, ex))
            errors.append("Official conference: " + str(ex)[:105])
    # The GNAC explicitly posts an AD Council-approved league-only master
    # schedule on its own administrative scheduling account. This is an
    # identified official fallback and must NEVER certify a school calendar.
    gnac = GNAC_APPROVED_CONFERENCE_SCHEDULES[gender].get(org)
    if gnac:
        team_id, subject = gnac
        gnac_url = gnac_schedule_url(gender, team_id)
        try:
            _, _, gnac_html = fetch_calendar((org, gnac_url))
            rows, report = parse_gnac_approved_calendar(
                gnac_html, gender, org, gnac_url, subject, by_org, exact)
            report["failed_school_calendar_urls"] = len(errors)
            return rows, report
        except Exception as ex:
            errors.append("GNAC approved league schedule: " + str(ex)[:105])
    return None, {"owner_org_id": org, "source_url": url,
                  "status": "failed", "error": " | ".join(errors)[:260],
                  "candidate_urls_tried": len(visited),
                  "rejected_page_evidence": rejected_page_evidence,
                  "conference_page_evidence": conference_page_evidence,
                  "discovered_schedule_links": list(dict.fromkeys(observed_links))[:8],
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



def retained_fixture_source(fixture, owner, previous_status, known_school, known_conference):
    """Retain only a prior fixture's genuinely documented owner source.

    A previously checked conference calendar must NEVER be relabeled as an
    official school source merely because the current crawl fails.
    """
    sources = set(fixture.get("official_schedule_sources") or [])
    if not sources:
        return None
    if owner not in fixture.get("verified_by_org_ids", []):
        return None
    school = (known_school.get(owner), "official_school")
    conference = (known_conference.get(owner), "official_conference")
    candidates = ([conference, school] if previous_status == "parsed_conference"
                  else [school, conference])
    for url, kind in candidates:
        if url and url in sources:
            return url, kind
    return None

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
    # A successfully validated conference schedule is ALSO original official
    # evidence. When its school calendar later becomes temporarily unreadable,
    # retain its fixtures as conference-sourced, never as a fake university
    # schedule. Provenance is persisted across successive transient failures.
    previous_good_conference = {
        int(org): url
        for org, url in (previous.get("last_verified_conference_source") or {}).items()
        if isinstance(url, str) and url.startswith("https://")
    }
    for a in previous.get("source_audit", []):
        org, url = int(a["owner_org_id"]), a.get("verified_direct_url") or a.get("source_url", "")
        if not str(url).startswith("https://"):
            continue
        if a.get("status") == "parsed":
            previous_good_source[org] = url
        elif a.get("status") == "parsed_conference":
            previous_good_conference[org] = url
    for f in previous.get("fixtures", []):
        for owner in f.get("verified_by_org_ids", []):
            available_previous[owner].append(f)
    gathered, audit, external_rows = [], [], []
    previous_external = defaultdict(list)
    for item in previous.get("unresolved_opponent_fixtures", []):
        if item.get("source_owner_org_id") in by_org:
            previous_external[item["source_owner_org_id"]].append(item)
    previous_audit = {int(a["owner_org_id"]): a for a in previous.get("source_audit", [])
                      if "owner_org_id" in a}
    # Reuse previously validated conference URLs instead of scanning them
    # every time; each refresh rechecks the full official page.
    known_subjects = {}
    for _, _, _, subject_map in OFFICIAL_CONFERENCE_RECOVERY_WINDOWS[gender]:
        known_subjects.update(subject_map)
    for org, conf_url in previous_good_conference.items():
        if (org in by_org and org in known_subjects and
                org not in OFFICIAL_CONFERENCE_SCHEDULES[gender]):
            OFFICIAL_CONFERENCE_SCHEDULES[gender][org] = (conf_url, known_subjects[org])
    OFFICIAL_CONFERENCE_SCHEDULES[gender].update(
        discover_official_conference_fallbacks(
            gender, by_org, exact, previous_good_conference))
    sources, missing = source_candidates(gender, by_org)
    assert len(sources) == len(by_org) and len({s[0] for s in sources}) == len(by_org)

    # Bounded workers: independent university hosts, no NCAA scraping flood.
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        results = {pool.submit(
            inspect_source, gender, source, by_org, exact,
            previous_good_source.get(source[0]),
            previous_audit.get(source[0], {}).get("status") not in ("parsed", "parsed_conference")
        ): source for source in sources}
        for future in concurrent.futures.as_completed(results):
            owner, url, pinned = results[future]
            try:
                rows, report = future.result()
            except Exception as ex:
                rows = None
                report = {"owner_org_id": owner, "source_url": url,
                          "status": "failed", "error": str(ex)[:200]}
            prior = available_previous[owner]
            new_external = report.pop("unresolved_opponent_rows", [])
            if rows is not None and (rows or new_external):
                # Verified school calendars with no matching DIII opponents
                # still have genuine published fixtures against other schools.
                # Their games remain non-Elo and their identity unresolved.
                # Attach evidence type before dedupe so conference pages
                # never masquerade as a university-published schedule.
                for row in rows:
                    row["source_kind"] = ("official_conference" if
                        report.get("status") == "parsed_conference" else "official_school")
                gathered.append(rows)
                external_rows.extend(new_external)
            else:
                for item in previous_external[owner]:
                    if item.get("source_url") == previous_good_source.get(owner):
                        external_rows.append(item)
                report["retained_previous_fixtures"] = len(prior)
                # Failed sources must not erase last verified fixture snapshots.
                recovered = []
                for f in prior:
                    source = retained_fixture_source(
                        f, owner, previous_audit.get(owner, {}).get("status"),
                        previous_good_source, previous_good_conference)
                    if source is None:
                        continue  # Never attribute an opponent URL to this owner.
                    prev_source, original_kind = source
                    recovered.append({
                        "date": f["date"], "away_org_id": f["away_org_id"],
                        "home_org_id": f["home_org_id"], "neutral": f["neutral"],
                        "source_owner_org_id": owner, "source_url": prev_source,
                        "source_kind": original_kind,
                        "tipoff_as_posted": f.get("tipoff_as_posted", ""),
                        "venue": f.get("venue", ""),
                        "venue_location": f.get("venue_location", ""),
                        "network_as_posted": f.get("network_as_posted", ""),
                        "radio_as_posted": f.get("radio_as_posted", ""),
                        "tournament": f.get("tournament", "")})
                report["retained_verified_fixtures"] = len(recovered)
                if recovered:
                    gathered.append(recovered)
            audit.append(report)

    fixtures, conflicts = combine(gender, gathered)
    successful = sum(a["status"] == "parsed" for a in audit)
    if successful < 1:
        raise ValueError(f"No official {gender} calendars parsed; preserving last certified dataset")
    for a in audit:
        url = a.get("verified_direct_url") or a.get("source_url", "")
        if not str(url).startswith("https://"):
            continue
        if a["status"] == "parsed":
            previous_good_source[int(a["owner_org_id"])] = url
        elif a["status"] == "parsed_conference":
            previous_good_conference[int(a["owner_org_id"])] = url
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
    unresolved_opponent_fixtures = []
    seen_unresolved = set()
    for item in external_rows:
        owner = item.get("source_owner_org_id")
        label = compact(item.get("external_opponent_label", ""))
        date, placement = item.get("date", ""), item.get("placement", "")
        if owner not in by_org or placement not in ("home", "away", "neutral"):
            continue
        if not re.fullmatch(r"202[67]-\d{2}-\d{2}", date) or not label:
            continue
        if BAD_OPPONENT.search(label):
            continue
        identity = (date, owner, key(label), placement)
        if identity in seen_unresolved:
            continue
        seen_unresolved.add(identity)
        # The opponent's own official calendar might already identify this
        # same game as DIII; avoid a duplicate due to nonstandard spelling.
        if any(f["date"] == date and any(
            key(label) in key(by_org[other]["name"]) or
            key(by_org[other]["name"]) in key(label)
            for other in (f["away_org_id"], f["home_org_id"]) if other != owner)
               for f in fixture_index[owner]):
            continue
        stable = hashlib.sha256(
            f"{owner}|{date}|{key(label)}|{placement}".encode()).hexdigest()[:12]
        unresolved_opponent_fixtures.append({
            "id": f"d3-{gender}-{date}-{owner}-other-{stable}",
            "date": date, "source_owner_org_id": owner,
            "external_opponent_label": label, "placement": placement,
            "status": "scheduled", "elo_eligible": False,
            "opponent_d3_identity_unverified": True, "schedule_only": True,
            "source_kind": item.get("source_kind", "official_school"),
            "source_url": item["source_url"],
            "tipoff_as_posted": item.get("tipoff_as_posted", ""),
            "venue_location": item.get("venue_location", ""),
        })
    unresolved_opponent_fixtures.sort(
        key=lambda x: (x["date"], x["source_owner_org_id"], x["id"]))
    missing_school_review = []
    for a in sorted((x for x in audit if x["status"] == "failed"),
                    key=lambda x: x["owner_org_id"]):
        org = a["owner_org_id"]
        other_sourced = [f for f in fixture_index[org]
                         if org not in f["verified_by_org_ids"]]
        reason = (a.get("error") or "").lower()
        if "javascript-only calendar shell" in reason:
            category = "javascript_only_calendar"
        elif "http error 403" in reason or "http error 429" in reason:
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
            "last_successful_school_schedule_url": previous_good_source.get(org, ""),
            "discovered_schedule_links": a.get("discovered_schedule_links", []),
            "checked_schedule_candidates": a.get("candidate_urls_tried", 0),
            "next_action": {
                "javascript_only_calendar": "The school's HTML is an empty JavaScript-only shell; use official conference member calendar or documented opponent fixtures, without bypassing access controls",
                "season_heading_not_verified": "Check official school's 2026-27 basketball schedule link, schedule text/print pages and team-specific conference calendar",
                "server_refused_method": "Inspect official school schedule platform's public print/text calendar; do not circumvent access controls",
                "access_restricted": "Use school's public conference schedule or official opponent schedule",
                "calendar_path_unavailable": "Find school's current official athletics website and season-specific schedule path",
                "unsupported_calendar_or_opponent_format": "Add a source-specific parser only after checking dates/opponents/home-away manually",
                "temporary_network_failure": "Retry prior official published schedule without deleting verified entries",
            }.get(category, "Locate an official school or conference 2026-27 calendar"),
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
        "last_verified_conference_source": {str(k): v for k, v in sorted(previous_good_conference.items())},
        "unverified_school_review": missing_school_review,
        "unverified_school_summary": review_coverage,
        "no_athletics_host": missing,
        "source_audit": sorted(audit, key=lambda x: x["owner_org_id"]),
        "conflicts": conflicts,
        "fixture_count": len(fixtures),
        "reciprocal_fixtures": count_reciprocal,
        "unresolved_opponent_fixture_count": len(unresolved_opponent_fixtures),
        "unresolved_opponent_fixtures": unresolved_opponent_fixtures,
        "fixtures": fixtures
    }
    if not dry_run:
        prior_file.write_text(json.dumps(output, indent=2) + "\n")
    print(json.dumps({"gender": gender, "ncaa_members": len(by_org),
                      "calendars_parsed": successful, "conference_sources": official_conference, "fixtures": len(fixtures),
                      "reciprocal": count_reciprocal, "conflicts": len(conflicts),
                      "non_d3_identified_games": len(unresolved_opponent_fixtures),
                      "outcomes": dict(status_counts),
                      "unverified_school_summary": review_coverage}, sort_keys=True), flush=True)
    return output

def self_test():
    teams = [
        {"ncaa_org_id": 286, "name": "Hope College", "membership_year": 2027, "d3_confirmed": True},
        {"ncaa_org_id": 30037, "name": "Trine University", "membership_year": 2027, "d3_confirmed": True},
        {"ncaa_org_id": 713, "name": "Trinity College (Connecticut)", "membership_year": 2027, "d3_confirmed": True},
        {"ncaa_org_id": 715, "name": "Trinity University (Texas)", "membership_year": 2027, "d3_confirmed": True},
        {"ncaa_org_id": 538, "name": "Pennsylvania State Univ. Erie, the Behrend College", "membership_year": 2027, "d3_confirmed": True},
        {"ncaa_org_id": 569, "name": "Regis College (Massachusetts)", "membership_year": 2027, "d3_confirmed": True},
        {"ncaa_org_id": 30225, "name": "State University of New York at Delhi", "membership_year": 2027, "d3_confirmed": True},
        {"ncaa_org_id": 8687, "name": "University of Saint Joseph (Connecticut)", "membership_year": 2027, "d3_confirmed": True},
        {"ncaa_org_id": 25719, "name": "Penn State University, Altoona", "membership_year": 2027, "d3_confirmed": True},
        {"ncaa_org_id": 30189, "name": "Penn State Brandywine", "membership_year": 2027, "d3_confirmed": True},
        {"ncaa_org_id": 939, "name": "Anderson University (Indiana)", "membership_year": 2027, "d3_confirmed": True},
    ]
    by_org, exact = official_index(teams)
    assert resolve("Hope", by_org, exact) == 286
    assert resolve("Trine University", by_org, exact) == 30037
    assert resolve("Trinity", by_org, exact) is None
    mark = conference_markup_evidence(
        "<html><title>League</title><h2>2026-27 Goucher Men's Basketball Schedule</h2>"
        "<ul><li class='sidearm-schedule-game'>November 10, 2026 - at Wesleyan</li></ul></html>",
        "https://landmarkconference.org/schedule.aspx?schedule=000",
        ValueError("insufficient table rows"))
    assert mark["schedule_dom_classes"] == ["sidearm-schedule-game"]
    assert mark["table_headers"] == []
    assert "2026-27 Goucher" in mark["headings"][0]
    assert javascript_only_placeholder(
        "<html><body><h1>JavaScript is disabled</h1>"
        "<p>Enable JavaScript to view this calendar.</p></body></html>")
    assert not javascript_only_placeholder(
        "<html><title>2026-27 Men's Basketball Schedule</title>"
        "<body><h1>JavaScript is disabled</h1>"
        "<table><tr><td>Nov 6, 2026</td></tr></table></body></html>")
    assert not javascript_only_placeholder(
        "<html><body><h2>2026-27 Women's Basketball Schedule</h2>"
        "<table><tr><th>Opponent</th></tr></table></body></html>")

    assert resolve("Trine or Hope", by_org, exact) is None
    missing_names = [
        (538, "Pennsylvania State Univ. Erie, the Behrend College", "Penn State Behrend"),
        (569, "Regis College (Massachusetts)", "Regis College"),
        (30225, "State University of New York at Delhi", "SUNY Delhi"),
        (8687, "University of Saint Joseph (Connecticut)", "St. Joseph (CT)"),
    ]
    aliases_by_org, aliases_exact = official_index([
        {"ncaa_org_id": org, "name": name, "membership_year": 2027,
         "d3_confirmed": True} for org, name, _ in missing_names
    ])
    assert all(resolve(label, aliases_by_org, aliases_exact) == org
               for org, _, label in missing_names)
    assert resolve("St. Joseph", aliases_by_org, aliases_exact) is None
    assert resolve("Regis University", aliases_by_org, aliases_exact) is None
    assert resolve("Penn State Altoona", aliases_by_org, aliases_exact) is None

    # Cross-school fixture identities must not disappear due to NCAA's formal
    # institution names; ambiguous names remain unresolved rather than guessed.
    for label, expected_org in (
        ("Penn State Behrend", 538),
        ("Penn St. Behrend", 538),
        ("Regis College", 569),
        ("Regis (Mass.)", 569),
        ("SUNY-Delhi", 30225),
        ("University of Saint Joseph", 8687),
        ("Penn State Altoona", 25719),
        ("Penn State Brandywine", 30189),
        ("Anderson University (IN)", 939),
    ):
        assert resolve(label, by_org, exact) == expected_org, label
    assert resolve("Regis", by_org, exact) is None
    assert resolve("Anderson", by_org, exact) is None
    assert resolve("Trinity", by_org, exact) is None
    wisconsin=[{"ncaa_org_id":i,"name":"University of Wisconsin-"+name,
                "membership_year":2027,"d3_confirmed":True}
               for i,name in [(793,"Eau Claire"),(795,"La Crosse"),(798,"Oshkosh"),
                              (800,"Platteville"),(801,"River Falls"),(802,"Stevens Point"),
                              (803,"Stout Polytechnic"),(804,"Superior"),(805,"Whitewater")]]
    w_org,w_exact=official_index(wisconsin)
    assert resolve("UW-Oshkosh",w_org,w_exact)==798
    assert resolve("UW-La Crosse",w_org,w_exact)==795
    assert resolve("UW-Stout",w_org,w_exact)==803
    assert resolve("UW-Whitewater",w_org,w_exact)==805
    assert resolve("Wisconsin Badgers",w_org,w_exact) is None

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
    link_sample = """<a href="/sports/mens-basketball/schedule/2026-27?grid=true">
      2026-27 Men's Basketball Schedule</a>
      <a href="/sports/womens-basketball/schedule/2026-27">Women</a>
      <a href="https://other.example/sports/mens-basketball/schedule/2026-27">External</a>"""
    discovered = matching_calendar_links(
        link_sample, "https://athletics.hope.edu/landing/index", "men")
    assert len(discovered) == 1 and "mens-basketball" in discovered[0]
    womens_links=matching_calendar_links(link_sample, "https://athletics.hope.edu", "women")
    assert len(womens_links)==1 and "/sports/womens-basketball/" in womens_links[0]
    assert all("/sports/mens-basketball/" not in x for x in womens_links)
    # No future-season or wrong-sport page can be accepted just because its
    # URL looks right. Yearless routes must still have the exact 2026-27 title.
    assert OFFICIAL_ATHLETICS_HOST_OVERRIDE[69] == "athletics.bowdoin.edu"
    assert OFFICIAL_ATHLETICS_HOST_OVERRIDE[585] == "athletics.rose-hulman.edu"
    assert OFFICIAL_ATHLETICS_HOST_OVERRIDE[30035] == "athletics.crown.edu"
    assert OFFICIAL_ATHLETICS_HOST_OVERRIDE[53] == "beloitcollegeathletics.com"
    assert OFFICIAL_CONFERENCE_SCHEDULES["men"][218][1] == "Eureka"
    assert OFFICIAL_CONFERENCE_SCHEDULES["women"][449][1] == "Mount Holyoke"
    assert OFFICIAL_CONFERENCE_SCHEDULES["men"][64][1] == "Blackburn"
    assert OFFICIAL_CONFERENCE_SCHEDULES["men"][161][1] == "Concordia"
    assert OFFICIAL_CONFERENCE_SCHEDULES["women"][118][1] == "Carleton"
    assert OFFICIAL_CONFERENCE_SCHEDULES["men"][1450][1] == "Westminster"
    assert OFFICIAL_CONFERENCE_SCHEDULES["women"][1450][0].endswith("schedule=2045")
    assert OFFICIAL_CONFERENCE_SCHEDULES["women"][525][1] == "Olivet"
    assert OFFICIAL_CONFERENCE_SCHEDULES["men"][1355][0].endswith("schedule=6196")
    assert OFFICIAL_CONFERENCE_SCHEDULES["women"][1355][0].endswith("schedule=6202")
    assert OFFICIAL_CONFERENCE_SCHEDULES["women"][987][0].endswith("schedule=4399")
    assert OFFICIAL_CONFERENCE_SCHEDULES["men"][987][0].endswith("schedule=4398")
    assert OFFICIAL_CONFERENCE_SCHEDULES["women"][1467][0].endswith("schedule=2615")
    assert OFFICIAL_CONFERENCE_SCHEDULES["women"][325][0].endswith("schedule=2616")
    assert OFFICIAL_CONFERENCE_SCHEDULES["women"][443][0].endswith("schedule=2618")
    assert OFFICIAL_CONFERENCE_SCHEDULES["women"][685][0].endswith("schedule=2619")
    assert OFFICIAL_CONFERENCE_SCHEDULES["women"][22235][0].endswith("schedule=2504")
    assert OFFICIAL_CONFERENCE_SCHEDULES["women"][785][0].endswith("schedule=2511")
    assert OFFICIAL_CONFERENCE_SCHEDULES["men"][1130] == (
        "https://collegiateconferenceofthesouth.com/schedule.aspx?schedule=542", "Huntingdon")
    assert OFFICIAL_CONFERENCE_SCHEDULES["women"][1130] == (
        "https://collegiateconferenceofthesouth.com/schedule.aspx?schedule=549", "Huntingdon")
    assert OFFICIAL_CONFERENCE_SCHEDULES["men"][179][0].endswith("schedule=7613")
    assert OFFICIAL_CONFERENCE_RECOVERY_WINDOWS["men"][0][0] == "heartlandconf.org"
    assert OFFICIAL_CONFERENCE_RECOVERY_WINDOWS["women"][-1][0] == "oac.org"
    assert all(0 < last - first <= 28
               for windows in OFFICIAL_CONFERENCE_RECOVERY_WINDOWS.values()
               for _, first, last, _ in windows)
    assert OFFICIAL_CONFERENCE_SCHEDULES["women"][179][0].endswith("schedule=7633")
    assert OFFICIAL_CONFERENCE_SCHEDULES["men"][455][0].endswith("schedule=2381")
    assert OFFICIAL_CONFERENCE_SCHEDULES["men"][517][0].endswith("schedule=2382")
    assert OFFICIAL_CONFERENCE_SCHEDULES["men"][22235][0].endswith("schedule=2501")
    # Lock down individually checked CNE team-specific season IDs and sport identity.
    assert OFFICIAL_CONFERENCE_SCHEDULES["men"][8981] == (
        "https://cnesports.org/schedule.aspx?schedule=4110", "Endicott")
    assert OFFICIAL_CONFERENCE_SCHEDULES["men"][762] == (
        "https://cnesports.org/schedule.aspx?schedule=4111", "Wentworth")
    assert OFFICIAL_CONFERENCE_SCHEDULES["women"][170] == (
        "https://cnesports.org/schedule.aspx?schedule=4125", "Curry")
    assert OFFICIAL_CONFERENCE_SCHEDULES["women"][8981] == (
        "https://cnesports.org/schedule.aspx?schedule=4121", "Endicott")
    assert OFFICIAL_CONFERENCE_SCHEDULES["women"][762] == (
        "https://cnesports.org/schedule.aspx?schedule=4122", "Wentworth")
    assert OFFICIAL_CONFERENCE_SCHEDULES["women"][684] == (
        "https://cnesports.org/schedule.aspx?schedule=4118", "Suffolk")
    # Eight 2026-27 conference fallbacks: identify the exact institution,
    # season, gender and page ID before game-row verification begins.
    expected = {
        "men": {
            170: ("cnesports.org", 4114, "Curry"),
            348: ("midwestconference.org", 4005, "Lawrence"),
            641: ("rollrivers.com", 2841, "Simpson"),
            806: ("northcoast.org", 2761, "Wittenberg"),
            8597: ("umacathletics.com", 4445, "Martin Luther"),
        },
        "women": {
            348: ("midwestconference.org", 3994, "Lawrence"),
            641: ("rollrivers.com", 2849, "Simpson"),
            806: ("northcoast.org", 2771, "Wittenberg"),
        },
    }
    for sport, schools in expected.items():
        for org, (domain, season_id, label) in schools.items():
            url, subject = OFFICIAL_CONFERENCE_SCHEDULES[sport][org]
            assert urlsplit(url).hostname == domain
            assert urlsplit(url).query == f"schedule={season_id}"
            assert subject == label

    # United East calendar IDs checked against their exact public 2026–27 headings.
    expected_ue = {"men": {30189: 3821, 30081: 3822},
                   "women": {30189: 3832, 30081: 3833}}
    for sex, ids in expected_ue.items():
        for org, schedule_id in ids.items():
            link, subject = OFFICIAL_CONFERENCE_SCHEDULES[sex][org]
            assert link == f"https://gounitedeast.com/schedule.aspx?schedule={schedule_id}"
            assert subject in ("Penn State Brandywine", "Penn State Harrisburg")
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
    legacy_rows, legacy_report = parse_conference_calendar(
        conf_html, "men", 64, "https://blackburnbeavers.com/sports/mbkb/2026-27/schedule",
        "Blackburn College", by_org, exact, school_legacy=True)
    assert legacy_report["status"] == "parsed_conference"  # caller recategorizes university
    assert len(legacy_rows) == 6  # neutral 'vs.' suppressed as ambiguous in legacy mode
    assert all(not x["neutral"] for x in legacy_rows)

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
    coded_m = html.replace("Men's Basketball", "Basketball (M)")
    coded_w = html.replace("Men's Basketball", "Basketball (W)")
    mr, _ = parse_calendar(coded_m, "men", 286,
                           "https://athletics.hope.edu/sports/mens-basketball/schedule/2026-27",
                           by_org, exact)
    wr, _ = parse_calendar(coded_w, "women", 286,
                           "https://athletics.hope.edu/sports/womens-basketball/schedule/2026-27",
                           by_org, exact)
    assert len(mr) == len(wr) == 3
    for wrong, g, path in [
        (coded_m, "women", "womens-basketball"),
        (coded_w, "men", "mens-basketball"),
    ]:
        try:
            parse_calendar(wrong, g, 286,
                           "https://athletics.hope.edu/sports/" + path + "/schedule/2026-27",
                           by_org, exact)
            raise AssertionError("Opposite-gender M/W calendar accepted")
        except ValueError:
            pass

    # 2026-27 schedule inside an h2 counts when the archive page title
    # gives "2026" alone (Regent/Lawrence Sidearm vendor behavior).
    archive_html = html.replace(
        "<title>2026-27 Men's Basketball Schedule - Hope College</title>",
        "<title>2026 Men's Basketball Schedule - Hope College</title>").replace(
        "<h1>2026-27 Men's Basketball Schedule</h1>",
        "<h1>Hope College Athletics</h1><h2>2026-27 Men's Basketball Schedule</h2>")
    archived_rows, _ = parse_calendar(
        archive_html, "men", 286,
        "https://athletics.hope.edu/sports/mens-basketball/schedule/2026?grid=true",
        by_org, exact)
    assert len(archived_rows) == 3
    archived_women = archive_html.replace("Men's Basketball", "Women's Basketball")
    archive_w_rows, _ = parse_calendar(
        archived_women, "women", 286,
        "https://athletics.hope.edu/sports/womens-basketball/schedule/2026?grid=true",
        by_org, exact)
    assert len(archive_w_rows) == 3
    wrong_year = archive_html.replace(
        "<h2>2026-27 Men's Basketball Schedule</h2>",
        "<h2>2025-26 Men's Basketball Schedule</h2>")
    try:
        parse_calendar(wrong_year, "men", 286,
                       "https://athletics.hope.edu/sports/mens-basketball/schedule/2026",
                       by_org, exact)
        raise AssertionError("Year-only title with wrong season heading accepted")
    except ValueError:
        pass

    rows, report = parse_calendar(html, "men", 286, "https://athletics.hope.edu/example", by_org, exact)
    assert report["readable_rows"] == 5 and len(rows) == 3
    assert not report["unresolved_opponent_rows"]  # conditional/ambiguous names
    external_heavy = (html.replace("Trine University", "Marquette University")
                     .replace("<td>Trine</td>", "<td>Georgetown University</td>")
                     .replace("<td>Trinity</td>", "<td>Stanford University</td>"))
    other_rows, other_audit = parse_calendar(
        external_heavy, "men", 286, "https://athletics.hope.edu/example", by_org, exact)
    assert not other_rows  # Nothing misrepresented as a DIII member game.
    assert len(other_audit["unresolved_opponent_rows"]) == 4
    assert other_audit["status"] == "parsed"
    assert all(r["external_opponent_label"] and r["source_owner_org_id"] == 286
               for r in other_audit["unresolved_opponent_rows"])
    _, mixed = parse_calendar(
        html.replace("Trine or Hope", "Marquette University"),
        "men", 286, "https://athletics.hope.edu/example", by_org, exact)
    assert len(mixed["unresolved_opponent_rows"]) == 1
    assert mixed["unresolved_opponent_rows"][0]["external_opponent_label"] == "Marquette University"
    assert mixed["unresolved_opponent_rows"][0]["placement"] == "neutral"
    assert resolve("Marquette University", by_org, exact) is None
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

    # A transient 403 must never erase an official conference-verified
    # fixture or promote it to a university-certified source.
    prior_game = {
        "verified_by_org_ids": [286, 30037],
        "official_schedule_sources": ["https://conference.example/schedule=44",
                                      "https://school.example/schedule"],
    }
    assert retained_fixture_source(
        prior_game, 286, "parsed_conference",
        {286: "https://school.example/schedule"},
        {286: "https://conference.example/schedule=44"}) == (
            "https://conference.example/schedule=44", "official_conference")
    assert retained_fixture_source(
        prior_game, 286, "parsed",
        {286: "https://school.example/schedule"},
        {286: "https://conference.example/schedule=44"}) == (
            "https://school.example/schedule", "official_school")
    assert retained_fixture_source(
        prior_game, 286, "failed", {286: "https://other.example/unknown"},
        {286: "https://no-source.example/missing"}) is None
    assert retained_fixture_source(
        prior_game, 999, "parsed", {999: "https://school.example/schedule"},
        {}) is None

    # Prior failed NCAA schools search the year-only and print/text routes.
    # This is discovery, not a relaxation of source verification.
    import inspect as _inspect
    _inspect_source_text = _inspect.getsource(inspect_source)
    assert '/schedule/2026?grid=true' in _inspect_source_text
    assert '/schedule/2026-27?print=true' in _inspect_source_text
    assert '/schedule/text/2026-27' in _inspect_source_text
    assert 'if deep_discovery:' in _inspect_source_text

    # GNAC's linked 2026-27 administrative team calendar: only conference
    # dates; no fabricated times, postseason, byes or cross-division members.
    gnac_ids = [2798, 569]
    gnac_by_org, gnac_exact = official_index([
        {"ncaa_org_id": org, "name": name, "membership_year": 2027,
         "d3_confirmed": True}
        for org, name in [(2798, "Albertus Magnus College"),
                          (569, "Regis College (Massachusetts)")]
    ])
    gnac_url = gnac_schedule_url("men", 14300749)
    sample_rows = "".join(
        f"<tr><td>Week 1</td><td>Tue 12/{i}/26</td><td>New Haven, CT</td>"
        "<td>Albertus Magnus</td><td>Regis</td></tr>"
        for i in (1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23)
    )
    gnac_html = (
        "<html><head><title>Men's Basketball AD Council approved 11/27/25</title></head>"
        "<body><h1>Men's Basketball AD Council approved 11/27/25</h1>"
        "<h2>Winter 2026-2027 - Basketball</h2>"
        "<h2>Albertus Magnus</h2><p>GNAC conference master schedule</p>"
        "<h3>Regular Season Standings</h3>"
        "<table><tr><th>Week</th><th>Date</th><th>Location</th>"
        "<th>Home</th><th>Away</th></tr>" + sample_rows + "</table></body></html>"
    )
    gnac_rows, gnac_report = parse_gnac_approved_calendar(
        gnac_html, "men", 2798, gnac_url,
        "Albertus Magnus", gnac_by_org, gnac_exact)
    assert len(gnac_rows) == 12
    assert all(not row["tipoff_as_posted"] for row in gnac_rows)
    assert gnac_report["status"] == "parsed_conference"
    for invalid_url in (
        gnac_url.replace("TeamID=14300749", "TeamID=14300759"),
        gnac_url.replace("LeagueID=1634344", "LeagueID=1634829"),
    ):
        try:
            parse_gnac_approved_calendar(
                gnac_html, "men", 2798, invalid_url,
                "Albertus Magnus", gnac_by_org, gnac_exact)
            raise AssertionError("Mismatched GNAC team/league source accepted")
        except ValueError:
            pass
    try:
        parse_gnac_approved_calendar(
            gnac_html.replace("Winter 2026-2027", "Winter 2025-2026"),
            "men", 2798, gnac_url, "Albertus Magnus", gnac_by_org, gnac_exact)
        raise AssertionError("Wrong season GNAC calendar accepted")
    except ValueError:
        pass

    # UC Santa Cruz uses a year-certified official /schedule/text grid, where
    # dates have no printed year. Reject older seasons or opposite sex.
    text_rows = """<html><h1>2026-27 Women's Basketball Schedule</h1>
        <table><thead><tr><th>Date</th><th>Time</th><th>At</th>
        <th>Opponent</th><th>Location</th><th>Tournament</th><th>Result</th>
        </tr></thead><tbody>
        <tr><td>Nov 3 (Tue)</td><td>6 PM</td><td>Away</td>
        <td>Trine University</td><td>Angola, IN</td><td></td><td>-</td></tr>
        <tr><td>Nov 7 (Sat)</td><td>1 PM</td><td>Home</td>
        <td>Trine University</td><td>Santa Cruz, CA</td><td></td><td>-</td></tr>
        <tr><td>Nov 8 (Sun)</td><td>3 PM</td><td>Away</td>
        <td>Hope College</td><td>Holland, MI</td><td></td><td>-</td></tr>
        <tr><td>Dec 29 (Tue)</td><td>11 AM</td><td>Neutral</td>
        <td>Marquette University</td><td>Denver, CO</td><td></td><td>-</td></tr>
        <tr><td>Jan 9 (Sat)</td><td>2 PM CT</td><td>Home</td>
        <td>Trine University</td><td>Santa Cruz, CA</td><td></td><td>-</td></tr>
        <tr><td>Feb 27 (Sat)</td><td></td><td>Home</td>
        <td>Coast-to-Coast Athletic Conference Tournament</td>
        <td>Santa Cruz</td><td></td><td>-</td></tr>
        </tbody></table></html>"""
    w_url = "https://goslugs.com/sports/womens-basketball/schedule/text"
    text_matches, text_report = parse_text_only_school_calendar(
        text_rows, "women", 286, w_url, by_org, exact)
    assert len(text_matches) == 3
    assert text_matches[0]["date"] == "2026-11-07"
    assert text_matches[-1]["date"] == "2027-01-09"
    assert text_matches[-1]["tipoff_as_posted"] == "2 PM CT"
    assert len(text_report["unresolved_opponent_rows"]) == 1
    assert all(x["source_kind"] == "official_school" for x in text_matches)
    for wrong_text, wrong_gender, wrong_url in [
        (text_rows, "men", "https://goslugs.com/sports/mens-basketball/schedule/text"),
        (text_rows.replace("2026-27", "2025-26"), "women", w_url),
        (text_rows, "women", "https://goslugs.com/sports/womens-basketball/schedule")
    ]:
        try:
            parse_text_only_school_calendar(
                wrong_text, wrong_gender, 286, wrong_url, by_org, exact)
            raise AssertionError("Invalid text-only source accepted")
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
