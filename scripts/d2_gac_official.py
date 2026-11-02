#!/usr/bin/env python3
"""2026-27 Great American Conference official school-calendar reconciliation.

Find actual GAC SIDEARM season schedule IDs by inspecting each page's *title*,
season, gender, and school. A source ID is never trusted merely because it is
numeric. Cache verified IDs after discovery for low-request daily refreshes.
Only DATE + canonical away/home agreement from two different school calendars
may add or enrich a fixture. No score, arena, stream, time-zone or broadcast
is guessed; uncertain rows are quarantined.
"""
from __future__ import annotations
import datetime as dt
import re
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from bs4 import BeautifulSoup

BASE="https://greatamericanconference.com/schedule.aspx?schedule="
SCHOOLS={
 "tech":("Arkansas Tech","Arkansas Tech University"),
 "uam":("Arkansas-Monticello","Arkansas Monticello","University of Arkansas Monticello","Ark. Monticello"),
 "ecu":("East Central","East Central University"),
 "harding":("Harding","Harding University"),
 "henderson":("Henderson State","Henderson State University"),
 "nwosu":("Northwestern Oklahoma State","Northwestern Oklahoma State University","Northwestern Oklahoma"),
 "obu":("Oklahoma Baptist","Oklahoma Baptist University"),
 "ouachita":("Ouachita Baptist","Ouachita Baptist University"),
 "seosu":("Southeastern Oklahoma State","Southeastern Oklahoma State University","Southeastern Oklahoma"),
 "sau":("Southern Arkansas","Southern Arkansas University"),
 "snu":("Southern Nazarene","Southern Nazarene University"),
 "swosu":("Southwestern Oklahoma State","Southwestern Oklahoma State University","Southwestern Oklahoma"),
}
def norm(value):
    return " ".join(re.sub(r"[^a-z0-9 ]"," ",str(value or "").lower()).split())
NAMES={norm(name):key for key,aliases in SCHOOLS.items() for name in aliases}
assert all(NAMES[norm(alias)]==key for key,names in SCHOOLS.items() for alias in names)
def school(value):return NAMES.get(norm(value))
def fetch(url):
    request=urllib.request.Request(url,headers={
        "User-Agent":"SportingLifeTimes/1.0 (+https://github.com/jbryancoburn-netizen/sporting-life-times)",
        "Accept":"text/html"})
    with urllib.request.urlopen(request,timeout=14) as response:
        return response.read(1_600_000).decode("utf-8","replace")

def identify(html):
    """Recognize the complete season, school, gender in page title/heading."""
    soup=BeautifulSoup(html,"html.parser")
    headings=[soup.title.get_text(" ",strip=True) if soup.title else ""]
    headings += [h.get_text(" ",strip=True) for h in soup.find_all(["h1","h2"],limit=3)]
    clean=" ".join(headings).replace("’","'")
    lower=clean.lower()
    if "2026-27" not in lower or "basketball" not in lower:return None
    if "women's basketball" in lower:gender="women"
    elif "men's basketball" in lower:gender="men"
    else:return None
    # Detect the canonical school label only at the season/sport title prefix.
    # This prevents opponent names inside schedule tables from being treated
    # as a source-school identity.
    match=re.search(r"2026-27\s+(.+?)\s+(?:women's|men's)\s+basketball",clean,re.I)
    if not match:return None
    owner=school(match.group(1))
    return (gender,owner) if owner else None

def parse(html,gender,owner):
    detected=identify(html)
    if detected!=(gender,owner):raise ValueError("Wrong GAC source season, sport or institution")
    soup=BeautifulSoup(html,"html.parser")
    rows=[];bad=0;tables=0
    for table in soup.select("table"):
        headers=norm(" ".join(x.get_text(" ",strip=True) for x in table.select("th")))
        if not all(x in headers for x in ("date","opponent","gac")):continue
        tables+=1
        for tr in table.select("tr"):
            cols=[" ".join(cell.get_text(" ",strip=True).split())
                  for cell in tr.find_all(["td","th"],recursive=False)]
            if len(cols)<5:continue
            date,opponent,conference,location,posted_time=cols[:5]
            if "*" not in conference:continue
            if not re.fullmatch(r"\d{1,2}/\d{1,2}/20(?:26|27)",date):
                bad+=1;continue
            try:when=dt.datetime.strptime(date,"%m/%d/%Y").date()
            except ValueError:bad+=1;continue
            if not dt.date(2026,11,1)<=when<=dt.date(2027,3,1):continue
            if re.match(r"^vs\.?\s+",opponent,re.I):
                bad+=1;continue
            at=bool(re.match(r"^at\s+",opponent,re.I))
            rival=school(re.sub(r"^at\s+","",opponent,flags=re.I))
            if not rival or rival==owner:
                bad+=1;continue
            away,home=(owner,rival) if at else (rival,owner)
            rows.append((when.isoformat(),away,home,owner))
        break
    if not tables or len(rows)<8:
        raise ValueError("GAC source does not contain a full school conference slate")
    return rows,bad

def inspect_ids(ids,gender,fetcher):
    """Fetch IDs concurrently, validate source identity before admitting it."""
    accepted={};duplicates=set();failed=0
    with ThreadPoolExecutor(max_workers=10) as pool:
        jobs={pool.submit(fetcher,BASE+str(sid)):sid for sid in ids}
        for job in as_completed(jobs):
            sid=jobs[job]
            try:
                html=job.result()
                found=identify(html)
                if not found or found[0]!=gender:continue
                owner=found[1]
                parse(html,gender,owner)
                if owner in accepted:duplicates.add(owner)
                else:accepted[owner]=(sid,html)
            except Exception:failed+=1
    for key in duplicates:accepted.pop(key,None)
    return accepted,failed,duplicates

