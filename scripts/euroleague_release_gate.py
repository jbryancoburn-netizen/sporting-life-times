"""EuroLeague release gate: prevent broken Elo, standings, forecasts or scorebugs."""
import datetime as dt
import json
import pathlib

ROOT=pathlib.Path(__file__).resolve().parents[1]
def validate(model, live):
    errors=[]
    teams=model.get("rankings",[])
    standings=model.get("standings",[])
    games=model.get("games_completed",0)
    codes=[t.get("code") for t in teams]
    if not 18<=len(teams)<=24 or len(codes)!=len(set(codes)) or None in codes:
        errors.append("Elo clubs missing or duplicated")
    if {t.get("code") for t in standings}!=set(codes):
        errors.append("Standings club list differs from Elo")
    if sum(t.get("wins",0) for t in standings)!=games or sum(t.get("losses",0) for t in standings)!=games:
        errors.append("Standings wins/losses do not reconcile to finals")
    if sum(t.get("played",0) for t in standings)!=2*games:
        errors.append("Standings appearances do not reconcile")
    results=model.get("recent_results",[])
    if len({str(g.get("id")) for g in results})!=len(results):
        errors.append("Duplicate final identifiers")
    fixture_ids={str(g.get("id")) for g in model.get("fixtures",[])}
    if any(g.get("home",{}).get("code") not in codes or g.get("away",{}).get("code") not in codes for g in model.get("fixtures",[])):
        errors.append("Fixture has unknown team")
    for game in model.get("fixtures",[]):
        prob=game.get("home_win_probability")
        if not isinstance(prob,(int,float)) or not 0<prob<1:
            errors.append("Invalid game probability: "+str(game.get("id")))
        projection=game.get("projection")
        if projection:
            if abs(projection["home"]+projection["away"]-projection["total"])>0.16:
                errors.append("Projected total inconsistent: "+str(game.get("id")))
            if abs(projection["away"]-projection["home"]-projection["spread_home"])>0.16:
                errors.append("Projected spread inconsistent: "+str(game.get("id")))
    live_ids=set()
    for g in live.get("games",[]):
        gid=str(g.get("id"))
        if gid in live_ids:errors.append("Duplicate live card "+gid)
        live_ids.add(gid)
        if g.get("status") not in ("scheduled","live","final"):
            errors.append("Unknown game state "+gid)
        hs=g.get("home",{}).get("score");aws=g.get("away",{}).get("score")
        if g.get("status")=="scheduled" and (hs is not None or aws is not None):
            errors.append("Scheduled game displays non-final score "+gid)
        if g.get("status") in ("final","live") and (not isinstance(hs,(int,float)) or not isinstance(aws,(int,float))):
            errors.append("Live/final missing scores "+gid)
    try:
        m=dt.datetime.fromisoformat(model["updated_at"].replace("Z","+00:00"))
        s=dt.datetime.fromisoformat(live["updated_at"].replace("Z","+00:00"))
        if m.tzinfo is None or s.tzinfo is None:errors.append("Missing timezone in published timestamps")
    except (KeyError,ValueError,TypeError):
        errors.append("Invalid publication timestamps")
    return errors

def main():
    model=json.loads((ROOT/"data/euroleague-model.json").read_text())
    live=json.loads((ROOT/"data/euroleague-live.json").read_text())
    errors=validate(model,live)
    if errors:raise SystemExit("RELEASE BLOCKED: "+"; ".join(errors))
    print("EuroLeague release gate PASS:",len(model["rankings"]),"clubs,",model["games_completed"],"finals,",len(model["fixtures"]),"fixtures,",len(live["games"]),"scorebugs")

if __name__=="__main__":main()
