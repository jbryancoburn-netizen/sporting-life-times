#!/usr/bin/env python3
"""Build the independent 2026 NFL newspaper from dated source scoreboards.

Every team is reset to 1500 before Week 1. No earlier seasons affect NFL Elo.
Completed REGULAR-SEASON games alone update Elo, replayed chronologically.
ESPN is attributed for schedules, scores and available game box scores.
"""
import json
import math
import os
import random
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
EDITION = DATA / "nfl-2026.json"
BOXES = DATA / "nfl-boxscores-2026.json"
ROSTERS = DATA / "nfl-rosters-2026.json"
SEASON = 2026
K = 22
HOME_ELO = 55
FULL_WEEKS = range(1, 19)
BASE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl"
UA = "SportingLifeTimes/1.0 (+independent football newspaper)"
# Fixed division identity, independent of incomplete in-game source metadata.
DIVISIONS = {
    "AFC East": "BUF MIA NE NYJ", "AFC North": "BAL CIN CLE PIT",
    "AFC South": "HOU IND JAX TEN", "AFC West": "DEN KC LAC LV",
    "NFC East": "DAL NYG PHI WSH", "NFC North": "CHI DET GB MIN",
    "NFC South": "ATL CAR NO TB", "NFC West": "ARI LAR SF SEA",
}
COLORS = {
    "ARI": ("#97233F", "#000000"), "ATL": ("#A71930", "#000000"),
    "BAL": ("#241773", "#9E7C0C"), "BUF": ("#00338D", "#C60C30"),
    "CAR": ("#0085CA", "#101820"), "CHI": ("#0B162A", "#C83803"),
    "CIN": ("#FB4F14", "#000000"), "CLE": ("#311D00", "#FF3C00"),
    "DAL": ("#003594", "#869397"), "DEN": ("#FB4F14", "#002244"),
    "DET": ("#0076B6", "#B0B7BC"), "GB": ("#203731", "#FFB612"),
    "HOU": ("#03202F", "#A71930"), "IND": ("#002C5F", "#A2AAAD"),
    "JAX": ("#006778", "#D7A22A"), "KC": ("#E31837", "#FFB81C"),
    "LAC": ("#0080C6", "#FFC20E"), "LAR": ("#003594", "#FFA300"),
    "LV": ("#000000", "#A5ACAF"), "MIA": ("#008E97", "#FC4C02"),
    "MIN": ("#4F2683", "#FFC62F"), "NE": ("#002244", "#C60C30"),
    "NO": ("#D3BC8D", "#101820"), "NYG": ("#0B2265", "#A71930"),
    "NYJ": ("#125740", "#000000"), "PHI": ("#004C54", "#A5ACAF"),
    "PIT": ("#FFB612", "#101820"), "SEA": ("#002244", "#69BE28"),
    "SF": ("#AA0000", "#B3995D"), "TB": ("#D50A0A", "#FF7900"),
    "TEN": ("#0C2340", "#4B92DB"), "WSH": ("#5A1414", "#FFB612"),
}
NAMES = {
    "ARI":"Arizona Cardinals","ATL":"Atlanta Falcons","BAL":"Baltimore Ravens",
    "BUF":"Buffalo Bills","CAR":"Carolina Panthers","CHI":"Chicago Bears",
    "CIN":"Cincinnati Bengals","CLE":"Cleveland Browns","DAL":"Dallas Cowboys",
    "DEN":"Denver Broncos","DET":"Detroit Lions","GB":"Green Bay Packers",
    "HOU":"Houston Texans","IND":"Indianapolis Colts","JAX":"Jacksonville Jaguars",
    "KC":"Kansas City Chiefs","LAC":"Los Angeles Chargers","LAR":"Los Angeles Rams",
    "LV":"Las Vegas Raiders","MIA":"Miami Dolphins","MIN":"Minnesota Vikings",
    "NE":"New England Patriots","NO":"New Orleans Saints","NYG":"New York Giants",
    "NYJ":"New York Jets","PHI":"Philadelphia Eagles","PIT":"Pittsburgh Steelers",
    "SEA":"Seattle Seahawks","SF":"San Francisco 49ers","TB":"Tampa Bay Buccaneers",
    "TEN":"Tennessee Titans","WSH":"Washington Commanders",
}
ESPN_ALIASES = {"WAS":"WSH","WSH":"WSH","JAC":"JAX","LA":"LAR","STL":"LAR",
                "OAK":"LV","SD":"LAC","SDG":"LAC","WS":"WSH"}
