#!/usr/bin/env python3
"""Bulk 2026-27 women's basketball university calendar verification.
Never infer a venue, time or network from a generic athletics webpage.
"""
import concurrent.futures,collections,datetime,json,pathlib,re,os
from urllib.parse import urlparse
from zoneinfo import ZoneInfo
import requests
from bs4 import BeautifulSoup

ROOT=pathlib.Path("data"); MBB=ROOT/"mbb-schedules-2026-27"
CAL=ROOT/"ncaaw-schedules-2026-27.json"
MONTHS={x:i+1 for i,x in enumerate("jan feb mar apr may jun jul aug sep oct nov dec".split())}
def normalize(x):
 x=re.sub(r"^\s*(?:No\.\s*)?#?\d{1,2}\s+","",str(x or ""),flags=re.I)
 x=re.sub(r"\b(the|university|college|women's|womens)\b","",x,flags=re.I)
 return re.sub(r"[^a-z0-9]","",x.lower())
def datekey(x):
 s=str(x or "");i=re.search(r"202[67]-\d\d-\d\d",s)
 if i:return i.group()
 m=re.search(r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})",s,re.I)
 if not m:return None
 mo=MONTHS[m.group(1)[:3].lower()]
 return f"{2026 if mo>=7 else 2027}-{mo:02}-{int(m.group(2)):02}"
def matching(a,b):
 x,y=normalize(a),normalize(b)
 if x==y:return True
 if len(x)<5 or len(y)<5:return False
 return x.startswith(y) or y.startswith(x)
def read_source(html):
 soup=BeautifulSoup(html,"html.parser");rows=[]
 for card in soup.select(".sidearm-schedule-game[data-game-id]"):
  op=card.select_one(".sidearm-schedule-game-opponent-text")
  de=card.select_one(".sidearm-schedule-game-opponent-date")
  if not op or not de:continue
  mo=re.match(r"^\s*(at|vs\.?|@)\s+(.+?)\s*$",op.get_text(" ",strip=True),re.I)
  dt=datekey(de.get_text(" ",strip=True))
  if not mo or not dt:continue
  site="away" if mo[1].lower() in ("at","@") else "home"
  if card.select_one(".sidearm-schedule-game-neutral,[class*='neutral-site']"):site="neutral"
  rows.append(dict(date=dt,opponent=mo[2],site=site,origin="official_university_sidearm_card"))
 if len(rows)>=5:return rows
 # Text schedules on older university athletics websites.
 for table in soup.select("table"):
  trs=table.select("tr")
  if not trs:continue
  h=[re.sub(r"[^a-z]","",x.get_text(" ",strip=True).lower()) for x in trs[0].find_all(["th","td"])]
  def col(*a):return next((i for i,v in enumerate(h) if v in a),-1)
  di,oi,si=col("date","gamedate"),col("opponent","opponentteam","teams","team"),col("at","site","homeaway")
  if min(di,oi)<0:continue
  for row in trs[1:]:
   v=[x.get_text(" ",strip=True) for x in row.find_all(["th","td"])]
   if max(di,oi)>=len(v):continue
   dt=datekey(v[di])
   if not dt or not v[oi]:continue
   site=v[si].lower().strip() if si>=0 and si<len(v) else ""
   opponent=v[oi]
   if site not in ("home","away","neutral"):
    m=re.match(r"^(at\s+|at(?=[A-Z])|vs\.?\s*|@\s*)(.+)$",opponent)
    site=("away" if m[1].strip().lower() in ("at","@") else "home") if m else ""
    if m:opponent=m[2].strip()
   rows.append(dict(date=dt,opponent=opponent,site=site,origin="official_university_schedule_table"))
 return rows
