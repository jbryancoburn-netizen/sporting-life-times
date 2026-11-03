#!/usr/bin/env python3
"""Source-checked, free congressional district news refresh (all 435, batched).

Do not invent local reporting: accept only an explicit district reference or
a named 2026 ballot candidate in a politics/House context. Do not infer a
district merely from a newspaper's state or a city in its title. Original
publisher title, named source, publication date and discovery feed URL are
retained; linked publishers own the articles.

The existing IA-01 desk/polls/roll calls are NOT edited by this job.
"""
from __future__ import annotations
import concurrent.futures
import datetime as dt
import email.utils
import json
import os
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parent.parent
ATLAS=ROOT/"politics-house-atlas.json"
OUT=ROOT/"data/politics-district-news.json"
BASE="https://news.google.com/rss/search?"
HEADERS={"User-Agent":"SportingLifeTimes-DistrictDesk/1.1 (source-linked headlines; no scraping; no paid APIs)"}
BATCH=int(os.environ.get("DISTRICT_NEWS_BATCH","75"))
MAX_ARTICLES=12
MAX_AGE=dt.timedelta(days=35)
NOW=dt.datetime.now(dt.timezone.utc)
POLITICS=re.compile(r"\b(congress|congressional|house|representative|rep\.?|election|campaign|ballot|legislat|district|vote|voting|democrat|republican|politic|primary)\b",re.I)
DIGIT_ORD={1:"st",2:"nd",3:"rd"}
def ordinal(n:int)->str:
    return str(n)+("th" if n%100 in (11,12,13) else DIGIT_ORD.get(n%10,"th"))
def pull(url:str)->bytes:
    req=urllib.request.Request(url,headers=HEADERS)
    with urllib.request.urlopen(req,timeout=18) as f:return f.read(1_500_000)
def published(raw):
    try:
        t=email.utils.parsedate_to_datetime(raw)
        return t.replace(tzinfo=dt.timezone.utc) if t.tzinfo is None else t.astimezone(dt.timezone.utc)
    except (ValueError,TypeError,IndexError):return None
def clean_title(title,publisher):
    title=title.strip()
    suffix=" - "+publisher
    return title[:-len(suffix)].strip() if title.lower().endswith(suffix.lower()) else title
def candidates(row):
    snapshot=row.get("official_2026_candidate_snapshot") or {}
    return [str(c.get("name") or "").strip() for c in (snapshot.get("candidates") or [])
            if len(str(c.get("name") or "").strip())>10 and " " in str(c.get("name") or "")]
def check_title(title,row,state_name,people):
    district=int(row["district"])
    suffix=ordinal(district)
    escaped=re.escape(state_name)
    number=f"0?{district}"
    federal=r"(?:congressional|U\.?S\.?\s+House|United States House)"
    phrases=[
        rf"\b{escaped}(?:'s|’s)?\s+(?:{suffix}|{number})\s+{federal}\s+district\b",
        rf"\b{escaped}(?:'s|’s)?\s+{federal}\s+district\s+{number}\b",
        rf"\b(?:{suffix}|{number})\s+{federal}\s+district\s+(?:of|in)\s+{escaped}\b"
    ]
    for p in phrases:
        if re.search(p,title,re.I):return "named_2026_district"
    if row["at_large"] and re.search(rf"\b{escaped}\s+at[- ]large\b",title,re.I) and re.search(r"congressional|U\\.?S\\.?\\s+House",title,re.I):
        return "state_at_large_seat"
    for name in people:
        if re.search(r"(?<![\w])"+re.escape(name)+r"(?![\w])",title,re.I) and POLITICS.search(title):
            return "verified_2026_ballot_candidate"
    return None
def query_for(row,state_name):
    district=int(row["district"])
    exact='"'+state_name+" "+ordinal(district)+' congressional district"'
    exact2='"'+state_name+" congressional district "+str(district)+'"'
    terms=[exact,exact2]
    for name in candidates(row)[:4]:
        terms.append('"'+name+'"')
    if row["at_large"]:terms.append('"'+state_name+' at-large"')
    q=" OR ".join(terms)+" when:21d"
    return BASE+urllib.parse.urlencode({"q":q,"hl":"en-US","gl":"US","ceid":"US:en"})