TEAM_DIV = {code: division for division, line in DIVISIONS.items() for code in line.split()}


def get_json(url, timeout=24):
    request = Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise ValueError("HTTP %s from %s" % (response.status, url))
        return json.load(response)


def load_file(path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        return fallback


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def number(value, default=None):
    try:
        if value is None or str(value).strip() in ("", "--", "-"):
            return default
        return float(str(value).replace(",", "").replace("%", ""))
    except (ValueError, TypeError):
        return default


def code_for(raw):
    return ESPN_ALIASES.get(str(raw or "").upper(), str(raw or "").upper())


def parse_event(event, week):
    season_type = (event.get("season") or {}).get("type")
    if season_type is not None and int(season_type) != 2:
        return None
    competition = (event.get("competitions") or [{}])[0]
    contestants = competition.get("competitors") or []
    if len(contestants) != 2:
        return None
    sides = {}
    for side in ("away", "home"):
        record = next((x for x in contestants if x.get("homeAway") == side), None)
        if not record:
            return None
        team = record.get("team") or {}
        code = code_for(team.get("abbreviation"))
        if code not in TEAM_DIV:
            raise ValueError("Unrecognized 2026 NFL team %r" % code)
        raw_score = record.get("score")
        value = number(raw_score)
        sides[side] = {
            "code":code, "name":NAMES[code], "id":str(team.get("id") or ""),
            "logo":team.get("logo") or "", "score":int(value) if value is not None else None,
        }
    if sides["home"]["code"] == sides["away"]["code"]:
        raise ValueError("Duplicate home/away team in event " + str(event.get("id")))
    status = (event.get("status") or {}).get("type") or {}
    state = status.get("state") or "pre"
    if status.get("completed"):
        state = "post"
    if state not in ("pre", "in", "post"):
        state = "pre"
    if state == "post" and any(sides[x]["score"] is None for x in sides):
        raise ValueError("Completed event lacks a final score " + str(event.get("id")))
    if state == "pre":
        sides["home"]["score"] = sides["away"]["score"] = None
    broadcasts = competition.get("broadcasts") or []
    broadcast = ", ".join(dict.fromkeys(
        name for entry in broadcasts
        for name in (entry.get("names") or []) if name
    ))
    venue = competition.get("venue") or {}
    address = venue.get("address") or {}
    event_id = str(event.get("id") or "")
    if not event_id:
        return None
    return {
        "id":event_id, "week":week, "date":event.get("date") or "",
        "state":state, "status":status.get("shortDetail") or status.get("description") or "",
        "away":sides["away"], "home":sides["home"], "neutral":bool(competition.get("neutralSite")),
        "venue":venue.get("fullName") or "",
        "city":address.get("city") or "", "broadcast":broadcast,
        "url":"https://www.espn.com/nfl/game/_/gameId/" + event_id,
        "source":"ESPN NFL scoreboard",
    }


def get_week(week):
    query = urlencode({"dates":str(SEASON),"seasontype":2,"week":week,"limit":100})
    raw = get_json(BASE + "/scoreboard?" + query)
    events = raw.get("events")
    if not isinstance(events, list) or not events:
        raise ValueError("No scoreboard events returned for Week %s" % week)
    parsed = [parse_event(event, week) for event in events]
    return week, [game for game in parsed if game]


def chronological_date(value):
    try:
        return datetime.fromisoformat(value.replace("Z","+00:00"))
    except (ValueError, TypeError, AttributeError):
        return datetime.min.replace(tzinfo=timezone.utc)


def get_games(now):
    old = load_file(EDITION, {})
    existing = {g["id"]:g for g in old.get("games", []) if g.get("id")}
    fast = "--fast" in sys.argv and len(existing) >= 250
    if fast:
        future = sorted((g for g in existing.values() if g.get("state") != "post"
                         and chronological_date(g.get("date")) >= now),
                        key=lambda x:x.get("date") or "")
        focus = (future[0].get("week") if future else 18)
        weeks = sorted(set(w for w in (int(focus)-1, int(focus), int(focus)+1)
                           if 1 <= w <= 18))
        # On Tuesday, the prior weekend is still in the previous week.
    else:
        weeks = list(FULL_WEEKS)
    results = {}
    errors = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(get_week, week):week for week in weeks}
        for future in as_completed(futures):
            week = futures[future]
            try:
                _, events = future.result()
                results[week] = events
            except Exception as exc:
                errors.append("%s: %s" % (week, str(exc)))
    if errors:
        raise RuntimeError("NFL source incomplete; retaining prior published data. " +
                           "; ".join(errors))
    for week in weeks:
        for game in results[week]:
            existing[game["id"]] = game
    games = sorted(existing.values(), key=lambda x:(x.get("date") or "",x["id"]))
    codes = set(x["away"]["code"] for x in games) | set(x["home"]["code"] for x in games)
    if len(codes) != 32:
        raise RuntimeError("Expected 32 teams, found %s. Refusing partial NFL publish." % len(codes))
    if len(games) != 272:
        raise RuntimeError("Expected 272 regular season fixtures, found %s. Refusing partial NFL publish." % len(games))
    appearances = {code:0 for code in TEAM_DIV}
    for game in games:
        for side in ("away","home"):
            appearances[game[side]["code"]] += 1
    bad = {k:v for k,v in appearances.items() if v != 17}
    if bad:
        raise RuntimeError("Incomplete team schedule; every club must have 17 games: %s" % bad)
    return games, weeks, fast