def official_urls(tid):
 """Find women's university schedules even if the men's per-team cache is absent.

 Men's-source records supply athletics HOSTS AND URL PATTERNS only. No men's
 game data is treated as women-specific official evidence.
 """
 p=MBB/(tid+".json")
 sources=[]
 if p.exists():
  try:sources.append(json.loads(p.read_text()).get("source_url") or "")
  except (OSError,ValueError):pass
 # The central school registry contains athletic URLs for the programs
 # missing from the per-team men's cache. Read it only when needed.
 if not any(any(mark in u for mark in ("mens-basketball","mbball","mbasketball","/mbkb/")) for u in sources):
  registry=ROOT/"mbb-official-school-schedule-sources.json"
  if registry.exists():
   for row in json.loads(registry.read_text()).get("teams",[]):
    if str(row.get("espn_id"))==str(tid):
     sources.append(row.get("url") or "")
     break
 # Direct school athletics pages confirmed for the 2026-27 women's season.
 # Keep these separate from any inferred men's URL pattern.
 exact={
  "8":"https://arkansasrazorbacks.com/sport/w-baskbl/schedule/",
  "55":"https://jaxstatesports.com/sports/womens-basketball/schedule",
  "59":"https://ramblinwreck.com/sports/w-baskbl/schedule",
  "87":"https://fightingirish.com/sports/wbball/schedule",
  "99":"https://lsusports.net/sports/wbball/schedule/season/2026-27",
  "195":"https://ohiobobcats.com/sports/wbball/schedule",
  "213":"https://gopsusports.com/sports/womens-basketball/schedule",
  "21":"https://goaztecs.com/sports/womens-basketball/schedule",
  "245":"https://12thman.com/sports/womens-basketball/schedule",
  "2900":"https://tommiesports.com/sports/wbball/schedule",
  "112358":"https://www.liuathletics.com/sports/womens-basketball/schedule/2026-27",
  "9":"https://thesundevils.com/sports/womens-basketball/schedule?print=true",
  "228":"https://clemsontigers.com/sports/w-basketball/schedule",
  "252":"https://byucougars.com/sports/womens-basketball/schedule",
  "96":"https://ukathletics.com/sports/wbball/schedule/",
  "238":"https://vucommodores.com/sports/wbball/schedule/season/2026-27",
  "2294":"https://hawkeyesports.com/sports/wbball/schedule",
  "24":"https://gostanford.com/sports/womens-basketball/schedule?print=true",
  "26":"https://uclabruins.com/sports/womens-basketball/schedule",
  "259":"https://hokiesports.com/sports/womens-basketball/schedule?print=true",
  "2390":"https://miamihurricanes.com/sports/wbball/schedule",
  "142":"https://mutigers.com/sports/womens-basketball/schedule?print=true",
  "258":"https://virginiasports.com/sports/wbball/schedule",
  "2132":"https://gobearcats.com/sports/womens-basketball/schedule",
  "2509":"https://purduesports.com/sports/womens-basketball/schedule",
  "2116":"https://ucfknights.com/sports/womens-basketball/schedule",
  "2306":"https://www.kstatesports.com/sports/womens-basketball/schedule/",
  "158":"https://huskers.com/sports/womens-basketball/schedule",
  "21":"https://goaztecs.com/sports/womens-basketball/schedule",
  "59":"https://ramblinwreck.com/sports/w-baskbl/schedule",
  "8":"https://arkansasrazorbacks.com/sport/w-baskbl/schedule/"
 }
 out=[exact[str(tid)]] if str(tid) in exact else []
 for u in sources:
  if not u.startswith("https://"):continue
  for old,new in (("mens-basketball","womens-basketball"),
                  ("mbball","wbball"),("mbasketball","wbasketball"),
                  ("/mbkb/","/wbkb/")):
   if old not in u:continue
   candidate=u.replace(old,new)
   out.append(candidate)
   if "/schedule" in candidate:
    base=candidate.split("/schedule",1)[0]+"/schedule"
    # Modern sites often no longer expose /text/2026-27 paths.
    out.extend([base,base+"?print=true",base+"/text",
                base+"/2026-27",base+"/text/2026-27"])
   break
 return list(dict.fromkeys(out))
