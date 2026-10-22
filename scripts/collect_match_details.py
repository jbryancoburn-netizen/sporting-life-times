#!/usr/bin/env python3
"""Publish first-party game-detail snapshots, preserving source attribution."""
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
PATHS = {"NFL":"football/nfl","MLB":"baseball/mlb","NBA":"basketball/nba","NHL":"hockey/nhl","Premier League":"soccer/eng.1","College Football":"football/college-football","Men's College Basketball":"basketball/mens-college-basketball","Women's College Basketball":"basketball/womens-college-basketball","Champions League":"soccer/uefa.champions","Europa League":"soccer/uefa.europa"}
source = json.loads((ROOT/"scoreboards.json").read_text(encoding="utf-8"))
out = {"updated_at":datetime.now(timezone.utc).isoformat(timespec="seconds"),"games":{},"errors":[],"coverage":{}}
# Reuse the last published verified records; do not erase them on provider failure.
previous = {}
try:
    req = Request("https://jbryancoburn-netizen.github.io/sporting-life-times/match_details.json", headers={"User-Agent":"SportingLifeTimes/1.0"})
    with urlopen(req, timeout=5) as response:
        previous = json.load(response).get("games") or {}
except Exception:
    pass
out["games"].update(previous)
out["retained_from_previous"] = len(previous)
for league in source.get("leagues", []):
    label = league.get("league")
    if label not in PATHS:
        continue
    # Prioritize live games, recent finals, and nearby scheduled fixtures.
    # Bound remote requests so the site can publish on schedule.
    now = datetime.now(timezone.utc)
    def priority(game):
        state = game.get("state")
        try:
            stamp = datetime.fromisoformat(str(game.get("date", "")).replace("Z", "+00:00"))
            distance = abs((stamp - now).total_seconds())
        except (ValueError, TypeError):
            distance = float("inf")
        return (0 if state == "in" else 1 if state == "post" else 2, distance)
    games = sorted(league.get("games", []), key=priority)[:4]
    out["coverage"][label] = {"attempted":0,"available":0,"with_events":0,"with_statistics":0,"failed":0}
    for game in games:
        ident = str(game.get("id") or "")
        if not ident.isdigit():
            continue
        key = label+"::"+ident
        # Avoid refetching settled games whose verified detail is already archived.
        cached = previous.get(key)
        if game.get("state") == "post" and isinstance(cached, dict) and (cached.get("events") or cached.get("statistics")):
            out["coverage"][label]["available"] += 1
            if cached.get("events"):
                out["coverage"][label]["with_events"] += 1
            if cached.get("statistics"):
                out["coverage"][label]["with_statistics"] += 1
            continue
        out["coverage"][label]["attempted"] += 1
        url = "https://site.api.espn.com/apis/site/v2/sports/"+PATHS[label]+"/summary?event="+ident
        try:
            req = Request(url, headers={"User-Agent":"SportingLifeTimes/1.0","Accept":"application/json"})
            with urlopen(req, timeout=5) as response:
                data = json.load(response)
            events = data.get("keyEvents") or data.get("plays") or []
            if isinstance(events, dict):
                events = events.get("items") or events.get("events") or []
            if not isinstance(events, list):
                events = []
            teams = (data.get("boxscore") or {}).get("teams") or []
            out["games"][key] = {"source":"ESPN public summary","source_url":url,"fetched_at":out["updated_at"],
                "events":[{"text":str(e.get("text") or e.get("description") or e.get("shortText") or (e.get("type") or {}).get("text") or "Event")[:500],"clock":str((e.get("clock") or {}).get("displayValue") or e.get("displayClock") or "")[:40]} for e in events[:150] if isinstance(e,dict)],
                "statistics":[{"team":str((t.get("team") or {}).get("displayName") or "Team"),"values":[{"name":str(v.get("label") or v.get("displayName") or v.get("name") or ""),"value":str(v.get("displayValue") if v.get("displayValue") is not None else v.get("value") or "")} for v in (t.get("statistics") or []) if isinstance(v,dict)]} for t in teams if isinstance(t,dict)],
                "lineups":[]}
            out["coverage"][label]["available"] += 1
            if out["games"][key]["events"]:
                out["coverage"][label]["with_events"] += 1
            if out["games"][key]["statistics"]:
                out["coverage"][label]["with_statistics"] += 1
        except Exception as exc:
            out["errors"].append({"game":key,"error":type(exc).__name__})
            out["coverage"][label]["failed"] += 1
# Bound the archive and preserve original timestamps for cached details.
if len(out["games"]) > 1500:
    ordered = sorted(out["games"].items(), key=lambda item: item[1].get("fetched_at", ""), reverse=True)
    out["games"] = dict(ordered[:1500])
(ROOT/"match_details.json").write_text(json.dumps(out,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
print("Published",len(out["games"]),"verified match detail records;",len(out["errors"]),"unavailable summaries")