def make_teams(games):
    teams = {}
    for code, name in NAMES.items():
        division = TEAM_DIV[code]
        teams[code] = {
            "code":code,"name":name,"division":division,"conference":division[:3],
            "colors":list(COLORS[code]),"logo":"","espn_id":"",
            "wins":0,"losses":0,"ties":0,"played":0,"pf":0,"pa":0,
            "elo":1500.0,"elo_delta":0.0, "last_five":[],
        }
    for game in games:
        for side in ("away","home"):
            incoming = game[side]
            team = teams[incoming["code"]]
            if incoming.get("logo"):
                team["logo"] = incoming["logo"]
            if incoming.get("id"):
                team["espn_id"] = incoming["id"]
    return teams


def expectancy(home, away, neutral):
    adjusted = home - away + (0 if neutral else HOME_ELO)
    return 1.0 / (1.0 + 10 ** (-adjusted / 400.0))


def replay_elo(games, teams):
    now = datetime.now(timezone.utc)
    for game in games:
        away, home = (teams[game[side]["code"]] for side in ("away","home"))
        if game["state"] != "post":
            continue
        hs, aws = game["home"]["score"], game["away"]["score"]
        if hs is None or aws is None:
            raise RuntimeError("Final missing points: " + game["id"])
        expected = expectancy(home["elo"],away["elo"],game.get("neutral",False))
        actual = 1.0 if hs > aws else (0.0 if hs < aws else 0.5)
        # Gentle margin adjustment, capped so blowouts never dominate the season.
        multiplier = min(1.5, 1.0 + 0.14 * math.log1p(abs(hs - aws)))
        change = K * multiplier * (actual - expected)
        game["pregame_elo_home"] = round(home["elo"],2)
        game["pregame_elo_away"] = round(away["elo"],2)
        game["home_win_probability"] = round(expected,4)
        game["home_elo_change"] = round(change,2)
        game["away_elo_change"] = round(-change,2)
        home["elo"] += change
        away["elo"] -= change
        home["elo_delta"] = change
        away["elo_delta"] = -change
        for team, points_for, points_against, score in (
            (home,hs,aws,actual),(away,aws,hs,1-actual)):
            team["played"] += 1
            team["pf"] += points_for
            team["pa"] += points_against
            if score == 1:
                team["wins"] += 1
                team["last_five"].append("W")
            elif score == 0:
                team["losses"] += 1
                team["last_five"].append("L")
            else:
                team["ties"] += 1
                team["last_five"].append("T")
            team["last_five"] = team["last_five"][-5:]
    for team in teams.values():
        team["elo"] = round(team["elo"],2)
        team["elo_delta"] = round(team["elo_delta"],2)
        team["win_pct"] = round((team["wins"] + team["ties"]/2) / team["played"],4) if team["played"] else 0
        team["points_per_game"] = round(team["pf"]/team["played"],1) if team["played"] else None
        team["allowed_per_game"] = round(team["pa"]/team["played"],1) if team["played"] else None
        team["point_diff"] = team["pf"] - team["pa"]
    # Future games use today's ratings, not ratings back at the season opener.
    for game in games:
        if game["state"] == "post":
            continue
        away, home = (teams[game[side]["code"]] for side in ("away","home"))
        p = expectancy(home["elo"],away["elo"],game.get("neutral",False))
        home_o = (home["pf"] + 4*22.0) / (home["played"]+4)
        away_o = (away["pf"] + 4*22.0) / (away["played"]+4)
        home_d = (home["pa"] + 4*22.0) / (home["played"]+4)
        away_d = (away["pa"] + 4*22.0) / (away["played"]+4)
        base_total = max(27.0,min(65.0, (home_o + away_d + away_o + home_d)/2))
        rating_gap = home["elo"] - away["elo"] + (0 if game.get("neutral") else HOME_ELO)
        margin = max(-22,min(22,rating_gap/36.0))
        game["home_win_probability"] = round(p,4)
        game["projected_home_score"] = round(max(0,base_total/2 + margin/2))
        game["projected_away_score"] = round(max(0,base_total/2 - margin/2))
    total = sum(x["elo"] for x in teams.values())
    if abs(total-48000.0)>1:
        raise RuntimeError("Elo conservation violated: %.3f" % total)


