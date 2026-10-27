"""Walk-forward evaluation of independent EuroLeague Elo parameter candidates.
Uses past games only before making each prediction. No imported ratings.
"""
import json, math, pathlib
import euroleague_model as el

OUT=pathlib.Path("data/euroleague-validation.json")
PARAMS=[(k,h,c) for k in (12.,18.,22.,28.,36.) for h in range(50,101,5) for c in (0.,)]
def score(games,k,home,carry):
    ratings={}; prior=None; preds=[]; details=[]
    for g in sorted(games,key=lambda x:(x["season"],el.clock(x["date"]),x["id"])):
        if g["season"]!=prior:
            prior=g["season"]
            ratings={t:1500+(v-1500)*carry for t,v in ratings.items()}
        a,b=g["home"]["code"],g["away"]["code"]
        ratings.setdefault(a,1500.);ratings.setdefault(b,1500.)
        if not g["completed"]:continue
        diff=ratings[a]-ratings[b]+(0 if g["neutral"] else home)
        p=max(.000001,min(.999999,el.expected(diff)))
        y=int(g["home"]["score"]>g["away"]["score"])
        if g["season"] in ("E2022","E2023","E2024","E2025","E2026"):
            preds.append((p,y))
            details.append({"season":g["season"],"id":g["id"],"pred":p,"actual":y})
        margin=abs(g["home"]["score"]-g["away"]["score"])
        d=k*min(1.65,.8+.22*math.log1p(margin))*(y-p)
        ratings[a]+=d;ratings[b]-=d
    if not preds:raise ValueError("No eligible evaluation games")
    n=len(preds)
    return {"n":n,"brier":sum((p-y)**2 for p,y in preds)/n,
        "log_loss":-sum(y*math.log(p)+(1-y)*math.log1p(-p) for p,y in preds)/n,
        "accuracy":sum((p>=.5)==bool(y) for p,y in preds)/n,
        "predictions":details}
def score_forecast_evaluation(games):
    """Pregame-only scoring backtest; evaluate the exact live forecast function."""
    seasons=("E2022","E2023","E2024","E2025","E2026")
    by_season={}
    for g in games:
        if g["season"] in seasons and g["completed"]:
            by_season.setdefault(g["season"],[]).append(g)
    results={}
    for season,rows in by_season.items():
        stats={};ratings={};n=0
        errors={"home":0.0,"away":0.0,"total":0.0,"margin":0.0,
                "baseline_total":0.0,"baseline_margin":0.0}
        correct=0
        for g in sorted(rows,key=lambda x:(el.clock(x["date"]),x["id"])):
            h,a=g["home"]["code"],g["away"]["code"]
            ratings.setdefault(h,1500.0);ratings.setdefault(a,1500.0)
            p=el.expected(ratings[h]-ratings[a]+(0 if g["neutral"] else el.HOME_ELO))
            hs,as_=stats.get(h),stats.get(a)
            played=sum(t["played"] for t in stats.values())
            avg=sum(t["for"] for t in stats.values())/played if played else None
            actual_h,actual_a=g["home"]["score"],g["away"]["score"]
            if hs and as_ and hs["played"]>=5 and as_["played"]>=5 and avg is not None:
                hp=.5*(hs["for"]/hs["played"]+as_["against"]/as_["played"])
                ap=.5*(as_["for"]/as_["played"]+hs["against"]/hs["played"])
                edge=1.5 if not g["neutral"] else 0
                pred=el.forecast_score(.7*hp+.3*avg+edge,.7*ap+.3*avg-edge,p)
                n+=1
                errors["home"]+=abs(pred["home"]-actual_h)
                errors["away"]+=abs(pred["away"]-actual_a)
                errors["total"]+=abs(pred["total"]-actual_h-actual_a)
                errors["margin"]+=abs((pred["home"]-pred["away"])-(actual_h-actual_a))
                errors["baseline_total"]+=abs(2*avg-actual_h-actual_a)
                errors["baseline_margin"]+=abs(actual_h-actual_a)
                correct+=int((pred["home"]>pred["away"])==(actual_h>actual_a))
            winner=int(actual_h>actual_a)
            margin=abs(actual_h-actual_a)
            change=el.K*min(1.65,.8+.22*math.log1p(margin))*(winner-p)
            ratings[h]+=change;ratings[a]-=change
            for code,pts,against in ((h,actual_h,actual_a),(a,actual_a,actual_h)):
                st=stats.setdefault(code,{"played":0,"for":0,"against":0})
                st["played"]+=1;st["for"]+=pts;st["against"]+=against
        results[season]={"games_evaluated":n,"home_score_mae":round(errors["home"]/n,2) if n else None,
            "away_score_mae":round(errors["away"]/n,2) if n else None,
            "total_mae":round(errors["total"]/n,2) if n else None,
            "margin_mae":round(errors["margin"]/n,2) if n else None,
            "league_average_total_mae":round(errors["baseline_total"]/n,2) if n else None,
            "zero_margin_baseline_mae":round(errors["baseline_margin"]/n,2) if n else None,
            "winner_accuracy":round(correct/n,4) if n else None}
    eligible=[v for v in results.values() if v["games_evaluated"]]
    total=sum(v["games_evaluated"] for v in eligible)
    def weighted(key):
        return round(sum(v[key]*v["games_evaluated"] for v in eligible)/total,2) if total else None
    return {"games_evaluated":total,"minimum_prior_games_per_team":5,
        "status":"measured" if total else "insufficient_eligible_games",
        "home_score_mae":weighted("home_score_mae"),"away_score_mae":weighted("away_score_mae"),
        "total_mae":weighted("total_mae"),"margin_mae":weighted("margin_mae"),
        "league_average_total_mae":weighted("league_average_total_mae"),
        "zero_margin_baseline_mae":weighted("zero_margin_baseline_mae"),
        "winner_accuracy":round(sum(v["winner_accuracy"]*v["games_evaluated"] for v in eligible)/total,4) if total else None,
        "by_season":results,
        "method":"strict pregame expanding-window; shared published forecast function; 1500 Elo reset each season"}

