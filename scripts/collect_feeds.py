#!/usr/bin/env python3
"""Collect a modest set of RSS headlines with attribution and feed health reporting."""
import json, re, time
from concurrent.futures import ThreadPoolExecutor
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
FEEDS = json.loads((ROOT / "feeds.json").read_text(encoding="utf-8"))
OUT = ROOT / "articles.json"

def clean(value):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", value or "")).strip()

def parse_date(item):
    for key in ("pubDate", "published", "updated", "{http://purl.org/dc/elements/1.1/}date"):
        el = item.find(key)
        if el is not None and el.text:
            return el.text.strip()
    return ""

def text_of(item, names):
    for name in names:
        el = item.find(name)
        if el is not None and el.text:
            return clean(el.text)
    return ""

def image_of(item):
    for tag in ("{http://search.yahoo.com/mrss/}content", "{http://search.yahoo.com/mrss/}thumbnail", "enclosure"):
        el=item.find(tag)
        if el is None: continue
        url=el.attrib.get("url","")
        typ=el.attrib.get("type","")
        if url.startswith("https://") and (typ.startswith("image/") or el.attrib.get("medium")=="image" or tag.endswith("thumbnail")):
            return url
    return None

def iso_date(raw):
    if not raw:
        return ""
    try:
        return parsedate_to_datetime(raw).astimezone(timezone.utc).isoformat()
    except (TypeError, ValueError, IndexError):
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()
        except (TypeError, ValueError):
            return ""

def is_recent(raw, now):
    value = iso_date(raw)
    if not value:
        return False
    try:
        return 0 <= (now - datetime.fromisoformat(value)).total_seconds() <= 7 * 86400
    except (TypeError, ValueError):
        return False

PROMOTION_RE = re.compile(r'\b(?:draftkings|betmgm|fanduel|bet365|kalshi|polymarket|prizepicks|sportsbook|promo codes?|bonus bets?|free bets?|first wager|odds boost|first touchdown scorer|anytime touchdown scorer|betting odds|odds and picks|odds,? predictions|best bets?|betting picks?|parlay picks?|prediction markets?|betting markets?|player prop bets?|how to bet|where to bet|betting guide)\b', re.I)

def collect_one(feed, now):
    result = {"source": feed["name"], "url": feed["url"], "ok": False, "items": 0, "error": None}
    found = []
    try:
        req = Request(feed["url"], headers={"User-Agent":"SportingLifeTimesBot/1.0 (+RSS aggregator; contact site maintainer)"})
        with urlopen(req, timeout=12) as response:
            raw = response.read(2_000_000)
        root = ET.fromstring(raw)
        nodes = root.findall(".//item") or root.findall(".//{http://www.w3.org/2005/Atom}entry")
        for item in nodes[:20]:
            title = text_of(item, ["title", "{http://www.w3.org/2005/Atom}title"])
            link = text_of(item, ["link"])
            if not link:
                link_el = item.find("{http://www.w3.org/2005/Atom}link")
                if link_el is not None: link = link_el.attrib.get("href", "")
            summary = text_of(item, ["description", "summary", "{http://www.w3.org/2005/Atom}summary", "content"])
            if not title or not link or not link.startswith("https://"): continue
            if PROMOTION_RE.search(" ".join((title, summary, link))): continue
            published = parse_date(item)
            if not is_recent(published, now): continue
            publisher = title.rsplit(" - ", 1)[-1] if feed.get("scope") == "local" and " - " in title else feed["name"]
            if feed.get("scope") == "local" and " - " in title: title = title.rsplit(" - ", 1)[0]
            found.append({"title":title, "url":link, "summary":summary[:600], "source":publisher, "category":feed.get("category","Sports"), "team":feed.get("team"), "scope":feed.get("scope","national"), "published_at":iso_date(published), "image_url":image_of(item)})
        if not found: raise ValueError("No recent usable articles returned")
        result["ok"] = True
        result["items"] = len(found)
    except Exception as exc:
        result["error"] = f"{type(exc).__name__}: {str(exc)[:180]}"
    return found, result

