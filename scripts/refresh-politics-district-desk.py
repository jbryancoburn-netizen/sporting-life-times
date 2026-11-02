#!/usr/bin/env python3
"""Refresh district-specific public news and verifiable congressional roll calls.

Free-only, standard-library sources. Never infer election winners, certified
returns, representative identities, vote positions or bill sponsorship.
Existing verified data stays untouched when source retrieval fails.
"""
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

ROOT = pathlib.Path(__file__).resolve().parent.parent
FILE = ROOT / "data" / "politics-district-desk.json"
TZ = dt.timezone.utc
UTC_NOW = dt.datetime.now(TZ)
ISO = UTC_NOW.isoformat(timespec="seconds").replace("+00:00", "Z")
ATOM = "{http://www.w3.org/2005/Atom}"
MAX_AGE_DAYS = 45
HEADERS = {"User-Agent": "SportingLifeTimes-DistrictWire/1.0 (public-source RSS; no credentials)", "Accept": "application/rss+xml,application/atom+xml,application/xml,text/xml,*/*"}
SOURCES = {
    "iowa public radio", "iowa capital dispatch", "quad-city times",
    "the gazette", "cedar rapids gazette", "wvik", "kwqc",
    "kcrg", "kcci", "des moines register", "the des moines register",
    "the guardian", "associated press", "ap news",
    "muscatine journal", "burlington hawk eye", "npr",
    "pbs news", "axios", "politico", "bleeding heartland",
    "wqpt", "iowa starting line", "little village",
}
DIRECT = re.compile(r"\b(miller[- ]meeks|bohannan|bridgford|ia[- ]?0?1|iowa.s (?:1st|first) congressional|iowa (?:1st|first) (?:house|district)|iowa (?:house )?district 1)\b", re.I)
LOCAL = re.compile(r"\b(iowa city|quad cities|davenport|bettendorf|muscatine|burlington|clinton|pella|newton|fairfield|keokuk|fort madison|scott county|johnson county)\b", re.I)
ISSUE = re.compile(r"\b(house|congress|representative|vote|election|ballot|politic|farm|tariff|factory|manufactur|steel|water|cancer|housing|hospital|university|econom|job|plant|labor|worker|industry|district|legislat)\b", re.I)

def get(url: str, limit: int = 1500000) -> bytes:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=22) as res:
        content = res.read(limit + 1)
    if len(content) > limit:
        raise ValueError("RSS resource over size cap")
    return content

