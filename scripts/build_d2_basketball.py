#!/usr/bin/env python3
"""Build separate NCAA Division II men/women newspaper datasets from NCAA game feeds.
This collector does not invent membership, location, conference, color or player details.
Old Casablanca endpoints were retired for basketball; use NCAA GraphQL with API fallback.
"""
import argparse
import copy
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import unicodedata
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data"
HASH="7287cda610a9326931931080cb3a604828febe6fe3c9016a7e4a36db99efdb7c"
try:
    from scripts.d2_elo_chronology import game_sort_key
except ModuleNotFoundError:  # direct python scripts/<name>.py invocation
    from d2_elo_chronology import game_sort_key

SEASON="2026-27"
USER_AGENT="SportingLifeTimes/1.0 (+https://github.com/jbryancoburn-netizen/sporting-life-times)"
def get_json(url):
    req=urllib.request.Request(url,headers={"User-Agent":USER_AGENT,"Accept":"application/json"})
    with urllib.request.urlopen(req,timeout=18) as response:
        return json.load(response)
def fetch_day(gender, day):
    """Union the available NCAA and DII-only secondary scoreboards by date.

    IMPORTANT: A nonempty NCAA response can still be PARTIAL. The former
    first-nonempty-source rule silently discarded other fixtures on that day.
    ESPN group=51 is consulted only as an *additional* candidate source:
    both opponents must still resolve uniquely to the DII team registry,
    and the game ledger deduplicates same-day canonical matchups.
    """
    sport="MBB" if gender=="men" else "WBB"
    date=day.strftime("%Y/%m/%d")
    params={"sportCode":sport,"division":2,"seasonYear":day.year+(1 if day.month>=7 else 0),"contestDate":date}
    qs=urllib.parse.urlencode({"extensions":json.dumps({"persistedQuery":{"version":1,"sha256Hash":HASH}},separators=(',',':')),
        "variables":json.dumps(params,separators=(',',':'))})
    game_sport="mens-college-basketball" if gender=="men" else "womens-college-basketball"
    espn_url=(f"https://site.api.espn.com/apis/site/v2/sports/basketball/{game_sport}/scoreboard?"
              +urllib.parse.urlencode({"groups":51,"limit":1000,"dates":day.strftime("%Y%m%d")}))
    sources=[
        ("NCAA official GraphQL","https://sdataprod.ncaa.com/?"+qs),
        ("NCAA open scoreboard mirror","https://ncaa-api.henrygd.me/scoreboard/basketball-"+gender+"/d2/"+date),
        ("ESPN Division II scoreboard",espn_url)]
    errors=[];empty_source=None;collected=[];providers=[]
    for source,url in sources:
        try:
            raw=get_json(url)
            if not isinstance(raw,dict) or raw.get("errors"):
                raise ValueError(f"{source}: invalid or error response")
            if source=="NCAA official GraphQL":
                contests=raw.get("data",{}).get("contests")
                if not isinstance(contests,list):raise ValueError("Missing NCAA contests")
                records=[normalise_contest(c,date,gender) for c in contests]
            elif source=="NCAA open scoreboard mirror":
                contests=raw.get("games")
                if not isinstance(contests,list):raise ValueError("Missing NCAA mirror games")
                records=[normalise_legacy(g.get("game",g),date,gender) for g in contests]
            else:
                contests=raw.get("events")
                if not isinstance(contests,list):raise ValueError("Missing ESPN events")
                records=[normalise_espn_game(g,date,gender) for g in contests]
            records=[item for item in records if item]
            if records:
                for game,away,home in records:
                    game["source_provider"]=source
                    game["source"]=("ESPN DII scoreboard (canonical DII opponents)"
                                    if source=="ESPN Division II scoreboard"
                                    else "NCAA scoreboard")
                    collected.append((game,away,home))
                providers.append(source)
            else:
                empty_source=empty_source or source
        except Exception as exc:
            errors.append(str(exc)[:180])
    if collected:
        # The caller's canonical date/team identity guard merges repeated
        # provider events. Keep the NCAA sources first for source provenance.
        return collected," + ".join(providers)
    if empty_source:
        return [],empty_source+" (no games)"
    raise RuntimeError(f"{gender} {date}: all sources failed: {errors[:3]}")

def display_et_time(raw):
    """Render published absolute timestamps in US Eastern, including DST."""
    value=str(raw or "").strip()
    if len(value)>=19 and value[4]=="-" and value[7]=="-" and value[10]=="T":
        try:
            when=dt.datetime.fromisoformat(value.replace("Z","+00:00"))
            if when.tzinfo is not None:
                return when.astimezone(ZoneInfo("America/New_York")).strftime("%I:%M %p").lstrip("0")+" ET"
        except ValueError:
            pass
    return value


def enrich_published_details_from_espn(records, url, gender, date):
    """Use ESPN DII only as a secondary metadata source, never identity authority.

    Match the exact date and both normalized team names, not event order or a
    fuzzy score. This retains the NCAA game ID, original source and results.
    """
    try:
        data=get_json(url)
        if not isinstance(data,dict) or not isinstance(data.get("events"),list):
            return records
        secondary=[normalise_espn_game(x,date,gender) for x in data["events"]]
        lookup={}
        ambiguous=set()
        for item in secondary:
            if not item:
                continue
            game,away,home=item
            key=(game["date"],frozenset((normalize_school_name(away["name"]),
                                         normalize_school_name(home["name"]))))
            if len(key[1])!=2 or not all(key[1]):
                continue
            if key in lookup:ambiguous.add(key)
            else:lookup[key]=game
        for current,a,h in records:
            key=(current["date"],frozenset((normalize_school_name(a["name"]),
                                            normalize_school_name(h["name"]))))
            if key in ambiguous or key not in lookup:
                continue
            other=lookup[key]
            if not current.get("network") and other.get("network"):
                current["network"]=other["network"]
                current["broadcast_source_url"]=other.get("source_url") or url
            if not current.get("start_time") and other.get("start_time"):
                current["start_time"]=other["start_time"]
    except (OSError,ValueError,TypeError,KeyError):
        # NCAA data stays publishable if ESPN's optional secondary feed fails.
        pass
    return records


def normalise_espn_game(event,date,gender):
    """Parse site-v2 ESPN scoreboard event; verify DII status on canonical match."""
    competitions=event.get("competitions") or []
    if not competitions:return None
    comp=competitions[0]
    competitors=comp.get("competitors") or []
    away=next((x for x in competitors if x.get("homeAway")=="away"),None)
    home=next((x for x in competitors if x.get("homeAway")=="home"),None)
    if not away or not home:return None
    def institution(row):
        provider=row.get("team") or {}
        n=provider.get("location") or provider.get("shortDisplayName") or ""
        return {"id":slug(n),"name":n,"slug":"","d2_confirmed":False,
                "source":"ESPN Division II scoreboard"}
    def score(row):
        raw=row.get("score")
        return raw.get("value",raw.get("displayValue")) if isinstance(raw,dict) else raw
    status=((event.get("status") or {}).get("type") or {})
    state=str(status.get("state") or "").lower()
    if status.get("completed") is True or state=="post":
        game_state="final"
    elif state=="in":
        game_state="live"
    else:
        game_state="scheduled"
    key=str(event.get("id") or "")
    link=(event.get("links") or [{}])
    url=link[0].get("href","") if link and isinstance(link[0],dict) else ""
    if not url and key.isdigit():
        url=f"https://www.espn.com/{'mens' if gender=='men' else 'womens'}-college-basketball/game/_/gameId/{key}"
    normalized={"id":"espn-d2-"+key,"url":url,"startTime":event.get("date") or "",
                "neutralSite":comp.get("neutralSite") is True,
                "network":",".join(x.get("names",[""])[0] for x in comp.get("broadcasts",[])
                                   if x.get("names"))}
    item=game_record(normalized,institution(away),institution(home),date,game_state,
                     score(away),score(home),False,False,gender)
    if item:
        item[0]["source"]="ESPN Division II scoreboard"
        item[0]["provider_game_id"]=key
    return item

