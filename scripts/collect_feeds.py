#!/usr/bin/env python3
"""Collect a modest set of RSS headlines with attribution and feed health reporting."""
import json, re, time
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

def main():
    articles, status, seen = [], [], set()
    for feed in FEEDS:
        result = {"source": feed["name"], "url": feed["url"], "ok": False, "items": 0, "error": None}
        try:
            req = Request(feed["url"], headers={"User-Agent":"SportingLifeTimesBot/1.0 (+RSS aggregator; contact site maintainer)"})
            with urlopen(req, timeout=15) as response:
                raw = response.read(2_000_000)
            root = ET.fromstring(raw)
            nodes = root.findall(".//item") or root.findall(".//{http://www.w3.org/2005/Atom}entry")
            for item in nodes[:25]:
                title = text_of(item, ["title", "{http://www.w3.org/2005/Atom}title"])
                link = text_of(item, ["link"])
                if not link:
                    link_el = item.find("{http://www.w3.org/2005/Atom}link")
                    if link_el is not None: link = link_el.attrib.get("href", "")
                summary = text_of(item, ["description", "summary", "{http://www.w3.org/2005/Atom}summary", "content"])
                if not title or not link or link in seen: continue
                seen.add(link)
                articles.append({"title":title, "url":link, "summary":summary[:600], "source":feed["name"], "category":feed.get("category","Sports"), "published_at":parse_date(item), "image_url":image_of(item)})
            result["ok"] = True
            result["items"] = sum(1 for a in articles if a["source"] == feed["name"])
        except Exception as exc:
            result["error"] = f"{type(exc).__name__}: {str(exc)[:180]}"
        status.append(result)
        time.sleep(0.25)
    articles.sort(key=lambda a: a.get("published_at",""), reverse=True)
    OUT.write_text(json.dumps({"updated_at":datetime.now(timezone.utc).isoformat(timespec="seconds"),"articles":articles[:80],"feed_status":status},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"Collected {len(articles)} unique stories; {sum(1 for s in status if s['ok'])}/{len(status)} feeds responded.")
    for s in status: print(f"{'OK' if s['ok'] else 'FAIL'} {s['source']}: {s['items']} items" + (f" — {s['error']}" if s['error'] else ""))
    if not any(s["ok"] for s in status):
        raise SystemExit("No RSS feeds responded; retaining diagnostic status and failing the workflow.")

if __name__ == "__main__": main()
