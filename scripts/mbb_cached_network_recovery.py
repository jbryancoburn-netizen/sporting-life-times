#!/usr/bin/env python3
"""Recover explicitly announced Division I basketball broadcasts and tipoffs.

Offline; only previously saved official conference, broadcaster, and SEC game
records. Requires exact date and both team identities; no guessed assignments.
"""
import collections
import json
import pathlib
import re

DATA = pathlib.Path(__file__).resolve().parents[1] / "data"
SCHEDULES = DATA / "mbb-schedules-2026-27"
SOURCES = (
    ("mbb-official-conference-game-evidence.json", "conference"),
    ("mbb-network-grid-evidence.json", "broadcaster"),
    ("mbb-sec-official-feed-recovery.json", "sec"),
    ("mbb-additional-conference-game-evidence.json", "conference"),
    ("mbb-american-a10-cusa-game-evidence.json", "conference"),
    ("mbb-october-conference-evidence.json", "conference"),
    ("mbb-patriot-summit-game-evidence.json", "conference"),
    ("mbb-western-conference-game-evidence.json", "conference"),
)
SKIP = re.compile(r"(?i)\b(?:TBA|TBD|unknown|wild\s*card|to\s+be\s+announced|unannounced)\b")
CLOCK = re.compile(r"(?i)^(?:(?:[01]?\d|2[0-3])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)|noon|midnight)(?:\s+(?:ET|CT|MT|PT|EST|EDT|CST|CDT|MST|MDT|PST|PDT))?$")
ZONES = re.compile(r"\b(ET|CT|MT|PT|EST|EDT|CST|CDT|MST|MDT|PST|PDT)\b", re.I)
ALIASES = {
    "ACCN": "ACC NETWORK", "ACCNX": "ACC NETWORK EXTRA",
    "SECN": "SEC NETWORK", "SECN+": "SEC NETWORK+",
    "BTN": "BIG TEN NETWORK", "B1G+": "BIG TEN+",
    "BIG TEN PLUS": "BIG TEN+", "CBSSN": "CBS SPORTS NETWORK",
    "FS1": "FOX SPORTS 1", "FS2": "FOX SPORTS 2",
}

def norm(s):
    s = re.sub(r"\s+", " ", str(s or "").strip()).upper()
    return ALIASES.get(s, s)

def safe_network(v):
    s = str(v or "").strip()
    if not 2 <= len(s) <= 44 or SKIP.search(s) or re.search(r"(?i)(?:\sOR\s|[|?,])", s) or ("/" in s and norm(s) not in ("K5/MW+",)):
        return ""
    if not re.fullmatch(r"[\w\s+()./&'-]+", s):
        return ""
    return s

def url_valid(url):
    return str(url or "").startswith("https://") and "espn.com/schedule" not in str(url)

def clock_with_zone(row, default_zone):
    value = str(row.get("time") or "").strip()
    if not CLOCK.fullmatch(value) or SKIP.search(value):
        return ""
    zone = ZONES.search(value)
    tz = zone.group(1).upper() if zone else str(row.get("timezone") or default_zone or "").upper()
    if not ZONES.fullmatch(tz):
        return ""
    return value if zone else value + " " + tz

def normalized_clock(clock):
    """Compare differing printed forms without treating 7 PM and 7:00 p.m. as conflicts."""
    raw = re.sub(r"[.\s]+", " ", str(clock or "").strip().upper()).replace("A M", "AM").replace("P M", "PM")
    raw = re.sub(r"\s+", " ", raw).strip()
    m = re.fullmatch(r"(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s+(ET|CT|MT|PT|EST|EDT|CST|CDT|MST|MDT|PST|PDT)", raw)
    if not m:
        special = re.fullmatch(r"(NOON|MIDNIGHT)\s+(ET|CT|MT|PT|EST|EDT|CST|CDT|MST|MDT|PST|PDT)", raw)
        if special:
            return ("12:00 PM" if special.group(1) == "NOON" else "12:00 AM", special.group(2)[:1])
        return raw
    return (f"{int(m.group(1))}:{m.group(2) or '00'} {m.group(3)}", m.group(4)[:1])

def load_evidence():
    grouped = collections.defaultdict(list)
    skipped = collections.Counter()
    for name, kind in SOURCES:
        obj = json.loads((DATA / name).read_text())
        rows = obj.get("official_game_evidence") if kind == "sec" else obj.get("rows", [])
        for row in rows:
            ids = row.get("teams") if kind == "sec" else [row.get("visitor_id"), row.get("host_id")]
            day = str(row.get("date") or "")[:10]
            if not isinstance(ids, list) or len(ids) != 2 or any(not str(x or "").isdigit() for x in ids) or ids[0] == ids[1] or not re.fullmatch(r"202[67]-\d\d-\d\d", day):
                skipped["unresolved_teams_or_date"] += 1
                continue
            source = row.get("source_url") or obj.get("source_url")
            if not url_valid(source):
                skipped["no_official_source"] += 1
                continue
            raw = row.get("broadcasts") if kind == "sec" else [row.get("tv")]
            if isinstance(raw, str):
                raw = [raw]
            names = [safe_network(n) for n in (raw or [])]
            names = sorted({n for n in names if n}, key=norm)
            time = clock_with_zone(row, obj.get("timezone") or ("ET" if kind == "sec" else ""))
            if not names and not time:
                skipped["no_safe_fields"] += 1
                continue
            key = (day, tuple(sorted(map(str, ids))))
            grouped[key].append({"networks": names, "time": time, "source_url": source, "kind": kind})
    return grouped, skipped

