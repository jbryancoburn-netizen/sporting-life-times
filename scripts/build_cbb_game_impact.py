"""Stage verified Division I box-score lines for RETRO Game Impact."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import json
from pathlib import Path
from urllib.request import urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1] / "data"
PUBLIC = "https://jbryancoburn-netizen.github.io/sporting-life-times/data/"
SEASON = "2026-27"
WORKERS = 24


def read(url):
    with urlopen(url, timeout=8) as response:
        return json.load(response)


def box(gender, event_id, signature):
    try:
        raw = read(f"https://site.api.espn.com/apis/site/v2/sports/basketball/"
                   f"{gender}s-college-basketball/summary?event={event_id}")
        header = raw["header"]
        contest, = header["competitions"]
        expected = {"home": (signature[0], signature[2]), "away": (signature[1], signature[3])}
        actual = {t["homeAway"]: (str(t["team"]["id"]), int(t["score"]))
                  for t in contest["competitors"]}
        if str(header["id"]) != event_id or not contest["status"]["type"]["completed"] or actual != expected:
            return None
        groups = {}
        identities = set()
        for group in raw["boxscore"]["players"]:
            team = str(group["team"]["id"])
            if team in groups:
                return None
            section, = [s for s in group["statistics"] if "PTS" in s.get("labels", [])]
            rows = []
            for athlete in section["athletes"]:
                if athlete.get("didNotPlay"):
                    continue
                fields = dict(zip(section["labels"], athlete["stats"], strict=True))
                minutes = fields["MIN"]
                if minutes == "--":
                    continue
                fg, fga = map(int, fields["FG"].split("-"))
                ft, fta = map(int, fields["FT"].split("-"))
                stats = [int(fields[k]) for k in ("PTS", "OREB", "DREB", "AST", "STL", "BLK", "TO")]
                points, offensive, defensive, *_ = stats
                if min(*stats, fg, ft) < 0 or fg > fga or ft > fta or offensive + defensive != int(fields["REB"]):
                    return None
                if minutes == "0" and not any([*stats, fga, fta]):
                    continue
                person = athlete["athlete"]
                ident = str(person["id"])
                if not ident.isdecimal() or ident in identities or not person["displayName"]:
                    return None
                identities.add(ident)
                rows.append([ident, person["displayName"], *stats, fga, fta])
            groups[team] = rows
        if set(groups) != set(signature[:2]) or any(
            not groups[team] or sum(row[2] for row in groups[team]) != points
            for team, points in expected.values()
        ):
            return None
        day = datetime.fromisoformat(contest["date"].replace("Z", "+00:00")).astimezone(
            ZoneInfo("America/New_York")).date().isoformat()
        return {"signature": signature, "day": day, "home": groups[signature[0]],
                "away": groups[signature[1]]}
    except (OSError, ValueError, TypeError, KeyError):
        return None


def build(gender):
    prefix = "ncaaw" if gender == "women" else "ncaam"
    ledger = json.loads((ROOT / f"{prefix}-{SEASON}-retro-primary.json").read_text())
    if ledger["season"] != SEASON:
        raise ValueError("Unexpected ledger season")
    ids = {str(t["team_id"]): str(t["team_id"]) for t in ledger["rankings"]}
    if gender == "men":
        crosswalk = json.loads((ROOT / f"ncaam-{SEASON}-espn-team-crosswalk.json").read_text())
        ids = {str(t["id"]): str(t["espn_id"]) for t in crosswalk["teams"]}
    teams = {ids[t["team_id"]]: [t["team_id"], t["team"], t.get("conference") or ""]
             for t in ledger["rankings"] if t["team_id"] in ids}
    expected = {}
    for row in sorted(ledger["events"], key=lambda g: (g["date"], str(g["id"])), reverse=True):
        ident = str(row["id"]).removeprefix("espn:")
        if len(ident) != 9 or not ident.startswith("401") or not ident.isdecimal():
            continue
        home, away = (ids.get(str(row[k])) for k in ("home_id", "away_id"))
        if home in teams and away in teams and home != away:
            expected[ident] = [home, away, row["home_score"], row["away_score"]]
    name = f"cbb-game-impact-{gender}.json"
    try:
        previous = read(PUBLIC + name)
    except (OSError, ValueError):
        previous = {}
    if previous.get("version") != 1 or previous.get("season") != SEASON or previous.get("gender") != gender:
        previous = {}
    games = {key: value for key, value in previous.get("games", {}).items()
             if expected.get(key) == value.get("signature")}
    earlier_attempts = previous.get("attempts", {})
    pending = sorted((key for key in expected if key not in games),
                     key=lambda key: earlier_attempts.get(key, 0))
    attempts = {key: count for key, count in earlier_attempts.items() if key in expected and key not in games}
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        results = pool.map(lambda key: box(gender, key, expected[key]), pending)
        for key, value in zip(pending, results, strict=True):
            if value:
                games[key] = value
                attempts.pop(key, None)
            else:
                attempts[key] = attempts.get(key, 0) + 1
    output = {"version": 1, "gender": gender, "season": SEASON, "expected": len(expected),
              "teams": teams, "games": games, "attempts": attempts}
    (ROOT / name).write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"{gender}: {len(games)}/{len(expected)} matching complete box scores")


if __name__ == "__main__":
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(build, ("men", "women")))