def parse_box(game):
    raw = get_json(BASE + "/summary?event=" + game["id"])
    box = raw.get("boxscore") or {}
    players = []
    for lineup in box.get("players") or []:
        team = code_for((lineup.get("team") or {}).get("abbreviation"))
        if team not in TEAM_DIV:
            continue
        for group in lineup.get("statistics") or []:
            category = str(group.get("name") or group.get("displayName") or "").lower()
            labels = group.get("labels") or []
            if not category or not labels:
                continue
            for athlete in group.get("athletes") or []:
                person = athlete.get("athlete") or {}
                pid = str(person.get("id") or "")
                vals = athlete.get("stats") or []
                stats = {str(label).upper(): number(value, 0) for label,value in zip(labels,vals)
                         if number(value) is not None}
                if not pid or not stats:
                    continue
                head = person.get("headshot") or {}
                players.append({
                    "id":pid,"name":person.get("displayName") or person.get("fullName") or "",
                    "team":team,"position":(person.get("position") or {}).get("abbreviation") or "",
                    "headshot":head.get("href") if isinstance(head,dict) else (head or ""),
                    "category":category,"stats":stats,
                })
    teamstats = {}
    for group in box.get("teams") or []:
        code = code_for((group.get("team") or {}).get("abbreviation"))
        if code not in TEAM_DIV:
            continue
        teamstats[code] = {}
        for row in group.get("statistics") or []:
            key = row.get("name") or row.get("label") or ""
            val = number(row.get("displayValue") or row.get("value"))
            if key and val is not None:
                teamstats[code][key] = val
    return {"players":players,"team_stats":teamstats}


def get_boxes(games):
    existing = load_file(BOXES,{})
    boxgames = existing.get("games") or {}
    finals = [g for g in games if g["state"] == "post"]
    missing = [g for g in finals if g["id"] not in boxgames]
    if missing:
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = {pool.submit(parse_box, g):g["id"] for g in missing}
            for future in as_completed(futures):
                eid = futures[future]
                try:
                    result = future.result()
                    if result.get("players") or result.get("team_stats"):
                        boxgames[eid] = result
                except Exception as exc:
                    print("Box score unavailable for",eid,":",str(exc),file=sys.stderr)
    write_json(BOXES,{"season":SEASON,"source":"ESPN game summary box scores",
                      "updated_at":datetime.now(timezone.utc).isoformat(),
                      "games":boxgames})
    return boxgames, len(finals)


