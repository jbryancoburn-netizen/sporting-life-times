#!/usr/bin/env python3
"""Collect verified, attributed headlines for the Hardwood Chronicle.

A Google News search query is discovery context, NOT evidence of the article's
sport or gender. Ambiguous Google headlines are omitted rather than mislabeled.
Direct publisher RSS links are preferred. Google News links are labeled as such.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from pathlib import Path
from urllib.parse import quote, urlsplit, urlunsplit
from urllib.request import Request, urlopen
import difflib
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/cbb-national-news.json"
MAX_AGE_HOURS = 72
FRESH_HOURS = 36
QUERIES = [
    ('men', '"men\'s college basketball" when:2d'),
    ('women', '"women\'s college basketball" when:2d'),
    ('men', '"NCAA men\'s basketball" rankings upset when:2d'),
    ('women', '"NCAA women\'s basketball" rankings upset when:2d'),
    ('men', '"men\'s basketball" transfer coach when:2d'),
    ('women', '"women\'s basketball" transfer coach when:2d'),
]
# First-party RSS endpoints, with a sport/gender guarantee only for specialist
# basketball feeds. General sports feeds must have explicit basketball evidence.
PUBLISHER_FEEDS = [
    ("NCAA.com", "https://www.ncaa.com/news/basketball-men/d1/rss.xml", "men"),
    ("NCAA.com", "https://www.ncaa.com/news/basketball-women/d1/rss.xml", "women"),
    ("ESPN Men's College Basketball", "https://www.espn.com/espn/rss/ncb/news", "men"),
    ("ESPN Women's College Basketball", "https://www.espn.com/espn/rss/ncw/news", "women"),
    ("Yahoo Sports", "https://sports.yahoo.com/rss/", None),
    ("The Athletic", "https://www.nytimes.com/athletic/rss/news/", None),
    ("CBS Sports", "https://www.cbssports.com/rss/headlines/", None),
]
WOMEN = re.compile(r"\b(?:women(?:['’]s)?|womens|ncaaw|wbb|lady\s+\w+|ladies)\b", re.I)
MEN = re.compile(r"\b(?:men(?:['’]s)?|mens|ncaam|mbb)\b", re.I)
BASKET = re.compile(r"\b(?:basketball|hoops|ncaa hoops|march madness|final four|ncaaw|ncaam|mbb|wbb)\b", re.I)
OFF_TOPIC = re.compile(r"\b(?:football|CFP|NFL|NBA|WNBA|MLB|NHL|soccer|baseball|hockey|quarterback|wide receiver|bowl game)\b", re.I)
LOW_VALUE = re.compile(r"\b(?:sportsbook|promo code|bonus bets?|parlay|wager|odds|betting|best bets?|picks|where to watch|how to watch|live stream|tv channel|highlights|top \d+ plays)\b", re.I)
IMPORTANT = re.compile(r"\b(?:upset|stuns?|shocks?|ranked|top 25|poll|ncaa tournament|bracket|champion|record|historic|major injury|suspension)\b", re.I)
GAME = re.compile(r"\b(?:routs?|defeats?|beats?|edges?|holds off|falls? to|knocks off|survives?|victor(?:y|ies)|wins?|loss|loses?|rallies|comeback)\b", re.I)
DEVELOPMENT = re.compile(r"\b(?:transfer|recruit|commit|injur|coach|conference|returns?|sidelined|suspension)\b", re.I)
LOCAL = re.compile(r"\b(?:preview|homestand|tickets?|photo gallery|press conference|recap|what channel)\b", re.I)
PREMIUM = re.compile(r"^(?:AP News|Associated Press|ESPN|The Athletic|CBS Sports|FOX Sports|Yahoo Sports|The New York Times|Hartford Courant|Washington Post|Chicago Tribune)$", re.I)
IGNORE_WORDS = frozenset("the a an and or to of at in on for with from after as is are was were no nr vs over top college basketball ncaa men women mens womens team teams game games".split())


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", value or ""))).strip()


def classify(title: str, *, trusted_feed_gender: str | None = None) -> str | None:
    """Return the one provable basketball edition, otherwise refuse placement."""
    if OFF_TOPIC.search(title) or LOW_VALUE.search(title):
        return None
    women, men = bool(WOMEN.search(title)), bool(MEN.search(title))
    if women and men:
        return None  # One article covering both editions must not be mislabeled.
    if women:
        return "women" if BASKET.search(title) or trusted_feed_gender == "women" else None
    if men:
        return "men" if BASKET.search(title) or trusted_feed_gender == "men" else None
    # Only a dedicated basketball publisher feed or a verified men's school feed
    # can supply the edition of an otherwise ambiguous headline.
    return trusted_feed_gender if trusted_feed_gender in ("men", "women") else None


def valid_url(value: str) -> bool:
    try:
        url = urlsplit(value)
        return url.scheme == "https" and bool(url.netloc)
    except ValueError:
        return False


def link_type(value: str) -> str:
    host = (urlsplit(value).hostname or "").lower()
    return "aggregator" if host == "news.google.com" or host.endswith(".news.google.com") else "publisher"


def parse_feed(payload: bytes, *, source_name: str, trusted_gender: str | None = None,
               discovered: bool = False, now: datetime | None = None) -> list[dict]:
    now = now or datetime.now(timezone.utc)
    root = ET.fromstring(payload)
    items = root.findall("./channel/item")
    result = []
    for entry in items:
        original_title = clean_text(entry.findtext("title") or "")
        source = clean_text(entry.findtext("source") or "") if discovered else source_name
        source = source or source_name
        title = re.sub(r"\s+-\s+" + re.escape(source) + r"$", "", original_title, flags=re.I).strip()
        url = (entry.findtext("link") or "").strip()
        try:
            published = parsedate_to_datetime(entry.findtext("pubDate") or "").astimezone(timezone.utc)
        except (TypeError, ValueError, AttributeError):
            continue
        if not valid_url(url) or not title or published > now + timedelta(minutes=5) or now - published > timedelta(hours=MAX_AGE_HOURS):
            continue
        gender = classify(title, trusted_feed_gender=trusted_gender)
        if not gender:
            continue
        summary = "" if discovered else clean_text(entry.findtext("description") or "")[:230]
        if summary.casefold() == title.casefold():
            summary = ""
        result.append({
            "title": title, "url": url, "source": source,
            "published_at": published.isoformat(), "summary": summary,
            "gender": gender, "category": "WBB" if gender == "women" else "MBB",
            "origin": "national RSS" if discovered else "publisher RSS",
            "gender_evidence": "verified_basketball_feed" if trusted_gender and not (MEN.search(title) or WOMEN.search(title)) else "explicit_title",
            "link_type": link_type(url)
        })
    return result


def fetch_feed(task: tuple, *, now: datetime) -> list[dict]:
    kind, label, address, trusted_gender = task
    request = Request(address, headers={
        "User-Agent": "Mozilla/5.0 (compatible; SportingLifeTimes/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml"
    })
    try:
        with urlopen(request, timeout=14) as response:
            payload = response.read(2_000_000)
        return parse_feed(payload, source_name=label, trusted_gender=trusted_gender,
                          discovered=kind == "discovery", now=now)
    except (OSError, ET.ParseError, ValueError) as error:
        print("Source unavailable:", label, str(error)[:130])
        return []


def normalized_title(title: str) -> str:
    title = re.sub(r"\s+-\s+[^-]+$", "", title.casefold())
    return re.sub(r"[^a-z0-9]+", " ", title).strip()


def tokens(title: str) -> set[str]:
    return {word for word in normalized_title(title).split() if len(word) > 2 and word not in IGNORE_WORDS}


def duplicate(a: dict, b: dict) -> bool:
    if a["gender"] != b["gender"]:
        return False
    if normalized_title(a["title"]) == normalized_title(b["title"]):
        return True
    if urlsplit(a["url"]).path == urlsplit(b["url"]).path and urlsplit(a["url"]).hostname == urlsplit(b["url"]).hostname:
        return True
    x, y = tokens(a["title"]), tokens(b["title"])
    if len(x) < 4 or len(y) < 4:
        return False
    jaccard = len(x & y) / len(x | y)
    return jaccard >= .70 or (jaccard >= .53 and difflib.SequenceMatcher(None, normalized_title(a["title"]), normalized_title(b["title"])).ratio() >= .76)


def score(article: dict, *, now: datetime) -> float:
    title = article["title"]
    published = datetime.fromisoformat(article["published_at"].replace("Z", "+00:00"))
    hours = max(0, (now - published).total_seconds() / 3600)
    impact = (40 if IMPORTANT.search(title) else 0) + (22 if GAME.search(title) else 0)
    impact += 15 if DEVELOPMENT.search(title) else 0
    impact -= 16 if LOCAL.search(title) else 0
    # National significance outranks recency; a direct, attributable publisher
    # is slightly preferred over an aggregator for otherwise similar articles.
    impact += 14 if PREMIUM.search(article.get("source", "")) else 0
    impact += 12 if article.get("link_type") == "publisher" else 0
    return round(impact - min(36, hours * .75), 2)


def choose(articles: list[dict], *, gender: str, now: datetime, limit: int = 80) -> list[dict]:
    eligible = []
    for article in articles:
        if article.get("gender") != gender or not valid_url(article.get("url", "")):
            continue
        # Recheck all older/school-provided content instead of trusting its tag.
        trusted = gender if article.get("gender_evidence") == "verified_basketball_feed" else None
        if classify(article.get("title", ""), trusted_feed_gender=trusted) != gender:
            continue
        try:
            age = now - datetime.fromisoformat(article["published_at"].replace("Z", "+00:00"))
        except (ValueError, KeyError, TypeError):
            continue
        if not timedelta(minutes=-5) <= age <= timedelta(hours=MAX_AGE_HOURS):
            continue
        article = dict(article)
        article["editorial_score"] = score(article, now=now)
        eligible.append(article)
    eligible.sort(key=lambda a: (a["editorial_score"], a["published_at"]), reverse=True)
    selected = []
    publisher_counts = {}
    for item in eligible:
        name = item["source"].casefold()
        if publisher_counts.get(name, 0) >= 10 or any(duplicate(item, prior) for prior in selected):
            continue
        selected.append(item)
        publisher_counts[name] = publisher_counts.get(name, 0) + 1
        if len(selected) >= limit:
            break
    return selected


def prior_school(now: datetime) -> list[dict]:
    result = []
    for file in (ROOT / "data/mbb-team-news").glob("*.json"):
        if not file.stem.isdigit():
            continue
        try:
            feed = json.loads(file.read_text())
        except (OSError, ValueError):
            continue
        for item in feed.get("articles", [])[:5]:
            title = clean_text(item.get("title", ""))
            if not BASKET.search(title) or classify(title, trusted_feed_gender="men") != "men":
                continue
            if not valid_url(item.get("url", "")):
                continue
            try:
                published = datetime.fromisoformat(item["published_at"].replace("Z", "+00:00"))
            except (KeyError, ValueError, TypeError):
                continue
            if now - published > timedelta(hours=48) or now - published < timedelta(minutes=-5):
                continue
            result.append({
                "title": title, "url": item["url"], "source": item.get("source", "School news"),
                "published_at": published.isoformat(), "summary": clean_text(item.get("summary", ""))[:230],
                "gender": "men", "category": "MBB", "origin": "school",
                "gender_evidence": "verified_basketball_feed", "link_type": link_type(item["url"])
            })
    return result


def main() -> None:
    now = datetime.now(timezone.utc)
    tasks = [("publisher", name, url, gender) for name, url, gender in PUBLISHER_FEEDS]
    tasks += [("discovery", "Google News", "https://news.google.com/rss/search?q=" + quote(query) + "&hl=en-US&gl=US&ceid=US:en", None)
              for _, query in QUERIES]
    with ThreadPoolExecutor(max_workers=8) as pool:
        batches = list(pool.map(lambda task: fetch_feed(task, now=now), tasks))
    articles = [a for batch in batches for a in batch] + prior_school(now)
    men = choose(articles, gender="men", now=now)
    women = choose(articles, gender="women", now=now)
    fresh = {gender: sum(now - datetime.fromisoformat(a["published_at"]) < timedelta(hours=FRESH_HOURS)
                         for a in selected) for gender, selected in (("men", men), ("women", women))}
    # A heartbeat or an old cached file is not proof of refreshed journalism.
    if min(len(men), len(women)) < 3 or min(fresh.values()) < 2:
        raise RuntimeError("Refusing to republish incomplete or stale editions: "
                           + str({"men": len(men), "women": len(women), "recent": fresh}))
    output = {
        "edition": "The Hardwood Chronicle", "season": "2026-27",
        "updated_at": now.isoformat(), "max_article_age_hours": MAX_AGE_HOURS,
        "sources": ["Direct publisher RSS", "Attributed Google News discovery", "Verified men's team reporting"],
        "coverage": {"men": len(men), "women": len(women)},
        "recent_36h": fresh, "direct_links": sum(a["link_type"] == "publisher" for a in men + women),
        "articles": men + women
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    print("Hardwood Chronicle verified:", output["coverage"], "recent:", fresh,
          "direct publisher links:", output["direct_links"])


if __name__ == "__main__":
    main()
