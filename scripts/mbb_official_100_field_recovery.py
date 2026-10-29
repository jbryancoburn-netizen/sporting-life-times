#!/usr/bin/env python3
"""One-off batch: 100 official school schedules; add only individually evidenced fields.
No paid API, no recurring workflow, no invented TV/time/arena. Existing verified data preserved.
"""
import json,re,pathlib,collections,concurrent.futures,os,datetime
from urllib.parse import urlparse, urljoin
import requests
from bs4 import BeautifulSoup
ROOT=pathlib.Path(__file__).resolve().parents[1]/"data"
teams=json.loads((ROOT/"ncaam-2026-27-espn-team-crosswalk.json").read_text())["teams"]
def norm(s):
 s=str(s or "").lower()
 s=re.sub(r"\b(university|college|univ|the|men's|mens)\b","",s)
 return re.sub(r"[^a-z0-9]","",s)
def extract(html,base_url):
 soup=BeautifulSoup(html,"html.parser")
 rows=[]
 for el in soup.select(".sidearm-schedule-game[data-game-id]"):
  opp=el.select_one(".sidearm-schedule-game-opponent-text")
  dat=el.select_one(".sidearm-schedule-game-opponent-date")
  if not opp or not dat:continue
  om=re.match(r"^\s*(at|vs\.?|@)\s+(.+?)\s*$",opp.get_text(" ",strip=True),re.I)
  dm=re.search(r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})",dat.get_text(" ",strip=True),re.I)
  if not om or not dm:continue
  month="jan feb mar apr may jun jul aug sep oct nov dec".split().index(dm[1][:3].lower())+1
  dt=f"{2026 if month>=7 else 2027}-{month:02d}-{int(dm[2]):02d}"
  game_id=el.get("data-game-id")
  site="away" if om[1].lower() in ("at","@") else "home"
  if el.select_one(".sidearm-schedule-game-neutral,[class*='neutral-site']"):site="neutral"
  locationnode=el.select_one(".sidearm-schedule-game-location")
  loc=locationnode.get_text(" ",strip=True) if locationnode else ""
  # Extract official local tipoff only when explicitly displayed, not a guessed timezone.
  tip=""
  times=dat.get_text(" ",strip=True)
  tm=re.search(r"\b(\d{1,2}(?::\d\d)?\s*(?:a\.?m\.?|p\.?m\.?))\b",times,re.I)
  if tm:tip=tm.group(1)
  # Broadcast only from an explicit network label near the game card.
  networks=[]
  for n in el.select("[class*='tv-network'],[class*='television'],[class*='broadcast-network'],[class*='game-network']"):
   t=n.get_text(" ",strip=True)
   if t and len(t)<=45 and t not in networks:networks.append(t)
  # SIDEARM's authoritative game-local TV coverage field, separate from radio.
  for coverage in el.select(".sidearm-schedule-game-coverage-tv-content,[class*='coverage-tv-content']"):
   label=coverage.get_text(" ",strip=True)
   if label and len(label)<65 and not re.search(r"^(?:TBA|TBD|None|N/A|TV:?)$",label,re.I):
    if label not in networks:networks.append(label)
  # Broadcast and stream metadata are GAME-LOCAL, not page-wide navigation links.
  known=re.compile(r"\b(?:ESPN\+|ESPN2?|ESPNU|ACC Network|SEC Network|Big Ten Network|BTN|CBS Sports Network|CBSSN|FS1|FS2|FOX|Peacock|FloSports|SWAC TV|HBCU GO|NBC Sports|TNT|truTV|YouTube TV|Mountain West Network)\b",re.I)
  for mark in el.select("img[alt],img[title],[class*='broadcast'],[class*='television'],[class*='tv-logo'],[class*='tv_network']"):
   label=mark.get("alt") or mark.get("title") or mark.get_text(" ",strip=True)
   if label and len(label)<70 and known.search(label):
    network=known.search(label).group()
    if network not in networks:networks.append(network)
  watch_url=""
  for a in el.select("a[href]"):
   label=a.get_text(" ",strip=True)
   href=a.get("href") or ""
   if re.search(r"\b(?:Watch Live|Live Video|Live Stream|Watch Game)\b",label,re.I) or (re.search(r"(?:watch|video|stream)",str(a.get("aria-label") or ""),re.I) and href):
    full=urljoin(base_url,href)
    if full.startswith("https://") and not re.search(r"(?:javascript:|mailto:)",full,re.I):
     watch_url=full;break
  rows.append(dict(date=dt,opponent=re.sub(r"\s*\((exh\.?|exhibition)\)$","",om[2],flags=re.I),game_id=game_id,site=site,location=loc,tipoff=tip,networks=networks,watch_url=watch_url))
 return rows
