#!/usr/bin/env python3
"""Refresh published 2026-27 NCAA men's basketball team calendars. Preserve last good files."""
# 365-school backfill; publish workflow retries when another desk commits concurrently.
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
            # All 365 school files can contain corrections from university athletics,
            # opponent school records, verified venues and television announcements.
            # A generic scoreboard refresh must NEVER destroy those manual/official fields.
            target = destination / f"{ident}.json"
            existing = {}
            if target.exists():
                try:
                    existing = json.loads(target.read_text())
                except (OSError, ValueError):
                    existing = {}
            prior_events = existing.get("events") or []
            source_enriched = bool(existing.get("verified_from_school")
                                   or "athletics" in str(existing.get("source_name","")).lower()
                                   or any(x.get("site_verified") is True
                                          or x.get("official_school_time")
                                          or x.get("school_source_url")
                                          or x.get("official_source")
                                          for x in prior_events))
            if prior_events and source_enriched:
                # Official school calendars are refreshed by the dedicated official
                # collection jobs; preserve all site, venue, tipoff and TV provenance.
                return ident, "preserved-official", len(prior_events)
            season_events = [e for e in events if str(e.get("date", ""))[:4] in ("2026", "2027")]
            if not season_events:
                # A zero-game API response is not a completed calendar. Keep previously verified data.
                if target.exists():
                    try:
                        prior = json.loads(target.read_text())
                        if prior.get("events"):
                            return ident, "preserved", len(prior["events"])
                    except (ValueError, OSError):
                        pass
                    # A missing upstream feed is not evidence of canceled games.
                return ident, "awaiting-source", 0
            # Never replace a more complete schedule with a smaller API response.
            if len(prior_events) > len(season_events):
                return ident, "preserved-larger", len(prior_events)
            content = {"season": "2026-27", "espn_team_id": ident,
                       "team_id": team["id"], "fetched_at": datetime.now(timezone.utc).isoformat(),
                       "source_name": "ESPN schedule fallback, not official school-verified",
                       "events": season_events}
            target.write_text(json.dumps(content, separators=(",", ":"), ensure_ascii=False))
            return ident, "updated", len(content["events"])
        except Exception as e:
            if attempt == 2:
                return ident, f"error: {str(e)[:80]}", 0
            time.sleep(1 + attempt * 2)

with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    results = list(pool.map(collect, crosswalk["teams"]))
counts = {"updated": sum(status == "updated" for _, status, _ in results),
          "preserved": sum(status.startswith("preserved") for _, status, _ in results),
          "preserved_official": sum(status == "preserved-official" for _, status, _ in results),
          "awaiting_source": sum(status == "awaiting-source" for _, status, _ in results),
          "failed": sum(status.startswith("error") for _, status, _ in results)}
summary = {"season": "2026-27", "as_of": datetime.now(timezone.utc).isoformat(),
           "team_count": len(results), **counts,
           "teams_with_games_this_run": sum(count > 0 for _, _, count in results),
           "calendar_games_retained": sum(count for _, _, count in results),
           "official_metadata_preserved": True,
           "indiana": next(({"status": status, "games": count} for ident, status, count in results if ident == "84"), None)}
(destination / "status.json").write_text(json.dumps(summary, indent=2) + "\n")
print(json.dumps(summary, indent=2))
if counts["updated"] == 0:
    print("No new ESPN schedule entries; preserved previously verified university calendars.")
