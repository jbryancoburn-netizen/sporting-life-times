#!/usr/bin/env python3
"""2026-27 South Atlantic Conference school-calendar reconciliation.

SAC SIDEARM schedule IDs 2584-2595 (men) and 2596-2607 (women) are
candidates, NOT evidence by themselves. Every page must have an exact
season, gender and identifiable university heading. A game is only
published when both schools independently agree on date and H/A role.
Neither final scores nor existing NCAA game identifiers are overwritten.
"""
from __future__ import annotations
import datetime as dt
import re
import unicodedata
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from bs4 import BeautifulSoup

BASE = "https://thesac.com/schedule.aspx?schedule="
SOURCES = {"men": tuple(range(2584, 2596)), "women": tuple(range(2596, 2608))}
LABELS = {
    "anderson": ("Anderson", "Anderson University", "Anderson University South Carolina"),
    "carson": ("Carson-Newman", "Carson Newman", "Carson-Newman University"),
    "catawba": ("Catawba", "Catawba College"),
    "coker": ("Coker", "Coker University"),
    "emory": ("Emory & Henry", "Emory and Henry", "Emory & Henry University"),
    "lenoir": ("Lenoir-Rhyne", "Lenoir Rhyne", "Lenoir-Rhyne University"),
    "lincoln": ("Lincoln Memorial", "Lincoln Memorial University"),
    "mars": ("Mars Hill", "Mars Hill University"),
    "newberry": ("Newberry", "Newberry College"),
    "tusculum": ("Tusculum", "Tusculum University"),
    "wise": ("UVA Wise", "University of Virginia's College at Wise",
             "The University of Virginia's College at Wise"),
    "wingate": ("Wingate", "Wingate University"),
}
def norm(value):
    txt = unicodedata.normalize("NFKD", str(value or "")).replace("–","-").replace("—","-").encode("ascii","ignore").decode("ascii")
    txt = txt.lower().replace("&", " and ")
    return " ".join(re.sub(r"[^a-z0-9]+", " ", txt).split())

NAMES = {}
for key, labels in LABELS.items():
    for label in labels:
        normalized = norm(label)
        if normalized in NAMES and NAMES[normalized] != key:
            raise ValueError("Conflicting SAC university alias")
        NAMES[normalized] = key
def school(label):
    return NAMES.get(norm(label))

def fetch(url):
    request = urllib.request.Request(url, headers={
        "User-Agent": "SportingLifeTimes/1.0 (+https://github.com/jbryancoburn-netizen/sporting-life-times)",
        "Accept": "text/html"})
    with urllib.request.urlopen(request, timeout=18) as response:
        return response.read(1_500_000).decode("utf-8", "replace")

def et_clock(value):
    """These twelve SAC campuses are in the Eastern time zone."""
    hit = re.fullmatch(r"\s*(1[0-2]|0?[1-9]):([0-5]\d)\s*([AP])\.?M\.?\s*", str(value or ""), re.I)
    return f"{int(hit[1])}:{hit[2]} {hit[3].upper()}M ET" if hit else None

def parse(html, gender, sid):
    if gender not in SOURCES or sid not in SOURCES[gender]:
        raise ValueError("Unexpected SAC source ID or basketball gender")
    soup = BeautifulSoup(html, "html.parser")
    title = (soup.title.get_text(" ", strip=True) if soup.title else "").replace("’", "'")
    hit = re.search(r"2026-27\s+(.+?)\s+(Men's|Women's)\s+Basketball\b", title, re.I)
    if not hit or ("women" if hit[2].lower().startswith("women") else "men") != gender:
        raise ValueError("SAC school calendar is the wrong season, sport or gender")
    owner = school(hit[1])
    if owner is None:
        raise ValueError("SAC school calendar has unrecognized owner")
    rows = []
    found = False
    rejected = 0
    for table in soup.select("table"):
        headers = [norm(x.get_text(" ", strip=True)) for x in table.select("tr th")]
        if not {"date", "opponent", "location", "result"}.issubset(headers):
            continue
        found = True
        clock_index = headers.index("result")
        for tr in table.select("tr"):
            cells = [x.get_text(" ", strip=True) for x in tr.find_all("td", recursive=False)]
            if len(cells) <= max(clock_index, headers.index("opponent")):
                continue
            raw_date = cells[headers.index("date")].strip()
            if not re.fullmatch(r"\d{1,2}/\d{1,2}/20(?:26|27)", raw_date):
                continue
            try:
                date = dt.datetime.strptime(raw_date, "%m/%d/%Y").date()
            except ValueError:
                rejected += 1
                continue
            if not dt.date(2026, 11, 1) <= date <= dt.date(2027, 3, 1):
                continue
            text = cells[headers.index("opponent")].strip()
            if re.search(r"\bexhibition\b", text, re.I) or re.match(r"^(vs\.?|versus)\s+", text, re.I):
                rejected += 1
                continue
            away_role = bool(re.match(r"^at\s+", text, re.I))
            opponent = school(re.sub(r"^at\s+", "", text, flags=re.I))
            if not opponent or opponent == owner:
                rejected += 1
                continue
            away, home = (owner, opponent) if away_role else (opponent, owner)
            rows.append((date.isoformat(), away, home, owner, et_clock(cells[clock_index])))
        break
    if not found or len(rows) < 7:
        raise ValueError(f"SAC official 2026-27 grid unavailable for {sid}")
    return owner, rows, rejected

