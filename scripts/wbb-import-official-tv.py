#!/usr/bin/env python3
"""Evidence-only 2026-27 women's TV source import; zero network guessing.

Uses immutable, cited game-specific official television announcements, and
assigns ESPN women's game IDs only for an unambiguous date + opponent pair.
Game-ID matching is validated against BOTH competing team calendars.
"""
import collections
import datetime as dt
import json
import pathlib
from zoneinfo import ZoneInfo

ROOT = pathlib.Path("data")
MANIFEST = ROOT / "ncaaw-2026-27-official-tv-research.json"
CAL = ROOT / "ncaaw-schedules-2026-27.json"
OFFICIAL = ROOT / "ncaaw-2026-27-official-broadcast-overrides.json"
AUDIT = ROOT / "ncaaw-2026-27-official-tv-research-audit.json"
ET = ZoneInfo("America/New_York")

def read(path):
    return json.loads(path.read_text(encoding="utf-8"))

def day(stamp):
    return dt.datetime.fromisoformat(stamp.replace("Z", "+00:00")).astimezone(ET).date().isoformat()

def main():
    catalog = read(MANIFEST)
    cal = read(CAL)
    old = read(OFFICIAL)
    if any(x.get("season") != "2026-27" or x.get("gender") != "women" for x in (catalog, cal, old)):
        raise RuntimeError("Women's 2026-27 source/season guard failed")
    if len(cal.get("teams", {})) != 363:
        raise RuntimeError("363 women's teams required")
    roster = set(cal["teams"])
    srcs = {s["source_id"]: s for s in catalog["sources"]}
    for s in srcs.values():
        if not s["source_url"].startswith("https://") or "women" not in s["title"].lower():
            raise RuntimeError("Incomplete or non-women's source citation")
    by_id = collections.defaultdict(list)
    for tid, team in cal["teams"].items():
        for g in team.get("games", []):
            if str(g["id"]) == "" or tid not in (str(g["home_id"]), str(g["away_id"])):
                raise RuntimeError("Incomplete women's school game reference")
            by_id[str(g["id"])].append((tid, g))
    by_match = collections.defaultdict(set)
    for gid, entries in by_id.items():
        g = entries[0][1]
        if len(entries) > 2:
            raise RuntimeError("Duplicate team game ledger identity")
        if any(any(str(x.get(k)) != str(g.get(k)) for k in ("date", "home_id", "away_id"))
               for _,x in entries):
            raise RuntimeError("Disagreeing opponent copies for game " + gid)
        by_match[(day(g["date"]), frozenset((str(g["home_id"]), str(g["away_id"]))))].add(gid)
    prior = {}
    for r in old.get("rows", []):
        key = str(r["game_id"])
        if key in prior and r["broadcast"] != prior[key]["broadcast"]:
            raise RuntimeError("Conflicting prior official broadcast " + key)
        prior[key] = r
    # Rules are narrowly allowed only for a conference's *explicit*
    # game-coverage promise, and only after all regular-season matchups
    # are accounted for in a women-specific conference registry.
    researched_rows = list(catalog["rows"])
    media_rule_counts = {}
    for rule in catalog.get("conference_media_rules", []):
        league = read(ROOT / "ncaaw-2026-27-conferences.json")
        if (league.get("gender") != "women" or league.get("season") != "2026-27"
                or int(league.get("verified_team_count",0)) != 363):
            raise RuntimeError("Women's conference registry incomplete")
        league_ids = {str(tid) for tid, info in league["teams"].items()
                      if info.get("conference") == rule["conference"]}
        expected_sizes = {"Atlantic 10 Conference": 14, "American Conference": 13}
        required_size = expected_sizes.get(rule["conference"])
        if required_size is None or len(league_ids) != required_size:
            raise RuntimeError("Unverified women's conference team membership for "+rule["conference"]+
                               ": expected "+str(required_size)+", found "+str(len(league_ids)))
        conference_games = []
        for gid, entries in by_id.items():
            g = entries[0][1]
            d = day(g["date"])
            if (rule["start"] <= d <= rule["end"] and
                    str(g["home_id"]) in league_ids and str(g["away_id"]) in league_ids):
                conference_games.append((gid, d, str(g["away_id"]), str(g["home_id"])))
        expected = int(rule["expected_distinct_conference_games"])
        if len(conference_games) != expected:
            raise RuntimeError("Conference media rule needs "+str(expected)+
                               " unique games, found "+str(len(conference_games))+
                               "; no conference-wide network inference allowed")
        explicitly_scheduled = {(row["date"],frozenset((str(row["away_id"]),str(row["home_id"]))))
                                for row in researched_rows}
        excluded = {(row["date"],frozenset(map(str,row["teams"]))) for row in rule["exclusions"]}
        if not all(key in {(d, frozenset((a,h))) for _,d,a,h in conference_games} for key in excluded):
            raise RuntimeError("Excluded national-TV game is not in official conference schedule")
        generated = 0
        for gid, d, away, home in conference_games:
            key = (d,frozenset((away,home)))
            if key in excluded or key in explicitly_scheduled:
                continue
            # Do not silently override a separately confirmed network.
            if gid in prior and prior[gid]["broadcast"] != rule["mandatory_network"]:
                continue
            researched_rows.append({"date":d,"away_id":away,"home_id":home,
                                    "broadcast":rule["mandatory_network"],
                                    "source_id":rule["source_id"]})
            generated += 1
        media_rule_counts[rule["conference"]] = {
            "conference_games_validated":len(conference_games),
            "streaming_games_generated":generated,
            "linear_or_unresolved_exclusions":len(conference_games)-generated
        }
    added, same, skipped = [], [], []
    seen = set()
    for row in researched_rows:
        source = srcs.get(row.get("source_id"))
        aid, hid = str(row["away_id"]), str(row["home_id"])
        key = (row["date"], frozenset((aid, hid)))
        if not source or aid not in roster or hid not in roster or aid == hid:
            raise RuntimeError("Unknown source or women's team on " + str(row))
        if key in seen:
            raise RuntimeError("Duplicate researched date/team combination")
        seen.add(key)
        ids = by_match.get(key, set())
        if len(ids) != 1:
            skipped.append({"date":row["date"],"away_id":aid,"home_id":hid,
                            "network":row["broadcast"],"reason":"missing_or_nonunique_team_date",
                            "candidate_count":len(ids),"source_url":source["source_url"]})
            continue
        gid = next(iter(ids))
        template = by_id[gid][0][1]
        if row.get("site") != "neutral" and (str(template["away_id"]) != aid or str(template["home_id"]) != hid):
            skipped.append({"game_id":gid,"date":row["date"],"network":row["broadcast"],
                            "reason":"official_vs_calendar_home_away_conflict",
                            "source_url":source["source_url"]})
            continue
        old_row = prior.get(gid)
        if old_row:
            def normalize(s):
                s=str(s).upper().replace(" ", "").replace("-", "")
                return {"SECN+":"SECNETWORK+","ACCNX":"ACCNETWORKEXTRA",
                        "CBSSN":"CBSSPORTSNETWORK"}.get(s, s)
            if normalize(old_row["broadcast"]) != normalize(row["broadcast"]):
                skipped.append({"game_id":gid,"reason":"conflicting_official_broadcast",
                                "prior":old_row["broadcast"],"researched":row["broadcast"],
                                "source_url":source["source_url"]})
            else:
                same.append(gid)
            continue
        prior[gid] = {"game_id":gid,"broadcast":row["broadcast"],
                      "source_url":source["source_url"],"source_type":source["source_type"],
                      "verified_on":"2026-10-29"}
        added.append(gid)
    # Preserve all previously sourced official games. Never replace an existing
    # official designation with an assumed single network.
    old["rows"] = list(prior.values())
    old["sources"] = list(dict.fromkeys(list(old.get("sources",[])) + [s["source_url"] for s in srcs.values()]))
    report = {"season":"2026-27","gender":"women","research_rows":len(researched_rows),"published_source_research_rows":len(catalog["rows"]),
              "conference_media_rule_audit":media_rule_counts,
              "matched_new_official_game_ids":len(added),"previously_official_game_ids":len(same),
              "unmatched_or_disputed":len(skipped),"new_game_ids":sorted(added),
              "skipped_details":skipped,"official_unique_games":len(prior),
              "source_urls":[s["source_url"] for s in srcs.values()],
              "policy":"No broadcast inferred from conference rights; only cited game-by-game assignments with uniquely matching school IDs and local date."}
    for path, payload in ((OFFICIAL,old),(AUDIT,report)):
        body=json.dumps(payload,indent=2,ensure_ascii=False)+"\n"
        if not path.exists() or path.read_text(encoding="utf-8") != body:
            path.write_text(body,encoding="utf-8")
    print("WBB OFFICIAL TV:",json.dumps({k:v for k,v in report.items() if k not in ("skipped_details","new_game_ids")}))
    if len(added) < 12:
        raise RuntimeError("Too few newly source-matched games; inspect research audit")
if __name__ == "__main__":
    main()
