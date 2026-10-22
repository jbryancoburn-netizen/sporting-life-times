"""Pure Match Center record merge and fixture selection helpers."""
from datetime import datetime, timezone


def has_verified_detail(record):
    return isinstance(record, dict) and any(record.get(k) for k in ("events", "statistics", "players"))


def merge_record(previous, fresh):
    """Keep verified source detail when an otherwise valid response is empty."""
    if has_verified_detail(previous) and not has_verified_detail(fresh):
        result = dict(previous)
        if isinstance(fresh.get("game"), dict):
            result["game"] = fresh["game"]
        return result
    return fresh


def choose_games(games, limit=12, per_state=4):
    """Give live, final and scheduled games balanced representation."""
    now = datetime.now(timezone.utc)
    def rank(game):
        try:
            date = datetime.fromisoformat(str(game.get("date", "")).replace("Z", "+00:00"))
            distance = abs((date - now).total_seconds())
        except (TypeError, ValueError):
            distance = float("inf")
        return distance
    ordered = sorted(games, key=rank)
    selected = []
    seen = set()
    for state in ("in", "post", "pre"):
        for game in (g for g in ordered if g.get("state") == state):
            ident = str(game.get("id") or "")
            if ident and ident not in seen:
                selected.append(game)
                seen.add(ident)
            if sum(g.get("state") == state for g in selected) >= per_state or len(selected) >= limit:
                break
    for game in ordered:
        ident = str(game.get("id") or "")
        if len(selected) >= limit:
            break
        if ident and ident not in seen:
            selected.append(game)
            seen.add(ident)
    return selected[:limit]
