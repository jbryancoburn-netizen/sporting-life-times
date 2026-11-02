#!/usr/bin/env python3
"""Best-effort *official-school-only* 2026-27 men's exhibition score recovery.

Read the existing verified team schedules. Match an October exhibition by
EXACT date + opponent on that school's athletics calendar. Accept ONLY an
explicit game-local W/L score. Do not write regular-season schedules or Elo.
Never overwrite an existing sourced result with a conflict.
"""
from __future__ import annotations
import concurrent.futures
import datetime as dt
import json
import pathlib
import re
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from bs4 import BeautifulSoup

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SCHEDULES = DATA / "mbb-schedules-2026-27"
RESULTS = DATA / "mbb-exhibition-finals-2026-27.json"
AUDIT = DATA / "mbb-exhibition-score-audit.json"
MONTHS = {"9": "Sep", "10": "Oct", "11": "Nov"}
SCORE = re.compile(r"(?<![A-Z0-9])([WL])\s*[,;:]?\s*(\d{1,3})\s*[-–]\s*(\d{1,3})(?!\d)", re.I)
EXHIB = re.compile(r"\b(?:exhibition|exh\.?|preseason|scrimmage)\b", re.I)
SUSPECT_HOSTS = ("espn.com", "wikipedia.org", "sports-reference.com", "realgm.com")
UA = "Mozilla/5.0 (compatible; SLTExhibitionScores/1.0; source attribution)"

def norm(value):
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())

def key(day, a, b):
    return day + "|" + "|".join(sorted((str(a), str(b))))

def exhibition(event):
    day = str(event.get("date", ""))[:10]
    return bool(day < "2026-11-01" or event.get("exhibition") is True or
                EXHIB.search(event.get("name", "")))

def candidates():
    schools = json.loads((DATA / "ncaam-2026-27-espn-team-crosswalk.json").read_text())["teams"]
    index = {str(s["espn_id"]): s for s in schools}
    grouped = defaultdict(list)
    for espn_id, school in index.items():
        file = SCHEDULES / (espn_id + ".json")
        if not file.exists():
            continue
        doc = json.loads(file.read_text())
        url = str(doc.get("source_url", ""))
        u = urllib.parse.urlparse(url)
        if (u.scheme != "https" or not u.hostname or
                any(u.hostname == bad or u.hostname.endswith("." + bad) for bad in SUSPECT_HOSTS)):
            continue
        for e in doc.get("events", []):
            day = str(e.get("date", ""))[:10]
            # A full-season listing is NOT itself evidence of a final.
            if not re.fullmatch(r"2026-(?:09|10|11)-\d{2}", day) or not exhibition(e):
                continue
            people = (e.get("competitions") or [{}])[0].get("competitors") or []
            own = next((p for p in people if str(p.get("team", {}).get("id")) == espn_id), None)
            opp = next((p for p in people if p is not own), None)
            if not own or not opp:
                continue
            other = str(opp.get("team", {}).get("id", ""))
            if other not in index or other == espn_id:
                continue
            names = [opp.get("team", {}).get("displayName"), e.get("name"),
                     index[other].get("name"), index[other].get("espn_name")]
            names = [norm(re.sub(r"\s*\((?:Exh\.?|Exhibition|Preseason)\)\s*", "", n or "", flags=re.I))
                     for n in names]
            names = [n for n in names if len(n) >= 4]
            grouped[espn_id].append(dict(date=day,own=espn_id,opp=other,
                                          names=list(dict.fromkeys(names)),
                                          homeaway=str(own.get("homeAway", "")), url=url))
    return grouped

def dated(text, day):
    mo, dd = day[5:7], int(day[8:10])
    m = MONTHS.get(str(int(mo)), "")
    if not m:
        return False
    return bool(re.search(r"\b" + m + r"[a-z]*\.?\s+" + str(dd) + r"\b", text, re.I)
                or re.search(r"\b" + str(int(mo)) + r"/0?" + str(dd) + r"(?:/\d{2,4})?\b", text)
                or day in text)

def extract(html, fixture):
    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    page = soup.get_text(" ", strip=True)[:300000]
    if (not re.search(r"2026\s*[-–/]\s*(?:20)?27", title + " " + page[:1500])
            or not re.search("basketball", title, re.I)
            or re.search(r"women['’]?s basketball", title, re.I)):
        return None
    selectors = (".sidearm-schedule-game[data-game-id], .schedule-event-item, "
                 ".schedule-table-item, .schedule-item, "
                 ".schedule-list .event, .s-game-card-standard, tr")
    results = set()
    for card in soup.select(selectors):
        text = card.get_text(" ", strip=True)
        if len(text) > 800 or len(text) < 12 or not dated(text, fixture["date"]):
            continue
        compact = norm(text)
        if not any(n in compact for n in fixture["names"]):
            continue
        for match in SCORE.finditer(text):
            result, own, other = match.groups()
            own, other = int(own), int(other)
            if own > 200 or other > 200 or own == other or (own > other) != (result.upper() == "W"):
                continue
            results.add((own, other))
    return next(iter(results)) if len(results) == 1 else None

