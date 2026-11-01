"""Conference Carolinas 2026-27 official university schedule reconciliation.

Sixteen official university athletics conference calendars for men's basketball
and sixteen separate women's. Every admitted match must have date/teams/home-away
independently attested by BOTH official school pages; no scores, broadcasts,
venues, neutral-site guesses or opposite-gender opponents are imported.
"""
import datetime as dt
import re
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor,as_completed
from d2_rmac_official import fetch,norm

BASE="https://conferencecarolinas.com/schedule.aspx?schedule="
LABELS=("Barton","Belmont Abbey","Chowan","Converse","Emmanuel","Erskine",
        "Ferrum","Francis Marion","King","Lees-McRae","Mount Olive",
        "North Greenville","Shorter","Southern Wesleyan","UNC Pembroke","Young Harris")
MEN=(4723,4744,4734,4664,4665,4666,4668,4669,4667,4724,4672,4671,4670,4674,4737,4673)
WOMEN=(4722,4745,4735,4679,4678,4677,4680,4682,4681,4683,4684,4685,4686,4687,4738,4688)
SOURCES={"men":dict(zip(MEN,LABELS)),"women":dict(zip(WOMEN,LABELS))}
ALIASES={
 "barton":("barton","barton college"),
 "belmont":("belmont abbey","belmont abbey college"),
 "chowan":("chowan","chowan university"),
 "converse":("converse","converse university"),
 "emmanuel":("emmanuel","emmanuel university","emmanuel university georgia"),
 "erskine":("erskine","erskine college"),
 "ferrum":("ferrum","ferrum college"),
 "francis":("francis marion","francis marion university"),
 "king":("king","king university"),
 "lees":("lees mcrae","lees mcrae college"),
 "mountolive":("mount olive","university of mount olive"),
 "northgreenville":("north greenville","north greenville university"),
 "shorter":("shorter","shorter university"),
 "southernwesleyan":("southern wesleyan","southern wesleyan university"),
 "uncp":("unc pembroke","university of north carolina at pembroke","north carolina pembroke"),
 "youngharris":("young harris","young harris college"),
}
KEYS={norm(name):key for key,labels in ALIASES.items() for name in labels}
def school(name):return KEYS.get(norm(name))
def parse(html,gender,sid):
 from bs4 import BeautifulSoup
 if sid not in SOURCES[gender]:raise ValueError("Unknown Carolinas gender source")
 soup=BeautifulSoup(html,"html.parser")
 title=" ".join([soup.title.get_text(" ",strip=True) if soup.title else ""]+
   [x.get_text(" ",strip=True) for x in soup.find_all(["h1","h2"],limit=3)])
 low=title.lower().replace("’","'")
 word="women's basketball" if gender=="women" else "men's basketball"
 school_label=SOURCES[gender][sid]
 if ("2026-27" not in low or word not in low or
   (gender=="men" and "women's basketball" in low) or
   norm(school_label) not in norm(title)):
  raise ValueError(f"Wrong official Carolinas gender/year/school {sid}")
 owner=school(school_label)
 if not owner:raise ValueError("Unknown Carolinas source institution")
 seen=0;rejected=0;result=[]
 for table in soup.select("table"):
  headers=norm(" ".join(h.get_text(" ",strip=True) for h in table.select("th")))
  if not ("date" in headers and "opponent" in headers and "notes" in headers):continue
  seen+=1
  for tr in table.select("tr"):
   cols=[" ".join(x.get_text(" ",strip=True).split()) for x in tr.find_all(["td","th"],recursive=False)]
   if len(cols)<4:continue
   raw,opponent,notes,time=cols[:4]
   if not re.fullmatch(r"\d{1,2}/\d{1,2}/20(?:26|27)",raw):
    rejected+=1;continue
   try:when=dt.datetime.strptime(raw,"%m/%d/%Y").date()
   except ValueError:rejected+=1;continue
   if not dt.date(2026,11,1)<=when<=dt.date(2027,3,1):continue
   if re.match(r"^(?:vs\.?|versus)\s+",opponent,re.I):rejected+=1;continue
   rival=school(re.sub(r"^at\s+","",opponent,flags=re.I))
   if not rival or rival==owner:rejected+=1;continue
   away,home=(owner,rival) if re.match(r"^at\s+",opponent,re.I) else (rival,owner)
   result.append((when.isoformat(),away,home,owner))
  break
 if seen==0 or not result:raise ValueError(f"Carolinas official calendar missing valid conference fixtures {sid}")
 return result,rejected

