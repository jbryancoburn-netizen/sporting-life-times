"""Reconcile club-confirmed EuroLeague finals against the competition feed."""
import json
import pathlib
DATA=pathlib.Path(__file__).resolve().parents[1]/"data/euroleague-final-verifications.json"

def load(path=DATA):
    if not path.exists():return {"season":"E2026","games":[]}
    data=json.loads(path.read_text())
    if data.get("season")!="E2026" or not isinstance(data.get("games"),list):
        raise ValueError("Invalid verified-final document")
    return data

def validated(doc):
    keys=set()
    for item in doc["games"]:
        code=str(item.get("id",""))
        score=item.get("score")
        if (not code or code in keys or not str(item.get("home","")) or not str(item.get("away","")) or
            item["home"]==item["away"] or not isinstance(score,list) or len(score)!=2 or
            not all(type(v)==int and 0<=v<=250 for v in score) or score[0]==score[1] or
            not str(item.get("source","")).startswith("https://")):
            raise ValueError("Invalid or duplicate verified-final game: "+code)
        keys.add(code)
    return doc["games"]

def apply(games, doc, require_all=False):
    by_id={str(g["id"]):g for g in games}
    applied=[]
    for final in validated(doc):
        game=by_id.get(str(final["id"]))
        if game is None:
            if require_all:raise ValueError("Verified final missing from season schedule: "+str(final["id"]))
            continue
        if game["home"]["code"]!=final["home"] or game["away"]["code"]!=final["away"]:
            raise ValueError("Verified final club mismatch: "+str(final["id"]))
        h,a=final["score"]
        if game.get("completed"):
            if (game["home"]["score"],game["away"]["score"])!=(h,a):
                raise ValueError("EuroLeague source and club disagree on final: "+str(final["id"]))
        else:
            game["home"]["score"]=h
            game["away"]["score"]=a
            game["completed"]=True
            applied.append(str(final["id"]))
    return applied
