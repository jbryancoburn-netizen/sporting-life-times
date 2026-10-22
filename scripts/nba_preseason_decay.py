"""NBA preseason prior decay: independent component, no double-counted results.

Use this to discount a preseason *adjustment* relative to baseline Elo.
The underlying Elo itself is updated once per game by the existing engine.
"""
from math import exp, log, isfinite

def preseason_weight(games_played: int, half_life: float = 15.0) -> float:
    if not isinstance(games_played, int) or games_played < 0:
        raise ValueError("games_played must be a nonnegative integer")
    if not isfinite(half_life) or half_life <= 0:
        raise ValueError("half_life must be positive and finite")
    return exp(-log(2) * games_played / half_life)

def evolving_elo(base_elo: float, preseason_delta: float, games_played: int,
                 half_life: float = 15.0) -> float:
    """Apply only the surviving preseason delta to game-updated base Elo.

    base_elo must be an Elo trajectory that does NOT already include
    preseason_delta; otherwise the adjustment would be double counted.
    """
    if not all(isfinite(v) for v in (base_elo, preseason_delta)):
        raise ValueError("Elo inputs must be finite")
    return base_elo + preseason_delta * preseason_weight(games_played, half_life)

def grid_candidates():
    return (10.0, 15.0, 20.0, 30.0)

def log_loss(probabilities, outcomes):
    """For chronological, held-out win probabilities and binary outcomes."""
    pairs = list(zip(probabilities, outcomes, strict=True))
    if not pairs:
        raise ValueError("empty evaluation")
    total = 0.0
    for p, y in pairs:
        if not isfinite(p) or not 0 <= p <= 1 or y not in (0, 1):
            raise ValueError("invalid probability or outcome")
        p = min(1 - 1e-15, max(1e-15, p))
        total -= y * log(p) + (1-y) * log(1-p)
    return total / len(pairs)
