#!/usr/bin/env python3
"""Publish durable, exact-match basketball television assignments for the Ledger.

Uses locally published, attributed school, conference, and game feeds. No
network is guessed from conference membership or a provider's media contract.
"""
import datetime as dt
import json
import re
from collections import defaultdict
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUTPUT = DATA / "cbb-published-networks-2026-27.json"
CONFERENCES = (
    "mbb-official-conference-game-evidence.json",
    "mbb-additional-conference-game-evidence.json",
    "mbb-october-conference-evidence.json",
    "mbb-western-conference-game-evidence.json",
    "mbb-network-grid-evidence.json",
)
UNANNOUNCED = {"", "TBA", "TBD", "<TBA>", "<TBD>", "TV TBA", "N/A", "NA",
               "TO BE ANNOUNCED", "TO BE DETERMINED", "NETWORK TBD", "NETWORK TBA", "TBC", "—", "-"}


def read(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def day_of(value):
    value = str(value or "")
    if not re.match(r"^202[67]-\d\d-\d\d", value):
        return ""
    try:
        instant = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        if instant.tzinfo:
            return instant.astimezone(ZoneInfo("America/New_York")).date().isoformat()
    except ValueError:
        return ""
    return value[:10]


def clean_network(value):
    if not isinstance(value, str):
        return ""
    value = " ".join(value.split())
    if value.upper() in UNANNOUNCED or re.search(r"<\s*TBD?\s*>", value, re.I):
        return ""
    return value[:120]


def pair(a, b):
    a, b = str(a or ""), str(b or "")
    if not a.isdigit() or not b.isdigit() or a == b:
        return None
    return tuple(sorted((a, b), key=int))


def network_from_event(event):
    comp = (event.get("competitions") or [{}])[0]
    names = []
    for row in comp.get("broadcasts") or []:
        if isinstance(row, dict):
            names += row.get("names") or []
    if not names:
        names = [event.get("broadcast") or ""]
    return " / ".join(dict.fromkeys(
        name for raw in names if (name := clean_network(raw))
    ))


def build(data=DATA):
    observations = defaultdict(list)

    def add(gender, day, a, b, network, source, priority, game_id=""):
        ids = pair(a, b)
        network = clean_network(network)
        if gender not in ("men", "women") or not ids or not day or not network:
            return
        if not re.fullmatch(r"202[6-7]-\d{2}-\d{2}", day):
            return
        key = (gender, day, *ids)
        observations[key].append({
            "network": network, "source": str(source or "")[:250],
            "priority": priority, "id": str(game_id or "") if str(game_id or "").isdigit() else ""
        })

    # Collect schedules for all 365 men's programs. Some authenticated school
    # events use a synthetic ID, so exact date + BOTH program IDs is the join.
    for path in sorted((data / "mbb-schedules-2026-27").glob("*.json")):
        doc = read(path)
        for event in doc.get("events", []):
            if not isinstance(event, dict) or not event.get("competitions"):
                continue
            comp = event["competitions"][0]
            teams = comp.get("competitors") or []
            if len(teams) != 2:
                continue
            ids = [str((t.get("team") or {}).get("id") or "") for t in teams]
            urls = [b.get("source_url") for b in comp.get("broadcasts") or []
                    if isinstance(b, dict) and b.get("source_url")]
            source = urls[0] if urls else (event.get("school_source_url") or
                      event.get("source_url") or "ESPN team schedule")
            priority = 3 if urls or event.get("official_source") is True else 1
            add("men", day_of(event.get("date")), *ids, network_from_event(event),
                source, priority, event.get("id"))

    # Conference and national TV grids are exact, dated announcements;
    # placeholders and contradictory notices are never shown as confirmed.
    for name in CONFERENCES:
        for row in read(data / name).get("rows", []):
            if not isinstance(row, dict):
                continue
            add("men", str(row.get("date") or "")[:10],
                row.get("visitor_id"), row.get("host_id"), row.get("tv"),
                row.get("source_url"), 3)

    for row in read(data / "cbb-verified-broadcasts-2026-27.json").get("entries", []):
        ids = row.get("team_ids") or []
        if len(ids) == 2:
            add("men", str(row.get("day") or "")[:10], *ids,
                row.get("network"), row.get("source_url"), 3, row.get("id"))

    # Women's game ledger already has published exact ESPN event identities.
    # Keep them in the same cached contract so transient API outages do not
    # strip verified WBB networks from the browser as scores are refreshed.
    women = read(data / "ncaaw-2026-27-games.json")
    for row in women.get("finals", []) + women.get("upcoming", []):
        if isinstance(row, dict):
            add("women", day_of(row.get("date")), row.get("away_id"),
                row.get("home_id"), row.get("broadcast"),
                women.get("source") or "Women's published game ledger", 2, row.get("id"))

    # Preserve source-backed assignments across refreshes if the latest
    # provider snapshot temporarily omits them. Current evidence outranks old.
    for row in read(data / OUTPUT.name).get("entries", []):
        ids = row.get("team_ids") or []
        if len(ids) == 2 and row.get("source"):
            add(row.get("gender"), row.get("day"), *ids, row.get("network"),
                row.get("source"), 0, row.get("id"))

    entries = []
    conflicts = []
    for (gender, day, a, b), rows in sorted(observations.items()):
        best = max(row["priority"] for row in rows)
        candidates = [row for row in rows if row["priority"] == best]
        # If two equally strong official sources genuinely disagree, fail
        # closed rather than assigning a network to the wrong game.
        variants = {r["network"].casefold() for r in candidates}
        if len(variants) > 1:
            conflicts.append({"gender": gender, "day": day, "team_ids": [a, b],
                              "networks": sorted({r["network"] for r in candidates})})
            continue
        chosen = next((r for r in candidates if r["source"].startswith("https://")),
                      candidates[0])
        ids = [r["id"] for r in candidates if r["id"]]
        entries.append({"gender": gender, "day": day, "team_ids": [a, b],
                        "id": ids[0] if len(set(ids)) == 1 else "",
                        "network": chosen["network"], "source": chosen["source"]})
    return {"season": "2026-27", "method": "exact-date-and-two-program-ID; source-backed; no generic conference guessing",
            "entries": entries, "conflicts": conflicts,
            "men_count": sum(e["gender"] == "men" for e in entries),
            "women_count": sum(e["gender"] == "women" for e in entries)}


def main():
    result = build()
    if not result["entries"]:
        raise SystemExit("No verified basketball networks; refusing empty publish")
    OUTPUT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("Published networks:", result["men_count"], "men,",
          result["women_count"], "women; conflicts:", len(result["conflicts"]))


if __name__ == "__main__":
    main()