def slug(value):
    return re.sub(r"[^a-z0-9]+","-",str(value or "").lower()).strip("-")
def school(record):
    names=record.get("names") or {}
    name=record.get("nameShort") or names.get("full") or names.get("short") or record.get("name") or ""
    ident=record.get("seoname") or names.get("seo") or record.get("teamId") or slug(name)
    conf=record.get("conferences") or []
    conference=(conf[0].get("conferenceName") if conf and isinstance(conf[0],dict) else "") or ""
    div=record.get("division") or record.get("divisionCode") or record.get("teamDivision")
    return {"id":slug(ident),"name":name,"slug":slug(record.get("seoname") or names.get("seo") or ident),
        "conference":conference,"d2_confirmed":str(div).lower() in ("2","ii","d2"),"source":"NCAA game scoreboard"}
def normalise_contest(c,date,gender):
    teams=c.get("teams") or []
    home=next((t for t in teams if t.get("isHome") is True),None)
    away=next((t for t in teams if t.get("isHome") is False),None)
    if not home or not away:return None
    aa,hh=school(away),school(home)
    status={"F":"final","I":"live","P":"scheduled"}.get(str(c.get("gameState") or "").upper(),"scheduled")
    return game_record(c,aa,hh,date,status,away.get("score"),home.get("score"),bool(away.get("isWinner")),bool(home.get("isWinner")),gender)
def normalise_legacy(c,date,gender):
    away,home=c.get("away") or {},c.get("home") or {}
    if not away or not home:return None
    status={"final":"final","live":"live","pre":"scheduled"}.get(str(c.get("gameState") or "").lower(),"scheduled")
    return game_record(c,school(away),school(home),date,status,away.get("score"),home.get("score"),bool(away.get("winner")),bool(home.get("winner")),gender)
def game_record(c,away,home,date,status,away_score,home_score,away_win,home_win,gender):
    if not away["name"] or not home["name"]:return None
    key=str(c.get("contestId") or c.get("gameID") or c.get("id") or f'{date}-{away["id"]}-{home["id"]}')
    try: away_score=int(away_score)
    except (ValueError,TypeError):away_score=None
    try: home_score=int(home_score)
    except (ValueError,TypeError):home_score=None
    if status=="final" and (away_score is None or home_score is None or away_score==home_score):
        status="unverified"
    url=c.get("url") or ""
    if url and url.startswith("/"):url="https://www.ncaa.com"+url
    if not url and key.isdigit():url="https://www.ncaa.com/game/"+key
    eligible=away["d2_confirmed"] and home["d2_confirmed"]
    game={"id":key,"date":date.replace("/","-"),"away":away["id"],"home":home["id"],
        "away_score":away_score,"home_score":home_score,"status":status,"start_time":display_et_time(c.get("startTime")),
        "network":c.get("broadcasterName") or c.get("network") or "",
        "source_url":url,"venue":"","neutral":any(c.get(k) is True for k in ("neutralSite","isNeutralSite","isNeutral")),"elo_eligible":eligible}
    return game,away,home

def seed_directory(gender):
    """Public 2026-27 name/conference facts, independent of NCAA scoreboard game availability.
    The NCAA sport-by-sport directory remains the certification authority.
    """
    from bs4 import BeautifulSoup
    urls={
        "men":"https://en.wikipedia.org/wiki/List_of_NCAA_Division_II_men%27s_basketball_programs",
        "women":"https://www.ncaawomensbasketball.com/blog/d2-womens-basketball-schools-by-state",
    }
    url=urls[gender]
    req=urllib.request.Request(url,headers={"User-Agent":USER_AGENT,"Accept":"text/html"})
    with urllib.request.urlopen(req,timeout=24) as response:
        soup=BeautifulSoup(response.read(),"html.parser")
    entries=[]
    for table in soup.select("table"):
        headings=" ".join(t.get_text(" ",strip=True) for t in table.select("tr:first-child th")).lower()
        if gender=="men":
            if not ("team" in headings and "conference" in headings and "city" in headings):
                continue
        else:
            if not ("school" in headings and "conference" in headings and "city" in headings):
                continue
        for tr in table.select("tr"):
            cells=tr.find_all(["th","td"],recursive=False)
            if len(cells)<4 or cells[0].name!="td":continue
            values=[c.get_text(" ",strip=True) for c in cells[:4]]
            if gender=="men":
                name,city,conference=values[0],values[1],values[3]
            else:
                name,city,conference=values[1],values[2],values[3]
            if not name or name.lower() in ("school","team"):continue
            # The membership is a preliminary published roster, not confirmation
            # that all programs are championship eligible.
            entries.append({"id":slug(name),"slug":"","name":name,"city":city,
                            "conference":conference,"d2_confirmed":True,
                            "source":url})
    unique={e["id"]:e for e in entries}
    if len(unique)<250 or len(unique)>310:
        raise RuntimeError(f"Unsafe {gender} directory extraction: {len(unique)} programs from {url}")
    return unique, url


def normalize_school_name(value):
    """Conservative NCAA school-index match: never choose a fuzzy nearest neighbor."""
    value=unicodedata.normalize("NFKD",str(value or "")).encode("ascii","ignore").decode("ascii").lower()
    value=value.replace("&"," and ")
    value=re.sub(r"\b(university|college|of|at|the)\b"," ",value)
    return re.sub(r"[^a-z0-9]","",value)

def seed_official_logos(teams):
    """Match NCAA's authoritative school names to its own SVG logo slugs.

    Ambiguous or absent names remain initials, NEVER another program's logo.
    Both men's and women's editions use the same NCAA school slug for the same
    institution, rather than maintaining different team-specific images.
    """
    sources=["https://www.ncaa.com/json/schools","https://ncaa-api.henrygd.me/schools-index"]
    schools=None;used=None;errors=[]
    for url in sources:
        try:
            candidate=get_json(url)
            if isinstance(candidate,dict):
                candidate=candidate.get("schools") or candidate.get("data")
            if not isinstance(candidate,list) or len(candidate)<800:
                raise ValueError("NCAA school index incomplete or wrong schema")
            schools=candidate;used=url;break
        except Exception as exc:
            errors.append(str(exc)[:180])
    if schools is None:
        return {"matched":sum(bool(t.get("slug")) for t in teams.values()),
                "index_source":None,"error":"NCAA school index unavailable; existing images preserved"}
    by_name={}
    for item in schools:
        slug_value=item.get("slug")
        if not isinstance(slug_value,str) or not re.fullmatch(r"[a-z0-9-]+",slug_value):
            continue
        for label in (item.get("name"),item.get("long_name"),item.get("long")):
            name=normalize_school_name(label)
            if name and len(name)>=5:
                by_name.setdefault(name,set()).add(slug_value)
    matched=0;ambiguous=0
    for t in teams.values():
        if t.get("slug") and t.get("logo_source")=="NCAA schools index":
            matched+=1;continue
        identity=normalize_school_name(t.get("name",""))
        slugs=by_name.get(identity,set())
        if len(slugs)==1:
            t["slug"]=next(iter(slugs))
            t["logo_source"]="NCAA schools index"
            matched+=1
        elif len(slugs)>1:
            ambiguous+=1
    return {"matched":matched,"unmatched":len(teams)-matched,
            "ambiguous":ambiguous,"index_source":used}


