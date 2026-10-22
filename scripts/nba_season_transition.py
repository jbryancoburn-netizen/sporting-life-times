"""NBA season transition: independently measured in-season signal replaces preseason prior.
The in-season signal MUST be estimated without initializing from the preseason prior.
Do not feed a conventional Elo already seeded by prior ratings into this blend.
"""
import math

def preseason_weight(games, half_life=15.0):
    if isinstance(games, bool) or not isinstance(games, int) or games < 0:
        raise ValueError("games must be a nonnegative integer")
    if isinstance(half_life, bool) or not isinstance(half_life, (int, float)) or not math.isfinite(half_life) or half_life <= 0:
        raise ValueError("half_life must be positive and finite")
    return 2 ** (-games / half_life)

def blend(preseason_elo, independent_season_elo, games, half_life=15.0):
    if any(isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x)
           for x in (preseason_elo, independent_season_elo)):
        raise ValueError("Elo inputs must be finite numbers")
    weight = preseason_weight(games, half_life)
    return {"elo": round(weight * preseason_elo + (1-weight) * independent_season_elo, 3),
            "preseason_weight": round(weight, 6),
            "season_weight": round(1-weight, 6),
            "games_played": games,
            "half_life_games": half_life}

def build(preseason, season, half_life=15.0):
    """season: per-team independently estimated current-season Elo plus games played."""
    if preseason.get("league") != "NBA" or season.get("league") != "NBA":
        raise ValueError("Both inputs must be NBA")
    if season.get("independent_of_preseason_prior") is not True:
        raise ValueError("Season signal must be independently calculated to avoid double counting")
    old = preseason.get("rankings", [])
    current = season.get("rankings", [])
    if len(old) != 30 or len(current) != 30:
        raise ValueError("Require 30 teams in both datasets")
    old_map = {x["team"]: x["elo"] for x in old}
    cur_map = {x["team"]: x for x in current}
    if len(old_map) != 30 or len(cur_map) != 30 or set(old_map) != set(cur_map):
        raise ValueError("Team identities must match uniquely")
    rows = []
    for team in old_map:
        c = cur_map[team]
        r = blend(old_map[team], c["elo"], c["games_played"], half_life)
        rows.append({"team": team, **r})
    rows.sort(key=lambda x: -x["elo"])
    return {"league": "NBA", "model": "USRS NBA preseason-to-season transition v1",
            "status": "calibration_pending",
            "methodology": "Independent in-season rating blended with preseason rating using exponential game-count half-life; no double-counting",
            "rankings": rows}
