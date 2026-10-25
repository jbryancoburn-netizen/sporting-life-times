#!/usr/bin/env python3
"""Multi-source RSS news publisher for The Sporting Life & Times."""
import datetime as dt
import email.utils
import html
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/"articles.json"
SOURCES=[
 ("BBC Sport","https://feeds.bbci.co.uk/sport/rss.xml","Multi-sport"),
 ("BBC Football","https://feeds.bbci.co.uk/sport/football/rss.xml","Football"),
 ("The Guardian Sport","https://www.theguardian.com/uk/sport/rss","Multi-sport"),
 ("The Guardian Football","https://www.theguardian.com/football/rss","Football"),
 ("Sky Sports Football","https://www.skysports.com/rss/12040","Football")
]
FOOTBALL=("premier league","arsenal","chelsea","liverpool","tottenham","manchester united","manchester city","newcastle","aston villa","brighton","everton","fulham","brentford","sunderland","leeds","crystal palace","bournemouth","ipswich","nottingham forest","coventry","hull city")
def clean(value):
    value=re.sub(r"<[^>]*>"," ",value or "")
    return re.sub(r"\\s+"," ",html.unescape(value)).strip()
def parse_date(raw):
    if not raw:return None
    try:
        d=email.utils.parsedate_to_datetime(raw)
        if d.tzinfo is None:d=d.replace(tzinfo=dt.timezone.utc)
        return d.astimezone(dt.timezone.utc)
    except (ValueError,TypeError,IndexError):return None
def parse_rss(payload,source,category):
    root=ET.fromstring(payload)
    items=root.findall(".//item")
    out=[]
    now=dt.datetime.now(dt.timezone.utc)
    for item in items:
        title=clean(item.findtext("title"));link=(item.findtext("link") or "").strip()
        published=parse_date(item.findtext("pubDate") or item.findtext("date"))
        if not title or not link.startswith("https://") or not published:continue
        if published>now+dt.timedelta(hours=2) or now-published>dt.timedelta(days=5):continue
        summary=clean(item.findtext("description"))[:400]
        bucket=category
        if any(k in (title+" "+summary).lower() for k in FOOTBALL):
            bucket="Premier League"
        out.append({"title":title,"url":link,"summary":summary,"source":source,
                    "category":bucket,"published_at":email.utils.format_datetime(published),
                    "image_url":None})
    return out
def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; SportingLifeTimes/1.0)","Accept":"application/rss+xml, application/xml, text/xml"})
    with urllib.request.urlopen(req,timeout=14) as response:return response.read(3_000_000)
def rebuild(fetcher=fetch,now=None):
    now=now or dt.datetime.now(dt.timezone.utc)
    published=[];status=[]
    for source,url,category in SOURCES:
        try:
            items=parse_rss(fetcher(url),source,category)
            if not items:raise ValueError("No recent dated stories")
            published.extend(items)
            status.append({"source":source,"state":"ok","items":len(items)})
        except Exception as exc:
            status.append({"source":source,"state":"failed","error":str(exc)[:160]})
    good=sum(s["state"]=="ok" for s in status)
    if good<2:raise RuntimeError("Too few independent news sources succeeded: "+json.dumps(status))
    existing=json.loads(DEST.read_text()) if DEST.exists() else {}
    # No fake news: old stories may be retained briefly, but timestamps remain original.
    published.extend(a for a in existing.get("articles",[]) if parse_date(a.get("published_at")) and (now-parse_date(a["published_at"])).total_seconds()<86400*2)
    unique={}
    for a in published:
        key=re.sub(r"[?#].*$","",a["url"]).rstrip("/")
        if key not in unique or parse_date(a["published_at"])>parse_date(unique[key]["published_at"]):unique[key]=a
    articles=sorted(unique.values(),key=lambda a:parse_date(a["published_at"]),reverse=True)[:140]
    recent=sum((now-parse_date(a["published_at"])).total_seconds()<=86400 for a in articles)
    if len(articles)<8 or recent<5:raise RuntimeError("News freshness gate failed: "+str((len(articles),recent)))
    doc={"updated_at":now.isoformat(),"articles":articles,"feed_status":status,"health":{"sources_ok":good,"sources_failed":len(status)-good,"last_24h":recent,"latest_article_at":articles[0]["published_at"],"status":"healthy"}}
    DEST.write_text(json.dumps(doc,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({"articles":len(articles),"last_24h":recent,"sources_ok":good,"sources_failed":len(status)-good}))
if __name__=="__main__":rebuild()
