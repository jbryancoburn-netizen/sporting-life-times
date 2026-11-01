#!/usr/bin/env python3
"""Fetch links and headlines from publisher feeds; do not republish article text."""
from __future__ import annotations

import datetime as dt
import email.utils
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "politics-news.json"
UTC = dt.timezone.utc
NOW = lambda: dt.datetime.now(UTC)
USER_AGENT = "Political-Life-and-Times/1.0 (+https://jbryancoburn-netizen.github.io/sporting-life-times/politics.html; headline link syndication)"
FEEDS = (
    ("PBS News", "https://www.pbs.org/newshour/feeds/rss/politics", ("pbs.org",)),
    ("NPR", "https://feeds.npr.org/1014/rss.xml", ("npr.org",)),
    ("Axios", "https://api.axios.com/feed/", ("axios.com",)),
    ("ProPublica", "https://www.propublica.org/feeds/propublica/main", ("propublica.org",)),
    ("POLITICO", "https://rss.politico.com/politics-news.xml", ("politico.com",)),
    ("BBC News", "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml", ("bbc.com", "bbc.co.uk")),
)
POLITICAL = re.compile(
    r"\b(election|congress|senat(?:e|or|ors)|house\s+of\s+representatives|"
    r"white house|president|trump|democrat|republican|legislation|lawmaker|"
    r"politic|political|vote|voter|ballot|governor|supreme court|"
    r"judg(?:e|es)|federal court|immigration|administration|"
    r"cabinet|campaign|tariff|justice department|department of justice|"
    r"scotus|capitol|midterm|polling|policy)\b", re.I
)
FEED_ATOM = "{http://www.w3.org/2005/Atom}"
def as_utc(value: str) -> dt.datetime | None:
    if not value:
        return None
    try:
        parsed = email.utils.parsedate_to_datetime(value)
        if parsed:
            return parsed.replace(tzinfo=parsed.tzinfo or UTC).astimezone(UTC)
    except (TypeError, ValueError, IndexError):
        pass
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.replace(tzinfo=parsed.tzinfo or UTC).astimezone(UTC)
    except ValueError:
        return None

def node_text(node: ET.Element, *paths: str) -> str:
    for path in paths:
        item = node.find(path)
        if item is not None and item.text and item.text.strip():
            return " ".join(item.text.split())
    return ""

def actual_link(node: ET.Element, is_atom: bool) -> str:
    if is_atom:
        for item in node.findall(FEED_ATOM + "link"):
            if item.get("rel", "alternate") == "alternate" and item.get("href"):
                return item.get("href", "")
    return node_text(node, "link")

def allowed_article_link(raw: str, hosts: tuple[str, ...]) -> str | None:
    try:
        url = urllib.parse.urlsplit(raw.strip())
        hostname = (url.hostname or "").lower()
        if url.scheme != "https" or not hostname or url.username or url.password:
            return None
        if not any(hostname == h or hostname.endswith("." + h) for h in hosts):
            return None
        # Remove fragments and campaign tracking parameters without altering canonical paths.
        clean = urllib.parse.urlunsplit(("https", url.netloc, url.path, url.query, ""))
        return clean
    except ValueError:
        return None

def parse_feed(body: bytes, source: str, hosts: tuple[str, ...], now: dt.datetime) -> list[dict]:
    root = ET.fromstring(body)
    entries = root.findall("./channel/item")
    is_atom = False
    if not entries:
        entries = root.findall(FEED_ATOM + "entry")
        is_atom = True
    if not entries:
        raise ValueError("No RSS items or Atom entries")
    output = []
    for entry in entries[:150]:
        title = node_text(entry, "title", FEED_ATOM + "title")[:240].strip()
        link = allowed_article_link(actual_link(entry, is_atom), hosts)
        published = as_utc(node_text(entry, "pubDate", "date", FEED_ATOM + "published", FEED_ATOM + "updated"))
        if not title or not link or published is None:
            continue
        age = (now - published).total_seconds()
        if age < -5400 or age > 72 * 3600:
            continue
        # Publisher politics feeds are already curated; general feeds must match topic.
        if source in ("Axios", "ProPublica", "BBC News") and not POLITICAL.search(title):
            continue
        output.append({
            "title": title, "url": link, "source": source,
            "published_at": published.isoformat(timespec="seconds")
        })
    return output

def fetch_one(source: str, url: str, hosts: tuple[str, ...], now: dt.datetime) -> list[dict]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*"})
    with urllib.request.urlopen(req, timeout=12) as res:
        if res.status != 200:
            raise RuntimeError("HTTP " + str(res.status))
        body = res.read(2_000_001)
        if len(body) > 2_000_000:
            raise ValueError("Feed exceeds allowed size")
    return parse_feed(body, source, hosts, now)

def build(fetcher=fetch_one, now: dt.datetime | None = None) -> dict:
    now = now or NOW()
    articles = []
    status = {}
    for source, url, hosts in FEEDS:
        try:
            found = fetcher(source, url, hosts, now)
            status[source] = {"status": "ok" if found else "no_recent_matching_stories", "count": len(found)}
            articles.extend(found)
        except Exception as error:
            status[source] = {"status": "error", "detail": str(error)[:115], "count": 0}
    # Avoid duplicate syndications, retain original publisher dates.
    dedup = {}
    for article in sorted(articles, key=lambda item: item["published_at"], reverse=True):
        key = article["url"].lower().rstrip("/")
        dedup.setdefault(key, article)
    articles = sorted(dedup.values(), key=lambda item: item["published_at"], reverse=True)[:90]
    successful = sum(item["status"] != "error" for item in status.values())
    return {
        "updated_at": now.isoformat(timespec="seconds"),
        "status": "ok" if successful >= 2 and len(articles) >= 4 else "insufficient_sources",
        "source_count": successful, "article_count": len(articles),
        "sources": status, "articles": articles,
        "editorial_policy": "Headline, publication date, publisher and direct link only. Article bodies and publisher images not republished.",
        "category": "U.S. politics"
    }

def main() -> int:
    data = build()
    print("Politics news providers:", json.dumps(data["sources"], sort_keys=True))
    if data["status"] != "ok":
        print("Not publishing insufficient source coverage; retaining last good edition.", file=sys.stderr)
        return 1
    OUTPUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("Published", data["article_count"], "links from", data["source_count"], "reachable feeds.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
