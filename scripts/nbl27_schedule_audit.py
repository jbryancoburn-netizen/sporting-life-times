#!/usr/bin/env python3
"""NBL27 schedule completeness audit and publishable ESPN candidate ledger.
Official NBL announced 165 regular-season games; ESPN results are candidates
until reconciled game-by-game to official NBL fixture identifiers.
"""
import datetime as dt
import json
import pathlib
import urllib.request
import time
from collections import Counter
from zoneinfo import ZoneInfo
import hashlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
DATA=ROOT/"data"
ENDPOINT="https://site.api.espn.com/apis/site/v2/sports/basketball/nbl/scoreboard"
MONTHS=[("20260919","20261031"),("20261101","20261130"),("20261201","20261231"),("20270101","20270131"),("20270201","20270228")]
TEAMS={"Adelaide 36ers","Brisbane Bullets","Cairns Taipans","Illawarra Hawks","Melbourne United","New Zealand Breakers","Perth Wildcats","South East Melbourne Phoenix","Sydney Kings","Tasmania JackJumpers"}
def get(a,b):
    url=f"{ENDPOINT}?dates={a}-{b}&limit=300"
    req=urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimes-NBL-Audit/1.0"})
    last_error=None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req,timeout=45) as response:
                payload=json.load(response)
            if not isinstance(payload.get("events"),list):
                raise ValueError("No events array returned")
            return payload["events"]
        except Exception as exc:
            last_error=exc
            if attempt<2: time.sleep(2**attempt)
    raise RuntimeError(f"ESPN source fetch failed for {a}-{b}: {last_error}")
def transform(event):
    comp=(event.get("competitions") or [{}])[0]
    cs=comp.get("competitors") or []
    h=next((x for x in cs if x.get("homeAway")=="home"),{})
    a=next((x for x in cs if x.get("homeAway")=="away"),{})
    state=event.get("status",{}).get("type",{}).get("state","pre")
    def score(x):
        try: return int(x["score"]) if state=="post" else None
        except (KeyError,ValueError,TypeError): return None
    return {"id":str(event.get("id","")),"date_utc":event.get("date"),
            "home":h.get("team",{}).get("displayName"),"away":a.get("team",{}).get("displayName"),
            "home_score":score(h),"away_score":score(a),"state":state,
            "venue":comp.get("venue",{}).get("fullName"),
            "broadcasts":sorted(set(name for b in comp.get("broadcasts",[]) for name in b.get("names",[]))),
            "round":event.get("week",{}).get("number"),
            "season_type":event.get("season",{}).get("type"),
            "source":"ESPN","official_nbl_verified":False}

def get_fixture_candidates():
    """Independent fixture cross-check; does not confer official-NBL status."""
    url="https://fixturedownload.azurewebsites.net/feed/json/nbl-2026"
    req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; SportingLifeTimes/1.0)"})
    with urllib.request.urlopen(req,timeout=45) as response: payload=json.load(response)
    if isinstance(payload,list): return payload
    if isinstance(payload,dict):
        for key in ("fixtures","Fixtures","games","Games","matches","Matches","data","Data"):
            if isinstance(payload.get(key),list): return payload[key]
    raise ValueError("Unrecognized secondary fixture schema")

def as_fixture(row):
    def grab(*names):
        for name in names:
            if row.get(name) is not None:return row[name]
        return None
    home=grab("HomeTeam","homeTeam","home_team","home","Home","Home Team")
    away=grab("AwayTeam","awayTeam","away_team","away","Away","Away Team")
    date=grab("DateUtc","dateUtc","date_utc","Date","date","StartDate","start")
    if isinstance(home,dict):home=home.get("name") or home.get("displayName")
    if isinstance(away,dict):away=away.get("name") or away.get("displayName")
    if not home or not away or not date:return None
    if not isinstance(date,str):date=str(date)
    if "36ers" in home:home="Adelaide 36ers"
    if "36ers" in away:away="Adelaide 36ers"
    return {"id":"secondary-"+hashlib.sha1((str(date)+"|"+str(home)+"|"+str(away)).encode()).hexdigest()[:16],"date_utc":date,"home":home,"away":away,"home_score":None,
       "away_score":None,"state":"pre","venue":grab("Location","location","Venue","venue"),
       "broadcasts":[],"round":None,"season_type":2,"source":"FixtureDownload secondary",
       "official_nbl_verified":False}

