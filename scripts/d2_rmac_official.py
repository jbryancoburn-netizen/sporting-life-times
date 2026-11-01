"""Reciprocal 2026-27 RMAC men's and women's schedules, from 30 official school grids.

Only the same date and exact home/away school pairing from BOTH institutional
schedules becomes a fixture. No scores, venues, broadcasts or Eastern times
are inferred; neutral/ambiguous games and prior unscored dates are withheld.
"""
import datetime as dt
import re
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE="https://rmacsports.org/schedule.aspx?schedule="
SOURCES={
 "men":dict(zip((4551,4552,4553,4554,4555,4556,4557,4558,4559,4560,4561,4599,4605,4607,4611),
 ("Adams State","Black Hills State","Colorado Christian","Colorado Mesa",
 "Colorado School of Mines","CSU Pueblo","Fort Lewis","South Dakota Mines",
 "UCCS","Western Colorado","Westminster","MSU Denver","Regis",
 "New Mexico Highlands","Chadron State"))),
 "women":dict(zip((4562,4563,4564,4565,4566,4567,4568,4569,4570,4571,4572,4600,4606,4621,4612),
 ("Adams State","Black Hills State","Colorado Christian","Colorado Mesa",
 "Colorado School of Mines","CSU Pueblo","Fort Lewis","South Dakota Mines",
 "UCCS","Western Colorado","Westminster","MSU Denver","Regis",
 "New Mexico Highlands","Chadron State")))
}
ALIAS={
 "adams":("adams state","adams state university"),
 "black":("black hills state","black hills state university"),
 "ccu":("colorado christian","colorado christian university"),
 "mesa":("colorado mesa","colorado mesa university"),
 "mines":("colorado school of mines","colorado mines"),
 "pueblo":("csu pueblo","colorado state university pueblo","colorado state pueblo"),
 "lewis":("fort lewis","fort lewis college"),
 "sdmines":("south dakota mines","south dakota school of mines","south dakota school of mines and technology","south dakota school of mines technology"),
 "uccs":("uccs","university of colorado colorado springs","uc colorado springs","u c colorado springs"),
 "western":("western colorado","western colorado university"),
 "westminster":("westminster","westminster university","westminster college","westminster university utah"),
 "msudenver":("msu denver","metropolitan state","metropolitan state university of denver"),
 "regis":("regis","regis university","regis university colorado"),
 "highlands":("new mexico highlands","new mexico highlands university","n m highlands"),
 "chadron":("chadron state","chadron state college"),
}
def norm(s):return " ".join(re.sub(r"[^a-z0-9 ]"," ",str(s or "").lower()).split())
LOOKUP={norm(label):key for key,labels in ALIAS.items() for label in labels}
def school(s):return LOOKUP.get(norm(s))
def fetch(url):
 req=urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimes/1.0 (+https://github.com/jbryancoburn-netizen/sporting-life-times)"})
 with urllib.request.urlopen(req,timeout=18) as response:return response.read(1800000).decode("utf-8","replace")
def parse(html,gender,source_id):
 from bs4 import BeautifulSoup
 soup=BeautifulSoup(html,"html.parser")
 title=" ".join([soup.title.get_text(" ",strip=True) if soup.title else ""]+
       [x.get_text(" ",strip=True) for x in soup.find_all(["h1","h2"],limit=3)])
 t=title.lower().replace("’","'")
 expected=SOURCES[gender][source_id]
 if ("2026-27" not in t or ("women's basketball" if gender=="women" else "men's basketball") not in t
     or (gender=="men" and "women's basketball" in t)
     or norm(expected) not in norm(title)):
  raise ValueError("Wrong official season/sport/school calendar: "+str(source_id))
 me=school(expected);rows=[];quarantined=0
 for table in soup.select("table"):
  headers=norm(" ".join(x.get_text(" ",strip=True) for x in table.select("th")))
  if not all(s in headers for s in ("date","opponent","location")):continue
  for tr in table.select("tr"):
   cols=[" ".join(x.get_text(" ",strip=True).split()) for x in tr.find_all(["td","th"],recursive=False)]
   if len(cols)<5 or "*" not in cols[1]:continue
   d,_,opponent,location,clock=cols[:5]
   if not re.fullmatch(r"\d{1,2}/\d{1,2}/20(?:26|27)",d):
    quarantined+=1;continue
   try:date=dt.datetime.strptime(d,"%m/%d/%Y").date()
   except ValueError:quarantined+=1;continue
   if not dt.date(2026,11,1)<=date<=dt.date(2027,3,1):continue
   if re.match(r"^vs\.?\s+",opponent,re.I):quarantined+=1;continue
   rival=school(re.sub(r"^at\s+","",opponent,flags=re.I))
   if rival is None or rival==me:quarantined+=1;continue
   away,home=(me,rival) if re.match(r"^at\s+",opponent,re.I) else (rival,me)
   rows.append((date.isoformat(),away,home,me))
  break
 if not rows:raise ValueError("No valid RMAC conference schedule rows: "+str(source_id))
 return rows,quarantined
def enrich_rmac(gender,games,teams,today=None,fetcher=fetch):
 today=today or dt.date.today()
 identities={};conflicted=set()
 for ident,t in teams.items():
  if t.get("conference") not in ("RMAC","Rocky Mountain Athletic Conference"):continue
  key=school(t.get("name")) or school(str(ident).replace("-"," "))
  if not key:continue
  if key in identities and identities[key]!=ident:conflicted.add(key)
  else:identities[key]=ident
 for key in conflicted:identities.pop(key,None)
 if len(identities)<12:
  return {"status":"RMAC team identity validation incomplete; fixtures held",
   "registered_schools":len(identities),"added":0,"enriched":0}
 calendars={};errors=[];rejected=0
 with ThreadPoolExecutor(max_workers=7) as pool:
  jobs={pool.submit(fetcher,BASE+str(sid)):sid for sid in SOURCES[gender]}
  for task in as_completed(jobs):
   sid=jobs[task]
   try:
    rows,bad=parse(task.result(),gender,sid)
    calendars[sid]=rows;rejected+=bad
   except Exception as e:errors.append({"id":sid,"reason":str(e)[:130]})
 if len(calendars)<12:
  return {"status":"Official RMAC university sources incomplete; fixtures held",
    "schools_read":len(calendars),"unavailable":errors,"added":0,"enriched":0}
 evidence=defaultdict(dict)
 for sid,rows in calendars.items():
  for date,away,home,owner in rows:
   if away not in identities or home not in identities:rejected+=1;continue
   if owner in evidence[(date,away,home)]:rejected+=1;continue
   evidence[(date,away,home)][owner]=sid
 published=defaultdict(list)
 for ident,g in games.items():
  if g.get("date") and g.get("away") and g.get("home"):
   published[(g["date"],frozenset((g["away"],g["home"])))].append((ident,g))
 added=enriched=collisions=one_sided=0
 for (date,away,home),votes in sorted(evidence.items()):
  if set(votes)!={away,home}:one_sided+=1;continue
  ai,hi=identities[away],identities[home]
  key=date,frozenset((ai,hi));prior=published.get(key,[])
  if len(prior)>1:collisions+=1;continue
  urls=sorted(BASE+str(sid) for sid in votes.values())
  if prior:
   old=prior[0][1]
   if old["away"]!=ai or old["home"]!=hi or old.get("neutral"):collisions+=1;continue
   merged=sorted(set(old.get("official_schedule_sources") or []).union(urls))
   if old.get("official_schedule_sources")!=merged:
    old["official_schedule_sources"]=merged;enriched+=1
   continue
  if dt.date.fromisoformat(date)<today:continue
  ident=f"d2rmac-2026-{gender}-{date}-{away}-{home}"
  if ident in games:collisions+=1;continue
  games[ident]={"id":ident,"date":date,"away":ai,"home":hi,
   "away_score":None,"home_score":None,"status":"scheduled","neutral":False,
   "elo_eligible":True,"verified":True,"conference_game":True,
   "source":"RMAC 2026-27 reciprocal official school calendars",
   "source_url":urls[0],"official_schedule_sources":urls}
  published[key].append((ident,games[ident]));added+=1
 return {"status":"RMAC exact two-school conference fixtures only","gender":gender,
   "schools_read":len(calendars),"registered_schools":len(identities),
   "confirmed_matchups":sum(set(x)=={a,h} for (_,a,h),x in evidence.items()),
   "added":added,"enriched":enriched,"one_sided":one_sided,
   "quarantined":rejected+collisions,"conflicts":collisions,"unavailable":errors,
   "source":"https://rmacsports.org/schedule.aspx?schedule="}
