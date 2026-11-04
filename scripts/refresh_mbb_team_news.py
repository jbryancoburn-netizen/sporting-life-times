#!/usr/bin/env python3
"""Collect attributed, school-specific basketball headlines; never invent news."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from urllib.parse import quote, urlparse, parse_qs, unquote
from urllib.request import Request, urlopen
import json, pathlib, re, time, xml.etree.ElementTree as ET

ROOT=pathlib.Path(__file__).resolve().parents[1]
teams=json.loads((ROOT/"data/ncaam-2026-27-espn-team-crosswalk.json").read_text())["teams"]
out=ROOT/"data/mbb-team-news"
out.mkdir(parents=True,exist_ok=True)
now=datetime.now(timezone.utc)
max_age=timedelta(days=14)

def fetch(team):
    school=team["name"]
    full=team.get("espn_name") or school
    ident=str(team["espn_id"])
    # Named school + explicit basketball context prevents unrelated sports entering team desks.
    query=f'"{full}" basketball when:14d'
    feed="https://news.google.com/rss/search?q="+quote(query)+"&hl=en-US&gl=US&ceid=US:en"
    target=out/(ident+".json")
    try:
        req=Request(feed,headers={"User-Agent":"Mozilla/5.0 (compatible; SportingLifeTimesTeamDesk/1.0)"})
        with urlopen(req,timeout=20) as res: root=ET.fromstring(res.read())
        entries=[]
        seen=set()
        for item in root.findall("./channel/item"):
            title=(item.findtext("title") or "").strip()
            link=(item.findtext("link") or "").strip()
            src=(item.findtext("source") or "Google News").strip()
            try: timestamp=parsedate_to_datetime(item.findtext("pubDate")).astimezone(timezone.utc)
            except (TypeError,ValueError,AttributeError): continue
            if timestamp>now+timedelta(hours=2) or now-timestamp>max_age: continue
            if not title or not link or link in seen: continue
            # Google News RSS titles often have suffix " - Publisher".
            clean=re.sub(r"\s+-\s+"+re.escape(src)+r"$","",title,flags=re.I).strip()
            if not re.search(r"basketball|hoosiers|wildcats|tournament|coach|roster|guard|forward|center|hoops",clean,re.I): continue
            entries.append({"title":clean,"url":link,"source":src,"published_at":timestamp.isoformat(),"summary":""})
            seen.add(link)
        entries.sort(key=lambda x:x["published_at"],reverse=True)
        if not entries:
            # Do not replace useful previous reporting with a transient empty API response.
            return ident,"no-new-headlines",0
        payload={"season":"2026-27","team_id":team["id"],"team":school,
          "updated_at":now.isoformat(),"source_feed":"Google News RSS search",
          "articles":entries[:10]}
        target.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n")
        return ident,"updated",len(payload["articles"])
    except Exception as exc:
        return ident,"error:"+str(exc)[:90],0

with ThreadPoolExecutor(max_workers=6) as pool:
    results=list(pool.map(fetch,teams))
# Assemble a conference-specific desk from the existing 365 school feeds.
# This is source-side aggregation: no extra paid feeds and no invented articles.
BIG_TEN = (
    "Illinois", "Indiana", "Iowa", "Maryland", "Michigan", "Michigan State",
    "Minnesota", "Nebraska", "Northwestern", "Ohio State", "Oregon",
    "Penn State", "Purdue", "Rutgers", "UCLA", "USC", "Washington", "Wisconsin"
)
def big_ten_school(team):
    label = (team.get("name") or "").casefold()
    # Exact school names avoid accidentally grouping Michigan State with Michigan.
    return label in {n.casefold() for n in BIG_TEN} or (
        label == "southern california"
    )
def publish_big_ten():
    records = []
    covered = []
    for team in teams:
        if not big_ten_school(team):
            continue
        file = out / (str(team["espn_id"]) + ".json")
        if not file.exists():
            continue
        try:
            doc = json.loads(file.read_text(encoding="utf-8"))
            if doc.get("team_id") != team["id"]:
                continue
            count = 0
            for article in doc.get("articles", []):
                if not article.get("title") or not article.get("url") or not article.get("published_at"):
                    continue
                records.append({**article, "team_id":team["id"], "school":team["name"], "category":"MBB"})
                count += 1
            if count:
                covered.append(team["name"])
        except (ValueError, OSError, KeyError):
            continue
    records.sort(key=lambda x:x["published_at"], reverse=True)
    unique = []
    seen = set()
    for article in records:
        key = re.sub(r"[^a-z0-9]+", " ", article["title"].lower()).strip()
        if key in seen:
            continue
        seen.add(key)
        unique.append(article)
    dest = out / "big-ten.json"
    if not unique and dest.exists():
        return len(covered), 0
    dest.write_text(json.dumps({"season":"2026-27","conference":"Big Ten",
        "updated_at":now.isoformat(),"schools_expected":18,
        "schools_with_reporting":len(set(covered)),"schools":sorted(set(covered)),
        "source_feed":"Attributable school-specific basketball reporting",
        "articles":unique[:120]}, ensure_ascii=False, indent=2)+"\\n")
    return len(set(covered)), len(unique[:120])
big_ten_schools, big_ten_stories = publish_big_ten()

summary={"attempted_at":now.isoformat(),"teams":len(teams),
"updated":sum(x[1]=="updated" for x in results),
"big_ten_schools_with_reporting":big_ten_schools,
"big_ten_articles":big_ten_stories,
"no_new_headlines":sum(x[1]=="no-new-headlines" for x in results),
"errors":[{"espn_id":i,"error":status} for i,status,n in results if status.startswith("error")]}
(out/"status.json").write_text(json.dumps(summary,indent=2)+"\n")
print(json.dumps({k:v if k!="errors" else len(v) for k,v in summary.items()},indent=2))
