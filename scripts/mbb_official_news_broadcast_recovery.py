#!/usr/bin/env python3
"""Recover per-game TV and tipoffs from five official 2026-27 university news releases.
Matches one unique date+opponent. Leaves ambiguous text untouched.
No paid services or recurring runs.
"""
import json,re,pathlib,collections,requests
from bs4 import BeautifulSoup
ROOT=pathlib.Path(__file__).resolve().parents[1]/"data"
ARTICLES={
 "59":"https://ramblinwreck.com/news/2026/10/7/jackets-slated-for-national-television-in-2026-27-season",
 "8":"https://arkansasrazorbacks.com/arkansas-gets-tip-times-and-tv-designations/",
 "9":"https://thesundevils.com/news/2026/10/14/tv-schedule-and-times-revealed-for-sun-devil-mens-basketball-schedule",
 "96":"https://ukathletics.com/news/2026/10/07/kentucky-mens-basketball-finalizes-2026-27-schedule/",
 "26":"https://uclabruins.com/news/2026/10/6/big-ten-finalized-mens-basketball-broadcast-schedule"
}
TV=re.compile(r"\b(?:ACC Network Extra|ACC Network|SEC Network|SECN\+|ESPN(?:2|U|\+)?|FOX|FS1|FS2|CBS(?: Sports Network)?|CBSSN|BTN|Big Ten Network|Big Ten Plus|B1G\+|Peacock|NBC(?: Sports Network)?|The CW|TNT|truTV|HBO Max|MW\+|ESPN or ESPN2|ESPN/2/U|ESPN/2|ESPN/U|ABC)\b",re.I)
VENUE=re.compile(r"Arena|Pavilion|Coliseum|Fieldhouse|Center|Stadium|Gymnasium|Forum",re.I)
def norm(s):
 s=re.sub(r"\([^)]*\)","",str(s or "").lower())
 s=re.sub(r"\b(vs|at|university|college|of|the|men|mens)\b"," ",s)
 return re.sub(r"[^a-z0-9]","",s)
def dt(s):
 m=re.search(r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b",str(s or ""),re.I)
 if not m:return ""
 month="jan feb mar apr may jun jul aug sep oct nov dec".split().index(m[1][:3].lower())+1
 return f"{2026 if month>=7 else 2027}-{month:02d}-{int(m[2]):02d}"
def extract(soup):
 events=[]
 for row in soup.select("tr"):
  cells=[el.get_text(" ",strip=True) for el in row.find_all(["th","td"],recursive=False)]
  if len(cells)<4:continue
  date=dt(cells[0]);tvparts=[x for x in cells if TV.search(x) and len(x)<=80]
  if not date or not tvparts:continue
  opponent=cells[2] if len(cells)>=6 else cells[1]
  # A television field alone is insufficient if opponent is missing/placeholder.
  if len(norm(opponent))<4:continue
  explicit=tvparts[-1]
  if not TV.search(explicit):continue
  events.append({"date":date,"opponent":opponent,"tv":explicit,"time":cells[-1] if len(cells)>=6 else cells[-2],"location":cells[-3] if len(cells)>=6 else cells[2],"method":"official_athletics_news_table"})
 # Format used by Arizona State: each dated schedule line is a list element.
 for li in soup.select("li"):
  line=li.get_text(" ",strip=True)
  date=dt(line);match=re.search(r"\b(?:vs\.?|at)\s+(.+?)\s*(?:,|-)?\s+\d{1,2}(?::\d\d)?\s*(?:a\.?m\.?|p\.?m\.?).*?\bon\s+(.+)$",line,re.I)
  if not date or not match:continue
  network=match.group(2).strip(" .;,")
  if not TV.search(network) or len(network)>65:continue
  opponent=match.group(1).strip(" ,.-")
  tm=re.search(r"(\d{1,2}(?::\d\d)?\s*(?:a\.?m\.?|p\.?m\.?))",line,re.I)
  events.append({"date":date,"opponent":opponent,"tv":network,"time":tm.group(1) if tm else "","location":"","method":"official_athletics_news_list"})
 return events
report=[]
for id,url in ARTICLES.items():
 out={"id":id,"source":url,"extracted":0,"matched":0,"broadcasts":0,"times":0,"venues":0}
 try:
  res=requests.get(url,timeout=15,headers={"User-Agent":"Mozilla/5.0"})
  res.raise_for_status()
  src=extract(BeautifulSoup(res.text,"html.parser"))
 except Exception as e:out["error"]=str(e)[:150];report.append(out);continue
 out["extracted"]=len(src)
 p=ROOT/"mbb-schedules-2026-27"/(id+".json")
 d=json.loads(p.read_text());games=d.get("events",[])
 for event in games:
  date=str(event.get("date") or "")[:10]
  comp=(event.get("competitions") or [{}])[0];players=comp.get("competitors") or []
  other=next((x for x in players if str((x.get("team") or {}).get("id"))!=id),{})
  name=norm((other.get("team") or {}).get("displayName") or event.get("name"))
  possible=[x for x in src if x["date"]==date and len(norm(x["opponent"]))>=4 and (norm(x["opponent"]) in name or name in norm(x["opponent"]))]
  if len(possible)!=1:continue
  x=possible[0];out["matched"]+=1
  if TV.search(x["tv"]) and not comp.get("broadcasts"):
   comp["broadcasts"]=[{"names":[x["tv"]],"source_url":url}]
   out["broadcasts"]+=1
  time=x["time"]
  if time and not re.search(r"TBA|TBD",time,re.I) and not event.get("official_school_time") and len(time)<28:
   event["official_school_time"]=time;event["official_school_time_source"]=url
   out["times"]+=1
  venue=x["location"]
  if venue and VENUE.search(venue) and not (comp.get("venue") or {}).get("arenaName") and len(venue)<80:
   v=comp.setdefault("venue",{});v["arenaName"]=venue;v["arena_source_url"]=url;out["venues"]+=1
 if out["broadcasts"] or out["times"] or out["venues"]:p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+"\n")
 report.append(out)
summary={"news_pages_checked":len(report),"source_games_extracted":sum(x["extracted"] for x in report),"games_matched":sum(x["matched"] for x in report),"broadcasts_added":sum(x["broadcasts"] for x in report),"times_added":sum(x["times"] for x in report),"venues_added":sum(x["venues"] for x in report)}
(ROOT/"mbb-official-news-broadcast-recovery.json").write_text(json.dumps({"summary":summary,"schools":report},indent=2)+"\n")
print(json.dumps(summary,indent=2))