def recover(record):
    one = record[1][0]
    url = one["url"]
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
        with urllib.request.urlopen(req, timeout=14) as stream:
            final_url = stream.url
            body = stream.read(2000000).decode("utf-8", "replace")
        original = urllib.parse.urlparse(url).hostname
        finalhost = urllib.parse.urlparse(final_url).hostname
        if original != finalhost or not body:
            return one["own"], [], "redirect-or-empty"
    except Exception as exc:
        return one["own"], [], type(exc).__name__
    rows = []
    for e in record[1]:
        result = extract(body, e)
        if not result:
            continue
        own, other = result
        # Unambiguous canonical comparison is by date and pair, not site label.
        rows.append(dict(date=e["date"], pair=key(e["date"], e["own"], e["opp"]),
                         scores={e["own"]: own, e["opp"]: other}, own=e["own"],
                         opp=e["opp"], source_url=final_url))
    return one["own"], rows, "read"

def main():
    ledger = json.loads(RESULTS.read_text())
    assert ledger.get("retro_included") is False and ledger.get("season") == "2026-27"
    existing = {}
    for row in ledger["games"]:
        pair = key(row["date"], row["away_espn_id"], row["home_espn_id"])
        if pair in existing:
            raise ValueError("Duplicate exhibition evidence: " + pair)
        existing[pair] = row
    schools = candidates()
    # Recheck all published school schedules periodically. No paid provider or
    # broad search scraping; only the university source URL already on file.
    discoveries = defaultdict(list)
    checked = 0
    status = defaultdict(int)
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        for school, rows, outcome in pool.map(recover, schools.items()):
            checked += 1
            status[outcome] += 1
            for game in rows:
                discoveries[game["pair"]].append(game)
    appended = 0
    conflicts = []
    for pair, suggestions in discoveries.items():
        signatures = {tuple(sorted(row["scores"].items())) for row in suggestions}
        if len(signatures) != 1:
            conflicts.append(dict(pair=pair,reason="official sources disagree"))
            continue
        row = suggestions[0]
        match = existing.get(pair)
        if match is not None:
            prior = {str(match["away_espn_id"]): match["away_score"],
                     str(match["home_espn_id"]): match["home_score"]}
            if prior != row["scores"]:
                conflicts.append(dict(pair=pair,reason="new score conflicts with existing verified result"))
            continue
        a, h = sorted(row["scores"], key=int)
        ledger["games"].append(dict(date=row["date"],away_espn_id=a,home_espn_id=h,
                                   away_score=row["scores"][a],home_score=row["scores"][h],
                                   source_url=row["source_url"],verified=True,
                                   classification="exhibition",counts_for_retro=False,
                                   verification_note="Exact university game-card result, date and opponent"))
        appended += 1
    ledger["games"].sort(key=lambda r:(r["date"],int(r["away_espn_id"]),int(r["home_espn_id"])))
    ledger["verified_games"] = len(ledger["games"])
    if appended:
        RESULTS.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n")
    coverage = set()
    for g in ledger["games"]:
        coverage.add(key(g["date"],g["away_espn_id"],g["home_espn_id"]))
    fixture_keys = {key(e["date"],e["own"],e["opp"])
                    for ls in schools.values() for e in ls}
    audit = {"checked_at":dt.datetime.now(dt.timezone.utc).isoformat(),
             "schools_attempted":checked, "schools_with_october_exhibitions":len(schools),
             "unique_published_exhibitions":len(fixture_keys),
             "published_exhibition_finals":len(coverage),
             "listed_games_still_missing_scores":len(fixture_keys-coverage),
             "new_results":appended, "source_read_results":dict(status),
             "conflicts":conflicts[:60],
             "unresolved_pairs":sorted(fixture_keys-coverage)[:500],
             "notes":"Missing games are not assigned scores. No RETRO file is read or written."}
    AUDIT.write_text(json.dumps(audit,indent=2,ensure_ascii=False)+"\n")
    print(json.dumps({k:v for k,v in audit.items() if k not in ("unresolved_pairs", "conflicts")},indent=2))
    if conflicts:
        print("WARN: conflicting results quarantined; existing ledger unchanged for those games.",file=sys.stderr)

if __name__ == "__main__":
    main()