def seed_cross_gender_logos(gender,teams):
    """Share the same NCAA institution's SVG, even across published name styles.

    Requires a UNIQUE DII program in the same city in the other-gender
    registry, and an independently matching distinctive school-name token.
    Never borrow an emblem from a different school in a multi-school city.
    """
    counterpart="women" if gender=="men" else "men"
    file=DATA/f"d2-{counterpart}-2026-27.json"
    if not file.exists():return {"added":0,"status":"counterpart unavailable"}
    other=json.loads(file.read_text()).get("teams",[])
    by_city={}
    for t in other:
        city=normalize_school_name(t.get("city"))
        if city:by_city.setdefault(city,[]).append(t)

    def school_tokens(value):
        plain=unicodedata.normalize("NFKD",str(value or "")).encode("ascii","ignore").decode("ascii").lower()
        bits=re.findall(r"[a-z0-9]+",plain)
        common={"university","college","state","school","north","south",
                "eastern","western","northern","southern","the","and",
                "saint","pennsylvania","georgia","california","texas"}
        return {v for v in bits if len(v)>=4 and v not in common}

    added=0
    for t in teams.values():
        if t.get("slug"):continue
        city=normalize_school_name(t.get("city"))
        alternatives=by_city.get(city,[]) if city else []
        if len(alternatives)!=1:continue
        candidate=alternatives[0]
        if not candidate.get("slug") or "NCAA schools index" not in candidate.get("logo_source",""):
            continue
        left=normalize_school_name(t.get("name"))
        right=normalize_school_name(candidate.get("name"))
        overlapping=school_tokens(t.get("name")) & school_tokens(candidate.get("name"))
        same_name=(len(left)>=6 and len(right)>=6 and (left in right or right in left))
        if not same_name and not overlapping:continue
        t["slug"]=candidate["slug"]
        t["logo_source"]="NCAA schools index via uniquely matched DII institution, city and school name"
        added+=1
    return {"added":added,"method":"unique same-city school with matching distinctive institutional name"}

def nonwhite_color(value):
    """Valid, visible hexadecimal palette color; pure/near-white is not a ring."""
    value=str(value or "").strip().lstrip("#")
    if not re.fullmatch(r"[a-fA-F0-9]{6}",value):
        return None
    rgb=[int(value[i:i+2],16) for i in (0,2,4)]
    if min(rgb)>231:
        return None
    return "#"+value.lower()

def tonal_accent(primary):
    """Editorial darker/lighter accent if ESPN reports white-only secondary.

    This color is NEVER described as an official school secondary.
    """
    rgb=[int(primary[i:i+2],16) for i in (1,3,5)]
    bright=sum(rgb)/3
    if bright<110:
        new=[int(x*0.6+255*0.4) for x in rgb]
    else:
        new=[int(x*0.66) for x in rgb]
    return "#"+"".join(f"{max(0,min(255,x)):02x}" for x in new)

def espn_team_entries(payload):
    """Extract published team objects from ESPN's public site-v2 teams list."""
    if not isinstance(payload,dict):
        return []
    sports=payload.get("sports") or []
    for sport in sports:
        for league in sport.get("leagues",[]):
            teams=league.get("teams") or []
            if isinstance(teams,list):
                return [x.get("team",x) for x in teams if isinstance(x,dict)]
    # Allows locally supplied snapshots with the same nested team shapes.
    return [x.get("team",x) for x in payload.get("teams",[]) if isinstance(x,dict)]

def seed_espn_dii_branding(gender,teams):
    """Only import colors after strict ESPN Division II institutional matching.

    Men and women are separate ESPN leagues; only group=51 (DII) is queried.
    Unmatched/ambiguous schools keep neutral logos instead of false colors.
    """
    sport="mens-college-basketball" if gender=="men" else "womens-college-basketball"
    url=f"https://site.api.espn.com/apis/site/v2/sports/basketball/{sport}/teams?group=51&limit=1000"
    try:
        entries=espn_team_entries(get_json(url))
        if not 25<=len(entries)<=330:
            raise ValueError(f"ESPN DII team-list data unverified ({len(entries)} teams); rejecting mismatched division")
    except Exception as exc:
        return {"matched":sum(bool(t.get("primary") and t.get("secondary")) for t in teams.values()),
                "directory_teams":0,"source":url,"error":str(exc)[:200]}
    registry={}
    for key,team in teams.items():
        for label in (team.get("name",""),):
            normalized=normalize_school_name(label)
            if normalized:registry.setdefault(normalized,set()).add(key)
    matches=0;ambiguous=0;editorial=0;two_school_colors=0
    for provider in entries:
        # ESPN 'name' is usually mascot; 'location' is the school name.
        names=(provider.get("location",""),provider.get("shortDisplayName",""))
        keys={k for label in names for k in registry.get(normalize_school_name(label),set())
              if normalize_school_name(label)}
        if len(keys)!=1:
            if len(keys)>1:ambiguous+=1
            continue
        school_id=next(iter(keys))
        existing=teams[school_id]
        primary=nonwhite_color(provider.get("color"))
        second=nonwhite_color(provider.get("alternateColor"))
        if not primary:continue
        if not second or second.lower()==primary.lower():
            second=tonal_accent(primary)
            nature="ESPN primary plus editorial nonwhite tonal accent"
            editorial+=1
        else:
            nature="ESPN-published primary and secondary team colors"
            two_school_colors+=1
        # Never replace a previously published verified institutional palette
        # with an untrusted heuristic or an accidental ESPN short-name collision.
        existing.update({"primary":primary,"secondary":second,
                         "espn_id":str(provider.get("id","")),
                         "color_source":url,
                         "color_provenance":nature})
        matches+=1
    return {"matched":matches,"official_secondary":two_school_colors,
            "editorial_tonal_secondary":editorial,
            "directory_teams":len(entries),"ambiguous":ambiguous,
            "source":url}

def seed_shared_dii_colors(gender,teams):
    """Same NCAA school logo identity means reusable institutional colors.

    The two genders share school colors, never schedules, ratings or rosters.
    """
    other="women" if gender=="men" else "men"
    path=DATA/f"d2-{other}-2026-27.json"
    if not path.exists():return {"added":0}
    found=json.loads(path.read_text()).get("teams",[])
    by_slug={}
    for t in found:
        key=t.get("slug")
        if key and t.get("primary") and t.get("secondary"):
            by_slug.setdefault(key,[]).append(t)
    count=0
    for t in teams.values():
        if t.get("primary") and t.get("secondary"):continue
        matches=by_slug.get(t.get("slug"),[])
        if len(matches)!=1:continue
        source=matches[0]
        if not nonwhite_color(source["primary"]) or not nonwhite_color(source["secondary"]):continue
        t["primary"]=source["primary"];t["secondary"]=source["secondary"]
        t["color_source"]=source.get("color_source","")
        t["color_provenance"]=source.get("color_provenance","") + " (shared institutional palette across genders)"
        count+=1
    return {"added":count,"method":"unique matching NCAA school logo slug"}

