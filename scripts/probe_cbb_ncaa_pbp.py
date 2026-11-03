#!/usr/bin/env python3
"""One-shot $0 CourtCast NCAA-vs-ESPN play-by-play reality check.
Read-only third-party calls. No game data is published into the live scorebug.
Measured response time != latency from play on court. This probe only observes
when content first becomes visible to this client on its sampling schedule.
"""
from __future__ import annotations
import argparse, datetime as dt, hashlib, json, os, re, statistics, time
from pathlib import Path
from urllib import request, error

DAY = "2026-11-02"
ROOT = "https://ncaa-api.henrygd.me"
ESPN = "https://site.api.espn.com/apis/site/v2/sports/basketball"
USER_AGENT = "SportingLifeTimes-CBB-Pilot/1.0 (one-off, low-rate source evaluation)"
TEXT_KEYS = ("text", "playText", "description", "playDescription", "play_by_play_text",
             "eventDescription", "eventDesc", "summary", "action")
MAX_GAMES = 4


def utc():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="milliseconds")


def fetch(url, timeout=11):
    t = time.monotonic()
    try:
        req = request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
        with request.urlopen(req, timeout=timeout) as r:
            raw = r.read(5_000_000)
            code = r.status
        payload = json.loads(raw)
        return payload, {"status": code, "ms": round((time.monotonic()-t)*1000),
                         "bytes": len(raw), "error": None}
    except Exception as exc:
        return None, {"status": getattr(exc, "code", None),
                      "ms": round((time.monotonic()-t)*1000),
                      "bytes": 0, "error": str(exc)[:150]}


def pbp_events(data, origin):
    """Only text-bearing events in actual play arrays count as play-by-play."""
    if not isinstance(data, dict):
        return []
    if origin == "espn":
        plays = data.get("plays")
        if isinstance(plays, dict):
            plays = plays.get("items")
        if not isinstance(plays, list):
            plays = data.get("playByPlay", {}).get("plays", [])
        if not isinstance(plays, list):
            return []
        containers = [(0, x) for x in plays]
    else:
        root = data.get("playbyplay", data)
        if not isinstance(root, dict):
            return []
        periods = root.get("periods") or []
        containers = []
        for n, p in enumerate(periods, 1):
            if not isinstance(p, dict):
                continue
            group = p.get("playbyplayStats") or p.get("plays") or []
            if not isinstance(group, list):
                continue
            for row in group:
                inner = row.get("plays") if isinstance(row, dict) else None
                for play in inner if isinstance(inner, list) else [row]:
                    containers.append((n, play))
    result, seen = [], set()
    for period, item in containers:
        if not isinstance(item, dict):
            continue
        content = next((item[k].strip() for k in TEXT_KEYS
                        if isinstance(item.get(k), str) and item[k].strip()), "")
        if not content:
            continue
        clock = item.get("clock", item.get("gameClock", item.get("time", "")))
        if isinstance(clock, dict):
            clock = clock.get("displayValue", "")
        if not isinstance(clock, str):
            clock = ""
        quarter = item.get("period", period)
        if isinstance(quarter, dict):
            quarter = quarter.get("number", period)
        key = re.sub(r"\\s+", " ", content.lower()).strip()
        fingerprint = hashlib.sha256(f"{quarter}|{clock}|{key}".encode()).hexdigest()[:16]
        if fingerprint in seen:
            continue
        seen.add(fingerprint)
        result.append({"key": fingerprint, "text": content[:140], "clock": clock[:16],
                       "period": quarter})
    return result


def espn_match(scoreboard, espn_id):
    if not isinstance(scoreboard, dict):
        return None
    for event in scoreboard.get("events") or []:
        if str(event.get("id")) != str(espn_id):
            continue
        c = (event.get("competitions") or [{}])[0]
        sides = {x.get("homeAway"): x for x in c.get("competitors", [])}
        status = (event.get("status") or {}).get("type") or {}
        def points(side):
            val = sides.get(side, {}).get("score")
            if isinstance(val, dict):
                val = val.get("displayValue", val.get("value"))
            return int(val) if str(val or "").isdigit() else None
        return {"phase": status.get("state"), "score": [points("away"), points("home")],
                "status_text": status.get("shortDetail"), "clock": (event.get("status") or {}).get("displayClock")}
    return None


