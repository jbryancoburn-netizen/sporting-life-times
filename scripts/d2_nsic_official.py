"""Northern Sun 2026-27 basketball from 32 official university conference schedules.

Requires exact reciprocal date, home/away, two unique NSIC institutional grids,
both gender isolated. Conference-only games, no invented scores, times, arenas
or broadcasts. The NSIC table's H/A/N column is checked independently of 'at'.
"""
import datetime as dt
import re
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from d2_rmac_official import fetch,norm

BASE="https://northernsun.org/schedule.aspx?schedule="
LABELS=("Augustana","Bemidji State","Concordia-St. Paul","Jamestown","Mary",
        "Minnesota Crookston","Minnesota Duluth","Minnesota State",
        "MSU Moorhead","Minot State","Northern State","Sioux Falls",
        "Southwest Minnesota State","St. Cloud State","Wayne State","Winona State")
# Some SIDEARM identifiers precede later-numbered sport inserts; use checked
# exact 2026-27 school IDs, never infer from offsets at runtime.
MEN=(4243,4247,4248,4249,4250,4251,4252,4253,4254,4255,4256,4257,4258,4259,4260,4261)
WOMEN=(4262,4263,4264,4265,4266,4267,4268,4269,4270,4271,4272,4273,4274,4275,4276,4277)
SOURCES={"men":dict(zip(MEN,LABELS)),"women":dict(zip(WOMEN,LABELS))}
ALIASES={
 "augustana":("augustana","augustana university","augustana university south dakota"),
 "bemidji":("bemidji state","bemidji state university"),
 "concordia":("concordia st paul","concordia saint paul","concordia university st paul","concordia university saint paul"),
 "jamestown":("jamestown","university of jamestown"),
 "mary":("mary","u mary","umary","university of mary"),
 "crookston":("minnesota crookston","university of minnesota crookston","minnesota crookston university"),
 "duluth":("minnesota duluth","university of minnesota duluth"),
 "mankato":("minnesota state","minnesota state university","minnesota state mankato",
            "minnesota state university mankato"),
 "moorhead":("msu moorhead","minnesota state moorhead","minnesota state university moorhead"),
 "minot":("minot state","minot state university"),
 "northern":("northern state","northern state university"),
 "siouxfalls":("sioux falls","university of sioux falls"),
 "southwest":("southwest minnesota state","southwest minnesota state university"),
 "stcloud":("st cloud state","st cloud state university","saint cloud state","saint cloud state university"),
 "wayne":("wayne state","wayne state college","wayne state ne","wayne state college nebraska"),
 "winona":("winona state","winona state university"),
}
REVERSE={norm(n):k for k,names in ALIASES.items() for n in names}
def school(label):return REVERSE.get(norm(label))
def parse(html,gender,sid):
 from bs4 import BeautifulSoup
 soup=BeautifulSoup(html,"html.parser")
 title=" ".join([soup.title.get_text(" ",strip=True) if soup.title else ""]+
        [x.get_text(" ",strip=True) for x in soup.find_all(["h1","h2"],limit=3)])
 t=title.lower().replace("’","'")
 required="women's basketball" if gender=="women" else "men's basketball"
 if ("2026-27" not in t or required not in t or
     (gender=="men" and "women's basketball" in t) or
     not re.search(r"2026-27\s+(.+?)\s+(?:women's|men's)\s+basketball",t)):
  raise ValueError("Wrong NSIC source season/gender/institution: "+str(sid))
 # Match the school that owns the heading, not an opponent appearing in
 # the table. Official Moorhead calendars spell out Minnesota State Moorhead,
 # while the NSIC registration uses the abbreviated 'MSU Moorhead'.
 owner_label=re.search(r"2026-27\s+(.+?)\s+(?:women's|men's)\s+basketball",t).group(1)
 if school(owner_label)!=school(SOURCES[gender][sid]):
  raise ValueError("Wrong NSIC school identity: "+str(sid))
 me=school(SOURCES[gender][sid]);out=[];bad=0
 for table in soup.select("table"):
  heading=norm(" ".join(x.get_text(" ",strip=True) for x in table.select("th")))
  if not all(v in heading for v in ("date","opponent","home","away")):continue
  for tr in table.select("tr"):
   cols=[" ".join(x.get_text(" ",strip=True).split()) for x in tr.find_all(["td","th"],recursive=False)]
   if len(cols)<6 or "*" not in cols[1]:continue
   raw,_,other,venue,role,clock=cols[:6]
   if not re.fullmatch(r"\d{1,2}/\d{1,2}/20(?:26|27)",raw):bad+=1;continue
   try:date=dt.datetime.strptime(raw,"%m/%d/%Y").date()
   except ValueError:bad+=1;continue
   if not dt.date(2026,11,1)<=date<=dt.date(2027,3,1):continue
   role=role.strip().upper()
   if role not in ("H","A"):bad+=1;continue
   text=other.strip()
   listed_at=bool(re.match(r"^at\s+",text,re.I))
   if listed_at != (role=="A") or re.match(r"^vs\.?\s+",text,re.I):
    bad+=1;continue
   rival=school(re.sub(r"^at\s+","",text,flags=re.I))
   if not rival or rival==me:bad+=1;continue
   away,home=(me,rival) if role=="A" else (rival,me)
   out.append((date.isoformat(),away,home,me))
  break
 if not out:raise ValueError("No 2026-27 verified NSIC conference games "+str(sid))
 return out,bad

