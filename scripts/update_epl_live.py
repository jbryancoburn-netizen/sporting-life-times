#!/usr/bin/env python3
"""Rebuild EPL desk feeds from confirmed match results. No external Elo service."""
import datetime as dt
import hashlib
import json
import math
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data"
URL="https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard"
CLUBS={
"ARS":"Arsenal","AVL":"Aston Villa","BOU":"Bournemouth","BRE":"Brentford",
"BHA":"Brighton","BIR":"Brighton","CHE":"Chelsea","COV":"Coventry","CRY":"Crystal Palace",
"EVE":"Everton","FUL":"Fulham","HUL":"Hull","IPS":"Ipswich","LEE":"Leeds United",
"LIV":"Liverpool","MCI":"Manchester City","MUN":"Manchester United",
"NEW":"Newcastle United","NFO":"Nott'm Forest","SUN":"Sunderland","TOT":"Tottenham"
}
ALIASES={"Brighton & Hove Albion":"Brighton","Nottingham Forest":"Nott'm Forest",
"Manchester City":"Manchester City","Manchester United":"Manchester United",
"Newcastle United":"Newcastle United","Leeds United":"Leeds United",
"AFC Bournemouth":"Bournemouth","Hull City":"Hull","Coventry City":"Coventry",
"Ipswich Town":"Ipswich","Tottenham Hotspur":"Tottenham","Arsenal FC":"Arsenal",
"Chelsea FC":"Chelsea","Fulham FC":"Fulham","Everton FC":"Everton"}
def get_day(day):
    url=URL+"?dates="+day.strftime("%Y%m%d")+"&limit=100"
    with urlopen(Request(url,headers={"User-Agent":"SportingLifeTimes-EPL/1.0","Accept":"application/json"}),timeout=30) as r:
        return json.load(r).get("events",[])
def club(c):
    short=c.get("team",{}).get("abbreviation","").upper()
    if short in CLUBS:return CLUBS[short]
    names=[c.get("team",{}).get(k,"") for k in ("displayName","shortDisplayName","name")]
    for name in names:
        if name in ALIASES:return ALIASES[name]
        if name in CLUBS.values():return name
    raise ValueError("Unknown EPL club "+repr((short,names)))
def parse(event):
    competition=(event.get("competitions") or [{}])[0]
    teams=competition.get("competitors") or []
    if len(teams)!=2:return None
    home=next((c for c in teams if c.get("homeAway")=="home"),None)
    away=next((c for c in teams if c.get("homeAway")=="away"),None)
    if not home or not away:return None
    start=dt.datetime.fromisoformat(event["date"].replace("Z","+00:00"))
    state=event.get("status",{}).get("type",{}).get("state","")
    completed=event.get("status",{}).get("type",{}).get("completed") is True
    outcome={"id":str(event["id"]),"kickoff":start.isoformat(),"date":start.date().isoformat(),
       "home":club(home),"away":club(away),"home_id":str(home["team"]["id"]),
       "away_id":str(away["team"]["id"]),"state":state,"completed":completed}
    if completed:
        outcome["home_score"]=int(home["score"])
        outcome["away_score"]=int(away["score"])
    return outcome
def forecast(rh,ra):
    e=1/(1+10**(-(rh-ra+55)/400))
    d=min(.25,2*e,2*(1-e))
    p=[max(.000001,e-d/2),d,max(.000001,1-e-d/2)]
    t=sum(p)
    return [v/t for v in p]
