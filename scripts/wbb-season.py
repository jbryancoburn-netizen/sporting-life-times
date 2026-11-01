#!/usr/bin/env python3
"""Women's D-I roster and games only; historical and live scoreboard import."""
import datetime as dt
import json
import pathlib
import sys
import time
import urllib.request
import urllib.error

ROOT=pathlib.Path("data")
BASE="https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball"

def request(url):
    req=urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimesWBB/1.0"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req,timeout=25) as r:
                return json.load(r)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
            if attempt == 2:
                raise
            # Retry transient provider failures instead of dropping a day's finals.
            print(f"WBB scoreboard retry {attempt+1}/2: {exc}")
            time.sleep(0.5 * (attempt + 1))

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
    # ESPN's women's team index omits Mercyhurst (ESPN team 2385).
    # Independently verified against Mercyhurst's official 2026-27 women's
    # basketball schedule and NCAA's projected 363 women D-I programs.
    if "2385" not in teams:
        teams["2385"]={"team_id":"2385","team":"Mercyhurst Lakers",
            "conference":"NEC","logo":"https://a.espncdn.com/i/teamlogos/ncaa/500/2385.png",
            "color":"000000","identity_source":"https://hurstathletics.com/sports/womens-basketball/schedule/2026-27"}
    # Institutional conference affiliations can provisionally fill missing
    # women's ESPN conference fields. They are NOT certified gender-specific
    # league tables, and they NEVER supply men's scores or Elo ratings.
    cross=ROOT/"ncaam-2026-27-espn-team-crosswalk.json"
    master=ROOT/"ncaam-2026-27-team-registry.json"
    if cross.exists() and master.exists():
        try:
            links=json.loads(cross.read_text(encoding="utf-8")).get("teams",[])
            institutions=json.loads(master.read_text(encoding="utf-8")).get("teams",[])
            conf_by_ncaa={str(x["id"]):x.get("conference","") for x in institutions}
            institution_conf={str(x["espn_id"]):conf_by_ncaa.get(str(x["id"]),"") for x in links}
            for tid,t in teams.items():
                if not t["conference"] and institution_conf.get(tid):
                    t["conference"]=institution_conf[tid]
                    t["conference_source"]="2026-27 institutional affiliation proxy, women's membership unverified"
                else:
                    t["conference_source"]="ESPN women's group or official school evidence"
        except (ValueError,KeyError,TypeError) as err:
            print("Conference proxy unavailable; leaving unknown affiliations:",err)
    # Prefer women's sport-specific conference memberships over provisional
    # institutional proxy data, but only after the registry passes coverage checks.
    official=ROOT/"ncaaw-2026-27-conferences.json"
    if official.exists():
        evidence=json.loads(official.read_text(encoding="utf-8"))
        if evidence.get("season")=="2026-27" and evidence.get("gender")=="women" and evidence.get("verified_team_count",0)>=350:
            for tid,info in evidence.get("teams",{}).items():
                if tid in teams and info.get("conference"):
                    teams[tid]["conference"]=info["conference"]
                    teams[tid]["conference_source"]=info.get("source","ESPN women-specific 2026-27 membership")
    if len(teams)!=363:
        raise RuntimeError("2026-27 NCAA projects 363 D-I women's programs; verified directory contains "+str(len(teams)))
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
    networks=[]
    for b in c.get("broadcasts",[]) or []:
        names=b.get("names") or b.get("shortName") or ""
        networks.extend(names if isinstance(names,list) else [names] if names else [])
    for b in c.get("geoBroadcasts",[]) or []:
        name=(b.get("media") or {}).get("shortName")
        if name:networks.append(name)
    out={"id":str(event.get("id") or ""),"date":date,"home_id":hid,"away_id":aid,
         "neutral":bool(c.get("neutralSite")),"site_verified":True,
         "venue":(c.get("venue") or {}).get("fullName"),
         "broadcast":", ".join(dict.fromkeys(str(n) for n in networks if n)) or None,
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

def ncaa_women_snapshot():
    """Recent NCAA-origin women results, already identity-mapped by the news collector.

    The relay transports NCAA.com data; it is not represented as an official
    NCAA API. A stale, incomplete or unidentifiable snapshot is ignored.
    """
    path=ROOT/"mbb-live.json"
    try:
        if not path.exists():
            return {}
        doc=json.loads(path.read_text(encoding="utf-8"))
        evidence=doc.get("ncaa_women_crosscheck") or {}
        if evidence.get("provider")!="NCAA.com via third-party relay":
            return {}
        if not str(evidence.get("source_url","")).startswith(
                "https://ncaa-api.henrygd.me/scoreboard/basketball-women/d1/"):
            return {}
        checked=dt.datetime.fromisoformat(str(evidence.get("checked_at","")).replace("Z","+00:00"))
        elapsed=dt.datetime.now(dt.timezone.utc)-checked
        if not dt.timedelta(seconds=-60)<=elapsed<=dt.timedelta(minutes=90):
            return {}
        return {str(row["espn_id"]):row for row in evidence.get("games",[])
                if isinstance(row,dict) and str(row.get("espn_id","")).isdigit()
                and row.get("phase") in ("final","live","scheduled")}
    except (OSError, ValueError, TypeError, KeyError) as exc:
        print("WBB NCAA-origin crosscheck snapshot unavailable:",exc)
        return {}


def reconcile_ncaa_origin(game_row,ncaa_rows):
    """Corroborate exact teams and finals, including when ESPN lags a final.

    On a real NCAA-origin/ESPN disagreement, reject publication instead of
    silently choosing either provider. No matching NCAA feed means ESPN-only
    provenance is retained explicitly.
    """
    row=ncaa_rows.get(str(game_row["id"]))
    if not row:
        game_row["score_evidence"]="espn_only"
        return game_row
    if str(row.get("home_id"))!=game_row["home_id"] or str(row.get("away_id"))!=game_row["away_id"]:
        raise RuntimeError("NCAA-origin / ESPN women team identity disagreement "+str(game_row["id"]))
    if row.get("phase")!="final":
        game_row["score_evidence"]="espn_final_ncaa_pending" if game_row["status"]=="final" else "fixture_identity_crosschecked"
        return game_row
    hs=row.get("home_score")
    aws=row.get("away_score")
    if isinstance(hs,bool) or isinstance(aws,bool):
        raise RuntimeError("Invalid NCAA-origin women score "+str(game_row["id"]))
    try:
        home,away=int(hs),int(aws)
    except (TypeError,ValueError) as exc:
        raise RuntimeError("Invalid NCAA-origin women score "+str(game_row["id"])) from exc
    if min(home,away)<1 or home==away:
        raise RuntimeError("Invalid NCAA-origin women final "+str(game_row["id"]))
    if game_row["status"]=="final" and (game_row["home_score"],game_row["away_score"])!=(home,away):
        raise RuntimeError("NCAA-origin / ESPN women final score disagreement "+str(game_row["id"]))
    game_row.update(status="final",home_score=home,away_score=away,
                    score_evidence=("espn_and_ncaa_origin" if
                                    game_row["status"]=="final" else "ncaa_origin_final_espn_fixture"))
    return game_row


def live(today=None):
    # Frequent live passes must not poll the next 14 days of already-published
    # full team schedules. Three past days recover missed late final reports.
    today=today or dt.datetime.now(dt.timezone.utc).date()
    try:
        teams=team_registry()
    except (OSError, ValueError, RuntimeError, KeyError, TypeError) as exc:
        # Preserve live results when the team-index endpoint alone is down.
        path=ROOT/"ncaaw-2026-27-teams.json"
        cache=json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        teams=cache.get("teams",[]) if cache.get("season")=="2026-27" else []
        unique={str(t.get("team_id")) for t in teams if isinstance(t,dict) and str(t.get("team_id","")).isdigit()}
        if len(teams)!=363 or len(unique)!=363:
            raise RuntimeError("WBB registry unavailable and cached roster fails 363-team safety gate") from exc
        print("WBB using certified published 363-team roster while ESPN team index is unavailable:",exc)
    ids={t["team_id"] for t in teams}
    write("ncaaw-2026-27-teams.json",{
        "season":"2026-27","source":"ESPN Division I women's team roster (group 50)",
        "count":len(teams),"teams":teams})
    ledger=ROOT/"ncaaw-2026-27-verified-games.json"
    saved=json.loads(ledger.read_text()).get("games",[]) if ledger.exists() else []
    finals={str(g["id"]):g for g in saved if str(g["home_id"]) in ids and str(g["away_id"]) in ids}
    upcoming={}
    ncaa_rows=ncaa_women_snapshot()
    failed=[]
    day=max(dt.date(2026,11,1),today-dt.timedelta(days=3))
    end=min(dt.date(2027,4,30),today+dt.timedelta(days=2))
    requested_start=day
    future_warnings=[]
    while day<=end:
        try:
            for event in daily(day):
                g=game(event)
                if not g or g["home_id"] not in ids or g["away_id"] not in ids:
                    continue
                if not "2026-11-01"<=g["date"][:10]<="2027-04-30":
                    continue
                g=reconcile_ncaa_origin(g,ncaa_rows)
                if g["status"]=="final":
                    old=finals.get(g["id"])
                    if old and any(old.get(k)!=g.get(k) for k in ("date","home_id","away_id","home_score","away_score")):
                        raise RuntimeError("Disputed game "+g["id"])
                    finals[g["id"]]=g
                elif g["id"] not in finals:
                    upcoming[g["id"]]=g
        except Exception as exc:
            problem={"date":str(day),"error":str(exc)}
            if day<=today:
                failed.append(problem)
            else:
                # Forward fixtures are already in the 363-school season ledger.
                # Their retrieval must never prevent publishing today's finals.
                future_warnings.append(problem)
        day+=dt.timedelta(days=1)
    if failed:
        raise RuntimeError("Women's past/current scoreboard ingest incomplete: "+json.dumps(failed))
    ordered=sorted(finals.values(),key=lambda g:(g["date"],g["id"]))
    write("ncaaw-2026-27-verified-games.json",{"season":"2026-27","games":ordered})
    write("ncaaw-2026-27-games.json",{
        "season":"2026-27","scope":"Rolling scoreboard only; not complete team schedules",
        "source":"ESPN women's Division I completed events and fixtures; independent NCAA-origin crosschecks are shown separately in the game desk",
        "score_source_scope":"ESPN women’s final scores, crosschecked with current NCAA-origin relay evidence when available; individual games retain source evidence",
        "fetch_window":{"from":str(requested_start),"through":str(end)},
        "future_fixture_fetch_warnings":future_warnings,
        "finals":ordered[-100:],
        "upcoming":sorted(upcoming.values(),key=lambda g:(g["date"],g["id"]))})
    print("Women's data:",len(teams),"D-I programs,",len(ordered),"finals,",len(upcoming),
          "upcoming; fetched",str(requested_start),"through",str(end),
          "; optional future date warnings:",len(future_warnings))

if __name__=="__main__":
    if sys.argv[1:2]==["live"]:
        live()
    elif len(sys.argv)==3 and sys.argv[1]=="history":
        history(int(sys.argv[2]))
    else:
        raise SystemExit("Usage: wbb-season.py live | history YEAR")