def aggregate_players(boxgames, teams, finals):
    combined = {}
    yards = {code:{"total":0.0,"n":0} for code in teams}
    for record in boxgames.values():
        current = set()
        for row in record.get("players") or []:
            key = row["id"] + ":" + row["team"]
            person = combined.setdefault(key,{
                "id":row["id"],"team":row["team"],"name":row["name"],
                "position":row.get("position") or "","headshot":row.get("headshot") or "",
                "games":0,"passing_yards":0,"passing_tds":0,"passing_int":0,
                "rushing_yards":0,"rushing_tds":0,"receiving_yards":0,
                "receiving_tds":0,"receptions":0,"tackles":0,"sacks":0,
                "defensive_int":0,
            })
            if row.get("headshot"):
                person["headshot"] = row["headshot"]
            if key not in current:
                person["games"] += 1
                current.add(key)
            cat = row["category"]
            s = row["stats"]
            if cat.startswith("pass"):
                person["passing_yards"] += s.get("YDS",0)
                person["passing_tds"] += s.get("TD",0)
                person["passing_int"] += s.get("INT",0)
            elif cat.startswith("rush"):
                person["rushing_yards"] += s.get("YDS",0)
                person["rushing_tds"] += s.get("TD",0)
            elif cat.startswith("receiv"):
                person["receiving_yards"] += s.get("YDS",0)
                person["receiving_tds"] += s.get("TD",0)
                person["receptions"] += s.get("REC",0)
            elif cat.startswith("defen"):
                person["tackles"] += s.get("TOT",s.get("TOTAL",0))
                person["sacks"] += s.get("SACKS",s.get("SACK",0))
            elif "interception" in cat:
                person["defensive_int"] += s.get("INT",0)
        for code, stats in (record.get("team_stats") or {}).items():
            if code in yards:
                value = stats.get("totalYards")
                if value is not None:
                    yards[code]["total"] += value
                    yards[code]["n"] += 1
    for code, stats in yards.items():
        teams[code]["total_yards_per_game"] = round(stats["total"]/stats["n"],1) if stats["n"] else None
        teams[code]["yards_games_covered"] = stats["n"]
    return sorted(combined.values(),key=lambda x:(-x["passing_yards"]-x["rushing_yards"]-x["receiving_yards"],x["name"]))


def get_rosters(teams, now):
    existing = load_file(ROSTERS,{})
    old = existing.get("teams") or {}
    updated = chronological_date(existing.get("updated_at"))
    fresh = (now-updated).total_seconds() < 5*86400 if updated.year > 2000 else False
    if fresh and len(old) >= 28:
        return old
    target = [(code,t["espn_id"]) for code,t in teams.items() if t.get("espn_id")]
    def fetch_roster(code, espn_id):
        raw = get_json(BASE + "/teams/" + espn_id + "/roster?season=" + str(SEASON))
        output = []
        for group in raw.get("athletes") or []:
            entries = group.get("items") if isinstance(group,dict) and "items" in group else [group]
            for athlete in entries or []:
                if not isinstance(athlete,dict) or not athlete.get("id"):
                    continue
                head = athlete.get("headshot") or {}
                pos = athlete.get("position") or {}
                output.append({
                    "id":str(athlete["id"]),"name":athlete.get("displayName") or "",
                    "number":athlete.get("jersey") or "",
                    "position":pos.get("abbreviation") or "",
                    "headshot":head.get("href") if isinstance(head,dict) else (head or ""),
                })
        return code,output
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(fetch_roster,*target_item) for target_item in target]
        for future in as_completed(futures):
            try:
                code,players = future.result()
                if players:
                    old[code] = players
            except Exception as exc:
                print("NFL roster retrieval issue:",str(exc),file=sys.stderr)
    write_json(ROSTERS,{"season":SEASON,"updated_at":now.isoformat(),
                        "source":"ESPN NFL team roster pages","teams":old})
    return old