def main():
    raw=[];failures=[]
    for start,end in MONTHS:
        try:raw.extend(get(start,end))
        except Exception as exc:failures.append({"start":start,"end":end,"error":str(exc)})
    # Secondary fixture retrieval must still run when ESPN is unavailable.
    by_id={str(g.get("id")):g for g in raw if g.get("id")}
    games=sorted([transform(g) for g in by_id.values()],key=lambda g:g.get("date_utc") or "")
    secondary_error=None
    try:
        secondary=[g for row in get_fixture_candidates() if (g:=as_fixture(row))]
        def local_date(iso):
            try:
                parsed=dt.datetime.fromisoformat(str(iso).replace("Z","+00:00"))
                if parsed.tzinfo:return parsed.astimezone(ZoneInfo("Australia/Sydney")).date().isoformat()
            except ValueError:pass
            return str(iso)[:10]
        known={(g["home"],g["away"],local_date(g["date_utc"])) for g in games}
        for g in secondary:
            key=(g["home"],g["away"],local_date(g["date_utc"]))
            if key not in known and g["home"] in TEAMS and g["away"] in TEAMS:
                games.append(g)
                known.add(key)
        games.sort(key=lambda g:g.get("date_utc") or "")
    except Exception as exc:
        secondary_error=str(exc)
    if len(games)<46:
        raise SystemExit("Fewer than 46 game candidates recovered; retaining the existing ledger.")
    counts=Counter(n for g in games for n in (g["home"],g["away"]) if n)
    invalid=[g["id"] for g in games if not g["id"] or g["home"] not in TEAMS or g["away"] not in TEAMS or g["home"]==g["away"] or not g["date_utc"]]
    duplicate_keys=[list(key) for key,num in Counter((g["date_utc"],g["home"],g["away"]) for g in games).items() if num>1]
    completed=[g for g in games if g["state"]=="post"]
    bad_scores=[g["id"] for g in completed if g["home_score"] is None or g["away_score"] is None]
    # Refuse to publish a shrinking or partial ledger after all retrieval paths.
    # ESPN scoreboard may include additional competition types; do not certify
    # 165 based only on total event count without NBL round classification.
    report={"generated_at":dt.datetime.now(dt.timezone.utc).isoformat(),"expected_regular_season_games":165,
            "expected_team_appearances":330,"source_event_count":len(raw),"unique_candidate_games":len(games),
            "candidate_team_appearances":sum(counts.values()),"per_team":dict(sorted(counts.items())),
            "source_month_failures":failures,"secondary_fixture_error":secondary_error,"invalid_games":invalid,"duplicate_matchups":duplicate_keys,
            "completed_games":len(completed),"completed_without_scores":bad_scores,
            "official_game_reconciliation":"NOT_COMPLETED",
            "certified_regular_season_complete":False,
            "reason":"ESPN events are not independently cross-matched to all 165 official NBL round fixtures."}
    DATA.mkdir(parents=True,exist_ok=True)
    (DATA/"nbl27-season-candidates.json").write_text(json.dumps({"season":"2026-27","source":"ESPN","official_verified":False,"games":games},indent=2)+"\n")
    (DATA/"nbl27-schedule-audit.json").write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2))
    if failures or invalid or duplicate_keys or bad_scores:raise SystemExit("NBL source/identity/score audit failed; see JSON report")
    if len(games)<165:raise SystemExit("NBL fixture feed has fewer than 165 candidates; schedule remains incomplete")
if __name__=="__main__":main()
