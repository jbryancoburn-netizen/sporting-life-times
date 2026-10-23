#!/usr/bin/env python3
"""Fetch and audit public 2026-27 men's D1 rosters, without inventing player impact.

ESPN is used only as attributed secondary roster evidence. No third-party
ratings enter the independent Elo calculation. Coverage and identity are
explicit publication gates.
"""
import argparse,json,urllib.request,urllib.parse
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path

BASE="https://site.api.espn.com/apis/common/v3/sports/basketball/mens-college-basketball/teams/"
def request(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimes/1.0"}),timeout=20) as r:
        return json.loads(r.read(4000000))
def fetch_team(team_id,season,reader=request):
    url=f"{BASE}{team_id}/roster?season={season}"
    data=reader(url)
    athletes=data.get("athletes") or []
    if isinstance(athletes,dict):
        athletes=[x for group in athletes.values() if isinstance(group,list) for x in group]
    if not isinstance(athletes,list):raise ValueError("Invalid roster collection")
    players=[]
    for a in athletes:
        pid=str(a.get("id") or a.get("uid") or "").strip()
        name=a.get("displayName") or a.get("fullName")
        if pid and name:players.append({"id":pid,"name":name,
          "position":a.get("position",{}).get("abbreviation") if isinstance(a.get("position"),dict) else None,
          "experience":a.get("experience",{}).get("displayValue") if isinstance(a.get("experience"),dict) else None})
    return {"team_id":str(team_id),"season":season,"url":url,"players":players}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--season",type=int,default=2027)
    p.add_argument("--team-ids",type=Path,default=Path("data/ncaam-2026-27-espn-team-crosswalk.json"))
    p.add_argument("--out",type=Path,default=Path("staging/ncaam-2027-roster-evidence.json"))
    a=p.parse_args()
    teams=json.loads(a.team_ids.read_text())["teams"]
    output=[];failures=[]
    def one(t):
        if not t.get("espn_id"):return None,{"team":t["name"],"reason":"missing ESPN school ID"}
        try:
            x=fetch_team(t["espn_id"],a.season)
            x["ncaa_id"]=t["id"];x["school"]=t["name"]
            if len(x["players"])<8:raise ValueError("Fewer than 8 listed players")
            return x,None
        except Exception as exc:return None,{"team":t["name"],"error":str(exc)[:160]}
    with ThreadPoolExecutor(max_workers=6) as executor:
        for x,err in executor.map(one,teams):
            if x:output.append(x)
            if err:failures.append(err)
    output.sort(key=lambda x:x["ncaa_id"])
    result={"season":a.season,"provenance":"ESPN roster endpoint; secondary evidence",
            "rosters":output,"failed":failures,"full_coverage":len(output)==len(teams)}
    a.out.parent.mkdir(parents=True,exist_ok=True)
    a.out.write_text(json.dumps(result,indent=2)+"\n")
    print("Complete rosters",len(output),"of",len(teams),"; failures",len(failures))
if __name__=="__main__":main()
