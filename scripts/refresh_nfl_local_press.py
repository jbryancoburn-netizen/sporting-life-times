#!/usr/bin/env python3
"""Original-publisher NFL local reporting, isolated from all scoring workflows.

Discovery: Google News RSS search, filtered to an explicit local publisher registry.
Publishing: direct HTTPS publisher URLs only, checked against the exact source domains.
If discovery/resolution fails, preserve recent previously verified links and report errors.
"""
import datetime as dt
import email.utils
import html
import json
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "data/nfl-local-sources.json"
DEST = ROOT / "data/nfl-local-reporting.json"
UTC = dt.timezone.utc
MAX_AGE = dt.timedelta(days=14)
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; SportingLifeTimesLocalPress/1.0)", "Accept-Language": "en-US,en;q=0.9"}
POST = re.compile(r"\b(recap|postgame|post-game|takeaways|reaction|grades?|win(?:s|ning)?|won|loss|lost|defeat(?:s|ed)?|beat(?:s|en)?|victory|falls? to|rall(?:y|ies|ied)|final score|10 thoughts|observations|after the game)\b", re.I)
INJURY = re.compile(r"\b(injur\w*|concussion|inactive|ruled out|questionable|doubtful|hamstring|injured reserve|practice report)\b", re.I)
PRE = re.compile(r"\b(preview|pregame|pre-game|ahead of|before kickoff|matchup|what to watch|prediction|how to watch|scouting report)\b", re.I)

def clean(value):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", value or ""))).strip()

def parse_date(raw):
    try:
        d = email.utils.parsedate_to_datetime(raw)
        return d.replace(tzinfo=UTC).astimezone(UTC) if d.tzinfo is None else d.astimezone(UTC)
    except (ValueError, TypeError, IndexError):
        return None

def valid_host(url, source):
    try:
        p = urllib.parse.urlsplit(url)
        s = source["domain"].split("/", 1)
        host = s[0].lower()
        wanted_path = "/" + s[1].strip("/") if len(s) > 1 else ""
        actual = (p.hostname or "").lower()
        return (p.scheme == "https" and not p.username and not p.password
                and p.port in (None, 443)
                and (actual == host or actual.endswith("." + host))
                and (not wanted_path or p.path.lower().startswith(wanted_path.lower() + "/")))
    except ValueError:
        return False

def source_for_url(url, sources):
    return next((source for source in sources if valid_host(url, source)), None)

def headline_match(title, team):
    # Match club identity, not a broad city search. RSS query already uses full club name.
    name = team["name"].lower()
    nick = name.split(" ", 1)[-1] if not name.startswith(("New York ", "New England ", "Los Angeles ", "San Francisco ", "Green Bay ", "Kansas City ", "Tampa Bay ", "Las Vegas ", "New Orleans ")) else name.split(" ")[-1]
    text = title.lower()
    if name in text:
        return True
    keywords = [nick] + team.get("aliases", [])
    return any(re.search(r"\b" + re.escape(k.lower()) + r"\b", text, re.I) for k in keywords)

def category(title):
    if INJURY.search(title):
        return "Injuries"
    if PRE.search(title):
        return "Pre-Game"
    if POST.search(title):
        return "Post-Game"
    return "Team News"

def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=18) as response:
        return response.read(2_000_000)

def search_url(team, sources, search_term=None, unrestricted=False):
    domains = " OR ".join("site:" + s["domain"] for s in sources)
    domain_clause = "" if unrestricted else " (" + domains + ")"
    q = '"' + (search_term or team["name"]) + '"' + domain_clause + ' when:7d'
    return "https://news.google.com/rss/search?q=" + urllib.parse.quote_plus(q) + "&hl=en-US&gl=US&ceid=US:en"