def heldout_evaluation(games):
    """Select settings on 2025-26; report untouched 2026-27 pregame predictions."""
    train=[g for g in games if g["season"] in ("E2021","E2022","E2023","E2024","E2025")]
    test=[g for g in games if g["season"]=="E2026" and g["completed"]]
    if not test:
        raise ValueError("No held-out 2026-27 games")
    candidates=[]
    folds=("E2023","E2024","E2025")
    for k,home,carry in PARAMS:
        r=score(train,k,home,carry)
        predictions=[p for p in r["predictions"] if p["season"] in folds]
        if not predictions: raise ValueError("Missing walk-forward historical holdout predictions")
        loss=-sum(p["actual"]*math.log(p["pred"])+(1-p["actual"])*math.log1p(-p["pred"]) for p in predictions)/len(predictions)
        brier=sum((p["pred"]-p["actual"])**2 for p in predictions)/len(predictions)
        candidates.append((loss,brier,k,home,carry))
    candidates.sort()
    _,_,k,home,carry=candidates[0]
    full=score(games,k,home,carry)
    hold=[p for p in full["predictions"] if p["season"]=="E2026"]
    baseline=score(games,22.,65.,0.)
    basehold=[p for p in baseline["predictions"] if p["season"]=="E2026"]
    def metrics(rows):
        n=len(rows)
        if not n:raise ValueError("No held-out predictions")
        return {"n":n,"log_loss":round(-sum(r["actual"]*math.log(max(1e-6,min(1-1e-6,r["pred"])))+(1-r["actual"])*math.log1p(-max(1e-6,min(1-1e-6,r["pred"]))) for r in rows)/n,6),
                "brier":round(sum((r["pred"]-r["actual"])**2 for r in rows)/n,6),
                "accuracy":round(sum((r["pred"]>=.5)==bool(r["actual"]) for r in rows)/n,4)}
    return {"method":"walk-forward selection on historical 2023-24 through 2025-26 seasons; evaluate unseen 2026-27 chronologically",
            "training_season":"E2021-E2025","historical_validation_seasons":list(folds),"holdout_season":"E2026",
            "selected_parameters":{"k":k,"home_elo":home,"season_carry":carry},
            "selected_holdout":metrics(hold),"baseline_holdout":metrics(basehold),
            "note":"True season holdout; selections are not retrained on holdout games."}

def main():
    games=[g for year in range(2021,2027) for g in el.fetch_season("E"+str(year))]
    training=[g for g in games if g["season"]!="E2026"]
    candidates=[]
    for k,home,carry in PARAMS:
        r=score(training,k,home,carry)
        candidates.append({"k":k,"home_elo":home,"season_carry":carry,
                           "brier":round(r["brier"],6),"log_loss":round(r["log_loss"],6),
                           "accuracy":round(r["accuracy"],4),"n":r["n"]})
    candidates.sort(key=lambda c:(c["log_loss"],c["brier"]))
    baseline=score(training,22.,65.,0.)
    best=candidates[0]
    scoring_validation=score_forecast_evaluation(games)
    heldout=heldout_evaluation(games)
    document={"heldout_evaluation":heldout,"scoring_forecast_validation":scoring_validation,"status":"reset_1500_calibration","evaluated_seasons":["E2022","E2023","E2024","E2025"],
              "method":"chronological expanding-window training through E2025; E2026 strictly held out",
              "caution":"2026-27 is held out from candidate selection; early-season holdout remains small.",
              "best_in_sample":best,"baseline":{"k":22,"home_elo":65,"season_carry":0.,
              "brier":round(baseline["brier"],6),"log_loss":round(baseline["log_loss"],6),"n":baseline["n"]},
              "tested":len(candidates),"leaderboard":candidates[:15]}
    OUT.parent.mkdir(exist_ok=True,parents=True)
    OUT.write_text(json.dumps(document,indent=2)+"\n")
    print(json.dumps({"tested":len(candidates),"best":best,"baseline":document["baseline"]}))
if __name__=="__main__":main()