def enrich_nsic(gender,games,teams,today=None,fetcher=fetch):
 today=today or dt.date.today()
 identities={};ambiguous=set()
 for team_id,t in teams.items():
  if t.get("conference") not in ("NSIC","Northern Sun Intercollegiate Conference"):continue
  s=school(t.get("name")) or school(str(team_id).replace("-"," "))
  if not s:continue
  if s in identities and identities[s]!=team_id:ambiguous.add(s)
  else:identities[s]=team_id
 for s in ambiguous:identities.pop(s,None)
 if len(identities)<13:
  return {"status":"NSIC identity coverage incomplete; fixtures held","schools_matched":len(identities),"added":0}
 calendars={};errors=[];rejected=0
 with ThreadPoolExecutor(max_workers=7) as pool:
  jobs={pool.submit(fetcher,BASE+str(sid)):sid for sid in SOURCES[gender]}
  for j in as_completed(jobs):
   sid=jobs[j]
   try:
    rows,bad=parse(j.result(),gender,sid)
    calendars[sid]=rows;rejected+=bad
   except Exception as exc:errors.append({"id":sid,"error":str(exc)[:150]})
 if len(calendars)<13:
  return {"status":"Official NSIC calendars incomplete; fixtures held",
   "schools_read":len(calendars),"added":0,"errors":errors}
 witnessed=defaultdict(dict)
 for sid,rows in calendars.items():
  for date,away,home,school_id in rows:
   if away not in identities or home not in identities:rejected+=1;continue
   if school_id in witnessed[(date,away,home)]:rejected+=1;continue
   witnessed[(date,away,home)][school_id]=sid
 prior=defaultdict(list)
 for ident,g in games.items():
  if g.get("date") and g.get("away") and g.get("home"):
   prior[(g["date"],frozenset((g["away"],g["home"])))].append((ident,g))
 added=enriched=conflicts=one_sided=0
 for (date,away,home),votes in sorted(witnessed.items()):
  if set(votes)!={away,home}:one_sided+=1;continue
  ai,hi=identities[away],identities[home]
  key=date,frozenset((ai,hi))
  existing=prior.get(key,[])
  if len(existing)>1:conflicts+=1;continue
  urls=sorted(BASE+str(sid) for sid in votes.values())
  if existing:
   gid,g=existing[0]
   if g["away"]!=ai or g["home"]!=hi or g.get("neutral"):
    conflicts+=1;continue
   merged=sorted(set(g.get("official_schedule_sources") or []).union(urls))
   if merged!=g.get("official_schedule_sources"):
    g["official_schedule_sources"]=merged;enriched+=1
   continue
  if dt.date.fromisoformat(date)<today:continue
  gid=f"d2nsic-2026-{gender}-{date}-{away}-{home}"
  if gid in games:conflicts+=1;continue
  games[gid]={"id":gid,"date":date,"away":ai,"home":hi,"away_score":None,
   "home_score":None,"status":"scheduled","neutral":False,"elo_eligible":True,
   "verified":True,"conference_game":True,
   "source":"NSIC 2026-27 reciprocal official school calendars",
   "source_url":urls[0],"official_schedule_sources":urls}
  prior[key].append((gid,games[gid]));added+=1
 return {"status":"NSIC exact two-school 2026-27 conference fixture check",
  "gender":gender,"schools_read":len(calendars),"schools_matched":len(identities),
  "confirmed_matchups":sum(set(v)=={a,h} for (date,a,h),v in witnessed.items()),
  "added":added,"enriched":enriched,"one_sided":one_sided,
  "quarantined":rejected+conflicts,"conflicts":conflicts,
  "errors":errors,"source":"Northern Sun official 2026-27 university calendars"}