def parse_feed(payload, team, now, limit, allowed_sources=None):
    root = ET.fromstring(payload)
    found = []
    for item in root.findall("./channel/item"):
        if allowed_sources is not None:
            source_el = item.find("source")
            source_url = source_el.attrib.get("url", "") if source_el is not None else ""
            host = (urllib.parse.urlsplit(source_url).hostname or "").lower()
            if not any(host == s["domain"].split("/")[0] or host.endswith("." + s["domain"].split("/")[0])
                       for s in allowed_sources):
                continue
        title = clean(item.findtext("title"))
        publisher = clean(item.findtext("source"))
        title = re.sub(r"\s+-\s+" + re.escape(publisher) + r"$", "", title, flags=re.I).strip() if publisher else title
        published = parse_date(item.findtext("pubDate"))
        url = (item.findtext("link") or "").strip()
        if not title or not published or not url.startswith("https://"):
            continue
        if published > now + dt.timedelta(hours=2) or now - published > MAX_AGE:
            continue
        if not headline_match(title, team):
            continue
        found.append({"title": title, "discovery_url": url, "published_at": published.isoformat(), "category": category(title)})
        if len(found) >= limit:
            break
    return found

def resolve_google(url):
    """Resolve a Google News wrapper using its article signature (not a paywall bypass)."""
    p = urllib.parse.urlsplit(url)
    if p.hostname != "news.google.com":
        return url
    gid = p.path.rstrip("/").split("/")[-1]
    if not re.fullmatch(r"[A-Za-z0-9_-]{20,}", gid):
        raise ValueError("Invalid Google News article ID")
    page = fetch("https://news.google.com/rss/articles/" + gid).decode("utf-8", "replace")
    attrs = {}
    for key in ("data-n-a-id", "data-n-a-ts", "data-n-a-sg"):
        m = re.search(key + r'="([^"]+)"', page)
        if not m:
            raise ValueError("Google News article signature unavailable")
        attrs[key] = html.unescape(m.group(1))
    sg, ts = attrs["data-n-a-sg"], attrs["data-n-a-ts"]
    inner = ('["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,'
             'null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],'
             + json.dumps(gid) + "," + ts + "," + json.dumps(sg) + "]")
    body = urllib.parse.urlencode({"f.req": json.dumps([[["Fbv4je", inner, None, "generic"]]])}).encode()
    req = urllib.request.Request("https://news.google.com/_/DotsSplashUi/data/batchexecute",
                                 data=body, headers={**HEADERS, "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"})
    with urllib.request.urlopen(req, timeout=18) as res:
        raw = res.read(500_000).decode("utf-8", "replace")
    start = raw.find("[[")
    if start < 0:
        raise ValueError("Malformed Google News resolution")
    rows = json.loads(raw[start:])
    values = [row for row in rows if isinstance(row, list) and len(row) >= 3 and row[1] == "Fbv4je"]
    if not values or not values[0][2]:
        raise ValueError("No publisher URL in Google News response")
    parsed = json.loads(values[0][2])
    url = parsed[1] if len(parsed) > 1 else ""
    if not isinstance(url, str) or not url.startswith("https://"):
        raise ValueError("Google News did not supply a publisher HTTPS URL")
    return url

def unique(articles, limit):
    seen = set()
    result = []
    for a in sorted(articles, key=lambda x: x["published_at"], reverse=True):
        identity = (re.sub(r"[?#].*$", "", a["url"]).rstrip("/").lower(), tuple(sorted(a.get("team_ids", []))))
        if identity in seen:
            continue
        seen.add(identity)
        result.append(a)
        if len(result) == limit:
            break
    return result

