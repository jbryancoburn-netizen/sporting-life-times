"""Stage Division I player stat cohorts for the men's and women's player register."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1] / "data"
SEASON = 2027
METRICS = ("avgPoints", "avgRebounds", "avgAssists", "avgSteals", "avgBlocks", "avgMinutes")
MIN_GAMES = 3


def read(name):
    return json.loads((ROOT / name).read_text())


def directory(gender):
    prefix = "ncaaw" if gender == "women" else "ncaam"
    table = read(f"{prefix}-2026-27-retro-primary.json")["rankings"]
    lookup = {str(t["id"]): str(t["espn_id"]) for t in
              read("ncaam-2026-27-espn-team-crosswalk.json")["teams"]} if gender == "men" else {}
    return {(lookup.get(str(t["team_id"])) if gender == "men" else str(t["team_id"])):
            [str(t["team_id"]), t["team"], t.get("conference")] for t in table
            if gender == "women" or str(t["team_id"]) in lookup}


def build(gender):
    league = gender + "s-college-basketball"
    url = f"https://site.web.api.espn.com/apis/common/v3/sports/basketball/{league}/statistics/byathlete"
    teams = directory(gender)

    def page(number):
        query = urlencode({"season": SEASON, "limit": 1000, "page": number})
        request = Request(f"{url}?{query}", headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(request, timeout=18) as response:
            data = json.load(response)
        if (data["requestedSeason"]["year"] != SEASON or data["league"]["slug"] != league
                or data["pagination"]["page"] != number):
            raise ValueError("Unexpected season, league, or page")
        return data

    first = page(1)
    pagination = first["pagination"]
    count = pagination["count"]
    if not 2 <= pagination["pages"] <= 20 or count < 3000 or len(teams) < 350:
        raise ValueError("Division I cohort is incomplete")
    with ThreadPoolExecutor(max_workers=6) as pool:
        pages = [first, *pool.map(page, range(2, pagination["pages"] + 1))]
    rows = {}
    ids = set()
    for chunk in pages:
        if chunk["pagination"]["count"] != count:
            raise ValueError("Published player table changed during download")
        columns = {category["name"]: category["names"] for category in chunk["categories"]}
        for entry in chunk["athletes"]:
            athlete = entry["athlete"]
            athlete_id = str(athlete["id"])
            ids.add(athlete_id)
            affiliations = {str(t["id"]) for t in athlete.get("teams", [])}
            team = str(athlete.get("teamId", ""))
            if team not in teams or affiliations != {team}:
                continue
            values = {}
            for category in entry["categories"]:
                values.update(zip(columns[category["name"]], category["totals"]))
            try:
                games = int(values["gamesPlayed"])
            except (KeyError, ValueError):
                continue
            if games < MIN_GAMES:
                continue
            stats = [float(values[m]) if values.get(m) not in (None, "", "-") else None for m in METRICS]
            rows[athlete_id] = [team, *stats]
    if len(ids) < count * .98 or len(rows) < 1000:
        raise ValueError(f"Only {len(ids)} of {count} player rows and {len(rows)} eligible Division I players")
    data = {"gender": gender, "season": SEASON, "asOf": datetime.now(timezone.utc).isoformat(),
            "minimumGames": MIN_GAMES, "metrics": METRICS, "teams": teams, "players": rows}
    target = ROOT / f"cbb-player-rankings-{gender}.json"
    target.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n")
    print(f"{gender}: {len(rows)} ranked players across {len({r[0] for r in rows.values()})} Division I schools")


if __name__ == "__main__":
    failures = []
    for gender in ("men", "women"):
        try:
            build(gender)
        except (OSError, ValueError, KeyError, TypeError) as error:
            failures.append(f"{gender}: {error}")
    if failures:
        raise SystemExit("; ".join(failures))