def run(team):
 tid=str(team.get("espn_id") or ""); p=ROOT/"mbb-schedules-2026-27"/(tid+".json")
 out=dict(school=team["name"],id=tid,status="missing_file",cards=0,venues=0,times=0,broadcasts=0,watch_links=0,sites=0,ambiguous=0)
 if not p.exists():return out
 d=json.loads(p.read_text());source=d.get("source_url") or ""
 if not source.startswith("https://"):out["status"]="missing_official_url";return out
 page=source.replace("/schedule/text/","/schedule/")
 if any(b in urlparse(page).hostname for b in ("espn.com","realgm.com","wikipedia.org")):out["status"]="nonofficial_url";return out
 try:
  cache_dir=ROOT/"mbb-official-source-cache";cache_dir.mkdir(exist_ok=True)
  cache=cache_dir/(tid+".json")
  cached=json.loads(cache.read_text()) if cache.exists() else None
  if cached and cached.get("url")==page and cached.get("parser_version")==3 and not os.getenv("REFRESH_SOURCES"):
   cards=cached.get("cards",[])
   res=type("Cached",(),{"url":page,"ok":True})()
  else:
   res=requests.get(page,timeout=12,headers={"User-Agent":"Mozilla/5.0"})
  if not res.ok or urlparse(res.url).hostname!=urlparse(page).hostname:out["status"]="fetch_failed";return out
  if not cached or cached.get("url")!=page or cached.get("parser_version")!=3 or os.getenv("REFRESH_SOURCES"):
   cards=extract(res.text,page)
   cache.write_text(json.dumps({"url":page,"parser_version":3,"fetched_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"cards":cards},ensure_ascii=False)+"\n")
 except Exception as ex:out.update(status="fetch_or_parse_failed",error=str(ex)[:120]);return out
 out["cards"]=len(cards);out["status"]="read" if cards else "unsupported_layout"
 if not cards:return out
 # One-to-one: only one school event and one official card per exact day/opponent key.
 lookup=collections.defaultdict(list)
 for card in cards:lookup[(card["date"],norm(card["opponent"]))].append(card)
 eventmap=collections.defaultdict(list)
 for e in d.get("events",[]):
  comps=(e.get("competitions") or [{}])[0];ps=comps.get("competitors") or []
  other=next((x for x in ps if str((x.get("team") or {}).get("id"))!=tid),{})
  eventmap[(str(e.get("date") or "")[:10],norm((other.get("team") or {}).get("displayName") or e.get("name")))].append(e)
 changed=False
 for key,events in eventmap.items():
  date,name=key
  possible=[card for (dt,opp),group in lookup.items() if dt==date and len(opp)>=5 and len(name)>=5 and (opp in name or name in opp) for card in group]
  if len(events)!=1 or len(possible)!=1:out["ambiguous"]+=int(bool(possible));continue
  e=events[0];card=possible[0]
  c=(e.get("competitions") or [{}])[0];v=c.setdefault("venue",{})
  loc=card["location"]
  # Only explicit facility names; generic cities and tournament labels are not arenas.
  if not v.get("arenaName") and re.search(r"\b(Arena|Coliseum|Center|Centre|Gymnasium|Fieldhouse|Pavilion|Field House|Convocation Center|Auditorium)\b",loc,re.I):
   v["arenaName"]=loc;v["arena_source_url"]=res.url
   v["arena_source_type"]="official_university_game_card";out["venues"]+=1;changed=True
  if card["tipoff"] and not e.get("official_school_time"):
   e["official_school_time"]=card["tipoff"];e["official_school_time_source"]=res.url;out["times"]+=1;changed=True
  watch=card.get("watch_url") or ""
  if watch and not e.get("official_watch_url"):
   e["official_watch_url"]=watch
   e["official_watch_source"]=res.url
   out["watch_links"]+=1;changed=True
  if card["networks"] and not c.get("broadcasts"):
   c["broadcasts"]=[{"names":card["networks"],"source_url":res.url}];out["broadcasts"]+=1;changed=True
  # NEVER use 'vs' alone to certify home; arena should match known home venue.
  if not e.get("site_verified") and card["site"]=="away" and not re.search("neutral",loc,re.I):
   own=next((x for x in c.get("competitors",[]) if str((x.get("team") or {}).get("id"))==tid),None)
   other=next((x for x in c.get("competitors",[]) if x is not own),None)
   if own and other:
    own["homeAway"]="away";other["homeAway"]="home";e["neutralSite"]=False;e["site_verified"]=True
    e["site_source_url"]=res.url;e["source_game_id"]=card["game_id"]
    e["site_verified_via"]="official_school_card_unique_away";out["sites"]+=1;changed=True
 if changed:p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+"\n")
 return out
# Take 100 PROGRAMS requiring work, not 100 arbitrary cached files.
selected=[]
for team in teams:
 tid=str(team.get("espn_id") or "")
 p=ROOT/"mbb-schedules-2026-27"/(tid+".json")
 if not p.exists():continue
 d=json.loads(p.read_text())
 if any(not e.get("site_verified") or not ((e.get("competitions") or [{}])[0].get("venue") or {}).get("arenaName") or not ((e.get("competitions") or [{}])[0].get("broadcasts")) for e in d.get("events",[])):
  selected.append(team)
if os.getenv("BATCH_NAME")=="sidearm-tv":
 previous=json.loads((ROOT/"mbb-official-field-recovery-all-365.json").read_text())
 supported={x["id"] for x in previous["schools"] if x["status"]=="read"}
 selected=[t for t in teams if str(t.get("espn_id")) in supported]
elif os.getenv("BATCH_NAME")=="all-365":
 selected=teams
elif os.getenv("BATCH_NAME")=="final-100":
 final=selected[300:]
 earlier=[]
 for filename in ("mbb-official-100-field-recovery.json","mbb-official-field-recovery-second-100.json","mbb-official-field-recovery-third-100.json"):
  p=ROOT/filename
  if p.exists():
   previous=json.loads(p.read_text())
   earlier.extend(x["id"] for x in previous.get("schools",[]) if x.get("status") in ("unsupported_layout","missing_official_url","fetch_failed"))
 earlier=set(earlier)
 revisit=[t for t in selected[:300] if str(t.get("espn_id")) in earlier][:100-len(final)]
 selected=final+revisit
else:
 selected=selected[int(os.getenv("BATCH_START","0")):int(os.getenv("BATCH_END","100"))]
assert len(selected)==(len(supported) if os.getenv("BATCH_NAME")=="sidearm-tv" else (365 if os.getenv("BATCH_NAME")=="all-365" else 100)), f"Wrong school count: {len(selected)}"
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool: results=list(pool.map(run,selected))
summary={"schools_targeted":len(selected),"schools_checked":len(results),"official_cards":sum(x["cards"] for x in results),"venues_added":sum(x["venues"] for x in results),"tipoffs_added":sum(x["times"] for x in results),"broadcasts_added":sum(x["broadcasts"] for x in results),"watch_links_added":sum(x["watch_links"] for x in results),"sites_verified":sum(x["sites"] for x in results),"schools_changed":sum(bool(x["venues"]+x["times"]+x["broadcasts"]+x["watch_links"]+x["sites"]) for x in results),"statuses":dict(collections.Counter(x["status"] for x in results))}
(ROOT/("mbb-official-field-recovery-"+os.getenv("BATCH_NAME","second-100")+".json")).write_text(json.dumps({"summary":summary,"schools":results},indent=2)+"\n")
print(json.dumps(summary,indent=2))