def rebuild(now=None, fetcher=fetch, resolver=resolve_google):
    now = now or dt.datetime.now(UTC)
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    teams = registry["teams"]
    assert len(teams) == len({str(t["id"]) for t in teams}) == 32
    assert all(len(t["local_sources"]) >= 2 for t in teams)
    national = registry["national_subscriber_sources"]
    old = json.loads(DEST.read_text(encoding="utf-8")) if DEST.exists() else {}
    previous = [a for a in old.get("articles", []) if isinstance(a, dict)]
    by_google = {a.get("discovery_url"): a["url"] for a in previous if a.get("discovery_url") and a.get("url")}
    all_sources = {str(t["id"]): t["local_sources"] + national for t in teams}
    # Always revalidate even previously stored URLs against configured publisher domains.
    retained = [a for a in previous if str(a.get("team_ids", [""])[0]) in all_sources
                and source_for_url(a.get("url", ""), all_sources[str(a["team_ids"][0])])
                and (dt.datetime.fromisoformat(a["published_at"]).astimezone(UTC) >= now - MAX_AGE)]
    jobs = []
    for team in teams:
        jobs.append((team, "local", team["local_sources"], 12))
        jobs.append((team, "subscriber", national, 7))
    results = []
    def discovery(job):
        team, family, sources, limit = job
        try:
            items = parse_feed(fetcher(search_url(team, sources)), team, now, limit)
            if family == "local" and len(items) < 3:
                # Local desks often shorten a team name to Bucs, Rams or Giants.
                short = (team.get("aliases") or [team["name"].split(" ")[-1]])[0]
                more = parse_feed(fetcher(search_url(team, sources, short)), team, now, limit)
                seen = {a["discovery_url"] for a in items}
                items.extend(a for a in more if a["discovery_url"] not in seen)
                seen.update(a["discovery_url"] for a in items)
                if len(items) < 3:
                    # Some papers are indexed in general search but not a multi-domain site: query.
                    wider = parse_feed(fetcher(search_url(team, sources, short, unrestricted=True)),
                                       team, now, limit, allowed_sources=sources)
                    items.extend(a for a in wider if a["discovery_url"] not in seen)
            if family == "local":
                for feed in team.get("direct_rss_feeds", []):
                    try:
                        direct = parse_feed(fetcher(feed), team, now, limit)
                        known = {a["discovery_url"] for a in items}
                        items.extend(a for a in direct if a["discovery_url"] not in known
                                     and source_for_url(a["discovery_url"], sources))
                    except Exception as feed_exc:
                        print("Optional local publisher RSS unavailable:", team["name"], feed,
                              str(feed_exc)[:100])
            return job, items[:limit], None
        except Exception as exc:
            return job, [], str(exc)[:160]
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(discovery, job) for job in jobs]
        for f in as_completed(futures):
            results.append(f.result())
    ok = sum(err is None for _, _, err in results)
    if ok < 8:
        raise RuntimeError(f"Local press discovery degraded: only {ok} of {len(jobs)} queries succeeded; retaining existing publication")
    gathered = []
    failed_resolution = 0
    for (team, family, sources, _), items, err in results:
        if err:
            continue
        for item in items:
            try:
                wrapped = item["discovery_url"]
                url = by_google.get(wrapped) or resolver(wrapped)
                source = source_for_url(url, sources)
                if not source:
                    continue  # Never publish an unverified Google wrapper or wrong publisher.
                gathered.append({**item, "url": url, "source": source["name"],
                                 "team_ids": [str(team["id"])], "origin": family,
                                 "summary": ""})
            except Exception:
                failed_resolution += 1
    merged = retained + gathered
    all_articles = []
    team_status = {}
    for team in teams:
        tid = str(team["id"])
        local = unique([a for a in merged if tid in a["team_ids"] and a.get("origin") == "local"], 12)
        subscriber = unique([a for a in merged if tid in a["team_ids"] and a.get("origin") == "subscriber"], 6)
        all_articles.extend(unique(local + subscriber, 18))
        team_status[tid] = {"team": team["name"], "local_articles": len(local),
                            "subscriber_articles": len(subscriber),
                            "local_sources": [s["name"] for s in team["local_sources"]]}
    all_articles = unique(all_articles, 576)
    if not all_articles:
        raise RuntimeError("No verified direct-publisher articles; existing publication preserved")
    status = [{"team_id": str(j[0]["id"]), "type": j[1], "state": "error" if err else "ok",
               "found": len(items), **({"error": err} if err else {})}
              for j, items, err in results]
    data = {"updated_at": now.isoformat(), "description": "Direct publisher URLs discovered from local and subscription news sources; no copied article text.",
            "articles": all_articles, "teams": team_status,
            "health": {"teams_configured": len(teams),
                       "teams_with_local_links": sum(bool(v["local_articles"]) for v in team_status.values()),
                       "queries_ok": ok, "queries_failed": len(jobs) - ok,
                       "resolution_failures": failed_resolution,
                       "sources": sorted(status, key=lambda x: (int(x["team_id"]), x["type"]))}}
    DEST.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in data["health"].items() if k != "sources"}))
    return data

if __name__ == "__main__":
    rebuild()
