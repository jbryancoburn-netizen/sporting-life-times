#!/usr/bin/env python3
"""Publish first-party game-detail snapshots, preserving source attribution."""
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from concurrent.futures import ThreadPoolExecutor, as_completed
from time import sleep
from urllib.error import HTTPError, URLError
from match_center_records import choose_games, merge_record

ROOT = Path(__file__).resolve().parents[1]
PATHS = {"NFL":"football/nfl","MLB":"baseball/mlb","NBA":"basketball/nba","NHL":"hockey/nhl","Premier League":"soccer/eng.1","College Football":"football/college-football","Men's College Basketball":"basketball/mens-college-basketball","Women's College Basketball":"basketball/womens-college-basketball","Champions League":"soccer/uefa.champions","Europa League":"soccer/uefa.europa"}
source = json.loads((ROOT/"scoreboards.json").read_text(encoding="utf-8"))
out = {"updated_at":datetime.now(timezone.utc).isoformat(timespec="seconds"),"games":{},"errors":[],"coverage":{}}
# Reuse the last published verified records; do not erase them on provider failure.
previous = {}
archive_path = ROOT / "data" / "match_center_archive.json"
try:
    local_archive = json.loads(archive_path.read_text(encoding="utf-8"))
    if isinstance(local_archive, dict):
        previous.update(local_archive.get("games") or {})
except (OSError, ValueError, TypeError):
    pass
try:
    req = Request("https://jbryancoburn-netizen.github.io/sporting-life-times/match_details.json", headers={"User-Agent":"SportingLifeTimes/1.0"})
    with urlopen(req, timeout=5) as response:
        published = json.load(response).get("games") or {}
        for key, record in published.items():
            if not isinstance(record, dict):
                continue
            old = previous.get(key)
            if not isinstance(old, dict) or (not (old.get("events") or old.get("statistics") or old.get("players")) and (record.get("events") or record.get("statistics") or record.get("players"))):
                previous[key] = record
except Exception:
    pass
out["games"].update(previous)

def read_json(url, attempts=3):
    for attempt in range(attempts):
        try:
            req = Request(url, headers={"User-Agent":"SportingLifeTimes/1.0","Accept":"application/json"})
            with urlopen(req, timeout=6) as response:
                return json.load(response)
        except (HTTPError, URLError, TimeoutError, ValueError) as exc:
            if isinstance(exc, HTTPError) and exc.code not in (429, 500, 502, 503, 504):
                raise
            if attempt == attempts - 1:
                raise
            sleep(0.4 * (2 ** attempt))

out["retained_from_previous"] = len(previous)
def priority(game):
    now = datetime.now(timezone.utc)
    try:
        stamp = datetime.fromisoformat(str(game.get("date", "")).replace("Z", "+00:00"))
        distance = abs((stamp - now).total_seconds())
    except (ValueError, TypeError):
        distance = float("inf")
    return (0 if game.get("state") == "in" else 1 if game.get("state") == "post" else 2, distance)