def discover(gender,old,fetcher):
    cached={str(k):int(v) for k,v in (old or {}).items()
            if k in SCHOOLS and str(v).isdigit() and 3100<=int(v)<=3500}
    if len(cached)>=11:
        chosen,failed,duplicate=inspect_ids(sorted(set(cached.values())),gender,fetcher)
        if len(chosen)>=11:return chosen,{"method":"validated cached official schedule IDs",
                                           "ids_scanned":len(cached),"source_errors":failed}
    # Harding men's verified 2026-27 schedule is source 3296. Nearby SIDEARM
    # numbers are *candidates*, never inherently validated source identities.
    ranges=[range(3260,3351),range(3150,3260),range(3351,3451)]
    seen=set();chosen={};errors=0
    for candidate_range in ranges:
        ids=[sid for sid in candidate_range if sid not in seen]
        seen.update(ids)
        sample,failed,duplicate=inspect_ids(ids,gender,fetcher)
        errors+=failed
        for k,pair in sample.items():
            if k not in chosen:chosen[k]=pair
            else:chosen.pop(k,None)
        if len(chosen)>=12:break
    return chosen,{"method":"official title/season/sport discovery",
                   "ids_scanned":len(seen),"source_errors":errors}

def identities(teams):
    found={};conflicts=set()
    for ident,record in teams.items():
        if record.get("conference") not in ("GAC","Great American Conference"):continue
        key=school(record.get("name")) or school(str(ident).replace("-"," "))
        if not key:continue
        if key in found and found[key]!=ident:conflicts.add(key)
        else:found[key]=ident
    for k in conflicts:found.pop(k,None)
    return found,conflicts

def enrich_gac(gender,games,teams,today=None,previous=None,fetcher=fetch):
    if gender not in ("men","women"):raise ValueError("Invalid DII gender")
    today=today or dt.date.today()
    team_ids,conflicts=identities(teams)
    if len(team_ids)!=12 or conflicts:
        return {"status":"GAC source identity unresolved; games held",
                "teams_identified":len(team_ids),"conflicts":sorted(conflicts),
                "added":0,"enriched":0}
    calendars,discovery=discover(gender,(previous or {}).get("source_schedule_ids"),fetcher)
    accepted={};warnings=[]
    for owner,(sid,html) in calendars.items():
        try:
            parsed,bad=parse(html,gender,owner)
            accepted[owner]=(sid,parsed)
            if bad:warnings.append({"institution":owner,"quarantined_rows":bad})
        except ValueError as exc:warnings.append({"institution":owner,"error":str(exc)})
    if len(accepted)<9:
        return {"status":"GAC official school calendars insufficient; games held",
                "schools_read":len(accepted),"added":0,"enriched":0,
                "source_discovery":discovery,"warnings":warnings}
    witness=defaultdict(dict)
    for source,(sid,rows) in accepted.items():
        for date,away,home,owner in rows:
            if away not in team_ids or home not in team_ids:continue
            key=(date,away,home)
            if owner in witness[key]:
                warnings.append({"source":sid,"error":"duplicate school date+opponent"});continue
            witness[key][owner]=sid
    existing=defaultdict(list)
    for gid,record in games.items():
        if record.get("date") and record.get("away") and record.get("home"):
            existing[(record["date"],frozenset((record["away"],record["home"])))].append((gid,record))
    added=enriched=one_sided=conflicted=0
    for (date,away,home),sources in sorted(witness.items()):
        if set(sources)!={away,home}:one_sided+=1;continue
        a,h=team_ids[away],team_ids[home]
        pair=(date,frozenset((a,h)))
        old=existing.get(pair,[])
        if len(old)>1:conflicted+=1;continue
        urls=sorted(BASE+str(sid) for sid in sources.values())
        if old:
            g=old[0][1]
            if g["away"]!=a or g["home"]!=h or g.get("neutral"):
                conflicted+=1;continue
            revised=sorted(set(g.get("official_schedule_sources") or []).union(urls))
            if revised!=g.get("official_schedule_sources"):
                g["official_schedule_sources"]=revised;enriched+=1
            continue
        if dt.date.fromisoformat(date)<today:continue
        gid=f"d2gac-2026-{gender}-{date}-{away}-{home}"
        if gid in games:conflicted+=1;continue
        game={"id":gid,"date":date,"away":a,"home":h,
              "away_score":None,"home_score":None,"status":"scheduled",
              "verified":True,"elo_eligible":True,"neutral":False,"conference_game":True,
              "source":"GAC 2026-27 reciprocal official school calendars",
              "source_url":urls[0],"official_schedule_sources":urls}
        games[gid]=game;existing[pair].append((gid,game));added+=1
    return {"status":"GAC exact reciprocal official school games only",
            "gender":gender,"schools_read":len(accepted),"teams_identified":len(team_ids),
            "confirmed_matchups":sum(set(v)=={a,h} for (date,a,h),v in witness.items()),
            "added":added,"enriched":enriched,"one_sided":one_sided,
            "conflicts":conflicted,"source_schedule_ids":{school:sid for school,(sid,_) in accepted.items()},
            "source_discovery":discovery,"warnings":warnings[:10],
            "source":"Great American Conference official 2026-27 basketball calendars"}
