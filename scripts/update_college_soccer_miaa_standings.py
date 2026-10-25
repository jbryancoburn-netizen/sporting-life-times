#!/usr/bin/env python3
"""Refresh MIAA 2026 men's soccer standings; reject incomplete/ambiguous source parses."""
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

SOURCE = "https://miaa.org/standings.aspx?path=msoc"
OUT = Path("data/college-soccer-miaa-standings.json")
TEAMS = {"Calvin":"calvin","Kalamazoo":"kalamazoo","Albion":"albion","Hope":"hope","Adrian":"adrian","Alma":"alma","Trine":"trine","Olivet":"olivet"}
RECORD = re.compile(r"^\\d+-\\d+(?:-\\d+)?$")
INTEGER = re.compile(r"^\\d+$")


def parse_table(html):
    soup = BeautifulSoup(html, "html.parser")
    for table in soup.find_all("table"):
        headers = [c.get_text(" ", strip=True).lower().replace(".", "") for c in table.select("thead tr:last-child th")]
        if not headers:
            headers = [c.get_text(" ", strip=True).lower().replace(".", "") for c in table.select("tr:first-child th")]
        def col(*options):
            for option in options:
                for i, h in enumerate(headers):
                    if h == option:
                        return i
            return -1
        record_idx = col("conf record", "conf", "conference")
        points_idx = col("cpts", "conf pts", "points", "pts")
        overall_idx = col("overall", "record")
        gp_idx = col("conf gp")
        if record_idx < 0 or points_idx < 0:
            continue
        rows = {}
        for tr in table.select("tbody tr"):
            cells = [c.get_text(" ",strip=True) for c in tr.find_all("td",recursive=False)]
            if not cells:
                continue
            school = next((name for name in TEAMS if any(re.fullmatch(re.escape(name), c, flags=re.I) for c in cells[:3])), None)
            if not school: continue
            def val(i):
                return cells[i].strip() if 0 <= i < len(cells) else ""
            conf = val(record_idx)
            points = val(points_idx)
            overall = val(overall_idx)
            gp = val(gp_idx)
            if not RECORD.fullmatch(conf) or not INTEGER.fullmatch(points):
                raise ValueError(f"Bad table record for {school}: {conf!r}, points {points!r}")
            if overall and not RECORD.fullmatch(overall): overall = ""
            parts = [int(v) for v in conf.split("-")]
            games = sum(parts)
            if gp and INTEGER.fullmatch(gp) and int(gp) != games:
                raise ValueError(f"Conference games mismatch for {school}: {gp} vs {conf}")
            rows[TEAMS[school]] = {
                "team_id": TEAMS[school],
                "conference_record": conf,
                "conference_points": int(points),
                "overall_record": overall,
                "conference_games": games,
            }
        if set(rows) == set(TEAMS.values()):
            return rows
    raise ValueError("Did not locate a complete eight-team MIAA standings table; existing published data left unchanged")


def main():
    request = Request(SOURCE, headers={"User-Agent":"Mozilla/5.0 (compatible; SportingLifeTimes/1.0; official standings refresh)"})
    with urlopen(request, timeout=35) as response:
        html = response.read().decode("utf-8", "replace")
    rows = parse_table(html)
    old = json.loads(OUT.read_text(encoding="utf-8"))
    old_rows = {item["team_id"]: item for item in old["rows"]}
    new_rows = [rows[team] for team in TEAMS.values()]
    # Prevent publishing a feed that is older than the previous verified season cutoff.
    for row in new_rows:
        old_games = int(old_rows.get(row["team_id"],{}).get("conference_games",0))
        if row["conference_games"] < old_games:
            raise ValueError(f"Source regressed for {row['team_id']}; keeping published snapshot")
    # For stable standings, do not write a new file on every unchanged poll.
    compare = lambda seq: [(v["team_id"], v["conference_record"], v["conference_points"],v["overall_record"],v["conference_games"]) for v in seq]
    if compare(old["rows"]) == compare(new_rows):
        print("Official table unchanged; existing published values remain")
        return
    old["rows"] = new_rows
    old["checked_date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    old["checked_at_utc"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    old["note"] = "Eight MIAA teams parsed from current official conference standings; no results inferred."
    OUT.write_text(json.dumps(old,indent=2)+"\\n",encoding="utf-8")
    print("Published eight fully validated official conference records")


if __name__ == "__main__":
    main()
