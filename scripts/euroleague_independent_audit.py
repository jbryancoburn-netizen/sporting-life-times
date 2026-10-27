"""Independent source reconciliation and current-season Elo replay; fail on any mismatch."""
import collections, datetime as dt, json, math, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import euroleague_model as source
import euroleague_final_checks as verified

OUT=pathlib.Path("data/euroleague-independent-audit.json")
def audit():
    published=json.loads(pathlib.Path("data/euroleague-model.json").read_text())
    settings=published["settings"]
    seasons={}
    for season in ("E2021","E2022","E2023","E2024","E2025","E2026"):
        games=source.fetch_season(season)
        completed=[g for g in games if g["completed"]]
        ids=[g["id"] for g in games]
        assert len(ids)==len(set(ids)) and all(ids),season+" duplicate identifiers"
        assert all(g["home"]["score"]!=g["away"]["score"] for g in completed),season+" tied final"
        assert all(source.clock(g["date"])!=dt.datetime.max.replace(tzinfo=dt.timezone.utc) for g in completed)
        clubs={t["code"] for g in games for t in (g["home"],g["away"])}
        appearances=collections.Counter(t["code"] for g in completed for t in (g["home"],g["away"]))
        assert sum(appearances.values())==2*len(completed)
        seasons[season]={"fixtures":len(games),"completed":len(completed),"clubs":len(clubs),
            "team_appearances":sum(appearances.values()),"unique_ids":len(set(ids))}
        if season=="E2026":current=games
    assert seasons["E2021"]["completed"]>0,"2021-22 has no verified results"
    assert len(current)==published["games_ingested"],"Current season fixture count changed"
    verified.apply(current,verified.load(),require_all=True)
    current.sort(key=lambda g:(source.clock(g["date"]),g["id"]))
    finished=[g for g in current if g["completed"]]
    assert len(finished)==published["games_completed"],"Completed-game count differs from published model"
    assert len(finished)>=70,"Missing historical 70-game replay"
    assert settings["opening_elo"]==1500 and settings["season_carry"]==0
    k=float(settings["K"]);home=float(settings["home_elo"])
    ratings={code:1500. for g in current for code in (g["home"]["code"],g["away"]["code"])}
    records=collections.defaultdict(lambda:{"played":0,"wins":0,"losses":0,"for":0,"against":0})
    ledger=[]
    for g in finished:
        a=g["home"]["code"];b=g["away"]["code"]
        hs=g["home"]["score"];aws=g["away"]["score"]
        probability=1/(1+10**(-(ratings[a]-ratings[b]+(0 if g["neutral"] else home))/400))
        outcome=int(hs>aws)
        multiplier=min(1.65,.8+.22*math.log1p(abs(hs-aws)))
        delta=k*multiplier*(outcome-probability)
        before=(ratings[a],ratings[b])
        ratings[a]+=delta;ratings[b]-=delta
        for code,points,against,win in ((a,hs,aws,outcome),(b,aws,hs,1-outcome)):
            r=records[code];r["played"]+=1;r["wins"]+=win;r["losses"]+=1-win;r["for"]+=points;r["against"]+=against
        ledger.append({"id":g["id"],"home":a,"away":b,"score":[hs,aws],
            "pregame_home_probability":round(probability,5),"home_delta":round(delta,7),
            "home_before":round(before[0],7),"away_before":round(before[1],7)})
    failures=[]
    published_rankings={r["code"]:r for r in published["rankings"]}
    for code,elo in sorted(ratings.items()):
        r=published_rankings.get(code)
        if r is None or abs(r["elo"]-round(elo,1))>0.00001:
            failures.append({"club":code,"field":"elo","replayed":round(elo,1),"published":r.get("elo") if r else None})
        for field,value in records[code].items():
            if r is None or r[field]!=value:failures.append({"club":code,"field":field,"replayed":value,"published":r.get(field) if r else None})
    published_recent={str(x["id"]):x for x in published["recent_results"]}
    for entry in ledger:
        old=published_recent.get(entry["id"])
        if old and (old["home"]!=entry["home"] or old["away"]!=entry["away"] or old["score"]!=entry["score"] or abs(old["pregame_home_probability"]-entry["pregame_home_probability"])>0.000001):
            failures.append({"game":entry["id"],"field":"recent_result","replayed":entry,"published":old})
    assert abs(sum(ratings.values())-1500*len(ratings))<1e-5,"Elo not zero sum"
    result={"status":"pass" if not failures else "fail","source":"EuroLeague public v2 source, independently re-fetched",
      "seasons":seasons,"settings":settings,"replayed_finals":len(ledger),
      "total_elo":round(sum(ratings.values()),6),"club_mismatches":failures,
      "game_ledger":ledger}
    OUT.parent.mkdir(exist_ok=True,parents=True)
    OUT.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({k:v for k,v in result.items() if k!="game_ledger"},indent=2),flush=True)
    if failures:raise SystemExit("Independent EuroLeague replay FAILED: "+str(len(failures))+" mismatches")
if __name__=="__main__":audit()