def simulated_playoffs(games, teams, trials=2000):
    left = [g for g in games if g["state"] != "post"]
    rng = random.Random(20261101 + len(left))
    values = {c:{"playoffs":0,"division":0,"one_seed":0,"wins_sum":0} for c in teams}
    divisions = {d:line.split() for d,line in DIVISIONS.items()}
    for _ in range(trials):
        w = {code:teams[code]["wins"]+0.5*teams[code]["ties"] for code in teams}
        for g in left:
            if rng.random() < g.get("home_win_probability",0.5):
                w[g["home"]["code"]] += 1
            else:
                w[g["away"]["code"]] += 1
        champions = {}
        for division, codes in divisions.items():
            winner = sorted(codes,key=lambda c:(-w[c],-teams[c]["elo"],c))[0]
            champions[division] = winner
            values[winner]["division"] += 1
        for conf in ("AFC","NFC"):
            seeds = sorted([c for d,c in champions.items() if d.startswith(conf)],
                           key=lambda c:(-w[c],-teams[c]["elo"],c))
            others = sorted((c for c in teams if teams[c]["conference"]==conf and c not in seeds),
                            key=lambda c:(-w[c],-teams[c]["elo"],c))
            qualifiers = seeds + others[:3]
            for code in qualifiers:
                values[code]["playoffs"] += 1
            if seeds:
                values[seeds[0]]["one_seed"] += 1
        for code in teams:
            values[code]["wins_sum"] += w[code]
    return {c:{"playoff_probability":round(r["playoffs"]/trials,4),
               "division_probability":round(r["division"]/trials,4),
               "one_seed_probability":round(r["one_seed"]/trials,4),
               "projected_wins":round(r["wins_sum"]/trials,1)}
            for c,r in values.items()}


def main():
    now = datetime.now(timezone.utc)
    games, weeks, fast = get_games(now)
    teams = make_teams(games)
    replay_elo(games,teams)
    boxgames, finals = get_boxes(games)
    players = aggregate_players(boxgames,teams,finals)
    rosters = get_rosters(teams,now)
    playoffs = simulated_playoffs(games,teams)
    for code, vals in playoffs.items():
        teams[code].update(vals)
        teams[code]["roster_count"] = len(rosters.get(code) or [])
    before = load_file(EDITION,{})
    out = {
        "schema":1,"season":SEASON,"updated_at":now.isoformat(),
        "sources":{"schedule":"ESPN NFL season scoreboards","box_scores":"ESPN NFL game summaries",
                   "rosters":"ESPN NFL team roster pages"},
        "model":{"name":"USRS independent NFL Elo","preseason":1500,"reset":True,
                 "k":K,"home_elo":HOME_ELO,"rating_divisor":400,
                 "margin_multiplier":"min(1.5, 1 + 0.14 ln(1 + margin))",
                 "playoff_simulations":2000},
        "coverage":{"teams":len(teams),"fixtures":len(games),"expected_regular_season_games":272,
                    "finals":finals,"box_scores":len([g for g in games if g["state"]=="post" and g["id"] in boxgames]),
                    "roster_teams":len([c for c in teams if rosters.get(c)]),
                    "weeks_fetched":weeks,"mode":"fast" if fast else "full"},
        "teams":sorted(teams.values(),key=lambda x:(-x["elo"],x["name"])),
        "games":games,"players":players,
        "notes":["Division tables are record-based; official multi-stage NFL tiebreakers may differ.",
                 "USRS Elo resets all teams to 1500 at the start of the 2026 regular season.",
                 "Playoff odds use simplified record/Elo tiebreakers, not the official NFL tiebreak sequence.",
                 "Player totals include only game box scores successfully retrieved; see coverage counters."],
    }
    write_json(EDITION,out)
    print("NFL published: %d fixtures, %d finals, %d/32 roster teams, %d box scores, %d player records, %d weeks fetched" %
          (len(games),finals,out["coverage"]["roster_teams"],
           out["coverage"]["box_scores"],len(players),len(weeks)))


if __name__=="__main__":
    main()