def parsed_date(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        stamp = email.utils.parsedate_to_datetime(value)
    except Exception:
        try:
            stamp = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return stamp.replace(tzinfo=TZ) if stamp.tzinfo is None else stamp.astimezone(TZ)

def bool_publisher(source: str) -> bool:
    return source.casefold().strip() in SOURCES

def local_topic(title: str) -> str:
    s = title.casefold()
    if "steel" in s or "farm" in s or "tariff" in s or "industry" in s:
        return "JOBS & ECONOMY"
    if "vote" in s or "house" in s or "election" in s or "campaign" in s:
        return "ELECTION & GOVERNMENT"
    return "LOCAL REPORT"

def article_ok(title: str, publisher: str, at: dt.datetime) -> bool:
    recent = dt.timedelta(days=-MAX_AGE_DAYS) <= (at - UTC_NOW) <= dt.timedelta(days=1)
    exact = bool(DIRECT.search(title))
    relevant_local = bool(LOCAL.search(title) and ISSUE.search(title))
    return bool(recent and bool_publisher(publisher) and (exact or relevant_local))

def collect_google():
    terms = [
        '"Miller-Meeks" OR "Christina Bohannan" OR "Michael Bridgford" when:14d',
        '"Iowa 1st congressional district" OR "IA-01" when:14d',
        '("Iowa City" OR Davenport OR Muscatine OR Burlington) (Congress OR factory OR hospital OR steel OR economy OR "water quality") when:14d',
    ]
    items = []
    errors = []
    for term in terms:
        query = urllib.parse.urlencode({"q": term, "hl": "en-US", "gl": "US", "ceid": "US:en"})
        url = "https://news.google.com/rss/search?" + query
        try:
            root = ET.fromstring(get(url))
            for item in root.findall(".//item"):
                title = (item.findtext("title") or "").strip()
                link = (item.findtext("link") or "").strip()
                src = item.find("source")
                publisher = (src.text or "").strip() if src is not None else ""
                at = parsed_date(item.findtext("pubDate"))
                if not at or not link.startswith("https://") or not article_ok(title, publisher, at):
                    continue
                # Google's published headline includes " - Publisher" sometimes.
                suffix = " - " + publisher
                if title.endswith(suffix):
                    title = title[:-len(suffix)]
                if not (16 <= len(title) <= 230):
                    continue
                items.append({
                    "title": title, "source": publisher, "url": link,
                    "published_at": at.isoformat(timespec="seconds").replace("+00:00", "Z"),
                    "topic": local_topic(title), "via": "Google News RSS / publisher-linked"
                })
        except (ValueError, ET.ParseError, urllib.error.URLError, TimeoutError) as exc:
            errors.append(type(exc).__name__)
    items.sort(key=lambda row: row["published_at"], reverse=True)
    return items, errors

def text_at(node: ET.Element, name: str) -> str:
    return "".join(node.findtext(ATOM + name, "") or "").strip()

def member_entries(id_: str):
    if not re.fullmatch(r"[A-Z][0-9]{6}", id_):
        raise ValueError("Invalid congressional Bioguide ID")
    root = ET.fromstring(get("https://watch.vote/feeds/members/" + id_ + ".xml"))
    entries = []
    for item in root.findall(ATOM + "entry"):
        title, updated = text_at(item, "title"), parsed_date(text_at(item, "updated") or text_at(item, "published"))
        summary = (text_at(item, "summary") + " " + text_at(item, "content")).strip()
        links = item.findall(ATOM + "link")
        url = next((x.get("href", "") for x in links if x.get("rel") == "alternate"), "")
        if not url:
            url = next((x.get("href", "") for x in links), "")
        if not url.startswith("https://") or not updated or len(title) < 6:
            continue
        # Only use the member's own explicit vote; a chamber-wide "Yeas" count
        # does NOT identify the individual's choice.
        match = re.search(r"^\s*(?:Voted\s+)?(Yea|Nay|Not Voting|Present)\b", title, re.I)
        if not match:
            match = re.search(r"\b(?:member voted|this member voted|position:)\s*(Yea|Nay|Not Voting|Present)\b", summary, re.I)
        if not match:
            continue
        pos = match.group(1).title()
        entries.append({
            "position": pos, "title": title[:210], "url": url,
            "when": updated.isoformat(timespec="seconds").replace("+00:00", "Z"),
            "reference": "Recorded U.S. House roll call"
        })
    entries.sort(key=lambda item: item["when"], reverse=True)
    return entries[:50]

def main() -> int:
    raw = json.loads(FILE.read_text(encoding="utf-8"))
    d = raw["districts"]["IA-01"]
    latest, errors = collect_google()
    print(f"IA-01: relevant RSS headlines={len(latest)}, feed errors={errors}")
    if latest:
        old = d.get("articles", [])
        joined = latest + old
        deduped = []
        seen = set()
        for item in joined:
            key = re.sub(r"[^a-z0-9]+", "", item["title"].casefold())
            if key in seen:
                continue
            if not item.get("url", "").startswith("https://"):
                continue
            seen.add(key)
            deduped.append(item)
        deduped.sort(key=lambda item: item["published_at"], reverse=True)
        if deduped[:16] != old:
            d["articles"] = deduped[:16]
            d["news_updated_at"] = ISO
        d["news_status"] = "updated_from_publisher_linked_RSS"
        d["news_checked_at"] = ISO
    elif not errors:
        d["news_checked_at"] = ISO
    # Polls: do not scrape ambiguous percentages from search snippets,
    # update a row only after an original source-backed methodological review.
    # The publication links in the desk expose available new survey releases.
    current = d.get("representation", {}).get("current_119th", {})
    new = d.get("representation", {}).get("new_120th")
    election = d.get("election", {})
    # Never switch to the new member on date alone.
    chosen = new if (
        UTC_NOW.date() >= dt.date(2027, 1, 3)
        and election.get("certified") is True
        and new and new.get("bioguide")
    ) else current
    bioguide = chosen.get("bioguide")
    try:
        votes = member_entries(bioguide)
        if chosen is new:
            if votes != new.get("votes", []):
                new["votes"] = votes
                new["votes_checked_at"] = ISO
        else:
            if votes != d["representation"].get("votes", []):
                d["representation"]["votes"] = votes
            d["representation"]["votes_checked_at"] = ISO
        print(f"Record {bioguide}: verified member vote entries {len(votes)}")
    except (ValueError, ET.ParseError, urllib.error.URLError, TimeoutError) as exc:
        print(f"Record {bioguide}: source unavailable ({type(exc).__name__}); preserved existing.")
    before = FILE.read_text(encoding="utf-8")
    after = json.dumps(raw, indent=2, ensure_ascii=False) + "\n"
    if before != after:
        FILE.write_text(after, encoding="utf-8")
        print("Wrote source-backed source desk delta")
    else:
        print("No changes")
    return 0

if __name__ == "__main__":
    sys.exit(main())
