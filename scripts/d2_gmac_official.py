#!/usr/bin/env python3
"""2026-27 DII Great Midwest two-institution school calendar reconciliation.

Searches only the current league's published SIDEARM calendar ID interval.
IDs are merely candidates: title, season, gender, institution, conference
marker, date and H/A role must validate. Two separate institutions must
confirm the SAME fixture. Do not touch NCAA game IDs, scores or Elo.
"""
from __future__ import annotations
import datetime as dt
import re
import unicodedata
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor,as_completed
from bs4 import BeautifulSoup

BASE="https://greatmidwestsports.com/schedule.aspx?schedule="
CANDIDATE_IDS=range(4058,4110)
LABELS={
 "ashland":("Ashland","Ashland University"),
 "cedarville":("Cedarville","Cedarville University"),
 "findlay":("Findlay","University of Findlay"),
 "hillsdale":("Hillsdale","Hillsdale College"),
 "kentucky":("Kentucky Wesleyan","Kentucky Wesleyan College"),
 "lakeerie":("Lake Erie","Lake Erie College"),
 "malone":("Malone","Malone University"),
 "northwood":("Northwood","Northwood University"),
 "ohiodom":("Ohio Dominican","Ohio Dominican University"),
 "thomasmore":("Thomas More","Thomas More University"),
 "tiffin":("Tiffin","Tiffin University"),
 "walsh":("Walsh","Walsh University"),
 "ursuline":("Ursuline","Ursuline College"),
}
def norm(value):
 s=unicodedata.normalize("NFKD",str(value or "")).replace("–","-").replace("’","'")
 return " ".join(re.sub(r"[^a-z0-9]+"," ",s.encode("ascii","ignore").decode("ascii").lower()).split())
ALIASES={norm(x):k for k,names in LABELS.items() for x in names}
def school(name):return ALIASES.get(norm(name))
def fetch(url):
 req=urllib.request.Request(url,headers={
  "User-Agent":"SportingLifeTimes/1.0 (+https://github.com/jbryancoburn-netizen/sporting-life-times)",
  "Accept":"text/html"})
 with urllib.request.urlopen(req,timeout=18) as res:
  return res.read(1_500_000).decode("utf-8","replace")
def parse(html,gender,sid):
 if gender not in ("men","women") or sid not in CANDIDATE_IDS:
  raise ValueError("Unexpected Great Midwest calendar source")
 soup=BeautifulSoup(html,"html.parser")
 title=(soup.title.get_text(" ",strip=True) if soup.title else "").replace("’","'")
 m=re.search(r"2026[-–]27\s+(.+?)\s+(Men's|Women's)\s+Basketball\b",title,re.I)
 if not m or ("women" if m[2].lower().startswith("women") else "men")!=gender:
  raise ValueError("Source title has wrong season/gender/sport")
 owner=school(m[1])
 if not owner or (gender=="men" and owner=="ursuline"):
  raise ValueError("Unrecognized or wrong-gender Great Midwest institution")
 rows=[];bad=0;found=False
 for table in soup.select("table"):
  for tr in table.select("tr"):
   heads=[norm(x.get_text(" ",strip=True)) for x in tr.find_all("th",recursive=False)]
   if not {"date","c","opponent","h a","time result"}.issubset(heads):continue
   idx={h:heads.index(h) for h in ("date","c","opponent","h a","time result")}
   found=True
   for row in table.select("tr"):
    cells=[x.get_text(" ",strip=True) for x in row.find_all("td",recursive=False)]
    if len(cells)<=max(idx.values()) or "*" not in cells[idx["c"]]:continue
    d=cells[idx["date"]].strip()
    if not re.fullmatch(r"\d{1,2}/\d{1,2}/20(?:26|27)",d):bad+=1;continue
    try:date=dt.datetime.strptime(d,"%m/%d/%Y").date()
    except ValueError:bad+=1;continue
    if not dt.date(2026,11,1)<=date<=dt.date(2027,3,1):continue
    role=cells[idx["h a"]].strip().upper()
    opponent=cells[idx["opponent"]].strip()
    away_prefix=bool(re.match(r"^at\s+",opponent,re.I))
    if role not in ("A","H") or (role=="A")!=away_prefix:
     bad+=1;continue
    other=school(re.sub(r"^at\s+","",opponent,flags=re.I))
    if not other or other==owner or (gender=="men" and other=="ursuline"):
     bad+=1;continue
    away,home=(owner,other) if role=="A" else (other,owner)
    # The conference spans Eastern and Central campuses and source clocks
    # have no explicit zone. Keep NCAA-verified times; never label a raw
    # '7:30 PM' as Eastern based on a guess.
    rows.append((date.isoformat(),away,home,owner))
   break
  if found:break
 if not found or len(rows)<5:raise ValueError("Source lacks a real 2026-27 conference fixture grid")
 return owner,rows,bad

