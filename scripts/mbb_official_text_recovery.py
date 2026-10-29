#!/usr/bin/env python3
"""Official athletics /schedule/text/ date-opponent site and tipoff recovery.
Target schools whose graphical pages do not expose Sidearm game cards.
No paid APIs, no extra scheduled Actions, preserve existing verified data.
"""
import collections,concurrent.futures,json,pathlib,re,requests
from urllib.parse import urlparse
from bs4 import BeautifulSoup
ROOT=pathlib.Path(__file__).resolve().parents[1]/"data"
TEAMS=json.loads((ROOT/"ncaam-2026-27-espn-team-crosswalk.json").read_text())["teams"]
ARENAS=json.loads((ROOT/"mbb-arena-registry.json").read_text())["teams"]
SUPPORTED={x["id"] for x in json.loads((ROOT/"mbb-official-field-recovery-all-365.json").read_text())["schools"] if x.get("status")=="read"}
MONTH={s:i+1 for i,s in enumerate("jan feb mar apr may jun jul aug sep oct nov dec".split())}
FACILITY=re.compile(r"\b(?:Arena|Coliseum|Center|Centre|Gymnasium|Gym|Fieldhouse|Field House|Pavilion|Forum|Dome|Auditorium|Convocation|Field House|The Pit|The Palestra|Smith Center)\b",re.I)
def norm(v):
 s=str(v or "").lower()
 s=re.sub(r"\b(?:university|college|of|the|univ|mens|men's)\b"," ",s)
 s=re.sub(r"\((?:preseason|exhibition|exh\.?)\)","",s)
 return re.sub(r"[^a-z0-9]","",s)
