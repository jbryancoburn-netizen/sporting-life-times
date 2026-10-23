#!/usr/bin/env python3
"""Read actual scheduled 2026-27 D1 games from ESPN as attributed secondary evidence.

This feed is NOT used as independent Elo ratings. No game is accepted as final
for Elo without matching NCAA source and court verification.
"""
import argparse,json,urllib.parse,urllib.request
from datetime import date,datetime
from pathlib import Path
def load(day,fetch=None):
    url="https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?"+urllib.parse.urlencode({"dates":day.strftime("%Y%m%d"),"groups":"50","limit":500})
    if fetch is None:
        req=urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimes/1.0","Accept":"application/json"})
        with urllib.request.urlopen(req,timeout=30) as res:body=json.loads(res.read(8000000))
    else:body=fetch(url)
    if not isinstance(body.get("events"),list):raise ValueError("Missing events collection")
    games=[];ids=set()
    for event in body["events"]:
        eid=str(event.get("id","")).strip()
        competitions=event.get("competitions") or []
        if not eid or eid in ids or len(competitions)!=1:raise ValueError("Invalid or duplicate ESPN contest")
        ids.add(eid);comp=competitions[0]
        rivals=comp.get("competitors") or []
        if len(rivals)!=2:raise ValueError("Missing competitors")
        home=next((t for t in rivals if t.get("homeAway")=="home"),None)
        away=next((t for t in rivals if t.get("homeAway")=="away"),None)
        if not home or not away:raise ValueError("Missing side classification")
        neutral=comp.get("neutralSite")
        if type(neutral) is not bool:neutral=None
        games.append({"source_event_id":eid,"date":event.get("date"),"name":event.get("name"),
           "home":home.get("team",{}).get("displayName"),"away":away.get("team",{}).get("displayName"),
           "home_location":home.get("team",{}).get("location"),"away_location":away.get("team",{}).get("location"),
           "home_short":home.get("team",{}).get("shortDisplayName"),"away_short":away.get("team",{}).get("shortDisplayName"),
           "home_espn_id":home.get("team",{}).get("id"),"away_espn_id":away.get("team",{}).get("id"),
           "venue_neutral":neutral,
           "state":event.get("status",{}).get("type",{}).get("name"),
           "source_url":event.get("links",[{}])[0].get("href") or url})
    return {"date":day.isoformat(),"source":url,"provider":"ESPN secondary schedule evidence",
       "games":sorted(games,key=lambda x:x["source_event_id"]),
       "use_for_elo":False,
       "note":"Final scores and neutral-site data require NCAA or institutional reconciliation."}
def main():
    p=argparse.ArgumentParser();p.add_argument("--date",default="2026-11-02")
    p.add_argument("--output",type=Path,default=Path("data/ncaam-2026-27-opening-schedule-candidates.json"))
    a=p.parse_args();result=load(date.fromisoformat(a.date))
    if not result["games"]:raise ValueError("Source returned no season-opening games; cannot claim schedule completeness")
    a.output.parent.mkdir(parents=True,exist_ok=True)
    a.output.write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print("Found",len(result["games"]),"secondary-source events",result["date"])
if __name__=="__main__":main()