def extract_logo_artwork_colors(svg):
    """Sample actual NCAA vector logo ink, never make up a school identity.

    These are editorial *logo-derived* colors, not certified brand standards.
    A white/transparent SVG background is never used as a site ring.
    """
    from collections import Counter
    raw=str(svg or "")
    if "<svg" not in raw[:1200].lower():return None
    colors=[]
    for match in re.findall(r"#[0-9a-fA-F]{6}(?![0-9a-fA-F])|#[0-9a-fA-F]{3}(?![0-9a-fA-F])",raw):
        v=match.lower()
        if len(v)==4:v="#"+''.join(x*2 for x in v[1:])
        c=nonwhite_color(v)
        if c:colors.append(c)
    if not colors:return None
    freq=Counter(colors)
    def rgb(c):return [int(c[i:i+2],16) for i in (1,3,5)]
    def chroma(c):
        components=rgb(c)
        return max(components)-min(components)
    # Skip monochrome-only art rather than applying generic black rings.
    colorful=[c for c in freq if chroma(c)>=28]
    if not colorful:return None
    primary=max(colorful,key=lambda c:(freq[c],chroma(c)))
    pool=[c for c in freq if c!=primary and
          sum(abs(a-b) for a,b in zip(rgb(c),rgb(primary)))>=110]
    if pool:
        secondary=max(pool,key=lambda c:(freq[c],chroma(c)))
        kind="NCAA SVG artwork two distinct sampled colors"
    else:
        secondary=tonal_accent(primary)
        kind="NCAA SVG artwork primary plus editorial tonal accent"
    return {"primary":primary,"secondary":secondary,"provenance":kind}

def get_logo_svg(slug_value):
    url="https://ncaa-api.henrygd.me/logo/"+urllib.parse.quote(slug_value,safe="")+".svg"
    req=urllib.request.Request(url,headers={"User-Agent":USER_AGENT,"Accept":"image/svg+xml"})
    with urllib.request.urlopen(req,timeout=12) as response:
        raw=response.read(2_500_000)
    return raw.decode("utf-8","replace")

def seed_logo_artwork_palette(teams):
    """One SVG per NCAA school, with disk cache shared between both sexes."""
    cache_path=DATA/"d2-logo-artwork-palette-2026.json"
    if cache_path.exists():
        try:
            cache=json.loads(cache_path.read_text())
            if cache.get("schema")!=1:cache={"schema":1,"teams":{}}
        except (OSError,ValueError):cache={"schema":1,"teams":{}}
    else:cache={"schema":1,"teams":{}}
    known=cache.setdefault("teams",{})
    slugs={t.get("slug") for t in teams.values() if re.fullmatch(r"[a-z0-9-]+",str(t.get("slug") or ""))}
    needed=sorted(s for s in slugs if s not in known)
    found=0;failures=0
    def recover(slug_value):
        try:
            palette=extract_logo_artwork_colors(get_logo_svg(slug_value))
            return slug_value,palette
        except Exception:
            return slug_value,None
    if needed:
        with ThreadPoolExecutor(max_workers=6) as pool:
            tasks=[pool.submit(recover,key) for key in needed]
            for future in as_completed(tasks):
                key,palette=future.result()
                if palette:
                    known[key]=palette
                    found+=1
                else:failures+=1
    if needed:
        tmp=cache_path.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(cache,separators=(',',':'))+"\n")
        tmp.replace(cache_path)
    matched=0;derived=0
    for t in teams.values():
        palette=known.get(t.get("slug")) if t.get("slug") else None
        if not palette:continue
        if "teamcolorcodes.com" in t.get("color_source",""):continue
        # The institutional SVG acts as the proof of color identity.
        t["primary"]=palette["primary"];t["secondary"]=palette["secondary"]
        t["color_source"]="https://ncaa-api.henrygd.me/logo/"+t["slug"]+".svg"
        t["color_provenance"]=palette["provenance"]
        matched+=1
        if "editorial" in palette["provenance"]:derived+=1
    return {"matched":matched,"with_editorial_tonal_accent":derived,
            "cached_school_logos":len(known),"new_palette_matches":found,
            "failed_or_monochrome":failures,
            "source":"NCAA team SVG artwork; colors are logo-derived, NOT official brand standard"}

def seed_published_dii_palettes(gender,teams):
    """Apply institution-specific published DII team colors with source URLs."""
    path=DATA/"d2-school-color-evidence-2026.json"
    if not path.exists():return {"matched":0,"status":"source registry missing"}
    evidence=json.loads(path.read_text())
    matched=0;tonal=0
    for item in evidence.get("entries",[]):
        ident=item.get("gender_ids",{}).get(gender)
        if not ident or ident not in teams:continue
        primary=nonwhite_color(item.get("primary"))
        second=nonwhite_color(item.get("secondary"))
        if not primary:continue
        if item.get("secondary_kind")=="white_replaced_with_tonal":
            second=tonal_accent(primary);tonal+=1
            provenance="published primary; editorial nonwhite tonal accent (official secondary white)"
        elif second and second!=primary:
            provenance="independently published two-color school palette"
        else:continue
        teams[ident].update({"primary":primary,"secondary":second,
            "color_source":item["source_url"],"color_provenance":provenance})
        matched+=1
    return {"matched":matched,"tonal_accents":tonal,"source":"school-specific documented colors"}

def seed_logo_artwork_palettes(teams):
    """Use only color pixels recorded in the exact NCAA school-logo SVG.

    Official institutional team-color evidence always takes precedence.
    The file is an auditable candidate scan of NCAA logo artwork, not a
    university brand-guide certification. No guessed logos or colors.
    """
    path=DATA/"d2-ncaa-logo-artwork-palette-audit.json"
    if not path.exists():
        return {"matched":0,"status":"Official NCAA SVG evidence scan not yet published"}
    source=json.loads(path.read_text())
    if not source.get("kind","").startswith("candidates only"):
        return {"matched":0,"status":"Rejected non-audited palette file"}
    entries=source.get("entries",{})
    added=0;rejected=0;chromatic=0
    def rgb(color):
        return tuple(int(color[i:i+2],16) for i in (1,3,5))
    def lively(color):
        r,g,b=rgb(color)
        return max(r,g,b)-min(r,g,b)>=35
    def distance(a,b):
        return sum((x-y)**2 for x,y in zip(rgb(a),rgb(b)))**0.5
    for t in teams.values():
        if t.get("primary") or t.get("secondary") or not t.get("slug"):
            continue
        record=entries.get(t["slug"],{})
        if "primary" not in record or "secondary" not in record:
            continue
        if "/logos/schools/bgl/"+t["slug"]+".svg" not in record.get("source_url",""):
            rejected+=1;continue
        # Require two visually distinct vector artwork colors and at least
        # one chromatic paint. Pure monochrome badges retain neutral rings.
        shades=[color for color,_ in record.get("top_colors",[])
                if nonwhite_color(color)]
        vivid=[color for color in shades if lively(color)]
        if not vivid:
            rejected+=1;continue
        first=vivid[0]
        second=next((v for v in vivid[1:] if distance(first,v)>=55),None)
        if not second:
            second=next((v for v in shades if distance(first,v)>=55),None)
        if not second:
            rejected+=1;continue
        t["primary"]=first;t["secondary"]=second
        t["color_source"]=record["source_url"]
        t["color_provenance"]="NCAA vector LOGO artwork colors (not independently certified school brand colors)"
        t["color_basis"]="artwork-derived"
        added+=1
        if lively(second):chromatic+=1
    return {"matched":added,"two_chromatic_artwork_colors":chromatic,
            "rejected_unclear_artwork":rejected,"source":"exact NCAA school logo SVG artwork audit",
            "not_university_brand_colors":True}

