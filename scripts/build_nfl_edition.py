#!/usr/bin/env python3
"""Build the independent 2026 NFL newspaper from sourced regular-season games.

All 32 clubs start at 1500 on the first kickoff; every confirmed final is replayed
chronologically. ESPN event IDs are immutable. No preseason/playoffs or prior Elo.
No invented results, stats, venues or roster entries. Incomplete box score
coverage is shown prominently rather than being represented as league complete.
"""
import argparse
import concurrent.futures
import datetime as dt
import json
import math
import re
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
EDITION = ROOT / "data/nfl-2026-edition.json"
BOXES = ROOT / "data/nfl-2026-boxscores.json"
ROSTERS = ROOT / "data/nfl-2026-rosters.json"
SEASON = 2026
API = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/"
# Official franchise identity by ESPN numeric team ID. (Code, division, colors.)
META = {
 1:("ATL","NFC South","#a71930","#000000"),2:("BUF","AFC East","#00338d","#c60c30"),
 3:("CHI","NFC North","#0b162a","#c83803"),4:("CIN","AFC North","#fb4f14","#000000"),
 5:("CLE","AFC North","#311d00","#ff3c00"),6:("DAL","NFC East","#003594","#869397"),
 7:("DEN","AFC West","#fb4f14","#002244"),8:("DET","NFC North","#0076b6","#b0b7bc"),
 9:("GB","NFC North","#203731","#ffb612"),10:("TEN","AFC South","#0c2340","#4b92db"),
 11:("IND","AFC South","#002c5f","#a2aaad"),12:("KC","AFC West","#e31837","#ffb81c"),
 13:("LV","AFC West","#000000","#a5acaf"),14:("LAR","NFC West","#003594","#ffa300"),
 15:("MIA","AFC East","#008e97","#fc4c02"),16:("MIN","NFC North","#4f2683","#ffc62f"),
 17:("NE","AFC East","#002244","#c60c30"),18:("NO","NFC South","#101820","#d3bc8d"),
 19:("NYG","NFC East","#0b2265","#a71930"),20:("NYJ","AFC East","#125740","#000000"),
 21:("PHI","NFC East","#004c54","#a5acaf"),22:("ARI","NFC West","#97233f","#000000"),
 23:("PIT","AFC North","#101820","#ffb612"),24:("LAC","AFC West","#0080c6","#ffc20e"),
 25:("SF","NFC West","#aa0000","#b3995d"),26:("SEA","NFC West","#002244","#69be28"),
 27:("TB","NFC South","#d50a0a","#34302b"),28:("WSH","NFC East","#5a1414","#ffb612"),
 29:("CAR","NFC South","#0085ca","#101820"),30:("JAX","AFC South","#006778","#d7a22a"),
 33:("BAL","AFC North","#241773","#9e7c0c"),34:("HOU","AFC South","#03202f","#a71930")
}
assert len(META) == 32
HEADERS = {"User-Agent":"SportingLifeTimes-NFL/1.0 (independent newspaper; data attributed to ESPN)",
           "Accept":"application/json"}
def request(url):
    err = None
    for attempt in range(3):
        try:
            with urlopen(Request(url,headers=HEADERS),timeout=25) as r:
                data=json.load(r)
            if not isinstance(data,dict): raise ValueError("Not a JSON object")
            return data
        except (OSError,ValueError,TimeoutError) as exc:
            err=exc
            if attempt<2: time.sleep(0.8*(attempt+1))
    raise RuntimeError(f"Source unavailable: {url}: {err}")

def source_week(w):
    query=urlencode({"season":SEASON,"seasontype":2,"week":w,"limit":40})
    d=request(API+"scoreboard?"+query)
    if not isinstance(d.get("events"),list):raise RuntimeError("Missing ESPN weekly events "+str(w))
    return w,d["events"]

