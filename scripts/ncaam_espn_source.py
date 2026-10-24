#!/usr/bin/env python3
"""Verified ESPN men's college basketball scoreboard to owned NCAA Elo input.

Provider supplies event IDs, participant identities, dates and authoritative
completed booleans. Every rating is still independently calculated.
No fuzzy team joins and no live scoreboard score is treated as final.
"""
import json,urllib.request
from datetime import date,datetime,timedelta,timezone
from pathlib import Path
from zoneinfo import ZoneInfo

BASE="https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard"
SEASON_START=date(2026,11,1)
SEASON_END=date(2027,4,30)
NY=ZoneInfo("America/New_York")

def fetch_day(day):
    url=f"{BASE}?dates={day:%Y%m%d}&limit=500&groups=50"
    req=urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimes-CBB-Elo/1.0"})
    with urllib.request.urlopen(req,timeout=45) as response:
        doc=json.load(response)
    if not isinstance(doc.get("events"),list):
        raise ValueError(f"ESPN NCAA events missing or invalid on {day}")
    return doc["events"]

def normalize_event(event,crosswalk):
    eid=str(event.get("id") or "").strip()
    competitions=event.get("competitions") or []
    if not eid or not competitions:return None,"missing_event_or_competition"
    comp=competitions[0]
    members=comp.get("competitors") or []
    if len(members)!=2:return None,"not_two_competitors"
    sides={}
    for member in members:
        side=member.get("homeAway")
        provider_id=str((member.get("team") or {}).get("id") or "")
        if side not in ("home","away") or side in sides:
            return None,"invalid_home_away"
        if provider_id not in crosswalk:
            return None,"unmatched_espn_program"
        sides[side]=(crosswalk[provider_id],member)
    if set(sides)!={"home","away"}:return None,"missing_home_or_away"
    h,h_raw=sides["home"]
    a,a_raw=sides["away"]
    if h["team_id"]==a["team_id"]:return None,"same_team"
    when=str(event.get("date") or "").replace("Z","+00:00")
    try:
        timestamp=datetime.fromisoformat(when)
        if timestamp.tzinfo is None:raise ValueError("tz missing")
        game_date=timestamp.astimezone(NY).date()
    except (ValueError,TypeError):
        return None,"invalid_event_timestamp"
    if not SEASON_START<=game_date<=SEASON_END:return None,"outside_season"
    done=(event.get("status") or {}).get("type",{}).get("completed") is True
    # Require both authoritative completed flag AND official numeric scores.
    def score(member):
        try:
            raw=member.get("score")
            x=float(raw)
            return str(int(x)) if x>=0 and x.is_integer() else ""
        except (TypeError,ValueError):return ""
    home_score=score(h_raw) if done else ""
    away_score=score(a_raw) if done else ""
    if done and (not home_score or not away_score or home_score==away_score):
        return None,"completed_without_valid_final"
    return {"contest_id":"espn:"+eid,"game_date":game_date.isoformat(),
            "home":h["team"],"away":a["team"],
            "home_score":home_score,"away_score":away_score,
            "status":"final" if done else "scheduled",
            "provider":"espn"},None

def merge(previous,updates):
    all_rows={str(e["contest_id"]):e for e in previous}
    corrected=0
    for new in updates:
        gid=new["contest_id"]
        old=all_rows.get(gid)
        if old:
            if old["home"]!=new["home"] or old["away"]!=new["away"]:
                raise ValueError(f"ESPN event participant identity changed: {gid}")
            if old["status"]=="final" and new["status"]!="final":
                continue  # Temporary provider degradation cannot erase a final.
            if old["status"]=="final" and new["status"]=="final" and (
                    old["home_score"]!=new["home_score"] or
                    old["away_score"]!=new["away_score"]):
                corrected+=1
        all_rows[gid]=new
    return sorted(all_rows.values(),key=lambda row:(row["game_date"],row["contest_id"])),corrected

def collect(through,crosswalk_path,cache_path,fetcher=fetch_day):
    known=json.loads(Path(crosswalk_path).read_text())
    if known["season"]!="2026-27" or known["matched_team_count"]<350:
        raise ValueError("Insufficient validated ESPN/NCAA team crosswalk")
    xwalk=known["crosswalk"]
    cache_file=Path(cache_path)
    if cache_file.exists():
        prior=json.loads(cache_file.read_text())
        if prior.get("season")!="2026-27":raise ValueError("Wrong-season NCAA ESPN cache")
        previous=prior.get("events",[])
    else:previous=[]
    start=SEASON_START if not previous else max(SEASON_START,through-timedelta(days=3))
    # Do not request an entire nonexistent calendar before the season.
    finish=min(SEASON_END,max(SEASON_START,through)+timedelta(days=7))
    if start>finish:start=finish
    updates=[];excluded={};fetched=0
    day=start
    while day<=finish:
        for event in fetcher(day):
            fetched+=1
            row,reason=normalize_event(event,xwalk)
            if reason:excluded[reason]=excluded.get(reason,0)+1
            else:updates.append(row)
        day+=timedelta(days=1)
    merged,corrections=merge(previous,updates)
    report={"provider":"ESPN scoreboard","season":"2026-27",
        "crosswalk_matched_programs":known["matched_team_count"],
        "crosswalk_unmatched_programs":known["missing_ncaa_teams"],
        "fetch_start":start.isoformat(),"fetch_through":finish.isoformat(),
        "provider_events_seen":fetched,"provider_events_accepted":len(updates),
        "provider_events_excluded":excluded,"corrected_final_scores":corrections,
        "cached_event_count":len(merged)}
    return merged,report

def write_cache(path,rows):
    path=Path(path)
    if path.exists():
        try:
            existing=json.loads(path.read_text(encoding="utf-8"))
            if existing.get("season")=="2026-27" and existing.get("events")==rows:
                return False  # No new score, status or fixture: no timestamp-only churn.
        except (ValueError,OSError):
            pass
    path.write_text(json.dumps({"season":"2026-27","provider":"ESPN",
        "updated_at":datetime.now(timezone.utc).isoformat(),
        "events":rows},indent=2)+"\n",encoding="utf-8")
    return True