def rebuild(today=None,loader=get_day):
    today=today or dt.datetime.now(dt.timezone.utc).date()
    first=dt.date(2026,8,1)
    last=today+dt.timedelta(days=18)
    if today<first:raise ValueError("Season has not begun")
    events={}
    dates=[first+dt.timedelta(days=i) for i in range((last-first).days+1)]
    # Fetch independent days concurrently; fail closed if any day cannot be fetched.
    # Serial day-by-day HTTP polling often exhausted the Actions job timeout.
    with ThreadPoolExecutor(max_workers=12) as pool:
      jobs={pool.submit(loader, day): day for day in dates}
      batches={}
      for job in as_completed(jobs):
        batches[jobs[job]]=job.result()
    for day in dates:
      for raw in batches[day]:
            game=parse(raw)
            if game is None:continue
            old=events.get(game["id"])
            # Duplicate appearances are accepted only when they describe one fixture.
            if old and (old["home"],old["away"],old["kickoff"])!=(game["home"],game["away"],game["kickoff"]):
                raise ValueError("Conflicting fixture ID "+game["id"])
            if not old or (game["completed"] and not old["completed"]):events[game["id"]]=game
    played=sorted((g for g in events.values() if g["completed"] and dt.datetime.fromisoformat(g["kickoff"])<=dt.datetime.now(dt.timezone.utc)),
       key=lambda g:(g["date"],g["kickoff"],g["id"]))
    # Never publish a truncated feed or replace the published dataset with fewer finals.
    old_path=DATA/"epl-ratings.json"
    prior=json.loads(old_path.read_text()) if old_path.exists() else {}
    floor=int(prior.get("completed_matches",0))
    if len(played)<floor:raise ValueError(f"Only {len(played)} finals; expected >= {floor}. No files published.")
    names=set(CLUBS.values())
    if len(names)!=20:raise ValueError("Expected exactly 20 clubs")
    ratings={name:1500.0 for name in names}
    table={name:{"club":name,"played":0,"won":0,"drawn":0,"lost":0,"gf":0,"ga":0,"gd":0,"points":0} for name in names}
    for g in played:
        h,a=g["home"],g["away"];hg,ag=g["home_score"],g["away_score"]
        if h==a:raise ValueError("Self-match")
        p=forecast(ratings[h],ratings[a]);actual=1 if hg>ag else .5 if hg==ag else 0
        expected=p[0]+.5*p[1]
        delta=20*(actual-expected)
        ratings[h]+=delta;ratings[a]-=delta
        for club,goals,conceded in [(h,hg,ag),(a,ag,hg)]:
            t=table[club];t["played"]+=1;t["gf"]+=goals;t["ga"]+=conceded
            t["gd"]=t["gf"]-t["ga"]
            if goals>conceded:t["won"]+=1;t["points"]+=3
            elif goals==conceded:t["drawn"]+=1;t["points"]+=1
            else:t["lost"]+=1
    if sum(x["played"] for x in table.values())!=2*len(played):raise ValueError("Table reconciliation failed")
    ordered=sorted(table.values(),key=lambda x:(-x["points"],-x["gd"],-x["gf"],x["club"]))
    upcoming=sorted((g for g in events.values() if not g["completed"] and dt.datetime.fromisoformat(g["kickoff"])>dt.datetime.now(dt.timezone.utc)),key=lambda g:g["kickoff"])
    source=hashlib.sha256(json.dumps(played,sort_keys=True).encode()).hexdigest()
    stamp=dt.datetime.now(dt.timezone.utc).isoformat()
    rating_doc={"as_of_date":today.isoformat(),"completed_matches":len(played),
      "ratings":{k:round(v,5) for k,v in ratings.items()},"predictions":[],
      "model_status":"provisional_unvalidated",
      "note":"Independent 1500-initialized Elo, K=20, 55-point home advantage, heuristic draw prior; not independently calibrated.",
      "standings":ordered,"standings_note":"Calculated from verified feed finals; no disciplinary deductions or head-to-head tiebreaks.",
      "provenance":{"season":"2026-2027","source_sha256":source,"source_fixtures":len(played),
        "rating_origin":"neutral baseline; no independently sourced prior-season ratings",
        "fixture_policy":"only feed-confirmed future fixtures"}}
    fixtures=[]
    for g in upcoming[:40]:
        h,a=g["home"],g["away"];p=forecast(ratings[h],ratings[a])
        # Explicitly hypothetical goals, not bookmaker lines or historical results.
        xh=max(.25,min(3.8,1.45+(ratings[h]-ratings[a]+55)/750))
        xa=max(.25,min(3.8,1.25+(ratings[a]-ratings[h]-55)/750))
        fixtures.append({"fixture_id":g["id"],"kickoff_utc":g["kickoff"],
          "home":{"id":g["home_id"],"name":h,"elo":ratings[h],"expected_goals":xh},
          "away":{"id":g["away_id"],"name":a,"elo":ratings[a],"expected_goals":xa},
          "probabilities":{"home":p[0],"draw":p[1],"away":p[2]},
          "projected_score":{"home":round(xh),"away":round(xa),"method":"heuristic_unvalidated_goal_rates"}})
    forecast_doc={"schema_version":1,"competition":"EPL","status":"provisional_research",
       "recent_results":[{"fixture_id":g["id"],"kickoff_utc":g["kickoff"],"home":g["home"],"away":g["away"],"home_score":g["home_score"],"away_score":g["away_score"]} for g in played[-18:][::-1]],
       "issued_at_utc":stamp,"fixtures":fixtures}
    DATA.mkdir(parents=True,exist_ok=True)
    for name,obj in [("epl-ratings.json",rating_doc),("epl-match-center.json",forecast_doc)]:
        path=DATA/name;body=json.dumps(obj,indent=2,sort_keys=True)+"\n"
        if not path.exists() or path.read_text()!=body:path.write_text(body)
    # Keep the newspaper's shared scoreboard in sync with EPL results, without
    # pretending the other leagues were refreshed.
    score_path=ROOT/"multi_scoreboards.json"
    if score_path.exists():
        board=json.loads(score_path.read_text())
        league=next((entry for entry in board.get("leagues",[]) if entry.get("league")=="Premier League"),None)
        if league is None:raise ValueError("Premier League scoreboard entry missing")
        recent=[g for g in played if (today-dt.date.fromisoformat(g["date"])).days<=7]
        sample=(recent[-18:]+upcoming[:18])
        def row(g):
            done=g["completed"]
            return {"id":g["id"],"name":g["away"]+" at "+g["home"],"date":g["kickoff"],
                "status":"Final" if done else "Scheduled","state":"post" if done else "pre",
                "teams":[{"name":g["home"],"score":str(g["home_score"]) if done else "",
                    "home_away":"home"},{"name":g["away"],"score":str(g["away_score"]) if done else "",
                    "home_away":"away"}]}
        league["games"]=[row(g) for g in sample]
        league["updated_at"]=stamp
        board_text=json.dumps(board,indent=2,ensure_ascii=False)+"\\n"
        if board_text!=score_path.read_text():score_path.write_text(board_text)
    print(json.dumps({"verified_finals":len(played),"upcoming":len(fixtures),"issued_at":stamp}))
if __name__=="__main__":rebuild()
