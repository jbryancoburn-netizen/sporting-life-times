#!/usr/bin/env python3
"""Recalculate experimental NCAA player-value sensitivity without touching Elo."""
import json
from pathlib import Path
d=Path(__file__).resolve().parents[1]/"data"
source=json.loads((d/"ncaam-2026-27-player-value-experimental-v1.json").read_text())
audit=json.loads((d/"ncaam-2026-27-player-value-sensitivity.json").read_text())
assert source["status"]=="SHADOW_ONLY_NOT_BACKTESTED"
assert audit["primary_ratings_changed"] is False
result=[]
for beta in audit["coefficient_grid_elo_per_scoring_rate"]:
    ranking=sorted(({"id":r["team_id"],"team":r["team"],
        "elo":round(r["baseline_elo"]+beta*(r["player_quality_index"]-source["team_quality_center"]),4)}
        for r in source["rankings"]),key=lambda x:(-x["elo"],x["id"]))
    high=next(i for i,r in enumerate(ranking) if r["team"]=="High Point")
    result.append({"beta":beta,"high_point_rank":high+1,"high_point_elo":ranking[high]["elo"],
        "top_5":[r["team"] for r in ranking[:5]]})
assert result==audit["results"],"Coefficient-sensitivity artifact does not reproduce"
assert [min(r["high_point_rank"] for r in result),max(r["high_point_rank"] for r in result)]==audit["high_point_rank_range"]
print("PASS: NCAA experimental player-value coefficient sensitivity reproduces")
