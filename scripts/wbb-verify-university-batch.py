#!/usr/bin/env python3
"""Bulk official *women's* school-schedule verification without inferred matches.

Derive candidate URLs from an institutional athletics URL registry, but accept
only pages whose TITLE and TABLE explicitly identify 2026-27 women's basketball.
Match ESPN WOMEN'S calendar by local playing date + uniquely identified opponent.
Do not automatically change published dates, venues, broadcast or tipoff.

Usage: python scripts/wbb-verify-university-batch.py --batch 0 --size 120
"""
import argparse
from concurrent.futures import ThreadPoolExecutor,as_completed
from collections import Counter,defaultdict
import datetime as dt
import json
import pathlib
import re
import time
from urllib.parse import urlparse
from urllib.request import Request,urlopen
from zoneinfo import ZoneInfo
from bs4 import BeautifulSoup

ROOT=pathlib.Path(__file__).resolve().parents[1]/"data"
MONTHS={m.lower():i+1 for i,m in enumerate(("Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"))}
EAST=ZoneInfo("America/New_York")
UA="Mozilla/5.0 (compatible; SportingLifeTimesWomensScheduleVerifier/1.0; independent research)"
# Only naming/identity aliases, not game data, from institutional sources.
ALIASES={"uconn":"Connecticut","fgcu":"Florida Gulf Coast","olemiss":"Mississippi",
         "unc":"North Carolina","ucf":"UCF","umass":"Massachusetts",
         "stjohns":"St. John's","fdu":"Fairleigh Dickinson",
         "utsa":"UTSA","uic":"UIC","usc":"Southern California"}

def normalize(v):
    v=str(v or "").lower().replace("&","and")
    return re.sub("[^a-z0-9]","",v)

def local_day(stamp):
    try:
        v=dt.datetime.fromisoformat(str(stamp).replace("Z","+00:00"))
        return v.astimezone(EAST).date().isoformat()
    except (ValueError,TypeError):return ""