def intval(x):
    try:
        t=str(x).replace(",","").strip()
        if re.fullmatch(r"-?[0-9]+",t):return int(t)
    except (ValueError,TypeError):pass
    return None

def number(x):
    if isinstance(x,(int,float)):return float(x)
    s=str(x or "").strip().replace(",","")
    if re.fullmatch(r"-?[0-9]+(?:\.[0-9]+)?",s):return float(s)
    return None

def logo(t):
    logos=t.get("logos") or []
    u=logos[0].get("href") if logos and isinstance(logos[0],dict) else ""
    return u if isinstance(u,str) and u.startswith("https://") else ""

def parse_event(e):
    if int((e.get("season") or {}).get("type") or 0)!=2 or int((e.get("season") or {}).get("year") or 0)!=SEASON:
        return None
    c=(e.get("competitions") or [{}])[0]
    sides={}
    for raw in c.get("competitors") or []:
        side=raw.get("homeAway")
        tid=intval((raw.get("team") or {}).get("id"))
        if side not in ("home","away") or tid not in META:return None
        tm=raw["team"];code,div,col,alt=META[tid]
        sides[side]={"id":str(tid),"code":code,"name":tm.get("displayName") or tm.get("name") or code,
            "logo":logo(tm) or f"https://a.espncdn.com/i/teamlogos/nfl/500/{code.lower()}.png",
            "score":intval(raw.get("score"))}
    if set(sides)!={"away","home"}:return None
    status=(e.get("status") or {}).get("type") or (c.get("status") or {}).get("type") or {}
    state=status.get("state") or "pre"
    complete=bool(status.get("completed")) or status.get("name") in ("STATUS_FINAL","STATUS_FINAL_OT")
    if complete:state="post"
    if state=="post" and (sides["home"]["score"] is None or sides["away"]["score"] is None):
        raise ValueError("Final without both numerical scores: "+str(e.get("id")))
    v=c.get("venue") or {}
    outlets=[]
    for item in c.get("broadcasts") or []:
        outlets.extend(item.get("names") or [])
    if not outlets:
        for b in (c.get("geoBroadcasts") or []):
            if (b.get("media") or {}).get("shortName"):outlets.append(b["media"]["shortName"])
    eid=str(e.get("id") or "")
    if not eid.isdigit():return None
    return {"id":eid,"date":e.get("date"),"week":int((e.get("week") or {}).get("number") or 0),
      "away":sides["away"],"home":sides["home"],"state":state,"status":status.get("description") or status.get("name") or state,
      "period":(e.get("status") or {}).get("period"),"clock":(e.get("status") or {}).get("displayClock"),
      "venue":v.get("fullName") or None,"city":v.get("address",{}).get("city") or v.get("city"),
      "broadcast":", ".join(dict.fromkeys(outlets)) or None,
      "source":"ESPN NFL scoreboard","url":"https://www.espn.com/nfl/game/_/gameId/"+eid}

def base_team(tid):
    code,div,col,alt=META[tid]
    return {"id":str(tid),"code":code,"name":code,"division":div,"conference":div[:3],
      "color":col,"secondary_color":alt,"logo":"https://a.espncdn.com/i/teamlogos/nfl/500/"+code.lower()+".png",
      "w":0,"l":0,"t":0,"pf":0,"pa":0,"elo":1500.0,"elo_change":0.0,"played":0}
def probability(away,home):return 1/(1+10**(-((home+55)-away)/400))
def projection(away,home):
    # Conservative score model using only completed 2026 games. Shrink to 22 points.
    av=(22*4+away["pf"])/(4+away["played"])
    ad=(22*4+home["pa"])/(4+home["played"])
    hv=(22*4+home["pf"])/(4+home["played"])
    hd=(22*4+away["pa"])/(4+away["played"])
    return [round(max(10,min(42,(av+ad)/2-0.9))),
            round(max(10,min(42,(hv+hd)/2+0.9)))]
