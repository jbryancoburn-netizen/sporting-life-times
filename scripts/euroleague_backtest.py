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
    document={"status":"historical_exploratory_only","evaluated_seasons":["E2025","E2026"],
              "method":"chronological expanding-window (but candidate selection occurs on evaluation seasons)",
              "caution":"Do not treat selected parameters as out-of-sample validated; reserve a future holdout.",
              "best_in_sample":best,"baseline":{"k":22,"home_elo":65,"season_carry":.67,
              "brier":round(baseline["brier"],6),"log_loss":round(baseline["log_loss"],6),"n":baseline["n"]},
              "tested":len(candidates),"leaderboard":candidates[:15]}
    OUT.parent.mkdir(exist_ok=True,parents=True)
    OUT.write_text(json.dumps(document,indent=2)+"\n")
    print(json.dumps({"tested":len(candidates),"best":best,"baseline":document["baseline"]}))
if __name__=="__main__":main()
