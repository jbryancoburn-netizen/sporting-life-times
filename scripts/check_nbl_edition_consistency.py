#!/usr/bin/env python3
"""Cross-validate NBL research Elo and newspaper standings from the SAME final ledger.

Never claims predictive Elo approval. Fails deployment if output drifts apart.
"""
import argparse,json,math
from pathlib import Path

def verify(elo,table):
    if elo.get("status")!="RESEARCH_ONLY_UNCERTIFIED" or elo.get("prediction_certified") is not False:
        raise ValueError("Research Elo approval/status is inconsistent")
    if table.get("status")!="source_derived_not_officially_reconciled":
        raise ValueError("NBL standings source status inconsistent")
    n=elo.get("current_regular_season_games")
    if type(n)!=int or n<=0 or table.get("games_replayed")!=n:
        raise ValueError("Different final-game cutoffs between NBL Elo and standings")
    er=elo.get("ratings",[]);sr=table.get("rows",[])
    if len(er)!=10 or len(sr)!=10:raise ValueError("Missing NBL clubs")
    em={r["team"]:r for r in er};sm={r["team"]:r for r in sr}
    if len(em)!=10 or len(sm)!=10 or em.keys()!=sm.keys():
        raise ValueError("NBL team-name mismatch")
    for team in em:
        for field in ("wins","losses"):
            if em[team].get(field)!=sm[team].get(field):
                raise ValueError("NBL record mismatch: "+team+" "+field)
        if not math.isfinite(float(em[team].get("elo",float("nan")))):
            raise ValueError("Non-finite NBL Elo: "+team)
    if sum(r["wins"] for r in er)!=n or sum(r["losses"] for r in er)!=n:
        raise ValueError("NBL played-game accounting mismatch")
    if len(elo.get("recent_results",[]))!=min(n,10):
        raise ValueError("NBL recent Elo finals incomplete")
    return {"status":"passed","teams":10,"games":n,"records_reconciled":True,
            "elo_forecasts_approved":False}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--elo",required=True);parser.add_argument("--standings",required=True)
    args=parser.parse_args()
    result=verify(json.loads(Path(args.elo).read_text()),
                  json.loads(Path(args.standings).read_text()))
    print(json.dumps(result,indent=2))
if __name__=="__main__":main()