def apply_membership_notes(gender,teams):
    """Never upgrade prospective conference members into certified DII schools."""
    path=DATA/"d2-membership-notes-2026-27.json"
    if not path.exists():return {"annotated":0,"excluded_from_dii_elo":0}
    notes=json.loads(path.read_text()).get(gender,{})
    annotated=0;excluded=0
    for ident,record in notes.items():
        t=teams.get(ident)
        if t is None:continue
        t["membership_status"]=record["status"]
        t["membership_source"]=record["source"]
        t["membership_note"]=record["note"]
        t["not_eligible_for_dii_elo"]=bool(record.get("not_eligible_for_dii_elo",False))
        if t["not_eligible_for_dii_elo"]:
            t["d2_confirmed"]=False
            excluded+=1
        annotated+=1
    return {"annotated":annotated,"excluded_from_dii_elo":excluded,
            "membership_source":"Official athletics, conference and NCAA announcements"}

def build_dii_team_lookup(teams):
    """Build a unique, conservative identity map for official NCAA contests."""
    by_slug={};by_name={}
    for ident,t in teams.items():
        if t.get("not_eligible_for_dii_elo"):continue
        slug_value=t.get("slug")
        if slug_value:by_slug.setdefault(slug_value,set()).add(ident)
        names=[t.get("name",""),ident]
        for label in names:
            normalized=normalize_school_name(label)
            if normalized:by_name.setdefault(normalized,set()).add(ident)
    return by_slug,by_name

def resolve_dii_team_id(source_team,lookup):
    """Return a canonical directory ID only when NCAA identity is unambiguous."""
    by_slug,by_name=lookup
    candidate=source_team.get("slug")
    if candidate:
        result=by_slug.get(candidate,set())
        if len(result)==1:return next(iter(result))
        if len(result)>1:return None
    # The official source may report shorter names; exact normalized names
    # are permitted only if exactly one registry entry matches.
    for label in (source_team.get("name"),source_team.get("id")):
        norm=normalize_school_name(label)
        result=by_name.get(norm,set()) if norm else set()
        if len(result)==1:return next(iter(result))
        if len(result)>1:return None
    return None

def merge_ncaa_contest(games,contest,away_id,home_id):
    """Merge NCAA events without double-counting organizer-confirmed games."""
    new={**contest,"away":away_id,"home":home_id,"elo_eligible":True,
         "verified":contest["status"]=="final","source":contest.get("source","NCAA scoreboard")}
    key=(new["date"],tuple(sorted((away_id,home_id))))
    match=None
    for existing_id,old in games.items():
        old_key=(old.get("date"),tuple(sorted((old.get("away"),old.get("home")))))
        if old_key==key:
            match=existing_id;break
    if match is None:
        games[new["id"]]=new
        return "added"
    old=games[match]
    if old.get("status")=="final" and new["status"]!="final":
        return "kept_verified_final"
    provider_key=("espn_id" if contest.get("source_provider")=="ESPN Division II scoreboard"
                  else "ncaa_id")
    if old.get("status")=="final" and new["status"]=="final":
        if ({old.get("away"):old.get("away_score"),old.get("home"):old.get("home_score")} ==
            {away_id:new.get("away_score"),home_id:new.get("home_score")}):
            old[provider_key]=new["id"]
            return "confirmed_duplicate"
        # Conflicts must be investigated rather than silently flipping scores.
        return "score_conflict"
    # An official update must not erase verified broadcast or start metadata.
    if new.get("start_time") and not old.get("start_time"):
        old["start_time"]=new["start_time"]
    if new.get("broadcast_source_url") and not old.get("broadcast_source_url"):
        old["broadcast_source_url"]=new["broadcast_source_url"]
    # Preserve official neutral-site venue, listing order, and provenance.
    old.update({"status":new["status"],"away_score":new["away_score"] if old["away"]==away_id else new["home_score"],
                "home_score":new["home_score"] if old["home"]==home_id else new["away_score"],
                "elo_eligible":True,"verified":bool(old.get("verified")) or new["verified"]})
    old[provider_key]=new["id"]
    if new.get("network") and not old.get("network"):
        old["network"]=new["network"]
        old["broadcast_source_url"]=new.get("source_url") or ""
    if new.get("neutral"):
        old["neutral"]=True
    return "updated"

def apply_official_tipoff_streams(gender, games, teams, as_of_date):
    """Apply named-school, date-exact CWU game streams without altering scores/IDs.

    Uses the university's complete event central and its individual GNAC
    Network WATCH links. No blanket GNAC mapping to unrelated games.
    """
    p=DATA/"d2-cwu-official-tipoff-streams-2026.json"
    if not p.exists():
        return {"verified":0,"updated":0,"new_fixtures":0,"unmatched_past":0}
    source=json.loads(p.read_text())
    seen=set()
    stats={"verified":0,"updated":0,"new_fixtures":0,"unmatched_past":0}
    for fixture in source.get("games",[]):
        if fixture["gender"]!=gender:continue
        away,home=fixture["away"],fixture["home"]
        if away not in teams or home not in teams:
            raise RuntimeError("CWU tournament identity missing from DII registry: "+away+" vs "+home)
        day=fixture["date"]
        key=(day,frozenset((away,home)))
        if key in seen:
            raise RuntimeError("CWU tournament duplicated: "+str(key))
        seen.add(key)
        candidates=[g for g in games.values()
                    if g.get("date")==day and frozenset((g.get("away"),g.get("home")))==key[1]]
        if len(candidates)>1:
            raise RuntimeError("Multiple DII records for official CWU game: "+str(key))
        verified_final=fixture.get("verified_final")
        if verified_final:
            scores=(verified_final.get("away_score"),verified_final.get("home_score"))
            if not all(isinstance(v,int) and not isinstance(v,bool) and v>=0 for v in scores) or scores[0]==scores[1]:
                raise RuntimeError("Invalid official CWU final: "+str(key))
            if not str(verified_final.get("source_url","")).startswith("https://"):
                raise RuntimeError("CWU final missing official source: "+str(key))
        if candidates:
            target=candidates[0]
            stats["updated"]+=1
        else:
            if day<as_of_date.isoformat() and not verified_final:
                # No fictional past results: only a school-verified final may
                # create an earlier fixture after the NCAA feed misses it.
                stats["unmatched_past"]+=1
                continue
            ident="cwud2-2026-"+gender+"-"+day+"-"+away+"-"+home
            target={"id":ident,"date":day,"away":away,"home":home,
                    "away_score":None,"home_score":None,"status":"scheduled",
                    "elo_eligible":True,"verified":True,"neutral":fixture["neutral"],
                    "source":"Central Washington official tournament schedule",
                    "source_url":source["source_url"],"tournament":source["event"]}
            games[ident]=target
            stats["new_fixtures"]+=1
        if verified_final:
            score_by_team={away:scores[0],home:scores[1]}
            expected=(score_by_team[target["away"]],score_by_team[target["home"]])
            if target.get("status")=="final":
                observed=(target.get("away_score"),target.get("home_score"))
                if observed!=expected:
                    raise RuntimeError("Conflicting verified CWU final: "+str(key))
            else:
                target.update({"status":"final","away_score":expected[0],
                    "home_score":expected[1],"verified":True,"elo_eligible":True,
                    "source":"Central Washington official tournament final",
                    "source_url":verified_final["source_url"]})
        local=dt.datetime.fromisoformat(day+"T"+fixture["tipoff_local"])
        local=local.replace(tzinfo=ZoneInfo(source["time_zone"]))
        target["start_time"]=local.astimezone(ZoneInfo("America/New_York")).strftime("%I:%M %p").lstrip("0")+" ET"
        target["network"]=fixture["network"]
        target["broadcast_type"]=fixture["broadcast_type"]
        target["stream_url"]=fixture["stream_url"]
        target["broadcast_source_url"]=source["source_url"]
        target["venue"]=source["venue"]
        # Do not overwrite the home/away flag of a verified NCAA match.
        if "neutral" not in target:
            target["neutral"]=fixture["neutral"]
        stats["verified"]+=1
    return stats