def identities(gender, teams):
    conference = "SAC" if gender == "men" else "South Atlantic Conference"
    found = {}
    duplicates = set()
    for ident, team in teams.items():
        if team.get("conference") != conference:
            continue
        key = school(team.get("name"))
        if key in found:
            duplicates.add(key)
        if key:
            found[key] = ident
    for key in duplicates:
        found.pop(key, None)
    return found, duplicates

def enrich_sac(gender, games, teams, today=None, fetcher=fetch):
    if gender not in SOURCES:
        raise ValueError("Wrong SAC gender")
    today = today or dt.date.today()
    ids, ambiguous = identities(gender, teams)
    if len(ids) != 12 or ambiguous:
        return {"status":"SAC member registry unresolved; fixtures held",
                "gender":gender, "teams_identified":len(ids), "ambiguous":sorted(ambiguous),
                "added":0,"enriched":0}
    calendars = {}
    unavailable = []
    rejected = 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        pending = {pool.submit(fetcher, BASE + str(sid)): sid for sid in SOURCES[gender]}
        for future in as_completed(pending):
            sid = pending[future]
            try:
                owner, rows, bad = parse(future.result(), gender, sid)
                # A source ID can NEVER be accepted as a different school
                # twice. Duplicate school calendars are held, not counted.
                if owner in calendars:
                    calendars[owner] = None
                    rejected += 1
                else:
                    calendars[owner] = (sid, rows)
                rejected += bad
            except Exception as exc:
                unavailable.append({"id":sid,"error":str(exc)[:140]})
    if len([x for x in calendars.values() if x]) < 2:
        return {"status":"SAC official source calendars insufficient; fixtures held",
                "gender":gender, "schools_read":0, "unavailable":unavailable,
                "added":0,"enriched":0}
    sightings = defaultdict(dict)
    duplicate_rows = 0
    for owner, payload in calendars.items():
        if not payload:
            continue
        sid, rows = payload
        for date, away, home, witness, clock in rows:
            if any(x not in ids for x in (owner, away, home)):
                rejected += 1
                continue
            key = (date, away, home)
            if witness in sightings[key]:
                # Exact duplicated rows on the SAC site should not discard
                # a real two-school match; competing tipoffs must be held.
                old = sightings[key][witness]
                new = (sid, clock)
                if old != new:
                    sightings[key][witness] = None
                    duplicate_rows += 1
            else:
                sightings[key][witness] = (sid, clock)
    existing = defaultdict(list)
    for ident, game in games.items():
        if game.get("date") and game.get("away") and game.get("home"):
            existing[(game["date"], frozenset((game["away"],game["home"])))].append((ident,game))
    added = enriched = one_sided = conflicts = time_conflicts = time_added = 0
    verified_pairs = 0
    for (date, away, home), votes in sorted(sightings.items()):
        if set(votes) != {away,home} or any(x is None for x in votes.values()):
            one_sided += 1
            continue
        verified_pairs += 1
        ai, hi = ids[away], ids[home]
        same_day = existing.get((date,frozenset((ai,hi))),[])
        if len(same_day) > 1:
            conflicts += 1
            continue
        sources = sorted(BASE + str(v[0]) for v in votes.values())
        clocks = [v[1] for v in votes.values()]
        tipoff = clocks[0] if clocks[0] and clocks[0] == clocks[1] else None
        if all(clocks) and not tipoff:
            time_conflicts += 1
        if same_day:
            old = same_day[0][1]
            if (old.get("away"),old.get("home")) != (ai,hi) or old.get("neutral"):
                conflicts += 1
                continue
            old_sources = old.get("official_schedule_sources") or []
            new_sources = sorted(set(old_sources).union(sources))
            if old_sources != new_sources:
                old["official_schedule_sources"] = new_sources
                enriched += 1
            if tipoff and not old.get("start_time"):
                old["start_time"] = tipoff
                old["tipoff_source_url"] = sources[0]
                time_added += 1
                enriched += 1
            continue
        if dt.date.fromisoformat(date) < today:
            continue
        gid = f"d2sac-2026-{gender}-{date}-{away}-{home}"
        if gid in games:
            conflicts += 1
            continue
        game = {"id":gid, "date":date, "away":ai, "home":hi,
                "away_score":None, "home_score":None, "status":"scheduled",
                "verified":True, "elo_eligible":True, "neutral":False,
                "source":"SAC two-university official 2026-27 school calendars",
                "source_url":sources[0], "official_schedule_sources":sources}
        if tipoff:
            game["start_time"] = tipoff
            game["tipoff_source_url"] = sources[0]
            time_added += 1
        games[gid] = game
        existing[(date,frozenset((ai,hi)))].append((gid,game))
        added += 1
    return {"status":"SAC exact reciprocal 2026-27 university schedules checked",
            "gender":gender, "schools_read":sum(bool(x) for x in calendars.values()),
            "teams_identified":len(ids), "reciprocal_matchups":verified_pairs,
            "added":added, "enriched":enriched, "one_sided":one_sided,
            "quarantined":rejected + conflicts + duplicate_rows,
            "conflicts":conflicts, "time_conflicts":time_conflicts,
            "mutually_verified_eastern_tipoffs":time_added,
            "unavailable":unavailable, "source":"South Atlantic Conference official school calendars"}