def text_date(label):
    m=re.search(r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b",label,re.I)
    if not m:return None
    month=MONTHS.get(m.group(1)[:3].lower())
    if not month:return None
    try:return dt.date(2026 if month>=7 else 2027,month,int(m.group(2))).isoformat()
    except ValueError:return None

def official_rows(html):
    soup=BeautifulSoup(html,"html.parser")
    headings=" ".join(n.get_text(" ",strip=True) for n in soup.select("title,h1,h2")[:12])
    # Prevent accepting men's basketball or a cached 2025-26 official page.
    if not re.search(r"2026\s*[-–]\s*27\s+women[’']?s\s+basketball",headings,re.I):
        return [],"not_verified_2026_27_women_header"
    out=[]
    for table in soup.select("table"):
        trs=table.select("tr")
        if not trs:continue
        header=[t.get_text(" ",strip=True).lower() for t in trs[0].find_all(["th","td"])]
        def find(*keys):return next((i for i,h in enumerate(header) if h in keys),None)
        di,oi,si,ti,li=find("date"),find("opponent"),find("at","site","location type"),find("time","tipoff"),find("location","venue")
        if None in (di,oi,si):continue
        for tr in trs[1:]:
            cells=[x.get_text(" ",strip=True) for x in tr.find_all(["th","td"])]
            if max(di,oi,si)>=len(cells):continue
            day=text_date(cells[di])
            site=normalize(cells[si])
            if not day or site not in ("home","away","neutral"):continue
            opponent=cells[oi].strip()
            if not opponent or re.search(r"\b(exhibition|exh\.|tba|tbd)\b",opponent,re.I):continue
            out.append({"date":day,"site":site,"opponent":opponent,
                "time":cells[ti] if ti is not None and ti<len(cells) else None,
                "location":cells[li] if li is not None and li<len(cells) else None})
    return out, "official_women_table" if out else "no_readable_women_schedule_table"

def fetch(url):
    req=Request(url,headers={"User-Agent":UA})
    with urlopen(req,timeout=13) as response:
        actual=response.geturl()
        expected=urlparse(url)
        observed=urlparse(actual)
        if expected.hostname!=observed.hostname:
            raise ValueError("Redirected away from official school host")
        return response.read(2_000_000).decode("utf-8","replace")

def candidate_urls(url):
    if "/sports/mens-basketball/schedule" not in url:return []
    u=url.replace("/sports/mens-basketball/schedule","/sports/womens-basketball/schedule")
    urls=[u]
    if "/schedule/text" in u:
        urls.append(u.replace("/schedule/text","/schedule"))
    elif "/schedule" in u:
        urls.append(u.replace("/schedule","/schedule/text"))
    return list(dict.fromkeys(urls))

def resolve_name(name,roster):
    needle=normalize(name)
    if needle in ALIASES:needle=normalize(ALIASES[needle])
    if len(needle)<3:return None
    # Exact school or prefix of full women's sport display name, provided the
    # result is UNIQUE across ALL 363 women's programs. Ambiguity is quarantined.
    exact=[t for t in roster if normalize(t["team"])==needle]
    if len(exact)==1:return str(exact[0]["team_id"])
    possible=[t for t in roster if normalize(t["team"]).startswith(needle)]
    return str(possible[0]["team_id"]) if len(possible)==1 else None

def verify_one(entry,calendar,roster):
    tid=str(entry["espn_id"])
    current=calendar["teams"].get(tid)
    result={"team_id":tid,"team":entry["team"],"status":"no_verified_source",
            "url":None,"official_rows":0,"matched":0,"unmatched_official":0,
            "date_site_conflicts":0,"evidence":[]}
    if not current or not current.get("games"):
        result["status"]="team_calendar_missing"
        return result
    for url in candidate_urls(entry["url"]):
        try:
            html=fetch(url)
            rows,status=official_rows(html)
            if not rows:
                result["status"]=status
                continue
            result["url"]=url
            result["status"]="parsed_official_women_schedule"
            result["official_rows"]=len(rows)
            break
        except Exception as exc:
            result["status"]="source_failed"
            result["source_error"]=str(exc)[:150]
    if not result["official_rows"]:return result
    school_games=defaultdict(list)
    for g in current["games"]:
        school_games[(local_day(g["date"]),str(g.get("opponent_id")))].append(g)
    used=set()
    for source in rows:
        rid=resolve_name(source["opponent"],roster)
        options=school_games.get((source["date"],rid),[]) if rid else []
        if len(options)!=1:
            result["unmatched_official"]+=1
            continue
        g=options[0]
        if str(g["id"]) in used:
            result["unmatched_official"]+=1
            continue
        used.add(str(g["id"]))
        if g.get("site")!=source["site"]:
            result["date_site_conflicts"]+=1
            continue
        # Source proves DATE, OPPONENT and SITE for this school's calendar.
        # The source time may be local, TBA, or ambiguous and is NOT certified.
        result["evidence"].append({"game_id":str(g["id"]),"team_id":tid,
            "date":source["date"],"opponent_id":rid,"site":source["site"],
            "source_url":result["url"],"source_type":"official_university_2026_27_womens_schedule",
            "verified_fields":["local_game_date","opponent_id","home_away_or_neutral"],
            "source_time_as_printed":source.get("time"),
            "source_location_as_printed":source.get("location")})
    result["matched"]=len(result["evidence"])
    result["status"]="official_rows_matched" if result["matched"] else "official_rows_no_identified_matches"
    return result

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--batch",type=int,default=0)
    ap.add_argument("--size",type=int,default=120)
    args=ap.parse_args()
    if args.batch<0 or args.size<1 or args.size>200:raise SystemExit("Invalid batch range")
    schedule=json.loads((ROOT/"ncaaw-schedules-2026-27.json").read_text(encoding="utf-8"))
    roster=json.loads((ROOT/"ncaaw-2026-27-teams.json").read_text(encoding="utf-8"))["teams"]
    sources=json.loads((ROOT/"mbb-official-school-schedule-sources.json").read_text(encoding="utf-8"))["teams"]
    if len(roster)!=363 or len(schedule.get("teams",{}))!=363:raise RuntimeError("Incomplete women calendar")
    seen=set()
    candidates=[]
    for x in sources:
        ident=str(x.get("espn_id") or "")
        if ident in seen or ident not in schedule["teams"] or not candidate_urls(x.get("url") or ""):continue
        seen.add(ident);candidates.append(x)
    # Exact, deterministic batch partitions; no repeated requests in a run.
    subset=candidates[args.batch*args.size:(args.batch+1)*args.size]
    if not subset:raise RuntimeError("No schools in selected batch")
    results=[]
    with ThreadPoolExecutor(max_workers=12) as pool:
        tasks=[pool.submit(verify_one,x,schedule,roster) for x in subset]
        for task in as_completed(tasks):
            results.append(task.result())
    results.sort(key=lambda r:r["team_id"])
    rows=[e for r in results for e in r["evidence"]]
    if len({(r["game_id"],r["team_id"]) for r in rows})!=len(rows):
        raise RuntimeError("Duplicate official match")
    verified=sum(r["matched"]>=8 for r in results)
    audit={"season":"2026-27","gender":"women","batch":args.batch,
        "schools_in_batch":len(subset),"source_pages_with_readable_2026_27_womens_table":sum(r["official_rows"]>0 for r in results),
        "schools_with_8plus_verified_entries":verified,
        "official_verified_team_game_entries":len(rows),
        "unique_official_verified_game_ids":len({r["game_id"] for r in rows}),
        "site_discrepancies_to_review":sum(r["date_site_conflicts"] for r in results),
        "unmatched_official_rows":sum(r["unmatched_official"] for r in results),
        "status_counts":dict(Counter(r["status"] for r in results)),
        "schools":[{k:v for k,v in r.items() if k!="evidence"} for r in results],
        "methods":"Strict season+gender page-header gate; date localized to US Eastern; unique school opponent ID and site match; no time, broadcast or venue fabricated.",
        "provenance":"University athletics women-specific schedule table. Institutional men's URL registry is used ONLY to find a candidate host; never as game evidence."}
    suffix=f"batch-{args.batch+1:02d}"
    for path,data in ((ROOT/f"ncaaw-official-school-verification-{suffix}.json",
                      {"season":"2026-27","gender":"women","batch":args.batch,
                       "verified_fields":["date","opponent_id","site"],"rows":rows}),
                      (ROOT/f"ncaaw-official-school-verification-audit-{suffix}.json",audit)):
        content=json.dumps(data,ensure_ascii=False,indent=2)+"\n"
        if not path.exists() or path.read_text()!=content:path.write_text(content)
    print("WBB OFFICIAL SCHOOL VERIFICATION:",
          len(subset),"schools attempted;",sum(r["official_rows"]>0 for r in results),
          "readable women's sources;",len(rows),"exactly verified entries;",
          verified,"schools with 8+ checks")
    # The audit is always written even if no university pages could be parsed.
    # Do not turn a partial batch into a claimed successful school verification.
    if verified==0:raise RuntimeError("No school with 8+ exact women's matches; inspect audit before publishing")

if __name__=="__main__":
    main()