def apply_verified_schedule_broadcasts(gender, games, teams, today, registry_file=None, stream_host="https://www.gnacnetwork.com/"):
    """Attach school-documented WATCH URLs to exact DII matchups only.

    The official school schedule confirms the date, both teams, stream host
    and venue. Existing NCAA game IDs, results and source provenance survive.
    """
    path=registry_file or DATA/"d2-verified-broadcast-fixtures-2026-27.json"
    stats={"matched":0,"created":0,"skipped":0}
    if not path.exists():
        return stats
    registry=json.loads(path.read_text())
    seen=set()
    for fixture in registry.get("fixtures",[]):
        if fixture.get("gender")!=gender:
            continue
        a,h=fixture["away"],fixture["home"]
        key=(fixture["date"],frozenset((a,h)))
        if key in seen:
            raise RuntimeError("Duplicated school broadcast evidence: "+str(key))
        seen.add(key)
        if len(key[1])!=2 or any(v not in teams or teams[v].get("not_eligible_for_dii_elo") for v in (a,h)):
            raise RuntimeError("Broadcast fixture has invalid DII team identity: "+str(key))
        if not str(fixture.get("source_url","")).startswith("https://") or not str(fixture.get("stream_url","")).startswith(stream_host):
            raise RuntimeError("Broadcast fixture lacks auditable official source or approved WATCH URL")
        local=dt.datetime.fromisoformat(fixture["date"]+"T"+fixture["local"])
        if local.hour>23 or local.minute>59:
            raise RuntimeError("Invalid local tipoff in official broadcast source")
        tz=ZoneInfo(registry["timezone"])
        exact_tipoff=local.replace(tzinfo=tz).astimezone(ZoneInfo("America/New_York")).strftime("%I:%M %p").lstrip("0")+" ET"
        match=[g for g in games.values() if
               g.get("date")==fixture["date"] and
               frozenset((g.get("away"),g.get("home")))==key[1]]
        if len(match)>1:
            raise RuntimeError("Multiple game IDs for one verified school broadcast: "+str(key))
        if match:
            game=match[0]
            stats["matched"]+=1
            if game.get("network") and game["network"]!=fixture["network"]:
                raise RuntimeError("Conflicting broadcast providers for "+str(key))
        elif fixture["date"]>=today.isoformat():
            ident="d2official-"+gender+"-"+fixture["date"]+"-"+a+"-"+h
            if ident in games:
                raise RuntimeError("Official fixture ID collision: "+ident)
            game={"id":ident,"date":fixture["date"],"away":a,"home":h,
                  "status":"scheduled","away_score":None,"home_score":None,
                  "neutral":bool(fixture["neutral"]),"verified":True,
                  "elo_eligible":True,"source_url":fixture["source_url"],
                  "source":"Official university athletics schedule"}
            games[ident]=game
            stats["created"]+=1
        else:
            stats["skipped"]+=1
            continue
        game["start_time"]=exact_tipoff
        # The named official arena establishes whether either team has home
        # court. Correct the NCAA default when a tournament match is neutral.
        game["neutral"]=bool(fixture["neutral"])
        game["network"]=fixture["network"]
        game["broadcast_type"]=fixture.get("broadcast_type","Streaming")
        game["stream_url"]=fixture["stream_url"]
        game["broadcast_source_url"]=fixture["source_url"]
        if fixture.get("venue") and not game.get("venue"):
            game["venue"]=fixture["venue"]
    return stats


def mutable_ledger(prior):
    """Start a refresh with independent objects, never in-place views of prior.

    A score or venue update to an existing game must be detectable by the
    live no-change gate. Shallow copies are insufficient for nested evidence,
    source URL lists or any later game-stat additions.
    """
    teams={t["id"]:copy.deepcopy(t) for t in prior.get("teams",[])}
    games={str(g["id"]):copy.deepcopy(g) for g in prior.get("games",[])}
    return teams,games


def ledger_changed(prior,teams,games):
    """Do not conflate a reused object with an unchanged published ledger."""
    return prior.get("teams",[])!=teams or prior.get("games",[])!=games