def fetch_detail(label, game):
    ident = str(game["id"])
    key = label + "::" + ident
    url = "https://site.api.espn.com/apis/site/v2/sports/" + PATHS[label] + "/summary?event=" + ident
    data = read_json(url)
    events = data.get("keyEvents") or data.get("plays") or []
    if isinstance(events, dict):
        events = events.get("items") or events.get("events") or []
    if not isinstance(events, list):
        events = []
    def event_record(e):
        kind = e.get("type") or {}
        clock = e.get("clock") or {}
        team = e.get("team") or {}
        return {"text":str(e.get("text") or e.get("description") or e.get("shortText") or kind.get("text") or "Event")[:500],
                "clock":str(clock.get("displayValue") or e.get("displayClock") or "")[:40],
                "period":str((e.get("period") or {}).get("number") or ""),
                "type":str(kind.get("text") or kind.get("type") or "")[:80],
                "team":str(team.get("displayName") or team.get("name") or "")[:100],
                "scoring":bool(e.get("scoringPlay") or e.get("isScore"))}
    boxscore = data.get("boxscore") or {}
    teams = boxscore.get("teams") or []
    players = []
    team_totals = []
    for group in boxscore.get("players") or []:
        if not isinstance(group, dict):
            continue
        team = (group.get("team") or {}).get("displayName") or "Team"
        for bucket in group.get("statistics") or []:
            if not isinstance(bucket, dict):
                continue
            labels = [str(x) for x in bucket.get("labels") or []]
            totals = bucket.get("totals")
            if isinstance(totals, list) and totals:
                team_totals.append({"team":str(team), "category":str(bucket.get("name") or bucket.get("displayName") or ""), "labels":labels, "stats":[str(x) for x in totals]})
            for p in bucket.get("athletes") or []:
                if not isinstance(p, dict):
                    continue
                stats = p.get("stats") or []
                if not isinstance(stats, list):
                    continue
                players.append({"team":str((p.get("team") or {}).get("displayName") or team),
                                "name":str((p.get("athlete") or {}).get("displayName") or "Player"),
                                "category":str(bucket.get("name") or bucket.get("displayName") or ""),
                                "labels":labels, "stats":[str(x) for x in stats]})
    record = {"source":"ESPN public summary","source_url":url,"fetched_at":out["updated_at"],
              "events":[event_record(e) for e in events[:250] if isinstance(e, dict)],
              "statistics":[{"team":str((t.get("team") or {}).get("displayName") or "Team"),
                             "values":[{"name":str(v.get("label") or v.get("displayName") or v.get("name") or ""),
                                        "value":str(v.get("displayValue") if v.get("displayValue") is not None else v.get("value") or "")}
                                       for v in t.get("statistics") or [] if isinstance(v, dict)]}
                            for t in teams if isinstance(t, dict)],
              "lineups":[], "players":players[:150], "team_totals":team_totals}
    record["game"] = {"id":ident,"league":label,"date":game.get("date"),"name":game.get("name"),"state":game.get("state"),"teams":game.get("teams") or [],"status":game.get("status")}
    return key, record


pending = []
for league in source.get("leagues", []):
    label = league.get("league")
    if label not in PATHS:
        continue
    games = choose_games(league.get("games", []))
    row = out["coverage"][label] = {"attempted":0,"available":0,"with_events":0,
                                      "with_statistics":0,"failed":0,"cached":0}
    for game in games:
        ident = str(game.get("id") or "")
        if not ident.isdigit():
            continue
        key = label + "::" + ident
        cached = previous.get(key)
        if game.get("state") == "post" and isinstance(cached, dict) and (
                cached.get("events") or cached.get("statistics") or cached.get("players")):
            if not isinstance(cached.get("game"), dict):
                cached["game"] = {"id":ident,"league":label,"date":game.get("date"),"name":game.get("name"),"state":game.get("state"),"teams":game.get("teams") or [],"status":game.get("status")}
            else:
                cached["game"].update({"state":game.get("state"),"status":game.get("status"),"teams":game.get("teams") or cached["game"].get("teams") or []})
            out["games"][key] = cached
            row["available"] += 1
            row["cached"] += 1
            row["with_events"] += int(bool(cached.get("events")))
            row["with_statistics"] += int(bool(cached.get("statistics")))
            continue
        row["attempted"] += 1
        pending.append((label, game))

# Bounded concurrency: all network I/O completes before the output is written.
with ThreadPoolExecutor(max_workers=5) as pool:
    futures = {pool.submit(fetch_detail, label, game): (label, str(game["id"]))
               for label, game in pending}
    for future in as_completed(futures):
        label, ident = futures[future]
        row = out["coverage"][label]
        try:
            key, record = future.result()
            record = merge_record(out["games"].get(key), record)
            out["games"][key] = record
            row["available"] += 1
            row["with_events"] += int(bool(record["events"]))
            row["with_statistics"] += int(bool(record["statistics"]))
        except Exception as exc:
            key = label+"::"+ident
            out["errors"].append({"game":key,"error":type(exc).__name__})
            row["failed"] += 1
            cached = out["games"].get(key)
            if isinstance(cached, dict) and (cached.get("events") or cached.get("statistics") or cached.get("players")):
                row["cached"] += 1
                row["available"] += 1
                row["with_events"] += int(bool(cached.get("events")))
                row["with_statistics"] += int(bool(cached.get("statistics")))

# Bound the archive and preserve original timestamps for cached details.
if len(out["games"]) > 1500:
    ordered = sorted(out["games"].items(), key=lambda item: item[1].get("fetched_at", ""), reverse=True)
    out["games"] = dict(ordered[:1500])
archive_path.parent.mkdir(parents=True, exist_ok=True)
archive_path.write_text(json.dumps({"updated_at":out["updated_at"],"games":out["games"]},ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
(ROOT/"match_details.json").write_text(json.dumps(out,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
print("Published",len(out["games"]),"verified match detail records;",len(out["errors"]),"unavailable summaries")
