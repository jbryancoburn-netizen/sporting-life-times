#!/usr/bin/env python3
"""Verified Sidearm reader. Card at/vs is authoritative; JSON-LD homeTeam is NOT."""
import json,re,os,pathlib,requests,collections,concurrent.futures
from bs4 import BeautifulSoup
from urllib.parse import urlparse
ROOT=pathlib.Path(__file__).resolve().parents[1]/"data"
TEAMS=json.loads((ROOT/"ncaam-2026-27-espn-team-crosswalk.json").read_text())["teams"]
ALIAS={"appalachian":"app","amcorpuschristi":"corpuschristi"}
def norm(s):
 s=str(s or "").lower()
 s=re.sub(r"\b(university|college|univ|the|athletics|mens|men's)\b","",s)
 return re.sub(r"[^a-z0-9]","",s)
def day(s):
 m=re.search(r"202[67]-\d\d-\d\d",str(s or ""))
 return m.group() if m else None
def parse(html):
 soup=BeautifulSoup(html,"html.parser")
 # JSONLD matches card dates where card dates omit year.
 structured=collections.defaultdict(list)
 for tag in soup.select('script[type="application/ld+json"]'):
  try: items=json.loads(tag.string or tag.get_text())
  except (ValueError,TypeError):continue
  if not isinstance(items,list):items=items.get("@graph",[items]) if isinstance(items,dict) else []
  for item in items:
   if not isinstance(item,dict) or not day(item.get("startDate")):continue
   name=item.get("name") or ""
   m=re.search(r"\s(?:At|Vs\.?)\s(.+)$",name,re.I)
   if not m:continue
   structured[(day(item["startDate"]),norm(m.group(1)))].append(item)
 rows=[]
 for card in soup.select(".sidearm-schedule-game[data-game-id]"):
  op=card.select_one(".sidearm-schedule-game-opponent-text")
  if not op:continue
  val=op.get_text(" ",strip=True)
  m=re.match(r"^(at|vs\.?|@)\s+(.+?)\s*$",val,re.I)
  if not m:continue
  opponent=re.sub(r"\s*\((?:exh\.?|exhibition)\)\s*$","",m.group(2),flags=re.I).strip()
  site="away" if m.group(1).lower() in ("at","@") else "home"
  # Sidearm's neutral tag explicitly overrides vs.
  cardclass=" ".join(card.get("class",[])).lower()
  if card.select_one(".sidearm-schedule-game-neutral,[class*='neutral-site']") or "neutral" in cardclass:site="neutral"
  dateel=card.select_one(".sidearm-schedule-game-opponent-date")
  ds=dateel.get_text(" ",strip=True) if dateel else ""
  match=re.search(r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})",ds,re.I)
  if not match:continue
  month=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].index(match[1][:3].lower())+1
  observed=f"{2026 if month>=7 else 2027}-{month:02d}-{int(match[2]):02d}"
  candidates=structured.get((observed,norm(opponent)),[])
  if len(candidates)!=1:continue
  obj=candidates[0]
  location=(obj.get("location") or {}).get("name") or ""
  rows.append(dict(date=observed,opponent=opponent,site=site,location=location,game_id=card.get("data-game-id"),source="sidearm_card_plus_jsonld"))
 return rows
def process(t):
 tid=str(t.get("espn_id") or "");path=ROOT/"mbb-schedules-2026-27"/(tid+".json")
 out=dict(school=t["name"],id=tid,status="no_source",extracted=0,corrected=0,ambiguous=0)
 if not path.exists():return out
 d=json.loads(path.read_text());url=d.get("source_url","")
 if not url.startswith("https://"):return out
 page=url.replace("/schedule/text/","/schedule/")
 try:
  response=requests.get(page,timeout=15,headers={"User-Agent":"Mozilla/5.0"})
  if not response.ok or urlparse(response.url).hostname!=urlparse(url).hostname:out["status"]="fetch_failed";return out
  rows=parse(response.text)
 except Exception as e:out.update(status="parse_failed",error=str(e)[:150]);return out
 out["extracted"]=len(rows);out["status"]="parsed" if rows else "no_joint_card_jsonld_matches"
 # One-to-one safety: a single official game may certify at most one newspaper event.
 event_keys=collections.Counter()
 for e in d.get("events",[]):
  ps=(e.get("competitions") or [{}])[0].get("competitors") or []
  op=next((z for z in ps if str((z.get("team") or {}).get("id"))!=tid),{})
  oppid=str((op.get("team") or {}).get("id") or (op.get("team") or {}).get("displayName") or e.get("name"))
  event_keys[(str(e.get("date"))[:10],oppid)]+=1
 used_official_ids=set()
 for event in d.get("events",[]):
  if event.get("site_verified") is True:continue
  dt=str(event.get("date",""))[:10];ps=(event.get("competitions") or [{}])[0].get("competitors") or []
  own=next((p for p in ps if str((p.get("team") or {}).get("id"))==tid),None)
  other=next((p for p in ps if p is not own),None)
  if not own or not other:continue
  name=norm((other.get("team") or {}).get("displayName"))
  matches=[row for row in rows if row["date"]==dt and len(norm(row["opponent"]))>=4 and (norm(row["opponent"]) in name or name in norm(row["opponent"]))]
  if len(matches)>1:out["ambiguous"]+=1
  if len(matches)!=1:continue
  opponent_id=str((other.get("team") or {}).get("id") or (other.get("team") or {}).get("displayName") or event.get("name"))
  if event_keys[(dt,opponent_id)]!=1:continue
  x=matches[0]
  if not x.get("game_id") or x["game_id"] in used_official_ids:continue
  # vs by itself is NOT proof of home game if game location is unrecognized.
  # Use game cards only where specific venue explicitly matches known own/host arena.
  if x["site"]=="home":
   registry=ARENAS.get(tid,{})
   known=norm(registry.get("home_arena"))
   loc=norm(x["location"])
   if not known or not loc or (known not in loc and loc not in known):continue
  if x["site"]=="away" and "neutral" in str(x["location"]).lower():continue
  own["homeAway"]=x["site"]
  other["homeAway"]={"home":"away","away":"home","neutral":"neutral"}[x["site"]]
  event["neutralSite"]=x["site"]=="neutral";event["site_verified"]=True
  event["site_verified_via"]="official_sidearm_card_jsonld_and_venue"
  event["site_source_url"]=response.url
  event["source_game_id"]=x["game_id"]
  used_official_ids.add(x["game_id"])
  out["corrected"]+=1
 if out["corrected"] and os.getenv("APPLY")=="1":path.write_text(json.dumps(d,ensure_ascii=False,indent=2)+"\n")
 return out
ARENAS=json.loads((ROOT/"mbb-arena-registry.json").read_text())["teams"]
start=int(os.getenv("START","0"));end=int(os.getenv("END","3"))
selection=TEAMS[start:end] if os.getenv("FULL")=="1" else [t for t in TEAMS if str(t.get("espn_id")) in ("2010","2026","357")]
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool: results=list(pool.map(process,selection))
summary=dict(schools_checked=len(results),games_extracted=sum(x["extracted"] for x in results),games_corrected=sum(x["corrected"] for x in results),status=dict(collections.Counter(x["status"] for x in results)))
out=dict(summary=summary,schools=results)
fname=os.getenv("REPORT","sidearm-pilot")
(ROOT/("mbb-"+fname+".json")).write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2))