def replay(games):
    teams={str(i):base_team(i) for i in META}
    for g in sorted(games,key=lambda z:(z.get("date") or "",z["id"])):
        for side in ("home","away"):
            t=teams[g[side]["id"]]
            t["name"]=g[side]["name"]
            if g[side].get("logo"):t["logo"]=g[side]["logo"]
        if g["state"]!="post":continue
        h=teams[g["home"]["id"]];a=teams[g["away"]["id"]]
        p=probability(a["elo"],h["elo"]);sa,sh=projection(a,h)
        hscore=g["home"]["score"];ascore=g["away"]["score"]
        actual=1 if hscore>ascore else (0 if hscore<ascore else 0.5)
        margin=abs(hscore-ascore)
        k=20*min(2.0,1+math.log2(1+margin)/4)
        delta=k*(actual-p)
        g["elo"]={"away_before":round(a["elo"],1),"home_before":round(h["elo"],1),
          "home_win_probability":round(p,4),"away_win_probability":round(1-p,4),
          "away_projected_points":sa,"home_projected_points":sh,
          "home_delta":round(delta,1),"away_delta":round(-delta,1)}
        h["elo"]+=delta;a["elo"]-=delta
        for t,sc,opp in ((h,hscore,ascore),(a,ascore,hscore)):
            t["pf"]+=sc;t["pa"]+=opp;t["played"]+=1
            if sc>opp:t["w"]+=1
            elif sc<opp:t["l"]+=1
            else:t["t"]+=1
    for t in teams.values():
        t["elo_change"]=round(t["elo"]-1500,1);t["elo"]=round(t["elo"],1)
        n=t["w"]+t["l"]+t["t"]
        t["pct"]=round((t["w"]+t["t"]*.5)/n,3) if n else 0.0
        t["point_diff"]=t["pf"]-t["pa"]
    for g in games:
        if g["state"]=="post":continue
        a=teams[g["away"]["id"]];h=teams[g["home"]["id"]]
        p=probability(a["elo"],h["elo"]);sa,sh=projection(a,h)
        g["elo"]={"away_before":a["elo"],"home_before":h["elo"],
         "home_win_probability":round(p,4),"away_win_probability":round(1-p,4),
         "away_projected_points":sa,"home_projected_points":sh}
    return sorted(teams.values(),key=lambda t:-t["elo"])

def parse_box(game_id):
    raw=request(API+"summary?event="+str(game_id))
    out={"id":str(game_id),"teams":{},"players":[]}
    box=raw.get("boxscore") or {}
    for side in box.get("teams") or []:
        tid=str((side.get("team") or {}).get("id") or "")
        if intval(tid) not in META:continue
        stats={}
        for obj in side.get("statistics") or []:
            val=number(obj.get("displayValue"))
            if val is not None:stats[str(obj.get("name") or "")]=val
        out["teams"][tid]=stats
    for group in box.get("players") or []:
        tid=str((group.get("team") or {}).get("id") or "")
        if intval(tid) not in META:continue
        for cat in group.get("statistics") or []:
            category=str(cat.get("name") or "").lower()
            labels=[str(v).upper().strip() for v in (cat.get("labels") or [])]
            for entry in cat.get("athletes") or []:
                athlete=entry.get("athlete") or {}
                aid=str(athlete.get("id") or "")
                if not aid:continue
                stat={}
                vals=entry.get("stats") or []
                for i,label in enumerate(labels):
                    if i<len(vals):
                        val=number(vals[i])
                        if val is not None:stat[label]=val
                if stat:out["players"].append({"id":aid,"name":athlete.get("displayName") or athlete.get("fullName") or aid,
                    "team_id":tid,"category":category,"stats":stat,
                    "headshot":(athlete.get("headshot") or {}).get("href") or "https://a.espncdn.com/i/headshots/nfl/players/full/"+aid+".png"})
    if not out["teams"] and not out["players"]:raise ValueError("No box score statistics for game "+str(game_id))
    return out

