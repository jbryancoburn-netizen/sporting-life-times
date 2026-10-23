#!/usr/bin/env python3
"""Refresh independently attributed NBA stories; preserve valid prior stories during outages."""
import json, re
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.request import Request,urlopen
from xml.etree import ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data/nba-top-stories.json"
FEEDS=[
 ("ESPN NBA","https://www.espn.com/espn/rss/nba/news","national"),
 ("CBS Sports NBA","https://www.cbssports.com/rss/headlines/nba","national"),
 ("NBA.com","https://www.nba.com/rss/nba_rss.xml","league"),
 ("Hoops Rumors","https://www.hoopsrumors.com/feed","national"),
]
def clean(s): return re.sub(r"\\s+"," ",re.sub(r"<[^>]*>"," ",s or "")).strip()
def when(raw):
 try: return parsedate_to_datetime(raw).astimezone(timezone.utc)
 except Exception:
  try:return datetime.fromisoformat(raw.replace("Z","+00:00")).astimezone(timezone.utc)
  except Exception:return None
def fetch(url):
 req=Request(url,headers={"User-Agent":"Mozilla/5.0 SportingLifeTimes/1.0","Accept":"application/rss+xml, application/json, */*"})
 with urlopen(req,timeout=13) as r:return r.read(1800000)
def rss(name,url,scope,now):
 root=ET.fromstring(fetch(url))
 for e in root.findall(".//item"):
  title=clean(e.findtext("title"));link=clean(e.findtext("link"))
  dt=when(e.findtext("pubDate") or e.findtext("{http://purl.org/dc/elements/1.1/}date") or "")
  if not title or not link.startswith("https://") or not dt or not (now-timedelta(days=5)<=dt<=now+timedelta(hours=1)):continue
  yield dict(title=title,url=link,summary=clean(e.findtext("description"))[:360],source=name,category="NBA",scope=scope,published_at=dt.isoformat())
def espn(now):
 raw=json.loads(fetch("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=70"))
 for a in raw.get("articles",[]):
  title=clean(a.get("headline",""));link=((a.get("links") or {}).get("web") or {}).get("href","")
  dt=when(a.get("published","") or a.get("lastModified",""))
  if not title or not link.startswith("https://") or not dt or not (now-timedelta(days=5)<=dt<=now+timedelta(hours=1)):continue
  yield dict(title=title,url=link,summary=clean(a.get("description",""))[:360],source="ESPN NBA",category="NBA",scope="national",published_at=dt.isoformat())
def main():
 now=datetime.now(timezone.utc);items=[];fail=[]
 for name,url,scope in FEEDS:
  try:items.extend(rss(name,url,scope,now))
  except Exception as e:fail.append(name+": "+str(e)[:100])
 try:items.extend(espn(now))
 except Exception as e:fail.append("ESPN API: "+str(e)[:100])
 if OUT.exists():
  try:
   old=json.loads(OUT.read_text())
   items.extend(a for a in old.get("articles",[]) if when(a.get("published_at","")) and now-timedelta(days=7)<=when(a.get("published_at",""))<=now+timedelta(hours=1))
  except (ValueError,OSError,TypeError):pass
 seen=set();dedup=[]
 for a in sorted(items,key=lambda a:a.get("published_at",""),reverse=True):
  k=re.sub(r"[^a-z0-9]","",a["title"].lower())
  if a["url"] in seen or k in seen:continue
  seen.add(a["url"]);seen.add(k);dedup.append(a)
 if not dedup:raise SystemExit("No NBA publisher stories obtained; refusing empty overwrite: "+" | ".join(fail))
 OUT.write_text(json.dumps(dict(updated_at=now.isoformat(),articles=dedup[:100],feed_errors=fail),indent=2,ensure_ascii=False)+"\\n")
 print("NBA stories:",len(dedup),"feed failures:",len(fail))
if __name__=="__main__":main()
