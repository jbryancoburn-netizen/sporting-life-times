"""Walk-forward NCAA soccer Elo parameter sensitivity report.

Diagnostic, NOT an unbiased historical backtest: pinned October 22 baseline,
short October 23+ observation window, unknown kickoff times and neutral venues.
Does not mutate published ratings. Run: python scripts/audit_college_soccer_elo_parameters.py
"""
import json, math
from pathlib import Path
from itertools import product
ROOT=Path(__file__).resolve().parents[1]
def load(p): return json.loads((ROOT/p).read_text())
def audit():
    baseline=load("data/college-soccer-elo-baseline.json")
    ledger=load("data/college-soccer-elo-final-ledger.json")
    ident={(r["gender"],r["team_id"]):k for k,rows in baseline["cohorts"].items() for r in rows}
    all_games=ledger["results"]
    games=sorted((g for g in all_games if ident.get((g["gender"],g["home_team"])) is not None and
                  ident.get((g["gender"],g["home_team"]))==ident.get((g["gender"],g["away_team"]))),
                 key=lambda g:(g["date"],g["match_id"]))
    out=[]
    for K,H,margin in product((14,28,42),(0,75,125),(False,True)):
        ratings={(r["gender"],r["team_id"]):float(r["elo"]) for rows in baseline["cohorts"].values() for r in rows}
        n=hit=0; loss=brier=0.
        for g in games:
            a=(g["gender"],g["home_team"]);b=(g["gender"],g["away_team"])
            pa=1/(1+10**(-(ratings[a]-ratings[b]+H)/400))
            outcome=1 if g["home_goals"]>g["away_goals"] else .5 if g["home_goals"]==g["away_goals"] else 0
            p=[(1-.24)*pa,.24,(1-.24)*(1-pa)]
            actual=[int(outcome==1),int(outcome==.5),int(outcome==0)]
            idx=actual.index(1)
            loss-=math.log(max(1e-10,p[idx]))
            brier+=sum((p[i]-actual[i])**2 for i in range(3))
            hit+=int(p.index(max(p))==idx)
            n+=1
            gap=abs(g["home_goals"]-g["away_goals"])
            multiplier=min(1.75,1+.15*(gap-1)) if margin and gap>1 else 1
            delta=K*multiplier*(outcome-pa)
            ratings[a]+=delta;ratings[b]-=delta
        out.append(dict(K=K,home_advantage=H,margin_multiplier=margin,sample=n,
            mean_log_loss=loss/n,mean_brier=brier/n,pick_accuracy=hit/n))
    out.sort(key=lambda r:r["mean_log_loss"])
    return {"baseline_as_of":baseline["as_of"],"ledger_count":len(all_games),"usable_games":len(games),
            "excluded_games":len(all_games)-len(games),"current_parameters":{"K":28,"home_advantage":75,"margin_multiplier":True},
            "draw_probability_assumption":.24,"window_start":games[0]["date"],"window_end":games[-1]["date"],
            "limitations":["Not full-season historical cross-validation","Parameter testing uses evaluation games; best combination is not independently validated",
            "Same-day chronological order unavailable","Home venues may include neutral sites","Draw rate is a fixed diagnostic assumption",
            "Ledger contains disputed final scores; fix source disagreements before sign-off"],
            "configurations":out}
def main():
    report=audit()
    dest=ROOT/"data/college-soccer-elo-parameter-audit-latest.json"
    dest.write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"games":report["usable_games"],"best":report["configurations"][0],
                      "current":next(x for x in report["configurations"] if x["K"]==28 and x["home_advantage"]==75 and x["margin_multiplier"])}))
if __name__=="__main__":main()
