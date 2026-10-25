#!/usr/bin/env python3
"""Fail if NCAA player-quality challenger winner is unsupported by matched-game data."""
import json
from pathlib import Path
d=Path(__file__).resolve().parents[1]/"data"
r=json.loads((d/"ncaam-coefficient-head-to-head.json").read_text())
x=json.loads((d/"ncaam-2026-27-coefficient-comparison-decision.json").read_text())
s=json.loads((d/"ncaam-coefficient-head-to-head-diagnostic.json").read_text())
assert s["status"]=="success"
assert x["research_winner"]=="quality_beta1200"
assert x["production_preseason_approved"] is False
assert r["production_promotion_approved"] is False
assert r["training_seasons"]==[2024,2025] and r["untouched_holdout_season"]==2026
for year in ("2024","2025","2026"):
    h=r["seasons"][year]
    a,b,c=(h[k] for k in ("baseline","exact_beta300","quality_beta1200"))
    assert a["games"]==b["games"]==c["games"]
    assert a["from"]==b["from"]==c["from"]
    assert a["through_exclusive"]==b["through_exclusive"]==c["through_exclusive"]
    assert c["log_loss"]<b["log_loss"]<a["log_loss"]
    assert c["brier"]<b["brier"]<a["brier"]
h=r["seasons"]["2026"]
assert h["baseline"]["games"]==x["holdout_games"]==s["holdout_games"]==1596
for model in ("baseline","exact_beta300","quality_beta1200"):
    for key in ("log_loss","brier"):
        assert h[model][key]==x["holdout"][model][key]
assert abs(x["winner_gain_over_300"]["log_loss"]-(h["exact_beta300"]["log_loss"]-h["quality_beta1200"]["log_loss"]))<1e-12
assert abs(x["winner_gain_over_300"]["brier"]-(h["exact_beta300"]["brier"]-h["quality_beta1200"]["brier"]))<1e-12
print("PASS: 1,596 held-out same-game wins for full 1200 model; preseason primary unchanged")