def one(row,state_name):
    people=candidates(row)
    url=query_for(row,state_name)
    try:
        root=ET.fromstring(pull(url))
        articles=[]
        seen=set()
        for node in root.findall(".//item"):
            raw_title=node.findtext("title") or ""
            source=node.find("source")
            publisher=(source.text or "").strip() if source is not None else ""
            published_at=published(node.findtext("pubDate"))
            link=(node.findtext("link") or "").strip()
            title=clean_title(raw_title,publisher)
            if re.search(r"\\b(latest polls|polling averages|betting odds|election odds)\\b",title,re.I):continue
            if not publisher or not published_at or not link.startswith("https://") or len(title)<16 or len(title)>230:
                continue
            if published_at>NOW+dt.timedelta(days=1) or NOW-published_at>MAX_AGE:
                continue
            reason=check_title(title,row,state_name,people)
            if not reason:continue
            key=re.sub(r"[^a-z0-9]","",title.casefold())
            if key in seen:continue
            seen.add(key)
            articles.append({
                "title":title,"source":publisher,"url":link,
                "published_at":published_at.isoformat(timespec="seconds").replace("+00:00","Z"),
                "topic":"HOUSE & DISTRICT" if reason!="verified_2026_ballot_candidate" else "CANDIDATE & GOVERNMENT",
                "district_id":row["id"],"match_reason":reason,
                "via":"Google News RSS / original publisher attributed"
            })
        articles.sort(key=lambda x:x["published_at"],reverse=True)
        return row["id"],articles[:MAX_ARTICLES],None
    except (ET.ParseError,urllib.error.URLError,TimeoutError,OSError,ValueError) as e:
        return row["id"],[],type(e).__name__
def main():
    if not 1<=BATCH<=125:raise ValueError("Batch must be 1..125")
    atlas=json.loads(ATLAS.read_text(encoding="utf-8"))
    rows=atlas["districts"]
    if len(rows)!=435:raise AssertionError("House ledger must contain 435 districts")
    state_names={s["code"]:s["name"] for s in atlas["states"]}
    if OUT.exists():
        obj=json.loads(OUT.read_text(encoding="utf-8"))
    else:
        obj={"schema_version":1,"districts":{},"next_index":0,"last_completed_cycle":None}
    cursor=int(obj.get("next_index",0))%435
    index=list(range(cursor,min(435,cursor+BATCH)))
    if len(index)<BATCH:index+=list(range(0,BATCH-len(index)))
    batch=[rows[i] for i in index]
    print("District news window:",batch[0]["id"],"to",batch[-1]["id"],"("+str(len(batch))+" districts)",flush=True)
    ok=0;added=0;failures=[]
    # Modest concurrency, free public discovery feeds; no user tracking or authentication.
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures=[executor.submit(one,row,state_names[row["state"]]) for row in batch]
        for f in concurrent.futures.as_completed(futures):
            did,latest,err=f.result()
            d=obj.setdefault("districts",{}).setdefault(did,{})
            if err:
                failures.append([did,err])
                d["last_attempt_error"]=err
                continue
            ok+=1
            old=d.get("articles",[])
            seen=set();combined=[]
            for article in sorted(latest+old,key=lambda x:x["published_at"],reverse=True):
                try:date=dt.datetime.fromisoformat(article["published_at"].replace("Z","+00:00"))
                except (ValueError,KeyError):continue
                if NOW-date>MAX_AGE:continue
                key=re.sub(r"[^a-z0-9]","",article["title"].casefold())
                if key not in seen:
                    seen.add(key);combined.append(article)
            d["articles"]=combined[:MAX_ARTICLES]
            added+=len([x for x in latest if x not in old])
            d["news_checked_at"]=NOW.isoformat(timespec="seconds").replace("+00:00","Z")
            d.pop("last_attempt_error",None)
    obj["next_index"]=(cursor+BATCH)%435
    obj["updated_at"]=NOW.isoformat(timespec="seconds").replace("+00:00","Z")
    obj["district_count"]=435
    obj["districts_checked_this_batch"]=ok
    obj["districts_with_articles"]=sum(bool(x.get("articles")) for x in obj["districts"].values())
    obj["districts_checked_total"]=sum(bool(x.get("news_checked_at")) for x in obj["districts"].values())
    obj["last_error_count"]=len(failures)
    obj["last_errors"]=failures[:20]
    if obj["next_index"]<=cursor:obj["last_completed_cycle"]=obj["updated_at"]
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(obj,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    print("Verified feeds checked",ok,"/",len(batch),"newly discovered",added,
          "districts with retained news",obj["districts_with_articles"],
          "total ever checked",obj["districts_checked_total"],"errors",len(failures),flush=True)

if __name__=="__main__":main()
