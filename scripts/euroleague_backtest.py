"""Walk-forward evaluation of independent EuroLeague Elo parameter candidates.
Uses past games only before making each prediction. No imported ratings.
"""
import json, math, pathlib
import euroleague_model as el

OUT=pathlib.Path("data/euroleague-validation.json")
PARAMS=[(k,h,c) for k in (12.,18.,22.,28.,36.) for h in (0.,35.,65.,90.,120.) for c in (.4,.67,.85)]
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
        if g["season"] in ("E2025","E2026"):
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
    """Evaluate the published scoring formula before each final, without future leakage."""
    stats={}; observed=[]; evaluated=0; abs_home=abs_away=abs_total=abs_margin=0.0
    current=sorted((g for g in games if g["season"]=="E2026" and g["completed"]),key=lambda g:(el.clock(g["date"]),g["id"]))
    for g in current:
        h,a=g["home"]["code"],g["away"]["code"]
        hst,ast=stats.get(h),stats.get(a)
        total_games=sum(t["played"] for t in stats.values())
        average=sum(t["for"] for t in stats.values())/total_games if total_games else None
        if hst and ast and hst["played"]>=5 and ast["played"]>=5 and average is not None:
            hp=.5*(hst["for"]/hst["played"]+ast["against"]/ast["played"])
            ap=.5*(ast["for"]/ast["played"]+hst["against"]/hst["played"])
            edge=1.5 if not g["neutral"] else 0
            pred_h=.7*hp+.3*average+edge
            pred_a=.7*ap+.3*average-edge
            actual_h,actual_a=g["home"]["score"],g["away"]["score"]
            evaluated+=1
            abs_home+=abs(pred_h-actual_h)
            abs_away+=abs(pred_a-actual_a)
            abs_total+=abs(pred_h+pred_a-actual_h-actual_a)
            abs_margin+=abs((pred_h-pred_a)-(actual_h-actual_a))
        for code,points,against in ((h,g["home"]["score"],g["away"]["score"]),(a,g["away"]["score"],g["home"]["score"])):
            st=stats.setdefault(code,{"played":0,"for":0,"against":0})
            st["played"]+=1;st["for"]+=points;st["against"]+=against
    return {"games_evaluated":evaluated,"minimum_prior_games_per_team":5,
            "status":"measured" if evaluated else "insufficient_eligible_games",
            "home_score_mae":round(abs_home/evaluated,2) if evaluated else None,
            "away_score_mae":round(abs_away/evaluated,2) if evaluated else None,
            "total_mae":round(abs_total/evaluated,2) if evaluated else None,
            "margin_mae":round(abs_margin/evaluated,2) if evaluated else None,
            "method":"strict pregame expanding-window; current published scoring formula"}

def heldout_evaluation(games):
    """Select settings on 2025-26; report untouched 2026-27 pregame predictions."""
    train=[g for g in games if g["season"] in ("E2024","E2025")]
    test=[g for g in games if g["season"]=="E2026" and g["completed"]]
    if not test:
        raise ValueError("No held-out 2026-27 games")
    candidates=[]
    for k,home,carry in PARAMS:
        r=score(train,k,home,carry)
        candidates.append((r["log_loss"],r["brier"],k,home,carry))
    candidates.sort()
    _,_,k,home,carry=candidates[0]
    full=score(games,k,home,carry)
    hold=[p for p in full["predictions"] if p["season"]=="E2026"]
    baseline=score(games,22.,65.,.67)
    basehold=[p for p in baseline["predictions"] if p["season"]=="E2026"]
    def metrics(rows):
        n=len(rows)
        if not n:raise ValueError("No held-out predictions")
        return {"n":n,"log_loss":round(-sum(r["actual"]*math.log(max(1e-6,min(1-1e-6,r["pred"])))+(1-r["actual"])*math.log1p(-max(1e-6,min(1-1e-6,r["pred"]))) for r in rows)/n,6),
                "brier":round(sum((r["pred"]-r["actual"])**2 for r in rows)/n,6),
                "accuracy":round(sum((r["pred"]>=.5)==bool(r["actual"]) for r in rows)/n,4)}
    return {"method":"train candidates on 2025-26; evaluate unseen 2026-27 chronologically",
            "training_season":"E2025","holdout_season":"E2026",
            "selected_parameters":{"k":k,"home_elo":home,"season_carry":carry},
            "selected_holdout":metrics(hold),"baseline_holdout":metrics(basehold),
            "note":"True season holdout; selections are not retrained on holdout games."}

def main():
    games=[g for year in (2024,2025,2026) for g in el.fetch_season("E"+str(year))]
    candidates=[]
    for k,home,carry in PARAMS:
        r=score(games,k,home,carry)
        candidates.append({"k":k,"home_elo":home,"season_carry":carry,
                           "brier":round(r["brier"],6),"log_loss":round(r["log_loss"],6),
                           "accuracy":round(r["accuracy"],4),"n":r["n"]})
    candidates.sort(key=lambda c:(c["log_loss"],c["brier"]))
    baseline=score(games,22.,65.,.67)
    best=candidates[0]
    scoring_validation=score_forecast_evaluation(games)
    heldout=heldout_evaluation(games)
    document={"heldout_evaluation":heldout,"scoring_forecast_validation":scoring_validation,"status":"holdout_measured_baseline_not_replaced","evaluated_seasons":["E2025","E2026"],
              "method":"chronological expanding-window (but candidate selection occurs on evaluation seasons)",
              "caution":"2026-27 is held out from candidate selection; sample is early season. Published Elo still uses provisional baseline settings until a release decision.",
              "best_in_sample":best,"baseline":{"k":22,"home_elo":65,"season_carry":.67,
              "brier":round(baseline["brier"],6),"log_loss":round(baseline["log_loss"],6),"n":baseline["n"]},
              "tested":len(candidates),"leaderboard":candidates[:15]}
    OUT.parent.mkdir(exist_ok=True,parents=True)
    OUT.write_text(json.dumps(document,indent=2)+"\n")
    print(json.dumps({"tested":len(candidates),"best":best,"baseline":document["baseline"]}))
if __name__=="__main__":main()