def choose_games(ledger, scoreboards):
    ordered = []
    for gender, prop, slug in (("men", "ncaa_crosscheck", "mens-college-basketball"),
                               ("women", "ncaa_women_crosscheck", "womens-college-basketball")):
        cross = ledger.get(prop) or {}
        day = cross.get("day")
        if day != DAY:
            continue
        for row in cross.get("games") or []:
            ncaa_id, espn_id = str(row.get("ncaa_id") or ""), str(row.get("espn_id") or "")
            if not (ncaa_id.isdigit() and espn_id.isdigit()):
                continue
            ev = espn_match(scoreboards.get(gender), espn_id)
            if not ev:
                continue
            order = {"in": 0, "post": 2}.get(ev["phase"], 1)
            if row.get("phase") == "live" and ev["phase"] == "in":
                order = -1
            ordered.append((order, gender, {
                "gender": gender, "sport": slug, "ncaa_id": ncaa_id,
                "espn_id": espn_id, "teams": f'{row.get("away_name")} @ {row.get("home_name")}',
                "verified_crosswalk": True, "initial_espn": ev,
                "initial_ncaa_score": [row.get("away_score"), row.get("home_score")],
                "initial_ncaa_score_as_of": cross.get("checked_at"),
                "selection_phase": ev["phase"]
            }))
    ordered.sort(key=lambda x: x[0])
    # At least one from each gender if the live scoreboard has a matched game.
    chosen = []
    for gender in ("men", "women"):
        matches = [x[2] for x in ordered if x[1] == gender]
        if matches:
            chosen.append(matches[0])
    for _, _, item in ordered:
        if len(chosen) == MAX_GAMES:
            break
        if not any(x["espn_id"] == item["espn_id"] for x in chosen):
            chosen.append(item)
    return chosen


