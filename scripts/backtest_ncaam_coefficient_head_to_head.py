#!/usr/bin/env python3
"""Matched-game comparison of NCAA player-value beta300 and quality beta1200.
Both candidates use the same 14-day dated player observation cutoff and
the same following 45-day game window. Not a preseason validation.
"""
import argparse,json
from pathlib import Path
from collections import defaultdict
from datetime import timedelta
from backtest_ncaam_quality_retrospective import (
    read_gz,school_key,extract_games,unadjusted_end,preseason_features)
from backtest_ncaam_quality_earlyseason_asof import cut_snapshot,score_after_cutoff
from backtest_ncaam_exact_player_v1 import exact_features

def run(root):
    years=(2023,2024,2025,2026)
    box={y:read_gz(root,"player_box",y) for y in years}
    schedules={y:read_gz(root,"schedule",y) for y in years}
    rosters={y:read_gz(root,"team_rosters",y) for y in years}
    games={};universe={};ending={};snapshots={};cutoffs={}
    for y in years:
        ids=defaultdict(set)
        for p in box[y]:
            school=school_key(p.get("team"))
            tid=str(p.get("team_ncaa_team_id") or "")
            if school and tid:ids[school].add(tid)
        universe[y]={school:next(iter(v)) for school,v in ids.items() if len(v)==1}
        if len(universe[y])<300:raise ValueError("incomplete team ID mapping")
        games[y],_=extract_games(schedules[y],universe[y],box[y])
        ending[y]=unadjusted_end(games[y],ending.get(y-1,{}),universe[y])
        if y==2023:continue
        cutoffs[y]=games[y][0]["day"]+timedelta(days=14)
        snapshots[y],_=cut_snapshot(box[y],cutoffs[y])
    results={}
    for y in (2024,2025,2026):
        minutes,_,_=preseason_features(snapshots[y],box[y-1])
        delta300,audit=exact_features(snapshots[y],box[y-1],universe[y])
        missing=set(universe[y])-set(minutes)
        # Equalize game coverage by supplying zero adjustments to uncovered schools.
        for team in missing:minutes[team]={"minute_adj":0.,"q_centered":0.}
        def score(adj):
            feats={t:{"minute_adj":0.,"q_centered":adj[t]} for t in universe[y]}
            return score_after_cutoff(games[y],ending[y-1],feats,1.,cutoffs[y])
        baseline=score({t:0. for t in universe[y]})
        beta300=score(delta300)
        beta1200=score({t:minutes[t]["minute_adj"]+1200*minutes[t]["q_centered"] for t in universe[y]})
        if len({baseline["games"],beta300["games"],beta1200["games"]})!=1:
            raise ValueError("unequal game counts")
        results[str(y)]={"baseline":baseline,"exact_beta300":beta300,
            "quality_beta1200":beta1200,"player_evidence":audit}
    return {"comparison":"NCAA identical post-day14 game windows exact beta300 vs quality beta1200",
        "status":"CHRONOLOGICAL_INSEASON_COMPARISON_NOT_PRESEASON_CERTIFICATION",
        "training_seasons":[2024,2025],"untouched_holdout_season":2026,
        "quality_1200_selection":"Previously chosen on 2024/25 training, frozen before 2026",
        "exact_300_selection":"Original fixed experimental coefficient; no holdout tuning",
        "seasons":results,"production_promotion_approved":False,
        "limitations":["Current-season players come only from first 14 days of dated game boxes.",
            "The 300 and 1200 models use different player-quality formulas and are compared as complete models.",
            "Does not establish pre-opening preseason roster membership or authorize Elo promotion."]}
def main():
    a=argparse.ArgumentParser()
    a.add_argument("--source",type=Path,required=True)
    a.add_argument("--output",type=Path,default=Path("data/ncaam-coefficient-head-to-head.json"))
    z=a.parse_args()
    doc=run(z.source)
    z.output.write_text(json.dumps(doc,indent=2)+"\n")
    print(json.dumps(doc["seasons"]["2026"],indent=2))
if __name__=="__main__":main()
