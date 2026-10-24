#!/usr/bin/env python3
"""Gate historical NCAA player-stat research: no production promotion by accident."""
import json
from pathlib import Path

def assess(data):
    rows=data["regularization_sensitivity"]
    if len(rows)!=5 or any(x["validation_2025"]["games"]!=data["selected_validation"]["games"] for x in rows.values()):
        raise ValueError("Missing/unequal calibration results")
    ordered=sorted(rows.items(),key=lambda kv:float(kv[0]))
    for _,row in ordered:
        if not all(v>=0 for v in row["selected_weights"].values()):
            raise ValueError("Invalid weight")
    best=min(ordered,key=lambda kv:(kv[1]["validation_2025"]["log_loss"],kv[1]["validation_2025"]["brier"]))
    return {
      "model":"ncaam-stat-weights-research-promotion-gate-v1",
      "decision":"RETAIN_INCUMBENT_RESEARCH_UNCERTIFIED",
      "validation_2025_reused_in_prior_model_search":True,
      "historical_roster_preopening_verified":False,
      "production_promotable":False,
      "compared_game_count":data["selected_validation"]["games"],
      "retrospective_lowest_validation_loss_penalty":best[0],
      "retrospective_best_weights":best[1]["selected_weights"],
      "training_selected_weights":data["selected_weights"],
      "training_selected_at_boundary":data["selected_at_grid_boundary"],
      "coefficients_not_identified_as_stable":True,
      "regularization_tradeoff":[{
        "penalty":k,"weights":v["selected_weights"],
        "validation_log_loss":v["validation_2025"]["log_loss"],
        "validation_brier":v["validation_2025"]["brier"],
        "boundary":v["selected_at_grid_boundary"]}
        for k,v in ordered],
      "requirements_before_promotion":[
        "Verify roster/player membership as of preseason rather than retrospectively",
        "Use an independently held future season or prospective predictions",
        "Validate source-school and athlete identity joins",
        "Validate home court/neutral locations and complete integrated model",
        "Verify predictive calibration and model stability"]
    }

if __name__=="__main__":
    src=Path("data/ncaam-independent-stat-weights.json")
    out=Path("data/ncaam-independent-stat-promotion-gate.json")
    result=assess(json.loads(src.read_text()))
    out.write_text(json.dumps(result,indent=2)+"\n")
    assert result["production_promotable"] is False
    print(json.dumps({k:v for k,v in result.items() if k!="regularization_tradeoff"},indent=2))