def main(args):
    begun = utc()
    ledger = json.loads(Path(args.ledger).read_text())
    boards = {}
    probe_http = {}
    for gender, sport in (("men", "mens-college-basketball"),
                           ("women", "womens-college-basketball")):
        boards[gender], probe_http[gender] = fetch(
            f"{ESPN}/{sport}/scoreboard?dates={DAY.replace('-', '')}&groups=50&limit=1000")
    games = choose_games(ledger, boards)
    report = {"schema": 1, "sample_date": DAY, "started_at": begun,
              "methodology": {
                  "sampling": f"{args.rounds} rounds separated by {args.interval} seconds",
                  "source": "NCAA.com through community ncaa-api and ESPN public summary",
                  "score_identity": "NCAA/ESPN exact matched crosswalk, no text-only guessed joins",
                  "freshness_limitation": "First observed at sampling points; cannot know on-court event time or true provider ingestion delay. The community API caches game endpoints for about 45 seconds.",
                  "no_live_promotion": True, "no_payment": True
              }, "scoreboard_requests": probe_http, "games": games,
              "samples": [], "summary": {}}
    first_seen = {"espn": {}, "ncaa": {}}
    last_counts = {}
    for round_number in range(args.rounds):
        if round_number:
            time.sleep(args.interval)
        current = {"round": round_number+1, "at": utc(), "games": []}
        # Scoreboard once per round per gender so score changes are not confused with PBP.
        round_boards = {}
        for gender, sport in (("men", "mens-college-basketball"),
                               ("women", "womens-college-basketball")):
            if any(g["gender"] == gender for g in games):
                round_boards[gender], _ = fetch(
                    f"{ESPN}/{sport}/scoreboard?dates={DAY.replace('-', '')}&groups=50&limit=1000")
        for g in games:
            one = {"ncaa_id": g["ncaa_id"], "espn_id": g["espn_id"],
                   "status": espn_match(round_boards.get(g["gender"]), g["espn_id"])}
            for source, url in (
                ("ncaa", f'{ROOT}/game/{g["ncaa_id"]}/play-by-play'),
                ("espn", f'{ESPN}/{g["sport"]}/summary?event={g["espn_id"]}')):
                payload, meta = fetch(url)
                events = pbp_events(payload, source)
                # Do not write huge raw event streams or guess team identities.
                one[source] = {"http": meta, "play_count": len(events),
                               "last_play": events[-1] if events else None,
                               "field_examples": {
                                  "top": list(payload.keys())[:12] if isinstance(payload,dict) else [],
                                  "period": list((payload.get("periods") or [{}])[0].keys())[:12]
                                    if isinstance(payload,dict) and isinstance((payload.get("periods") or [{}])[0],dict) else []
                               }}
                for item in events:
                    first_seen[source].setdefault(g["espn_id"]+"|"+item["key"], current["at"])
                key = g["espn_id"]+"|"+source
                previous = last_counts.get(key)
                if previous is not None and previous != len(events):
                    one[source]["count_changed_from"] = previous
                last_counts[key] = len(events)
                time.sleep(0.36)  # safeguard public demo < 3 requests/s / runner IP
            current["games"].append(one)
        report["samples"].append(current)
    per_game = []
    for g in games:
        iid = g["espn_id"]+"|"
        matched = sorted(set(k[len(iid):] for k in first_seen["espn"] if k.startswith(iid)) &
                         set(k[len(iid):] for k in first_seen["ncaa"] if k.startswith(iid)))
        differences = []
        for k in matched:
            first_n = dt.datetime.fromisoformat(first_seen["ncaa"][iid+k])
            first_e = dt.datetime.fromisoformat(first_seen["espn"][iid+k])
            differences.append(round((first_n-first_e).total_seconds(),1))
        per_game.append({
          "teams":g["teams"],"espn_id":g["espn_id"],"ncaa_id":g["ncaa_id"],
          "play_counts":{source:[s["games"][next(i for i,x in enumerate(games) if x["espn_id"]==g["espn_id"])][source]["play_count"]
              for s in report["samples"]] for source in ("espn","ncaa")},
          "exact_text_clock_play_matches":len(matched),
          "observed_ncaa_minus_espn_seconds":differences[:20],
          "possible_lag_conclusion": ("First-observed comparison only, ± sampling interval and source cache; NOT play-to-publish latency."
              if matched else "Inconclusive: no identical event text/clock/period keys across both feeds.")
        })
    report["summary"]={
        "sampled_games": len(games),
        "sampled_rounds": len(report["samples"]),
        "games_with_ncaa_playlog": sum(any(s["games"][i]["ncaa"]["play_count"] for s in report["samples"]) for i in range(len(games))),
        "games_with_espn_playlog": sum(any(s["games"][i]["espn"]["play_count"] for s in report["samples"]) for i in range(len(games))),
        "http_errors": {src:sum(bool(s["games"][i][src]["http"]["error"]) for s in report["samples"] for i in range(len(games))) for src in ("ncaa","espn")},
        "per_game": per_game,
        "recommendation": "Do not auto-promote NCAA play data; assess matching, freshness, and failure rate first."
    }
    report["finished_at"]=utc()
    dest=Path(args.output)
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(report,indent=2,ensure_ascii=False)+chr(10))
    print(json.dumps(report["summary"],indent=2))
    print("Saved audit:",dest)
    return 0


if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--ledger",default="data/mbb-live.json")
    p.add_argument("--output",default="data/cbb-ncaa-source-audit.json")
    p.add_argument("--rounds",type=int,default=4)
    p.add_argument("--interval",type=int,default=20)
    raise SystemExit(main(p.parse_args()))
