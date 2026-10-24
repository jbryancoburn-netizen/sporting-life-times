#!/usr/bin/env python3
"""Deterministic single-game NCAA Elo stress scenarios: NO fitted predictions.
Production uses K=24 and MOV=.55; inspect expected rating swings at various
prior win probabilities and margins. Do not automatically change K or MOV.
"""
import json,math
from pathlib import Path
from update_ncaam_season import K,MOV

def shift(probability,margin,k=K,mov=MOV):
    if not (0<probability<1 and 0<=margin<=100 and k>0 and mov>=0):
        raise ValueError("Invalid probability, margin or coefficients")
    return k*(1+mov*math.log10(1+margin))*(1-probability)

def audit():
    cases=[{"win_probability":p,"margin":m,"elo_gain":round(shift(p,m),4)}
           for p in (.1,.25,.5,.75,.9) for m in (1,5,10,20,35)]
    return {"model":"SLAT-NCAAM-current-game-Elo-sensitivity","type":"deterministic-scenarios-not-historical-validation",
        "k":K,"mov":MOV,"cases":cases,
        "ten_percent_underdog_20_point_win_gain":round(shift(.1,20),4),
        "fifty_percent_team_20_point_win_gain":round(shift(.5,20),4),
        "rules":["Same-date Elo updates are applied together","A winning underdog gains more than a favorite for the same margin",
          "No fitted K or MOV coefficients; retain live settings pending exact-match historical backtest"]}
if __name__=="__main__":
    result=audit()
    path=Path("data/ncaam-2026-27-elo-volatility-audit.json")
    path.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({k:v for k,v in result.items() if k!="cases"},indent=2))