CATEGORIES={"passing":("passing","PASS YDS","YDS"),"rushing":("rushing","RUSH YDS","YDS"),
            "receiving":("receiving","REC YDS","YDS"),"tackles":("defensive","TACKLES","TOT"),
            "sacks":("defensive","SACKS","SACKS"),"interceptions":("interceptions","INT","INT")}
def aggregate_leaders(boxes):
    players={}
    for box in boxes.values():
        for line in box.get("players") or []:
            key=(line["id"],line["category"])
            p=players.setdefault(key,{"id":line["id"],"name":line["name"],"team_id":line["team_id"],
                "headshot":line.get("headshot"),"category":line["category"],"games":0,"stats":{}})
            p["games"]+=1
            for name,val in line["stats"].items():
                p["stats"][name]=round(p["stats"].get(name,0)+val,2)
    boards={}
    for label,(cat,description,key) in CATEGORIES.items():
        rows=[]
        for (pid,category),p in players.items():
            if cat not in category:continue
            val=p["stats"].get(key)
            if val is None or val<=0:continue
            rows.append({**p,"value":val})
        rows.sort(key=lambda r:(-r["value"],r["name"]))
        boards[label]=rows[:30]
    return boards

def collect_roster(team_id):
    raw=request(API+"teams/"+str(team_id)+"/roster?season="+str(SEASON))
    rows=[]
    def add(a):
        if not isinstance(a,dict):return
        if "athlete" in a:a=a["athlete"]
        if not isinstance(a,dict) or not a.get("id"):return
        pos=a.get("position") or {}
        rows.append({"id":str(a["id"]),"name":a.get("fullName") or a.get("displayName") or "",
          "jersey":a.get("jersey") or "","position":pos.get("abbreviation") or pos.get("name") or "",
          "headshot":(a.get("headshot") or {}).get("href") or "https://a.espncdn.com/i/headshots/nfl/players/full/"+str(a["id"])+".png",
          "status":(a.get("status") or {}).get("name") if isinstance(a.get("status"),dict) else a.get("status")})
    for a in raw.get("athletes") or []:
        if "items" in a:
            for row in a.get("items") or []:add(row)
        else:add(a)
    return str(team_id),sorted({r["id"]:r for r in rows}.values(),key=lambda r:(r["position"],r["name"]))

def load(path,default):
    try:return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError,ValueError,OSError):return default