def update(gender, bootstrap=False, live=False):
    output=DATA/f"d2-{gender}-2026-27.json"
    prior=json.loads(output.read_text()) if output.exists() else {}
    teams,games=mutable_ledger(prior)
    # Scoreboard polls happen twice an hour. Reusing the last certified
    # directory and logo palette prevents thousands of redundant school SVG,
    # conference and directory requests per game day. The daily run still
    # re-checks official membership, artwork, calendars and broadcast sources.
    rapid=bool(live and prior.get("teams") and prior.get("quality"))
    previous_quality=prior.get("quality") or {}
    directory_source=previous_quality.get("directory_source") if rapid else None
    directory_error=previous_quality.get("directory_error") if rapid else None
    if not rapid:
        try:
            discovered,directory_source=seed_directory(gender)
            # Do not throw away previously confirmed school-specific details.
            for ident,found in discovered.items():
                teams[ident]={**found,**teams.get(ident,{})}
        except Exception as exc:
            directory_error=str(exc)
            print(f"WARNING: {gender} directory not refreshed: {exc}",file=sys.stderr)
    # ESPN's team listing sometimes ignores DII and returns DI. Never carry
    # forward previously rejected colors even on the rapid no-scrape path.
    for team in teams.values():
        if "site.api.espn.com" in team.get("color_source","") and "group=51" in team.get("color_source",""):
            for field in ("primary","secondary","color_source","color_provenance","espn_id"):
                team.pop(field,None)
    membership_quality=apply_membership_notes(gender,teams)
    if rapid:
        color_quality=previous_quality.get("school_color_coverage") or {}
        logo_quality=previous_quality.get("official_logo_index") or {}
    else:
        color_quality=seed_espn_dii_branding(gender,teams)
        logo_quality=seed_official_logos(teams)
        paired_quality=seed_cross_gender_logos(gender,teams)
        color_quality['cross_gender']=seed_shared_dii_colors(gender,teams)
        color_quality['ncaa_logo_artwork']=seed_logo_artwork_palette(teams)
        color_quality['published_school_evidence']=seed_published_dii_palettes(gender,teams)
        color_quality['ncaa_svg_artwork_palette']=seed_logo_artwork_palettes(teams)
        color_quality['total_with_two_visible_colors']=sum(bool(t.get('primary') and t.get('secondary')) for t in teams.values())
        logo_quality["cross_gender"]=paired_quality
        logo_quality["matched"]=sum(bool(t.get("slug")) for t in teams.values())
        logo_quality["unmatched"]=len(teams)-logo_quality["matched"]
    # Each game is an independent copy of the persisted source record.
    # CCA-sanctioned Hawaii October tournament games were independently
    # verified against the tournament organizer's published score bracket.
    # They are neutral-site: the first/second teams are NOT home and away.
    tournament_path=DATA/"d2-verified-tournaments-2026-27.json"
    tournament=json.loads(tournament_path.read_text()) if tournament_path.exists() else {}
    tournament_source=tournament.get("source_url","")
    for fixture in tournament.get(gender,[]):
        if fixture["away"] not in teams or fixture["home"] not in teams:
            raise RuntimeError(f"{gender}: official event team not found in directory: {fixture['id']}")
        previous=games.get(fixture["id"])
        # Never roll a final backward to a scheduled game during an import.
        if previous and previous.get("status")=="final" and fixture["status"]!="final":continue
        games[fixture["id"]]={**fixture,"elo_eligible":True,"verified":True}

    # Independently corroborated early-season DII contests from official
    # university athletics recaps. Keep them separate from Hawaii and from
    # the NCAA scoreboard so every result has a traceable original source.
    extra_path=DATA/"d2-verified-other-openers-2026-27.json"
    extra=json.loads(extra_path.read_text()) if extra_path.exists() else {}
    for fixture in extra.get(gender,[]):
        if fixture["away"] not in teams or fixture["home"] not in teams:
            raise RuntimeError(f"{gender}: verified opener team missing from registry: {fixture['id']}")
        old_game=games.get(fixture["id"])
        if old_game and old_game.get("status")=="final" and fixture["status"]!="final":
            continue
        games[fixture["id"]]={**fixture,"elo_eligible":True,"verified":True}
    # Official 2026 Hoops in Hawaii Holiday Classic: DII women's fixtures.
    # December DIII showcases excluded; tournament home/away designation
    # remains neutral until host-school records clarify it.
    holiday_path=DATA/"d2-verified-holiday-2026-27.json"
    holiday=json.loads(holiday_path.read_text()) if holiday_path.exists() else {}
    holiday_source=holiday.get("source_url","")
    if gender=="women":
        for fixture in holiday.get("games",[]):
            if fixture["away"] not in teams or fixture["home"] not in teams:
                raise RuntimeError(f"Verified holiday game references unknown DII program: {fixture['id']}")
            old=games.get(fixture["id"],{})
            if old.get("status")=="final" and fixture.get("status")!="final":
                continue
            games[fixture["id"]]={**fixture,"verified":True,"elo_eligible":True}
    # Use the basketball newspaper's Eastern calendar, not UTC midnight.
    # During game hours the UTC date can already be tomorrow.
    today=dt.datetime.now(ZoneInfo("America/New_York")).date()
    if bootstrap:
        start,end=dt.date(2026,10,15),dt.date(2027,4,12)
    elif live:
        start=max(dt.date(2026,10,15),today-dt.timedelta(days=2))
        end=min(dt.date(2027,4,12),today+dt.timedelta(days=2))
    else:
        start=max(dt.date(2026,10,15),today-dt.timedelta(days=12))
        end=min(dt.date(2027,4,12),today+dt.timedelta(days=30))
    days=[start+dt.timedelta(days=i) for i in range((end-start).days+1)]
    successful=0;errors=[];source_counts={}
    ingestion={"added":0,"updated":0,"kept_verified_final":0,
               "confirmed_duplicate":0,"score_conflict":0,"unmatched_identity":0}
    identity=build_dii_team_lookup(teams)
    with ThreadPoolExecutor(max_workers=3) as pool:
        tasks={pool.submit(fetch_day,gender,day):day for day in days}
        for job in as_completed(tasks):
            try:records,source=job.result();successful+=1;source_counts[source]=source_counts.get(source,0)+1
            except Exception as exc:errors.append(str(exc));continue
            for item in records:
                if not item:continue
                g,away_source,home_source=item
                aa=resolve_dii_team_id(away_source,identity)
                hh=resolve_dii_team_id(home_source,identity)
                if not aa or not hh:
                    # Cross-division/unknown teams belong in an opponent
                    # ledger, not silently added as NCAA DII programs.
                    ingestion["unmatched_identity"]+=1
                    continue
                disposition=merge_ncaa_contest(games,g,aa,hh)
                ingestion[disposition]+=1
    if successful<max(1,len(days)//2):
        raise RuntimeError(f"{gender}: {successful}/{len(days)} NCAA date requests succeeded. Refusing to publish suspect empty/partial feed. Errors: {errors[:3]}")
    official_broadcasts=apply_official_tipoff_streams(gender,games,teams,today)
    extra_broadcasts=apply_verified_schedule_broadcasts(gender,games,teams,today)
    midwest_broadcasts=apply_verified_schedule_broadcasts(gender,games,teams,today,
        registry_file=DATA/"d2-midwest-tipoff-official-2026.json",
        stream_host="https://justagame.com/clients/justagame-fieldhouse/")
    # Official conference schedules change much less often than live scores.
    # Preserve their last verified reconciliation in rapid mode, and perform
    # the complete two-school crawl in the DAILY extended refresh. This does
    # not trust unauthenticated live scoreboard records as official fixtures.
    from d2_gsc_official import enrich_gsc, enrich_gsc_venue_evidence
    if rapid:
        gsc_quality=previous_quality.get("official_gsc_schedule_reconciliation") or {"status":"daily source check pending"}
        cacc_quality=previous_quality.get("official_cacc_schedule_reconciliation") or {"status":"daily source check pending"}
        # First publication after a new women's source importer is installed:
        # seed once even if the workflow was invoked by a fast push event.
        # All later rapid polls reuse this result, including an explicit
        # source-unavailable status; the daily job handles normal retries.
        if gender=="women" and cacc_quality.get("source") != "CACC official 2026-27 women's basketball university calendars":
            from d2_cacc_women_official import enrich_cacc_women
            cacc_quality=enrich_cacc_women(games,teams,today)
    else:
        gsc_quality=enrich_gsc(games,teams,today,gender=gender)
        if gender=="men":
            from d2_cacc_official import enrich_cacc
            cacc_quality=enrich_cacc(games,teams,today)
        else:
            from d2_cacc_women_official import enrich_cacc_women
            cacc_quality=enrich_cacc_women(games,teams,today)
    gsc_venue_quality=enrich_gsc_venue_evidence(games,gender)
    # PSAC 2026-27 official calendars are the next certified conference.
    # Bootstrap once after deployment, then update in the daily source pass.
    # Half-hour NCAA polls reuse the earlier two-school reconciliation.
    from d2_psac_official import enrich_psac, enrich_psac_temporary_court
    psac_quality=previous_quality.get("official_psac_schedule_reconciliation")
    if not rapid or not psac_quality:
        psac_quality=enrich_psac(gender,games,teams,today)
    psac_venue_quality=enrich_psac_temporary_court(gender,games)
    # Ratings start at 1500 on every new season; only NCAA verified DII-v-DII finals count.
    rating={key:1500.0 for key in teams}
    wins={key:0 for key in teams};losses={key:0 for key in teams}
    # Initial explicit uncalibrated settings: no fictitious back-tested coefficients.
    k=20.0;home_edge=65.0
    finals=0
    for game in sorted(games.values(),key=game_sort_key):
        a,h=game["away"],game["home"]
        if a not in rating or h not in rating or not game.get("elo_eligible") or teams[a].get("not_eligible_for_dii_elo") or teams[h].get("not_eligible_for_dii_elo"):
            # Cross-division opponents and uncertain memberships must not
            # receive bogus win probabilities.
            for field in ("pregame_elo_away","pregame_elo_home","pred_home_pct",
                          "elo_change_home","elo_change_away"):
                game.pop(field,None)
            continue
        match_edge=0.0 if game.get("neutral") else home_edge
        expectation=1/(1+10**((rating[a]-rating[h]-match_edge)/400))
        game["pregame_elo_away"]=round(rating[a],1)
        game["pregame_elo_home"]=round(rating[h],1)
        game["pred_home_pct"]=round(100*expectation,1)
        game["forecast_model_status"]="experimental; DII historical calibration pending"
        if game["status"]!="final":
            game.pop("elo_change_home",None)
            game.pop("elo_change_away",None)
            continue
        if game.get("away_score") is None or game.get("home_score") is None:
            continue
        outcome=1 if game["home_score"]>game["away_score"] else 0
        movement=k*(outcome-expectation)
        game["elo_change_home"]=round(movement,1)
        game["elo_change_away"]=round(-movement,1)
        rating[h]+=movement;rating[a]-=movement
        if outcome:wins[h]+=1;losses[a]+=1
        else:wins[a]+=1;losses[h]+=1
        finals+=1
    for key,t in teams.items():
        t["elo"]=round(rating[key],1);t["w"]=wins[key];t["l"]=losses[key]
    ordered=sorted(teams.values(),key=lambda v:v["name"].lower())
    allgames=sorted(games.values(),key=lambda v:(v["date"],v["id"]))
    quality={"status":("DIRECTORY ONLY — NCAA game feed is empty; schedules, records and Elo changes pending" if not allgames
                       else "PARTIAL — 2026-27 DII membership, dates and schedules require school-level verification"),
        "dates_requested":len(days),"dates_fetched":successful,"dates_failed":len(errors),
        "sample_errors":errors[:5],"verified_dii_finals":finals,"programs_found":len(ordered),
        "official_contests_available":ingestion["added"]+ingestion["updated"]+ingestion["confirmed_duplicate"]>0,
        "ncaa_ingestion":ingestion,
        "verified_tournament_games":sum(1 for g in allgames if g.get("source")=="official tournament organizer"),
        "verified_tournament_source":tournament_source,
        "verified_other_openers":sum(1 for g in allgames if str(g.get("id","")).startswith("d2opening-2026-")),
        "verified_holiday_fixtures":sum(1 for g in allgames if str(g.get("id","")).startswith("d2holiday-2026-")),
        "verified_holiday_source":holiday_source,
        "other_openers_provenance":"Official university athletics results, game-by-game source URLs",
        "directory_source":directory_source,"directory_error":directory_error,
        "official_logo_index":logo_quality,
        "school_color_coverage":color_quality,
        "membership_certified":False,
        "membership_review":membership_quality,
        "official_cwu_tipoff_broadcasts":official_broadcasts,
        "official_other_schedule_broadcasts":extra_broadcasts,
        "official_midwest_tipoff_broadcasts":midwest_broadcasts,
        "official_gsc_schedule_reconciliation":gsc_quality,
        "official_gsc_venue_evidence":gsc_venue_quality,
        "official_cacc_schedule_reconciliation":cacc_quality,
        "official_psac_schedule_reconciliation":psac_quality,
        "official_psac_temporary_home_venues":psac_venue_quality}
    # A complete DATE scan is not certification of every school schedule.
    previous=(prior.get("quality") or {}).get("full_season_scan")
    if bootstrap:
        scan={"as_of":dt.datetime.now(dt.timezone.utc).isoformat(),
              "start":start.isoformat(),"end":end.isoformat(),
              "dates_requested":len(days),"dates_fetched":successful,
              "dates_failed":len(errors),
              "completed":len(days)>=150 and successful>=int(len(days)*0.95),
              "schedules_certified":False}
    else:
        scan=previous or {"completed":False,"schedules_certified":False}
    quality["full_season_scan"]=scan
    # Explicit schedule-field coverage. A fixture is not a completed team
    # schedule, and a blank venue is not a verified home-court location.
    schedule_counts={ident:0 for ident in teams}
    for g in allgames:
        for ident in (g["away"],g["home"]):
            if ident in schedule_counts:schedule_counts[ident]+=1
    missing_schools=sorted((teams[k]["name"] for k,n in schedule_counts.items() if n==0))
    arena_present=sum(bool(g.get("venue")) and not any(
        phrase in str(g.get("venue")).lower()
        for phrase in ("pending","tba","unknown","to be announced")) for g in allgames)
    network_present=sum(bool(g.get("network")) and str(g.get("network")).strip().lower()
        not in ("tba","unknown","none") for g in allgames)
    quality["field_coverage"]={
        "fixture_records":len(allgames),
        "schools_with_at_least_one_fixture":len(teams)-len(missing_schools),
        "schools_with_no_published_fixtures":len(missing_schools),
        "schools_with_no_fixture_examples":missing_schools[:12],
        "games_with_named_venue":arena_present,
        "games_without_confirmed_venue":len(allgames)-arena_present,
        "games_with_verified_tipoff":sum(bool(g.get("start_time")) for g in allgames),
        "games_with_stream_link":sum(bool(g.get("stream_url")) for g in allgames),
        "games_with_network":network_present,
        "games_without_network":len(allgames)-network_present,
        "distinct_game_dates":len({g["date"] for g in allgames}),
        "schedule_certified":False,
        "notes":"Partial coverage; school-level schedule and venue certification remain outstanding"
    }
    payload={"season":SEASON,"gender":gender,"division":"II","team_target":298,"starting_elo":1500,
        "as_of":dt.datetime.now(dt.timezone.utc).isoformat(),"source":"NCAA official GraphQL; ncaa-api mirror fallback",
        "model":{"name":"USRS RETRO","starting_elo":1500,"k":k,"home_elo_edge":home_edge,"status":"provisional coefficients; historical calibration not completed"},
        "quality":quality,"teams":ordered,"games":allgames}
    # In rapid game-day mode, record only real changes. This avoids dozens
    # of timestamp-only Git commits, needless redeploys, and write conflicts
    # with other league newspapers that share this public repository.
    # The regular daily run still publishes its fresh source-health audit.
    if live and prior and not ledger_changed(prior,ordered,allgames):
        print(gender,"live refresh checked",successful,"days without material data changes")
        return
    tmp=output.with_suffix(".json.tmp");tmp.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+"\n");tmp.replace(output)
    print(gender,json.dumps(quality),source_counts)
def main():
    parser=argparse.ArgumentParser()
    flags=parser.add_mutually_exclusive_group()
    flags.add_argument("--bootstrap",action="store_true",help="Full 180-day season source scan")
    flags.add_argument("--live",action="store_true",help="Lean game-day refresh, two days back and ahead")
    args=parser.parse_args()
    for gender in ("men","women"):update(gender,bootstrap=args.bootstrap,live=args.live)
if __name__=="__main__":main()
