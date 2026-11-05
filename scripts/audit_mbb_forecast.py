#!/usr/bin/env python3
"""Diagnostic only: current ratings are POSTGAME and cannot validate forecasts."""
import json, math
from pathlib import Path
from collections import defaultdict
ROOT=Path(__file__).resolve().parents[1]
def read(p): return json.loads((ROOT/p).read_text(encoding="utf-8"))
r=read("data/ncaam-2026-27-retro-primary.json")
c=read("data/ncaam-score-calibration.json")
f=read("data/ncaam-2026-27-upcoming-forecasts.json")
elo={t["team_id"]:float(t["elo"]) for t in r["rankings"]}
slope=c["parameters"]["elo_margin_slope"]
buckets=defaultdict(lambda:{"n":0,"absolute_error":0., "observed_margin_sum":0.,"projected_magnitude_sum":0.})
for g in r.get("events",[]):
    a,h=elo.get(g.get("away_id")),elo.get(g.get("home_id"))
    if a is None or h is None:continue
    gap=h-a
    # These are END-OF-SNAPSHOT ratings: this is a descriptive retrospective, NOT holdout validation.
    category=next((label for edge,label in [(100,"0-99"),(200,"100-199"),(300,"200-299"),(400,"300-399"),(500,"400-499") ] if abs(gap)<edge),"500+")
    actual=float(g["home_score"])-float(g["away_score"])
    estimated=gap*slope
    b=buckets[category];b["n"]+=1;b["absolute_error"]+=abs(actual-estimated);b["observed_margin_sum"]+=abs(actual);b["projected_magnitude_sum"]+=abs(estimated)
values=sorted(elo.values())
report={
"status":"DIAGNOSTIC_ONLY_NOT_BACKTEST",
"warning":"Completed games are compared against postgame RETRO ratings, causing lookahead leakage. These diagnostics must not be presented as historical forecast accuracy. Build chronological pregame ratings and disjoint holdout seasons before approving model calibration.",
"rating_snapshot_as_of":r.get("as_of"),"games_in_snapshot":len(r.get("events",[])),
"teams":len(elo),"baseline":r.get("starting_elo"),
"rating_min":values[0],"rating_max":values[-1],"rating_range":round(values[-1]-values[0],3),
"forecast_count":len(f["games"]),
"forecast_max_absolute_margin":max(abs(x.get("projected_home_margin") or 0) for x in f["games"]),
"retrospective_buckets":[{"elo_gap":k,"games":v["n"],"descriptive_mae_not_holdout":round(v["absolute_error"]/v["n"],3),"mean_absolute_observed_margin":round(v["observed_margin_sum"]/v["n"],3),"mean_absolute_projected_margin":round(v["projected_magnitude_sum"]/v["n"],3)} for k,v in sorted(buckets.items())],
"next_required_validation":"Chronological pregame ratings, season-disjoint training/holdout, MAE and calibration by 0-9,10-19,20-29,30-39,40+ actual spread buckets, plus Elo-gap buckets."
}
out=ROOT/"data/ncaam-forecast-diagnostics.json"
out.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
print(json.dumps(report,indent=2))