def run(fast):
    now=dt.datetime.now(dt.timezone.utc)
    old=load(EDITION,{})
    oldgames={g["id"]:g for g in old.get("games",[]) if g.get("id")}
    weeks=list(range(1,19))
    if fast and len(oldgames)>=200:
        local=now.astimezone(ZoneInfo("America/New_York")).date()
        near=set()
        for g in oldgames.values():
            try:date=dt.datetime.fromisoformat(g["date"].replace("Z","+00:00")).astimezone(ZoneInfo("America/New_York")).date()
            except (ValueError,TypeError,KeyError):continue
            if abs((date-local).days)<=15:near.add(g.get("week"))
        weeks=sorted(w for w in near if isinstance(w,int) and 1<=w<=18) or [1]
    newgames={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for w,events in pool.map(source_week,weeks):
            if not events and not fast:raise RuntimeError("Empty NFL week "+str(w)+"; refuse incomplete season publication")
            for e in events:
                game=parse_event(e)
                if game:
                    game["week"]=w
                    newgames[game["id"]]=game
    games=dict(oldgames if fast else {})
    for eid,g in newgames.items():
        # Fresh source replaces prior state; game identity remains stable.
        games[eid]=g
    games=sorted(games.values(),key=lambda g:(g["date"] or "",g["id"]))
    if len(games)<200 or len({g["id"] for g in games})!=len(games):
        raise RuntimeError("NFL 2026 game ledger incomplete/duplicated ("+str(len(games))+"); preserve published data")
    if len({g["away"]["id"] for g in games}|{g["home"]["id"] for g in games})!=32:
        raise RuntimeError("NFL ledger lacks all 32 teams")
    finals=[g for g in games if g["state"]=="post"]
    boxes=load(BOXES,{"games":{}}).get("games") or {}
    missing=[g["id"] for g in finals if g["id"] not in boxes]
    # Missing boxes retry in subsequent runs; no fabricated player statistics.
    if missing:
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            pending={pool.submit(parse_box,eid):eid for eid in missing}
            for fut in concurrent.futures.as_completed(pending):
                eid=pending[fut]
                try:boxes[eid]=fut.result()
                except (RuntimeError,ValueError) as exc:print("Box score unavailable:",eid,exc)
    complete_ids={g["id"] for g in finals}
    boxes={eid:val for eid,val in boxes.items() if eid in complete_ids}
    team_stats={str(i):{} for i in META}
    for b in boxes.values():
        for tid,stats in b.get("teams",{}).items():
            if tid not in team_stats:continue
            for k,v in stats.items():
                team_stats[tid][k]=round(team_stats[tid].get(k,0)+v,2)
    roster_data=load(ROSTERS,{})
    roster_last=roster_data.get("updated_at")
    stale=True
    if roster_last:
        try:stale=(now-dt.datetime.fromisoformat(roster_last)).total_seconds()>86400
        except (ValueError,TypeError):pass
    rosters=roster_data.get("teams") or {}
    if stale or len(rosters)!=32:
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            futs={pool.submit(collect_roster,tid):tid for tid in META}
            for fut in concurrent.futures.as_completed(futs):
                try:
                    tid,rows=fut.result()
                    if rows:rosters[tid]=rows
                except (RuntimeError,ValueError) as exc:print("Roster unavailable:",futs[fut],exc)
    roster_stamp=now.isoformat() if len(rosters)==32 else (roster_last or now.isoformat())
    teams=replay(games)
    for t in teams:
        t["team_stats"]=team_stats[t["id"]]
        t["roster_count"]=len(rosters.get(t["id"],[]))
    leaders=aggregate_leaders(boxes)
    data={"season":SEASON,"updated_at":now.isoformat(),"source":"ESPN NFL scoreboard and game summaries; independent USRS model",
      "data_policy":"ESPN sourced factual results; unofficial derived ratings and forecasts, not official NFL standings/tiebreakers",
      "model":{"baseline":1500,"home_advantage_elo":55,"k_base":20,
        "margin_multiplier":"min(2, 1 + log2(1+absolute point margin)/4)",
        "season_reset":True,"regular_season_only":True,"historical_prior":False,"tie_result":0.5},
      "coverage":{"teams":32,"games":len(games),"finals":len(finals),
        "future_or_live":len(games)-len(finals),"boxscores":len(boxes),
        "boxscore_complete":len(boxes)==len(finals),"rosters":len(rosters),
        "weeks_fetched":weeks,"mode":"fast" if fast else "full"},
      "teams":teams,"games":games,"leaders":leaders}
    # Stage and validate data in memory before overwriting any existing publication.
    assert all(t["played"]==t["w"]+t["l"]+t["t"] for t in teams)
    assert sum(t["played"] for t in teams)==2*len(finals)
    assert abs(sum(t["elo"] for t in teams)-48000)<2.0
    for path,obj in ((EDITION,data),(BOXES,{"season":SEASON,"updated_at":now.isoformat(),"games":boxes}),
                     (ROSTERS,{"season":SEASON,"updated_at":roster_stamp,"teams":rosters})):
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(json.dumps(obj,separators=(",",":"),ensure_ascii=False)+"\n",encoding="utf-8")
    print("NFL 2026 verified: games",len(games),"finals",len(finals),"team roster",len(rosters),
          "boxscores",len(boxes),"Elo base",data["model"]["baseline"])

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--fast",action="store_true")
    args=parser.parse_args()
    run(args.fast)