def identities(gender,teams):
 conference="G-MAC" if gender=="men" else "Great Midwest Athletic Conference"
 out={};amb=set()
 for key,t in teams.items():
  if t.get("conference")!=conference:continue
  ident=school(t.get("name"))
  if not ident:continue
  if ident in out and out[ident]!=key:amb.add(ident)
  else:out[ident]=key
 for ident in amb:out.pop(ident,None)
 return out,amb

def enrich_gmac(gender,games,teams,today=None,fetcher=fetch):
 if gender not in ("men","women"):raise ValueError("Wrong Great Midwest gender")
 today=today or dt.date.today()
 ids,ambiguous=identities(gender,teams)
 target=12 if gender=="men" else 13
 if len(ids)!=target or ambiguous:
  return {"status":"GMAC member directory unresolved; fixtures held",
          "gender":gender,"teams_identified":len(ids),"added":0,"enriched":0}
 calendars={};duplicates=set();invalid=0;failed=0
 with ThreadPoolExecutor(max_workers=16) as pool:
  work={pool.submit(fetcher,BASE+str(sid)):sid for sid in CANDIDATE_IDS}
  for future in as_completed(work):
   sid=work[future]
   try:
    owner,rows,bad=parse(future.result(),gender,sid)
    invalid+=bad
    if owner in calendars:duplicates.add(owner)
    else:calendars[owner]=(sid,rows)
   except Exception:failed+=1
 for owner in duplicates:calendars.pop(owner,None)
 if len(calendars)<2:
  return {"status":"GMAC official institution source coverage insufficient; fixtures held",
          "gender":gender,"schools_read":len(calendars),"failed_candidates":failed,
          "added":0,"enriched":0}
 votes=defaultdict(dict);dupe_rows=0
 for owner,(sid,rows) in calendars.items():
  for day,away,home,witness in rows:
   if any(x not in ids for x in (away,home,witness)):
    invalid+=1;continue
   key=(day,away,home)
   if witness in votes[key]:
    if votes[key][witness]!=sid:
     votes[key][witness]=None;dupe_rows+=1
   else:votes[key][witness]=sid
 existing=defaultdict(list)
 for gid,g in games.items():
  if g.get("date") and g.get("away") and g.get("home"):
   existing[(g["date"],frozenset((g["away"],g["home"])))].append((gid,g))
 added=enriched=confirmed=one_sided=conflicts=0
 pair_orientations=defaultdict(set)
 for (date,away,home) in votes:
  pair_orientations[(date,frozenset((away,home)))].add((away,home))
 for (day,away,home),witnesses in sorted(votes.items()):
  # If any official calendar contradicts the home/away direction, hold
  # that school/date pairing even when one direction has two witnesses.
  if len(pair_orientations[(day,frozenset((away,home)))])>1:
   conflicts+=1;continue
  if set(witnesses)!={away,home} or any(x is None for x in witnesses.values()):
   one_sided+=1;continue
  confirmed+=1
  ai,hi=ids[away],ids[home]
  prior=existing.get((day,frozenset((ai,hi))),[])
  if len(prior)>1:conflicts+=1;continue
  sources=sorted(BASE+str(x) for x in witnesses.values())
  if prior:
   old=prior[0][1]
   if (old.get("away"),old.get("home"))!=(ai,hi) or old.get("neutral"):
    conflicts+=1;continue
   before=old.get("official_schedule_sources") or []
   after=sorted(set(before).union(sources))
   if after!=before:old["official_schedule_sources"]=after;enriched+=1
   continue
  if dt.date.fromisoformat(day)<today:continue
  gid=f"d2gmac-2026-{gender}-{day}-{away}-{home}"
  if gid in games:conflicts+=1;continue
  game={"id":gid,"date":day,"away":ai,"home":hi,"away_score":None,
        "home_score":None,"status":"scheduled","verified":True,
        "elo_eligible":True,"neutral":False,"conference_game":True,
        "source":"GMAC 2026-27 reciprocal official school calendars",
        "source_url":sources[0],"official_schedule_sources":sources}
  games[gid]=game;existing[(day,frozenset((ai,hi)))].append((gid,game));added+=1
 return {"status":"GMAC exact two-university 2026-27 fixture verification",
         "gender":gender,"teams_identified":len(ids),"schools_read":len(calendars),
         "confirmed_matchups":confirmed,"added":added,"enriched":enriched,
         "one_sided":one_sided,"quarantined":invalid+dupe_rows+conflicts,
         "conflicts":conflicts,"failed_candidates":failed,
         "missing_schools":sorted(set(ids)-set(calendars)),
         "source":"Great Midwest Athletic Conference university schedules"}