def identities(teams):
 by_key={};duplicate=set()
 for ident,record in teams.items():
  if record.get("conference") not in ("Carolinas","Conference Carolinas"):continue
  key=school(record.get("name")) or school(str(ident).replace("-"," "))
  if not key:continue
  if key in by_key and by_key[key]!=ident:duplicate.add(key)
  else:by_key[key]=ident
 for key in duplicate:by_key.pop(key,None)
 return by_key,duplicate

def enrich_carolinas(gender,games,teams,today=None,fetcher=fetch):
 today=today or dt.date.today()
 team_ids,duplicates=identities(teams)
 if len(team_ids)<15 or duplicates:
  return {"status":"Carolinas team identities incomplete; fixtures held",
          "teams_identified":len(team_ids),"duplicate_aliases":sorted(duplicates),
          "added":0,"enriched":0}
 reports={};errors=[];rejected=0
 with ThreadPoolExecutor(max_workers=8) as pool:
  jobs={pool.submit(fetcher,BASE+str(sid)):sid for sid in SOURCES[gender]}
  for task in as_completed(jobs):
   sid=jobs[task]
   try:
    rows,bad=parse(task.result(),gender,sid)
    reports[sid]=rows;rejected+=bad
   except Exception as exc:errors.append({"school":SOURCES[gender][sid],
                                         "source_id":sid,"reason":str(exc)[:150]})
 if len(reports)<13:
  return {"status":"Official Carolinas sources insufficient; fixtures held",
          "schools_read":len(reports),"unavailable":errors,
          "added":0,"enriched":0}
 sightings=defaultdict(dict)
 for sid,rows in reports.items():
  for date,away,home,source_owner in rows:
   if away not in team_ids or home not in team_ids:rejected+=1;continue
   key=(date,away,home)
   if source_owner in sightings[key]:rejected+=1;continue
   sightings[key][source_owner]=sid
 existing=defaultdict(list)
 for gid,g in games.items():
  if g.get("date") and g.get("home") and g.get("away"):
   existing[(g["date"],frozenset((g["away"],g["home"])))].append((gid,g))
 added=enriched=conflicts=unilateral=0
 for (date,away,home),sources in sorted(sightings.items()):
  if set(sources)!={away,home}:
   unilateral+=1;continue
  a,h=team_ids[away],team_ids[home]
  key=(date,frozenset((a,h)))
  prior=existing.get(key,[])
  if len(prior)>1:conflicts+=1;continue
  urls=sorted(BASE+str(sid) for sid in sources.values())
  if prior:
   original=prior[0][1]
   if original.get("away")!=a or original.get("home")!=h or original.get("neutral"):
    conflicts+=1;continue
   updated=sorted(set(original.get("official_schedule_sources") or []).union(urls))
   if original.get("official_schedule_sources")!=updated:
    original["official_schedule_sources"]=updated;enriched+=1
   continue
  if dt.date.fromisoformat(date)<today:continue
  gid=f"d2carolinas-2026-{gender}-{date}-{away}-{home}"
  if gid in games:conflicts+=1;continue
  new={"id":gid,"date":date,"away":a,"home":h,
       "away_score":None,"home_score":None,"status":"scheduled",
       "verified":True,"elo_eligible":True,"neutral":False,
       "conference_game":True,"source":"Carolinas reciprocal 2026-27 university athletic calendars",
       "source_url":urls[0],"official_schedule_sources":urls}
  games[gid]=new;existing[key].append((gid,new));added+=1
 return {"status":"Carolinas two-school official fixtures verified",
         "gender":gender,"schools_read":len(reports),"teams_identified":len(team_ids),
         "confirmed_matchups":sum(set(v)=={a,h} for (_,a,h),v in sightings.items()),
         "added":added,"enriched":enriched,"one_sided":unilateral,
         "quarantined":rejected+conflicts,"conflicts":conflicts,
         "unavailable":errors,"source":"Conference Carolinas official 2026-27 school schedules"}
