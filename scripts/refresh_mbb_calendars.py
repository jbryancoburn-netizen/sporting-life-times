#!/usr/bin/env python3
"""Refresh published 2026-27 NCAA men's basketball team calendars. Preserve last good files."""
import concurrent.futures
import json
import pathlib
import time
import urllib.request
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
crosswalk = json.loads((ROOT / "data/ncaam-2026-27-espn-team-crosswalk.json").read_text())
destination = ROOT / "data/mbb-schedules-2026-27"
destination.mkdir(parents=True, exist_ok=True)

def collect(team):
    ident = str(team["espn_id"])
    url = f"https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/{ident}/schedule?season=2027&limit=400"
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 SportingLifeTimes/1.0", "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=25) as response:
                body = json.load(response)
            events = body.get("events", [])
            if not isinstance(events, list):
                raise ValueError("Unexpected schedule payload")
            # Never overwrite a previously populated calendar with a transient empty feed.
            target = destination / f"{ident}.json"
            if target.exists():
                try:
                    existing = json.loads(target.read_text())
                    if existing.get("source_name") == "Indiana University Athletics official 2026-27 schedule" and len(existing.get("events", [])) >= len(events):
                        return ident, "preserved", len(existing["events"])
                except (OSError, ValueError):
                    pass
            if not events and target.exists():
                return ident, "preserved", 0
            content = {"season": "2026-27", "espn_team_id": ident,
                       "team_id": team["id"], "fetched_at": datetime.now(timezone.utc).isoformat(),
                       "events": [e for e in events if str(e.get("date", ""))[:4] in ("2026", "2027")]}
            target.write_text(json.dumps(content, separators=(",", ":"), ensure_ascii=False))
            return ident, "updated", len(content["events"])
        except Exception as e:
            if attempt == 2:
                return ident, f"error: {str(e)[:80]}", 0
            time.sleep(1 + attempt * 2)

with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    results = list(pool.map(collect, crosswalk["teams"]))
counts = {"updated": sum(status == "updated" for _, status, _ in results),
          "preserved": sum(status == "preserved" for _, status, _ in results),
          "failed": sum(status.startswith("error") for _, status, _ in results)}
summary = {"season": "2026-27", "as_of": datetime.now(timezone.utc).isoformat(),
           "team_count": len(results), **counts,
           "teams_with_games_this_run": sum(count > 0 for _, _, count in results),
           "indiana": next(({"status": status, "games": count} for ident, status, count in results if ident == "84"), None)}
(destination / "status.json").write_text(json.dumps(summary, indent=2) + "\n")
print(json.dumps(summary, indent=2))
if counts["updated"] == 0:
    raise SystemExit("No schedules refreshed; existing calendars retained.")