def day(v):
 m=re.search(r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b",v,re.I)
 if not m:return None
 month=MONTH[m[1][:3].lower()]
 return f"{2026 if month>=7 else 2027}-{month:02d}-{int(m[2]):02d}"
def extract(html):
 soup=BeautifulSoup(html,"html.parser");rows=[];seen=set()
 for table in soup.select("table"):
  table_rows=table.find_all("tr")
  for headerrow in table_rows[:3]:
   heads=[th.get_text(" ",strip=True).lower() for th in headerrow.find_all(["td","th"],recursive=False)]
   def ix(keys):
    return next((i for i,h in enumerate(heads) if h in keys),-1)
   di,si,oi,ti,li=[ix(k) for k in ({"date"},{"at","site","home/away"},{"opponent"},{"time"},{"location","venue"})]
   if min(di,si,oi)<0:continue
   for tr in table_rows:
    cells=[c.get_text(" ",strip=True) for c in tr.find_all(["td","th"],recursive=False)]
    if len(cells)<=max(di,si,oi):continue
    date=day(cells[di]);site=cells[si].strip().lower();opp=cells[oi].strip()
    if not date or site not in ("home","away","neutral") or not opp:continue
    loc=cells[li].strip() if 0<=li<len(cells) else ""
    tip=cells[ti].strip() if 0<=ti<len(cells) else ""
    key=(date,norm(opp),site)
    if key in seen:continue
    rows.append(dict(date=date,site=site,opponent=opp,location=loc,tipoff=tip));seen.add(key)
   break
 return rows
def apply(t):
 tid=str(t.get("espn_id") or "")
 p=ROOT/"mbb-schedules-2026-27"/(tid+".json")
 out=dict(id=tid,school=t["name"],status="missing_file",school_rows=0,site_verified=0,times_added=0,arenas_added=0,official_matched=0,disagreements=0)
 if not p.exists():return out
 d=json.loads(p.read_text());url=d.get("source_url") or ""
 if not url.startswith("https://"):
  out["status"]="no_official_source";return out
 host=urlparse(url).hostname
 if not host or any(q in host for q in ("espn.com","realgm.com","wikipedia.org")):
  out["status"]="disallowed_source";return out
 if "/schedule/text/" in url:candidates=[url]
 elif "/schedule/" in url:
  before,after=url.split("/schedule/",1)
  candidates=[before+"/schedule/text/2026-27",before+"/schedule/text/2026",url]
 else:out["status"]="no_text_route";return out
 records=[];used_url=None
 for page in list(dict.fromkeys(candidates))[:3]:
  try:
   response=requests.get(page,timeout=12,headers={"User-Agent":"Mozilla/5.0"})
   if not response.ok or urlparse(response.url).hostname!=host:continue
   records=extract(response.text)
   if records:used_url=response.url;break
  except requests.RequestException:pass
 if not records:
  out["status"]="no_readable_text_schedule";return out
 out["status"]="official_text_parsed";out["school_rows"]=len(records)
 bydate=collections.defaultdict(list)
 for row in records:bydate[row["date"]].append(row)
 games=d.get("events",[]);keys=collections.Counter()
 for e in games:
  ps=(e.get("competitions") or [{}])[0].get("competitors") or []
  other=next((x for x in ps if str((x.get("team") or {}).get("id"))!=tid),{})
  keys[(str(e.get("date") or "")[:10],str((other.get("team") or {}).get("id") or (other.get("team") or {}).get("displayName") or e.get("name")))] +=1
 used=set();changes=False
 for e in games:
  dt=str(e.get("date") or "")[:10]
  comps=(e.get("competitions") or [{}])[0];ps=comps.get("competitors") or []
  own=next((x for x in ps if str((x.get("team") or {}).get("id"))==tid),None)
  opp=next((x for x in ps if x is not own),None)
  if not own or not opp:continue
  opponent_id=str((opp.get("team") or {}).get("id") or (opp.get("team") or {}).get("displayName") or e.get("name"))
  if keys[(dt,opponent_id)]!=1:continue
  ownname=norm((opp.get("team") or {}).get("displayName") or e.get("name"))
  matches=[x for x in bydate[dt] if len(norm(x["opponent"]))>=3 and len(ownname)>=3 and (norm(x["opponent"]) in ownname or ownname in norm(x["opponent"]))]
  if len(matches)!=1:continue
  row=matches[0];key=(row["date"],norm(row["opponent"]))
  if key in used:continue
  used.add(key);out["official_matched"]+=1
  if not e.get("site_verified"):
   own["homeAway"]=row["site"];opp["homeAway"]={"home":"away","away":"home","neutral":"neutral"}[row["site"]]
   e["neutralSite"]=row["site"]=="neutral";e["site_verified"]=True
   e["site_verified_via"]="official_university_text_schedule_unique_opponent_date"
   e["site_source_url"]=used_url;out["site_verified"]+=1;changes=True
  elif own.get("homeAway")!=row["site"]:
   out["disagreements"]+=1
   e["official_source_site_disagreement"]={"existing":own.get("homeAway"),"official":row["site"],"source":used_url}
   changes=True
  tip=row["tipoff"]
  if tip and not re.search(r"\b(?:TBA|TBD|or)\b|/|^\s*-\s*$",tip,re.I) and re.search(r"\b\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b|\bnoon\b",tip,re.I) and not e.get("official_school_time"):
   e["official_school_time"]=tip;e["official_school_time_source"]=used_url
   out["times_added"]+=1;changes=True
  loc=row["location"];v=comps.setdefault("venue",{})
  parent=re.search(r"\(([^()]+)\)",loc)
  arena=parent.group(1).strip() if parent and FACILITY.search(parent.group(1)) else ""
  if arena and not v.get("arenaName"):
   v["arenaName"]=arena;v["arena_source_url"]=used_url
   v["arena_source_type"]="official_university_text_game_location"
   out["arenas_added"]+=1;changes=True
  if loc and not v.get("official_school_location"):
   v["official_school_location"]=loc;v["source_url"]=used_url;changes=True
 if changes:p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+"\n")
 return out
# Recheck all non-Sidearm universities and any school missing a verified source URL is reported.
target=[t for t in TEAMS if str(t.get("espn_id")) not in SUPPORTED]
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool: results=list(pool.map(apply,target))
summary=dict(schools_targeted=len(results),official_schools_parsed=sum(x["status"]=="official_text_parsed" for x in results),games_matched=sum(x["official_matched"] for x in results),sites_verified=sum(x["site_verified"] for x in results),tipoffs_added=sum(x["times_added"] for x in results),arenas_added=sum(x["arenas_added"] for x in results),disagreements=sum(x["disagreements"] for x in results),statuses=dict(collections.Counter(x["status"] for x in results)))
(ROOT/"mbb-official-text-recovery-report.json").write_text(json.dumps({"summary":summary,"schools":results},indent=2)+"\n")
print(json.dumps(summary,indent=2))