def recover():
    teams = json.loads((DATA / "ncaam-2026-27-espn-team-crosswalk.json").read_text())["teams"]
    owners = {str(t["espn_id"]) for t in teams}
    assert len(owners) == 365, "Require 365 school identities"
    docs = {}
    for owner in owners:
        path = SCHEDULES / (owner + ".json")
        if not path.exists():
            raise RuntimeError("Missing schedule " + owner)
        docs[owner] = (path, json.loads(path.read_text()))
    evidence, skipped = load_evidence()
    # A duplicate date/opponent pair within the same school is not a unique fixture.
    game_keys = collections.Counter()
    for owner, (_, doc) in docs.items():
        for game in doc.get("events", []):
            ps = (game.get("competitions") or [{}])[0].get("competitors") or []
            ids = [str((p.get("team") or {}).get("id") or "") for p in ps]
            day = str(game.get("date") or "")[:10]
            if len(ids) == 2 and owner in ids and all(x in owners for x in ids) and ids[0] != ids[1]:
                game_keys[(owner, day, tuple(sorted(ids)))] += 1
    counts = collections.Counter()
    changes, conflicts, changed = [], [], set()
    for owner, (path, doc) in docs.items():
        for game in doc.get("events", []):
            ps = (game.get("competitions") or [{}])[0].get("competitors") or []
            ids = [str((p.get("team") or {}).get("id") or "") for p in ps]
            day = str(game.get("date") or "")[:10]
            if len(ids) != 2 or owner not in ids or any(x not in owners for x in ids) or ids[0] == ids[1]:
                continue
            key = (day, tuple(sorted(ids)))
            if game_keys[(owner, *key)] != 1:
                counts["nonunique_school_game_skipped"] += 1
                continue
            facts = evidence.get(key, [])
            if not facts:
                continue
            counts["exact_matching_entries"] += 1
            competition = game["competitions"][0]
            tv = [x for x in facts if x["networks"]]
            network_sets = {tuple(sorted(norm(n) for n in x["networks"])) for x in tv}
            if len(network_sets) > 1:
                counts["network_conflicts"] += 1
                if len(conflicts) < 120:
                    conflicts.append({"school_id": owner, "event_id": game.get("id"), "date": day,
                                      "issue": "conflicting_network_sources", "values": [list(v) for v in network_sets]})
            elif len(network_sets) == 1 and not (competition.get("broadcasts") or game.get("broadcasts") or game.get("broadcast")):
                candidate = tv[0]
                competition["broadcasts"] = [{"names": candidate["networks"], "source_url": candidate["source_url"],
                                              "verified_via": "saved_official_schedule_2026-27"}]
                game["broadcast_source_url"] = candidate["source_url"]
                counts["networks_added"] += 1
                changed.add(owner)
                changes.append({"school_id": owner, "event_id": game.get("id"), "date": day,
                                "field": "network", "value": candidate["networks"], "source_url": candidate["source_url"]})
            times = {normalized_clock(x["time"]): x for x in facts if x["time"]}
            prior = str(game.get("official_school_time") or "").strip()
            other = str(game.get("official_time") or "").strip()
            if len(times) > 1:
                counts["time_conflicts"] += 1
            elif len(times) == 1 and not CLOCK.fullmatch(prior) and not CLOCK.fullmatch(other):
                candidate = next(iter(times.values()))
                game["official_school_time"] = candidate["time"]
                game["official_school_time_source"] = candidate["source_url"]
                game["official_school_time_verified_via"] = "saved_official_schedule_2026-27"
                counts["tipoffs_added"] += 1
                changed.add(owner)
                changes.append({"school_id": owner, "event_id": game.get("id"), "date": day,
                                "field": "tipoff", "value": candidate["time"], "source_url": candidate["source_url"]})
    for owner in changed:
        path, doc = docs[owner]
        path.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n")
    # Final audit is calculated AFTER all offline recovery updates, rather than
    # reporting pre-recovery counts from the earlier reciprocal-source step.
    post = collections.Counter()
    for _, doc in docs.values():
        for game in doc.get("events", []):
            post["game_entries"] += 1
            if not CLOCK.fullmatch(str(game.get("official_school_time") or "").strip()) and not CLOCK.fullmatch(str(game.get("official_time") or "").strip()):
                post["missing_tipoff"] += 1
            comp = (game.get("competitions") or [{}])[0]
            if not (comp.get("broadcasts") or game.get("broadcasts") or game.get("broadcast")):
                post["missing_broadcast"] += 1
            if game.get("site_verified") is not True:
                post["site_unverified"] += 1
    report = {
        "season": "2026-27",
        "summary": {"schools_scanned": len(docs), "schools_changed": len(changed),
                    "game_records_changed": len(set((x["school_id"], x["event_id"]) for x in changes)),
                    **dict(counts), "evidence_game_keys": len(evidence), "evidence_skipped": dict(skipped),
                    "final_field_audit": dict(post)},
        "policy": "Exact date/two-team-ID matching; verified official sources only; no replacement of existing network or tipoff; disagreements logged.",
        "changes": changes, "conflicts": conflicts,
    }
    (DATA / "mbb-cached-network-recovery-20261101.json").write_text(json.dumps(report, indent=2) + "\n")
    manifest = DATA / "mbb-official-recheck-365-verification.json"
    if manifest.exists():
        existing = json.loads(manifest.read_text())
        existing["saved_broadcast_recovery"] = report
        existing["final_field_audit"] = dict(post)
        manifest.write_text(json.dumps(existing, indent=2) + "\n")
    print(json.dumps(report["summary"], indent=2))
    return report["summary"]

if __name__ == "__main__":
    recover()
