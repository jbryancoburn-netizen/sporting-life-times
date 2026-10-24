#!/usr/bin/env python3
"""Stage Australian NBL season finals from public ESPN scoreboard.
Research/audit staging only. Does not mark data verified or publish Elo.
"""
import argparse, json, time
from datetime import date, timedelta, datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import urlencode

URL="https://site.api.espn.com/apis/site/v2/sports/basketball/nbl/scoreboard"
def fetch_events(url):
    req=Request(url,headers={"User-Agent":"SportingLifeTimes/1.0","Accept":"application/json"})
    with urlopen(req,timeout=25) as response:
        doc=json.load(response)
    if not isinstance(doc.get("events"),list): raise ValueError("Missing events array for "+url)
    return doc["events"]

def fetch_month(start,end):
    url=URL+"?"+urlencode({"dates":start.strftime("%Y%m%d")+"-"+end.strftime("%Y%m%d"),"limit":500})
    try:
        return fetch_events(url),[url]
    except HTTPError as ex:
        if ex.code!=400:raise
    events=[]
    urls=[]
    cursor=start
    while cursor<=end:
        day_url=URL+"?"+urlencode({"dates":cursor.strftime("%Y%m%d"),"limit":100})
        events.extend(fetch_events(day_url))
        urls.append(day_url)
        cursor+=timedelta(days=1)
        time.sleep(.08)
    return events,urls

def months(start,end):
    cursor=date(start.year,start.month,1)
    while cursor<=end:
        nxt=(date(cursor.year+1,1,1) if cursor.month==12 else date(cursor.year,cursor.month+1,1))
        yield max(start,cursor),min(end,nxt-timedelta(days=1))
        cursor=nxt

def normalize(ev):
    status=((ev.get("status") or {}).get("type") or {})
    if status.get("state")!="post" or not status.get("completed",False): return None
    c=((ev.get("competitions") or [{}])[0])
    players=c.get("competitors") or []
    if len(players)!=2: return None
    home=next((t for t in players if t.get("homeAway")=="home"),None)
    away=next((t for t in players if t.get("homeAway")=="away"),None)
    if not home or not away: return None
    try:
        hs,as_=int(home["score"]),int(away["score"])
    except (TypeError,ValueError,KeyError): return None
    if hs==as_ or min(hs,as_)<0: return None
    return {"id":str(ev.get("id","")),"played_at":ev.get("date"),"home":(home.get("team") or {}).get("displayName"),
      "away":(away.get("team") or {}).get("displayName"),"home_score":hs,"away_score":as_,
      "source_url":next((x.get("href") for x in ev.get("links",[]) if x.get("href","").startswith("https://")),""),
      "verified":False,"provider":"espn","state":"candidate"}

def collect(start,end):
    ids={}
    probes=[]
    for a,b in months(start,end):
        ev,urls=fetch_month(a,b)
        probes.append({"from":str(a),"to":str(b),"events":len(ev),"endpoints":urls,"request_count":len(urls)})
        for raw in ev:
            game=normalize(raw)
            if game and game["id"]:
                if game["id"] in ids and ids[game["id"]]!=game:
                    raise ValueError("Conflicting provider results for "+game["id"])
                ids[game["id"]]=game
        time.sleep(.3)
    return {"retrieved_at":datetime.now(timezone.utc).isoformat(),"range":[str(start),str(end)],
      "status":"uncertified_source_candidates","source":"ESPN site API","probes":probes,
      "candidate_count":len(ids),"games":sorted(ids.values(),key=lambda g:(g["played_at"] or "",g["id"]))}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--start",required=True,help="ISO date inclusive")
    p.add_argument("--end",required=True,help="ISO date inclusive")
    p.add_argument("--output",required=True)
    a=p.parse_args()
    start,end=date.fromisoformat(a.start),date.fromisoformat(a.end)
    if start>end:raise ValueError("Start must precede end")
    output=collect(start,end)
    dest=Path(a.output)
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(output,indent=2)+"\n")
    print("NBL candidate finals",output["candidate_count"],"month windows",len(output["probes"]))
if __name__=="__main__":main()
