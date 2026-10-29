#!/usr/bin/env python3
"""Women's D-I roster and games only; historical and live scoreboard import."""
import datetime as dt
import json
import pathlib
import sys
import time
import urllib.request

ROOT=pathlib.Path("data")
BASE="https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball"

def request(url):
    req=urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimesWBB/1.0"})
    with urllib.request.urlopen(req,timeout=25) as r:
        return json.load(r)

def write(filename,payload):
    ROOT.mkdir(exist_ok=True)
    dest=ROOT/filename
    output=json.dumps(payload,ensure_ascii=False,indent=2)+"\n"
    if not dest.exists() or dest.read_text(encoding="utf-8")!=output:
        dest.write_text(output,encoding="utf-8")

def team_registry():
    source=request(BASE+"/teams?groups=50&limit=500")
    entries=[x.get("team",x) for s in source.get("sports",[]) for league in s.get("leagues",[]) for x in league.get("teams",[])]
    teams={}
    for t in entries:
        tid=str(t.get("id") or "")
        if not tid.isdigit():
            continue
        g=t.get("groups") or t.get("conference") or {}
        conf=(g.get("name") or g.get("displayName") or "") if isinstance(g,dict) else str(g)
        logo=next((v.get("href") for v in t.get("logos",[]) if v.get("href")),None)
        teams[tid]={"team_id":tid,"team":t.get("displayName") or t.get("name") or tid,
                    "conference":conf,"logo":logo,"color":t.get("color") or ""}
    if not 355<=len(teams)<=375:
        raise RuntimeError("Incomplete D-I women's team registry: "+str(len(teams)))
    return sorted(teams.values(),key=lambda x:x["team"].casefold())

def daily(day):
    url=BASE+"/scoreboard?groups=50&limit=500&dates="+day.strftime("%Y%m%d")
    return request(url).get("events",[])

def game(event):
    c=(event.get("competitions") or [{}])[0]
    sides=c.get("competitors") or []
    h=next((x for x in sides if x.get("homeAway")=="home"),None)
    a=next((x for x in sides if x.get("homeAway")=="away"),None)
    if not h or not a:
        return None
    hid=str(h.get("team",{}).get("id") or "")
    aid=str(a.get("team",{}).get("id") or "")
    date=str(event.get("date") or "")
    if not hid or not aid or hid==aid or len(date)<10:
        return None
    done=bool(event.get("status",{}).get("type",{}).get("completed"))
    out={"id":str(event.get("id") or ""),"date":date,"home_id":hid,"away_id":aid,
         "neutral":bool(c.get("neutralSite")),"site_verified":True,
         "venue":(c.get("venue") or {}).get("fullName"),
         "status":"final" if done else "scheduled"}
    if done:
        try:
            hs=int(h["score"]);aws=int(a["score"])
        except (KeyError,TypeError,ValueError):
            return None
        if min(hs,aws)<1 or hs==aws:
            return None
        out.update(home_score=hs,away_score=aws)
    return out if out["id"] else None

def history(year):
    if not 2022<=year<=2026:
        raise RuntimeError("Historical season ending year must be 2022-2026")
    ids={t["team_id"] for t in team_registry()}
    day=dt.date(year-1,11,1)
    end=dt.date(year,4,15)
    finals={}
    failed=[]
    excluded=0
    while day<=end:
        try:
            for event in daily(day):
                g=game(event)
                if not g or g["status"]!="final":
                    continue
                if g["home_id"] not in ids or g["away_id"] not in ids:
                    excluded+=1
                    continue
                if g["id"] in finals and finals[g["id"]]!=g:
                    raise RuntimeError("Disputed result "+g["id"])
                finals[g["id"]]=g
        except Exception as exc:
            failed.append({"date":str(day),"error":str(exc)})
        day+=dt.timedelta(days=1)
        time.sleep(.04)
    if failed or len(finals)<2500:
        raise RuntimeError(f"Incomplete WBB history: {len(finals)} finals, {len(failed)} failed dates")
    write(f"wbb-{year-1}-{year}-results.json",{
        "season":f"{year-1}-{year%100:02d}",
        "source":"ESPN women's D-I scoreboard; D-I-vs-D-I games only",
        "audit":{"complete":True,"games":len(finals),"excluded_outside_current_registry":excluded},
        "games":sorted(finals.values(),key=lambda g:(g["date"],g["id"]))})
    print("Verified historical finals",year,len(finals))

def live():
    teams=team_registry()
    ids={t["team_id"] for t in teams}
    write("ncaaw-2026-27-teams.json",{
        "season":"2026-27","source":"ESPN Division I women's team roster (group 50)",
        "count":len(teams),"teams":teams})
    ledger=ROOT/"ncaaw-2026-27-verified-games.json"
    saved=json.loads(ledger.read_text()).get("games",[]) if ledger.exists() else []
    finals={str(g["id"]):g for g in saved if str(g["home_id"]) in ids and str(g["away_id"]) in ids}
    upcoming={}
    failed=[]
    now=dt.datetime.now(dt.timezone.utc).date()
    day=max(dt.date(2026,11,1),now-dt.timedelta(days=3))
    end=min(dt.date(2027,4,30),now+dt.timedelta(days=14))
    while day<=end:
        try:
            for event in daily(day):
                g=game(event)
                if not g or g["home_id"] not in ids or g["away_id"] not in ids:
                    continue
                if not "2026-11-01"<=g["date"][:10]<="2027-04-30":
                    continue
                if g["status"]=="final":
                    old=finals.get(g["id"])
                    if old and any(old.get(k)!=g.get(k) for k in ("date","home_id","away_id","home_score","away_score")):
                        raise RuntimeError("Disputed game "+g["id"])
                    finals[g["id"]]=g
                elif g["id"] not in finals:
                    upcoming[g["id"]]=g
        except Exception as exc:
            failed.append({"date":str(day),"error":str(exc)})
        day+=dt.timedelta(days=1)
    if failed:
        raise RuntimeError("Women's scoreboard ingest incomplete: "+json.dumps(failed))
    ordered=sorted(finals.values(),key=lambda g:(g["date"],g["id"]))
    write("ncaaw-2026-27-verified-games.json",{"season":"2026-27","games":ordered})
    write("ncaaw-2026-27-games.json",{
        "season":"2026-27","scope":"Rolling scoreboard only; not complete team schedules",
        "source":"ESPN women's Division I completed events and fixtures",
        "finals":ordered[-100:],
        "upcoming":sorted(upcoming.values(),key=lambda g:(g["date"],g["id"]))})
    print("Women's data:",len(teams),"D-I programs,",len(ordered),"finals,",len(upcoming),"upcoming")

if __name__=="__main__":
    if sys.argv[1:2]==["live"]:
        live()
    elif len(sys.argv)==3 and sys.argv[1]=="history":
        history(int(sys.argv[2]))
    else:
        raise SystemExit("Usage: wbb-season.py live | history YEAR")
