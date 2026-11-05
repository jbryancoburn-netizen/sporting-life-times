#!/usr/bin/env python3
"""Refresh four current-season AP/Coaches basketball polls; fail closed on uncertain sources."""
import datetime as dt
import json
import pathlib
import re
import urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCES={"men":("mens-college-basketball","data/ncaam-2026-27-national-polls.json"),
         "women":("womens-college-basketball","data/ncaaw-2026-27-national-polls.json")}
TODAY=dt.datetime.now(dt.timezone.utc).date()
def valid_date(value):
    if not value:return None
    try:
        day=dt.date.fromisoformat(str(value)[:10])
        return day if dt.date(2026,10,1)<=day<=TODAY else None
    except ValueError:return None
def fetch(league):
    url=f"https://site.api.espn.com/apis/site/v2/sports/basketball/{league}/rankings"
    req=urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimesPolls/1.0","Accept":"application/json"})
    with urllib.request.urlopen(req,timeout=25) as response:
        return json.load(response),url
def extract(payload,kind):
    pools=payload.get("rankings",[])
    if isinstance(pools,dict):pools=list(pools.values())
    names={"ap":("associated press","ap top","ap poll"),"coaches":("coaches","usa today","usatoday","wbca")}
    matches=[]
    for item in pools:
        if not isinstance(item,dict):continue
        label=" ".join(str(item.get(k,"")) for k in ("name","shortName","displayName","type","description")).lower()
        if any(tag in label for tag in names[kind]):matches.append(item)
    for poll in matches:
        items=poll.get("ranks") or poll.get("rankings") or poll.get("entries") or []
        if not isinstance(items,list):continue
        rows=[]
        for entry in items:
            if not isinstance(entry,dict):continue
            rank=entry.get("current") or entry.get("rank") or entry.get("position")
            team=entry.get("team") or {}
            name=(team.get("displayName") or team.get("name") or team.get("shortDisplayName")) if isinstance(team,dict) else str(team)
            if not name and isinstance(entry.get("competitor"),dict):
                name=entry["competitor"].get("displayName")
            try: rank=int(rank)
            except (TypeError,ValueError):continue
            if name and 1<=rank<=25:rows.append({"rank":rank,"team":name})
        if len(rows)!=25 or set(t["rank"] for t in rows)!=set(range(1,26)):continue
        rows.sort(key=lambda x:x["rank"])
        # A source date must belong to the actual poll, not simply the request time.
        date=(valid_date(poll.get("date")) or valid_date(poll.get("published")) or
              valid_date(poll.get("updated")) or valid_date((poll.get("latestWeek") or {}).get("startDate")) or
              valid_date(payload.get("latestWeek",{}).get("startDate")))
        if date:return rows,date
    return None,None
changed=0
for gender,(league,relative) in SOURCES.items():
    path=ROOT/relative
    old=json.loads(path.read_text(encoding="utf-8"))
    try:payload,url=fetch(league)
    except Exception as exc:
        print(gender,"source unavailable, preserved:",exc)
        continue
    for kind in ("ap","coaches"):
        rows,date=extract(payload,kind)
        if not rows or not date:
            print(gender,kind,"unverifiable 25 entries/date; preserved")
            continue
        previous=old["polls"][kind]
        old_date=valid_date(previous.get("published_at") or old.get("as_of"))
        if old_date and date<=old_date:
            print(gender,kind,"no newer verified edition")
            continue
        previous["rankings"]=rows
        previous["published_at"]=date.isoformat()
        previous["source_url"]=url
        changed+=1
        print(gender,kind,"updated",date)
    dates=[valid_date(p.get("published_at") or old.get("as_of")) for p in old["polls"].values()]
    if any(d for d in dates if d):
        old["as_of"]=max(d for d in dates if d).isoformat()
    if changed:path.write_text(json.dumps(old,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
print("New editions:",changed)
