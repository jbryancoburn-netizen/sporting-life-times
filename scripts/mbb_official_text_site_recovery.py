#!/usr/bin/env python3
"""School-by-school official TEXT schedule reader for non-Sidearm layouts.
Uses official athletics pages only; matches unique date + opponent; no paid feeds.
Never fabricates missing venues or broadcasts, and never overwrites conflicts.
"""
import json,re,pathlib,os,collections,concurrent.futures,datetime
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup
ROOT=pathlib.Path(__file__).resolve().parents[1]/"data"
TEAMS=json.loads((ROOT/"ncaam-2026-27-espn-team-crosswalk.json").read_text())["teams"]
BAD_HOST=("espn.com","realgm.com","wikipedia.org")
VENUE=re.compile(r"Arena|Coliseum|Center|Centre|Gym|Fieldhouse|Pavilion|Auditorium|Convocation|Forum|Dome|Stadium",re.I)
def norm(value):
 s=str(value or "").lower()
 s=re.sub(r"\b(university|college|of|the|men|mens|women)\b"," ",s)
 return re.sub(r"[^a-z0-9]","",s)
def date_of(txt):
 m=re.search(r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b",str(txt or ""),re.I)
 if not m:return ""
 mo="jan feb mar apr may jun jul aug sep oct nov dec".split().index(m[1][:3].lower())+1
 return f"{2026 if mo>=7 else 2027}-{mo:02d}-{int(m[2]):02d}"
def parse(html):
 soup=BeautifulSoup(html,"html.parser");rows=[]
 for table in soup.select("table"):
  trs=table.select("tr")
  if not trs:continue
  header=[x.get_text(" ",strip=True).lower() for x in trs[0].find_all(["td","th"])]
  def pos(*names):
   return next((i for i,h in enumerate(header) if h in names),-1)
  datei=pos("date");sitei=pos("at","site","home/away","h/a");oppi=pos("opponent")
  timei=pos("time","tipoff","tip");loci=pos("location","venue","arena")
  tvi=pos("tv","television","broadcast","network","tv/network")
  if min(datei,sitei,oppi)<0:continue
  for tr in trs[1:]:
   cells=[x.get_text(" ",strip=True) for x in tr.find_all(["td","th"],recursive=False)]
   if len(cells)<=max(datei,sitei,oppi):continue
   when=date_of(cells[datei]);site=cells[sitei].strip().lower()
   if site not in ("home","away","neutral") or not when:continue
   opponent=cells[oppi].strip()
   if not opponent or re.match(r"^(?:TBA|TBD)$",opponent,re.I):continue
   arena=cells[loci].strip() if loci>=0 and loci<len(cells) else ""
   tip=cells[timei].strip() if timei>=0 and timei<len(cells) else ""
   tv=cells[tvi].strip() if tvi>=0 and tvi<len(cells) else ""
   rows.append(dict(date=when,site=site,opponent=opponent,location=arena,tipoff=tip,broadcast=tv))
 return rows
def resolve_one(team):
 tid=str(team.get("espn_id") or "");p=ROOT/"mbb-schedules-2026-27"/(tid+".json")
 result=dict(school=team["name"],id=tid,status="missing_file",source_rows=0,matches=0,sites=0,times=0,venues=0,broadcasts=0,conflicts=0)
 if not p.exists():return result
 d=json.loads(p.read_text());source=d.get("source_url") or ""
 if not source.startswith("https://"):result["status"]="no_official_source";return result
 parsed=urlparse(source)
 if not parsed.hostname or any(x in parsed.hostname for x in BAD_HOST):result["status"]="invalid_source";return result
 # Prefer the school's simple text-schedule; it usually has explicit home/away columns.
 if "/schedule/text/" in source: candidates=[source]
 elif "/schedule/" in source: candidates=[source.replace("/schedule/","/schedule/text/",1)]
 else:candidates=[]
 candidates.append(source)
 candidates=list(dict.fromkeys(candidates))
 rows=[];official_url=""
 for url in candidates[:2]:
  try:
   response=requests.get(url,timeout=9,headers={"User-Agent":"Mozilla/5.0"})
   if not response.ok or urlparse(response.url).hostname!=parsed.hostname:continue
   trial=parse(response.text)
   if trial:rows=trial;official_url=response.url;break
  except (requests.RequestException,ValueError):continue
 result["source_rows"]=len(rows)
 if not rows:result["status"]="no_official_schedule_table";return result
 result["status"]="parsed"
 sourcemap=collections.defaultdict(list)
 for row in rows:sourcemap[row["date"]].append(row)
 games=d.get("events",[]);changed=False
 for event in games:
  dt=str(event.get("date") or "")[:10]
  c=(event.get("competitions") or [{}])[0];players=c.get("competitors") or []
  own=next((x for x in players if str((x.get("team") or {}).get("id"))==tid),None)
  other=next((x for x in players if x is not own),None)
  if not own or not other:continue
  oppname=norm((other.get("team") or {}).get("displayName") or event.get("name"))
  names=[norm(event.get("name"))]
  matches=[x for x in sourcemap.get(dt,[]) if norm(x["opponent"]) and (norm(x["opponent"]) in oppname or oppname in norm(x["opponent"]) or (len(norm(x["opponent"]))>=5 and norm(x["opponent"]) in names))]
  # Conservative unique date fallback: only one game on that date in both the school source and newspaper.
  if not matches and len(sourcemap.get(dt,[]))==1 and sum(str(z.get("date") or "")[:10]==dt for z in games)==1:
   row=sourcemap[dt][0]
   if len(norm(row["opponent"]))>=5 and len(oppname)>=5:
    # No opponent-guessing: date-only cases remain unresolved.
    pass
  if len(matches)!=1:result["conflicts"]+=int(len(matches)>1);continue
  match=matches[0]
  if sum(str(z.get("date") or "")[:10]==dt and norm(z.get("name"))==norm(event.get("name")) for z in games)!=1:
   result["conflicts"]+=1;continue
  result["matches"]+=1
  if event.get("site_verified") is True:
   if own.get("homeAway")!=match["site"]:result["conflicts"]+=1
  else:
   own["homeAway"]=match["site"]
   other["homeAway"]="away" if match["site"]=="home" else "home" if match["site"]=="away" else "neutral"
   event["neutralSite"]=match["site"]=="neutral"
   event["site_verified"]=True
   event["site_verified_via"]="official_athletics_text_schedule_date_opponent"
   event["site_source_url"]=official_url
   result["sites"]+=1;changed=True
  tm=match["tipoff"]
  if tm and not re.search(r"\b(?:TBA|TBD|To Be Announced)\b",tm,re.I) and not event.get("official_school_time"):
   event["official_school_time"]=tm;event["official_school_time_source"]=official_url
   result["times"]+=1;changed=True
  raw=match["location"]
  v=c.setdefault("venue",{})
  m=re.search(r"\(([^()]{4,90})\)",raw)
  arena=m.group(1) if m and VENUE.search(m.group(1)) else (raw if VENUE.search(raw) and len(raw)<85 and "," not in raw else "")
  if arena and not v.get("arenaName"):
   v["arenaName"]=arena;v["arena_source_url"]=official_url
   v["arena_source_type"]="official_school_text_schedule"
   result["venues"]+=1;changed=True
  tv=match["broadcast"]
  if tv and not re.search(r"^(?:TBA|TBD|N/A|None)$",tv,re.I) and not c.get("broadcasts"):
   c["broadcasts"]=[{"names":[tv],"source_url":official_url}]
   result["broadcasts"]+=1;changed=True
 if changed:p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+"\n")
 return result
batch=os.getenv("BATCH","unread-365")
if batch=="unread-365":
 original=ROOT/"mbb-official-field-recovery-all-365.json"
 inspected=json.loads(original.read_text())["schools"]
 selected_ids={x["id"] for x in inspected if x["status"]!="read"}
 selected=[t for t in TEAMS if str(t.get("espn_id")) in selected_ids]
else:selected=TEAMS
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:results=list(pool.map(resolve_one,selected))
summary=dict(schools_targeted=len(selected),school_tables_read=sum(x["status"]=="parsed" for x in results),school_games_read=sum(x["source_rows"] for x in results),
 site_corrections=sum(x["sites"] for x in results),tipoffs_added=sum(x["times"] for x in results),
 venues_added=sum(x["venues"] for x in results),broadcasts_added=sum(x["broadcasts"] for x in results),
 conflicts=sum(x["conflicts"] for x in results),statuses=dict(collections.Counter(x["status"] for x in results)))
(ROOT/"mbb-official-text-"+batch+".json").write_text(json.dumps({"summary":summary,"schools":results},indent=2)+"\n")
print(json.dumps(summary,indent=2))
