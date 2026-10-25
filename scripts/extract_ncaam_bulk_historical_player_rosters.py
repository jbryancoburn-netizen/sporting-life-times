#!/usr/bin/env python3
"""Extract player names from real official historical school roster pages.

This is school-hosted historical *page content*, not a guaranteed pre-opening
snapshot. Never certify historic timing from page path or retrieval date.
"""
import argparse,concurrent.futures,hashlib,json,re,urllib.request
from collections import Counter
from datetime import datetime,timezone
from html import unescape
from pathlib import Path
from urllib.parse import urlparse

ROSTER_LINK=re.compile(r'<a\b[^>]*href=["\']([^"\']*/sports/mens-basketball/roster/[^"\'?#]+/\d+/?)[^"\']*["\'][^>]*>(.*?)</a>',re.I|re.S)
TAGS=re.compile(r'<[^>]+>')
SPACE=re.compile(r'\s+')
def parse_players(html):
    names={}
    for link,content in ROSTER_LINK.findall(html):
        name=SPACE.sub(" ",unescape(TAGS.sub(" ",content))).strip()
        name=re.sub(r"\s+(?:View|Profile|Bio)$","",name,flags=re.I)
        if not (3<=len(name)<=85 and re.search(r"[A-Za-z]",name)):
            continue
        if re.search(r"(?i)^(jersey number|full|view|roster|bio|staff|coach|print|schedule|stats|number)\\b",name):\n            continue\n        if len(name.split())<2 or len(name.split())>5 or not re.fullmatch(r"[\w\s.'’\-]+",name,re.UNICODE):
            continue
        person=link.rstrip("/").split("/")[-2]
        if person and person not in names:
            names[person]=name
    return sorted(names.values())
def extract(row):
    out={k:row[k] for k in ("team","season_end_year","candidate_url")}
    out["status"]="NOT_VERIFIED";out["preopening_membership_verified"]=False
    try:
        u=row["candidate_url"]
        with urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"Mozilla/5.0 (Sporting Life Times historical roster research)"}),timeout=17) as res:
            payload=res.read(1200000)
            resolved=res.url
        html=payload.decode("utf8","replace")
        players=parse_players(html)
        season=f'{row["season_end_year"]-1}-{row["season_end_year"]%100:02d}'
        out.update(status="PARSED_CURRENT_PAGE",retrieved_sha256=hashlib.sha256(payload).hexdigest(),
                   resolved_url=resolved,season_marker_found=season in html,
                   player_count=len(players),players=players,
                   parser="sidearm roster player profile link names",
                   preopening_membership_verified=False)
        if len(players)<5:out["status"]="NO_RELIABLE_ROSTER_EXTRACTION"
    except Exception as exc:
        out.update(status="FETCH_FAILED",error=str(exc)[:180],players=[],player_count=0)
    return out
def main():
    a=argparse.ArgumentParser()
    a.add_argument("--batch",type=int,required=True)
    a.add_argument("--workers",type=int,default=12)
    z=a.parse_args()
    src=Path(f"data/ncaam-historical-bulk-discovery/batch-{z.batch:02d}.json")
    data=json.loads(src.read_text())
    candidates=[r for r in data["results"] if r.get("season_string_found") and r.get("player_name_context_found")]
    with concurrent.futures.ThreadPoolExecutor(max_workers=z.workers) as pool:
        records=list(pool.map(extract,candidates))
    summary={"source_candidates":len(candidates),"pages_fetched":sum(r["status"]!="FETCH_FAILED" for r in records),
             "pages_with_five_or_more_player_names":sum(r["player_count"]>=5 for r in records),
             "total_extracted_player_mentions":sum(r["player_count"] for r in records),
             "preopening_player_rosters_verified":0}
    result={"generated_utc":datetime.now(timezone.utc).isoformat(),"batch":z.batch,
            "scope":"current rendering of season-specific official roster pages",
            "certification":"NOT_PREOPENING_TIMESTAMPS",
            "summary":summary,"records":records}
    target=Path(f"data/ncaam-historical-roster-extraction/batch-{z.batch:02d}.json")
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps(summary,indent=2))
if __name__=="__main__":main()