def school(tid,school_data):
 result={"team_id":tid,"school":school_data["team"],"status":"no_official_url","source":None,
         "source_rows":0,"matched":0,"site_matched":0,"site_conflicts":0,"evidence":[]}
 urls=official_urls(tid)
 if not urls:return result
 rows=[];url=None
 for candidate in urls[:8]:
  if "/mens-basketball/" in candidate:continue
  try:
   response=requests.get(candidate,timeout=(5,10),headers={"User-Agent":"Mozilla/5.0 (compatible; SportingLifeTimesWBB/1.0)"})
   if not response.ok:continue
   if urlparse(response.url).hostname!=urlparse(candidate).hostname:continue
   if "/mens-basketball/" in response.url:continue
   rows=read_source(response.text)
   if len(rows)>=5:url=response.url;break
  except requests.RequestException:pass
 if not url:result["status"]="unreadable_university_schedule";return result
 result.update(status="parsed_university_calendar",source=url,source_rows=len(rows))
 bydate=collections.defaultdict(list)
 for g in school_data["games"]:
  dt=datetime.datetime.fromisoformat(g["date"].replace("Z","+00:00")).astimezone(ZoneInfo("America/New_York")).date().isoformat()
  bydate[dt].append(g)
 seen=set()
 for r in rows:
  candidates=[g for g in bydate[r["date"]] if matching(r["opponent"],g["opponent"])]
  if len(candidates)!=1:continue
  g=candidates[0]
  if g["id"] in seen:continue
  seen.add(g["id"])
  fields=["scheduled_date","opponent"]
  if r["site"]:
   if r["site"]==g["site"]:fields.append("home_away");result["site_matched"]+=1
   else:result["site_conflicts"]+=1
  result["evidence"].append({"team_id":tid,"game_id":g["id"],
      "verified_date":r["date"],"verified_opponent":r["opponent"],
      "verified_fields":fields,"source_url":url,"source_type":r["origin"]})
 result["matched"]=len(result["evidence"])
 result["status"]="matched_university_games" if result["matched"] else "zero_safe_matches"
 return result
def main():
 d=json.loads(CAL.read_text())
 if d.get("gender")!="women" or len(d["teams"])!=363:raise RuntimeError("Women registry guard failed")
 work=list(d["teams"].items())
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
  results=list(pool.map(lambda p:school(*p),work))
 evidence=[]
 for r in results:evidence.extend(r.pop("evidence"))
 oldpath=ROOT/"ncaaw-2026-27-official-schedule-verifications.json"
 old=json.loads(oldpath.read_text()) if oldpath.exists() else {"rows":[]}
 ids={(str(e["team_id"]),str(e["game_id"])) for e in evidence}
 for r in old.get("rows",[]):
  key=(str(r.get("team_id")),str(r.get("game_id")))
  if key not in ids:
   evidence.append(r);ids.add(key)
 lookup={(tid,str(g["id"])):g for tid,t in d["teams"].items() for g in t["games"]}
 verified=set()
 for r in evidence:
  tid=str(r["team_id"]);gid=str(r["game_id"])
  if (tid,gid) not in lookup:continue
  g=lookup[tid,gid]
  g["official_schedule_verified_fields"]=r["verified_fields"]
  g["official_schedule_source_url"]=r["source_url"]
  verified.add(tid)
 stats={"season":"2026-27","gender":"women","schools_attempted":len(results),
   "schools_with_readable_official_calendar":sum(x["source_rows"]>0 for x in results),
   "schools_with_matched_official_calendar":len({x["team_id"] for x in results if x["matched"]}) ,
   "verified_school_count_including_prior":len(verified),
   "verified_team_game_rows_including_prior":len(evidence),
   "verified_unique_game_ids":len({str(x["game_id"]) for x in evidence}),
   "official_home_away_matched":sum("home_away" in x.get("verified_fields",[]) for x in evidence),
   "official_home_away_conflicts":sum(x["site_conflicts"] for x in results),
   "status_counts":dict(collections.Counter(x["status"] for x in results)),
   "school_results":results,
   "policy":"Exact calendar date + unique opponent from official women's university schedule. No official arena, tipoff or TV claimed unless separately verified."
 }
 auditpath=ROOT/"ncaaw-schedules-2026-27-audit.json"
 audit=json.loads(auditpath.read_text())
 audit["official_school_schedules_date_and_opponent_checked"]=len(verified)
 audit["official_school_schedule_entries_date_and_opponent_checked"]=len(evidence)
 audit["official_schedule_bulk_evidence_file"]="data/ncaaw-2026-27-official-schedule-bulk-evidence.json"
 audit["official_schedule_bulk_audit_file"]="data/ncaaw-2026-27-official-schedule-bulk-audit.json"
 for path,obj in [(CAL,d),(auditpath,audit),
                  (ROOT/"ncaaw-2026-27-official-schedule-bulk-evidence.json",{"season":"2026-27","gender":"women","rows":evidence}),
                  (ROOT/"ncaaw-2026-27-official-schedule-bulk-audit.json",stats)]:
  serialized=json.dumps(obj,indent=2,ensure_ascii=False)+"\n"
  if not path.exists() or path.read_text()!=serialized:path.write_text(serialized)
 print("Women's official calendar bulk verification:",json.dumps({k:v for k,v in stats.items() if k!="school_results"}))
 if len(verified)<2:raise RuntimeError("Too few verifiable university schedules")
if __name__=="__main__":main()