def main():
    now = datetime.now(timezone.utc)
    # Bound the latency of a large local-news network: slow sources must not
    # serialize the entire hourly edition. Preserve configured feed order.
    with ThreadPoolExecutor(max_workers=10) as pool:
        results = list(pool.map(lambda feed: collect_one(feed, now), FEEDS))
    articles, status, seen_links, seen_titles = [], [], set(), set()
    for found, result in results:
        status.append(result)
        for article in found:
            key = re.sub(r"[^a-z0-9]+", "", article["title"].lower())
            if article["url"] in seen_links or key in seen_titles: continue
            seen_links.add(article["url"])
            seen_titles.add(key)
            articles.append(article)
    if OUT.exists():
        try:
            old=json.loads(OUT.read_text(encoding="utf-8"))
            for article in old.get("articles",[]):
                if not isinstance(article,dict) or not article.get("url") or not article.get("title"): continue
                if not is_recent(article.get("published_at"),now): continue
                key=re.sub(r"[^a-z0-9]+","",article["title"].lower())
                if article["url"] not in seen_links and key not in seen_titles:
                    seen_links.add(article["url"]);seen_titles.add(key);articles.append(article)
        except (OSError,ValueError,TypeError): pass
    # ESPN's structured NBA news endpoint is a backup when RSS hosts block runners.
    # It supplies real headlines and original links, never generated stories.
    try:
        req=Request("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=60",headers={"User-Agent":"Mozilla/5.0","Accept":"application/json"})
        with urlopen(req,timeout=12) as response: nba_data=json.load(response)
        for item in nba_data.get("articles",[]):
            title=clean(item.get("headline",""))
            links=item.get("links") or {}
            link=(links.get("web") or {}).get("href","")
            if not title or not link.startswith("https://") or PROMOTION_RE.search(title):continue
            published=iso_date(item.get("published") or item.get("lastModified") or "")
            if not is_recent(published,now):continue
            key=re.sub(r"[^a-z0-9]+","",title.lower())
            if link in seen_links or key in seen_titles:continue
            seen_links.add(link);seen_titles.add(key)
            articles.append({"title":title,"url":link,"summary":clean(item.get("story") or item.get("description") or "")[:600],"source":"ESPN NBA","category":"NBA","scope":"national","team":None,"published_at":published,"image_url":None})
        status.append({"source":"ESPN NBA structured news","url":"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news","ok":True,"items":sum(a.get("source")=="ESPN NBA" for a in articles),"error":None})
    except (OSError,ValueError,TypeError,KeyError) as exc:
        status.append({"source":"ESPN NBA structured news","ok":False,"items":0,"error":type(exc).__name__})
    articles.sort(key=lambda a: a.get("published_at",""), reverse=True)
    nba_count=sum(a.get("category")=="NBA" or "NBA" in a.get("source","") for a in articles)
    if nba_count==0: print("WARNING: zero NBA articles collected; source health must be reviewed")
    nbl_terms=re.compile(r'\b(?:NBL|Breakers|Wildcats|JackJumpers|Taipans|36ers|Illawarra Hawks|Adelaide|Melbourne United|Sydney Kings|Brisbane Bullets|South East Melbourne|SEM Phoenix|Perth Wildcats)\b',re.I)
    nbl_exclude=re.compile(r'\b(?:betting|bet tips?|best bets?|sportsbook|wager|punting|parlay|odds|NBA betting|NBA picks)\b',re.I)
    nbl_articles=[a for a in articles if a.get("category")=="Australian NBL"
                  and nbl_terms.search(a.get("title",""))
                  and not nbl_exclude.search(a.get("title",""))
                  and not re.search(r'\bNBA\b',a.get("title",""),re.I)
                  and not re.search(r'\b(?:live score|match center|fixtures?|schedule|gamecast|standings)\b',a.get("title",""),re.I)]
    nbl_dest=ROOT/"nbl-articles.json"
    nbl_dest.write_text(json.dumps({"updated_at":now.isoformat(),"articles":nbl_articles[:300],"feed_status":[v for v in status if "NBL" in v.get("source","") or "Breakers" in v.get("source","") or "Wildcats" in v.get("source","") or "Kings" in v.get("source","") or "Melbourne United" in v.get("source","")]},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("NBL wire:",len(nbl_articles),"attributed headlines",flush=True)
    OUT.write_text(json.dumps({"updated_at":datetime.now(timezone.utc).isoformat(timespec="seconds"),"articles":articles[:1000],"feed_status":status},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"Collected {len(articles)} unique stories; {sum(1 for x in status if x['ok'])}/{len(status)} feeds responded.")
    for item in status: print(f"{'OK' if item['ok'] else 'FAIL'} {item['source']}: {item['items']} items" + (f" — {item['error']}" if item['error'] else ""))
    if not any(item["ok"] for item in status):
        print("WARNING: No recent articles; feed sources unavailable.")

if __name__ == "__main__": main()
