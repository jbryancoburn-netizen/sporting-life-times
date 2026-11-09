#!/usr/bin/env python3
"""Prospective, as-of-date comparison of RETRO regularization .006 vs .002.

Uses confirmed D-I games from previous calendar days only. Archives predictions
for future UTC dates, freezing them permanently. Never scores games not archived
before their day. Does not alter published RETRO ratings or forecasts.
"""
import json, math, pathlib
from datetime import datetime, timezone
from collections import defaultdict

DATA = pathlib.Path(__file__).resolve().parents[1] / "data"
SOURCE = DATA / "ncaam-2026-27-retro-primary.json"
FUTURE = DATA / "ncaam-2026-27-upcoming-forecasts.json"
ARCHIVE = DATA / "retro-regularization-forward-2026-27.json"
REPORT = DATA / "retro-regularization-forward-score-2026-27.json"

def get(path, default=None):
    if not path.exists() and default is not None:
        return default
    return json.loads(path.read_text(encoding="utf-8"))

def save(path, data):
    body = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    if not path.exists() or path.read_text(encoding="utf-8") != body:
        path.write_text(body, encoding="utf-8")

def calc(events, reg):
    ratings, counts = {}, {}
    for g in events:
        a, b = g["home_id"], g["away_id"]
        if a == b: continue
        for t in (a,b):
            ratings.setdefault(t, 1500.)
            counts[t] = counts.get(t, 0) + 1
    for _ in range(160):
        grad = dict.fromkeys(ratings, 0.)
        for g in events:
            a,b = g["home_id"],g["away_id"]
            if a not in ratings or b not in ratings or a == b: continue
            m = g["home_score"] - g["away_score"]
            edge = 100 if g.get("site_verified") and not g.get("neutral") else 0
            p = 1 / (1 + 10 ** ((ratings[b]-ratings[a]-edge)/400))
            residual = min(2.5,1+math.log1p(abs(m))/3) * ((1 if m>0 else 0) - p)
            grad[a] += residual
            grad[b] -= residual
        for t, old in list(ratings.items()):
            new = old + 18 * (grad[t] - reg*(old-1500))/(3+counts[t])
            ratings[t] = max(1100,min(1900,new))
    return ratings

def score(rows):
    n=len(rows)
    if not n:return {"games":0,"margin_mae":None,"brier":None,"winner_accuracy":None}
    return {"games":n,
            "margin_mae":round(sum(x["absolute_error"] for x in rows)/n,4),
            "brier":round(sum(x["brier"] for x in rows)/n,6),
            "winner_accuracy":round(sum(x["winner_correct"] for x in rows)/n,5)}

def main():
    now=datetime.now(timezone.utc).isoformat(timespec="seconds")
    today=now[:10]
    source=get(SOURCE)
    upcoming=get(FUTURE)
    assert source.get("season")==upcoming.get("season")=="2026-27"
    archive=get(ARCHIVE,{"season":"2026-27","predictions":[]})
    stored=archive["predictions"]
    seen={(x["date"], x["id"]) for x in stored}
    events=source.get("events",[])
    future=[g for g in upcoming.get("games",[]) if isinstance(g.get("date"),str)
            and g["date"]>today and g.get("id") and (g["date"],g["id"]) not in seen]
    # Separate as-of-date rating builds prevent same-day or future-score leakage.
    byday=defaultdict(list)
    for g in future:byday[g["date"]].append(g)
    for day, fixtures in sorted(byday.items()):
        history=[g for g in events if g["date"]<day]
        models={str(reg):calc(history,reg) for reg in (0.006,0.002)}
        for f in fixtures:
            edge=100 if f.get("venue_verification")=="verified_home" else 0
            forecasts={}
            for label,ratings in models.items():
                diff=ratings.get(f["home_id"],1500)-ratings.get(f["away_id"],1500)+edge
                forecasts[label]={"margin":round(diff*0.05681226*2)/2,
                                  "probability":1/(1+10**(-diff/400))}
            stored.append({"date":day,"id":f["id"],"home_id":f["home_id"],
                           "away_id":f["away_id"],"captured_at_utc":now,
                           "venue_verification":f.get("venue_verification"),
                           "forecasts":forecasts})
            seen.add((day,f["id"]))
    stored.sort(key=lambda x:(x["date"],x["id"]))
    archive["predictions"]=stored
    finals={(e["date"],e["id"]):e for e in events}
    outcomes={key:[] for key in ("0.006","0.002")}
    mismatches=[]
    for entry in stored:
        actual=finals.get((entry["date"],entry["id"]))
        if not actual:continue
        if any(actual.get(k)!=entry.get(k) for k in ("home_id","away_id")):
            mismatches.append(entry["id"]);continue
        margin=actual["home_score"]-actual["away_score"]
        for key,forecast in entry["forecasts"].items():
            p=forecast["probability"]
            outcomes[key].append({"date":entry["date"],"id":entry["id"],
                    "absolute_error":abs(forecast["margin"]-margin),
                    "brier":(p-(1 if margin>0 else 0))**2,
                    "winner_correct":(p>=0.5)==(margin>0)})
    previous=get(REPORT,{})
    report={"season":"2026-27","method":"Frozen future-date predictions; 1500 reset; previous-days-only D-I results",
            "archived":len(stored),"excluded_identity_mismatches":mismatches,
            "baseline_006":score(outcomes["0.006"]),
            "challenger_002":score(outcomes["0.002"]),
            "by_date":{day:{key:score([x for x in outcomes[key] if x["date"]==day])
                        for key in outcomes}
                       for day in sorted(set(x["date"] for v in outcomes.values() for x in v))},
            "last_changed_utc":now}
    if {k:v for k,v in previous.items() if k!="last_changed_utc"}=={k:v for k,v in report.items() if k!="last_changed_utc"}:
        report["last_changed_utc"]=previous.get("last_changed_utc",now)
    save(ARCHIVE,archive);save(REPORT,report)
    print("Forward archive",len(stored),"scored",len(outcomes["0.006"]),
          "identity exceptions",len(mismatches))

if __name__=="__main__":
    main()
