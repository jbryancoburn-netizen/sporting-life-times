#!/usr/bin/env python3
"""Collect the latest publicly listed 2026 House poll per district (research tier).

Publisher: People's Poll public 2026 House page, which says it republishes a
New York Times compiled CC BY 4.0 district-poll dataset. This is SECONDARY
reporting and NOT equivalent to verifying each original poll's questionnaire.

One poll per district from the public summary page; NOT all polls in the
dataset, NOT a poll average, NOT an election probability. Poll sample sizes,
individual survey field dates, sponsors and house effects are unverified unless
separately documented in an original release.
"""
from __future__ import annotations
from datetime import datetime,timezone
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import urlsplit
from urllib.request import Request,urlopen

ROOT=Path(__file__).resolve().parents[1]
SOURCE="https://peoplespoll.com/house"
OUT=ROOT/"politics-house-polls-compilation.json"
REPORT=ROOT/"politics-house-polls-compilation-audit.json"
PAGE_SIZE_LIMIT=600_000
# The public HTML lists only the newest poll in each polled district.
LINE=re.compile(r"^.+?\((?P<id>[A-Z]{2}-\d{1,2})\):\s+(?P<count>\d+)\s+polls?\.\s+Newest:\s+(?P<pollster>.+?),\s+(?P<date>[A-Z][a-z]{2}\s+\d{1,2},\s+2026):\s+(?P<choices>.+)$")
CANDIDATE=re.compile(r"(?P<name>[^,]+?)\s+\((?P<party>[DRILGOCP])\)\s+(?P<pct>\d{1,3}(?:\.\d+)?)%")
PARTY={"D":"D","R":"R","I":"I","L":"L","G":"G","O":"O","C":"O","P":"O"}

class PublicList(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.items=[];self.active=None;self.depth=0
    def handle_starttag(self,tag,attrs):
        if tag=="li":
            if self.active is None:self.active={"texts":[],"source_links":[]};self.depth=1
            else:self.depth+=1
        elif tag=="a" and self.active is not None:
            href=dict(attrs).get("href")
            if href and href.startswith(("https://","http://")):
                self.active["source_links"].append(href)
    def handle_endtag(self,tag):
        if tag=="li" and self.active is not None:
            self.depth-=1
            if self.depth==0:self.items.append(self.active);self.active=None
    def handle_data(self,data):
        if self.active is not None:self.active["texts"].append(data)

def parse_page(html,atlas):
    if not isinstance(html,str) or "2026 House district polls" not in html:
        raise ValueError("Unexpected public 2026 House polling compilation source")
    p=PublicList();p.feed(html)
    catalog={r["id"] for r in atlas["districts"]}
    single={s["code"] for s in atlas["states"] if s["district_count"]==1}
    rows=[];seen=set();exclusions=[]
    for item in p.items:
        line=" ".join(" ".join(item["texts"]).split())
        match=LINE.match(line)
        if not match:continue
        rid=match["id"];state,number=rid.split("-")
        canonical=state+"-"+("00" if state in single and number in ("0","1","00","01") else number.zfill(2))
        if canonical not in catalog:
            exclusions.append({"source_race_id":rid,"reason":"not_2026_house_inventory"});continue
        if canonical in seen:raise ValueError("Duplicate district listing "+canonical)
        seen.add(canonical)
        date=datetime.strptime(match["date"],"%b %d, %Y").date().isoformat()
        candidates=[]
        for cm in CANDIDATE.finditer(match["choices"]):
            name=cm["name"].strip()
            if not name or len(name)>100:continue
            pct=float(cm["pct"])
            if not 0<=pct<=100:raise ValueError("Invalid published polling percentage in "+canonical)
            candidates.append({"name":name,"party":PARTY[cm["party"]],"pct":pct})
        if len(candidates)<2 or len({x["name"].casefold() for x in candidates})!=len(candidates):
            exclusions.append({"source_race_id":rid,"reason":"candidate_percentages_incomplete"});continue
        if sum(x["pct"] for x in candidates)>101.5:
            exclusions.append({"source_race_id":rid,"reason":"candidate_percentages_exceed_possible_total"});continue
        links=item["source_links"]
        if not links or not links[0].startswith("https://"):
            exclusions.append({"source_race_id":rid,"reason":"original_release_link_not_https"});continue
        if len(match["pollster"].strip())<3:
            exclusions.append({"source_race_id":rid,"reason":"pollster_label_missing"});continue
        is_generic=all(x["name"].lower().startswith("generic ") or "generic" in x["name"].lower() for x in candidates[:2])
        rows.append({
            "id":"compilation-"+canonical.lower()+"-"+date,"race_id":canonical,
            "election_year":2026,"pollster":match["pollster"].strip(),
            "published_poll_count_in_district":int(match["count"]),
            "reported_date":date,"end_date":date,
            "date_basis":"Public compilation listing date; original survey field end not independently confirmed",
            "start_date":None,"sample_size":None,"population":"not_reported",
            "source_url":links[0],"compilation_url":SOURCE,
            "source_type":"public_nyt_cc_by_compilation_as_reported_by_peoples_poll",
            "source_verified":False,"compilation_verified":True,
            "candidate_names_not_ballot_verified":True,"question_type":"generic_house" if is_generic else "named_house",
            "sponsor":None,"sponsorship_not_independently_verified":True,
            "candidates":candidates,
            "method_note":"Secondary compilation of a publicly reported district poll, not an independently checked original survey. Source link may describe methodology, funding, sample and field dates. No house-effects adjustment or poll average."
        })
    if not 95<=len(rows)<=135:
        raise ValueError(f"Public poll listing did not yield expected breadth, only {len(rows)} districts ({len(exclusions)} excluded). No incomplete source will overwrite prior compilation.")
    if len(rows)+len(exclusions)>150:raise ValueError("Unexpected public source layout")
    return {
        "status":"SECONDARY_LATEST_HOUSE_POLL_COMPILATION_NOT_PRIMARY_VERIFIED",
        "election_year":2026,
        "compiled_at":datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source_url":SOURCE,
        "source_attribution":"People's Poll public House page, which attributes its compilation to New York Times district poll records and marks CC BY 4.0",
        "method":"Latest public poll per listed district only, no averaging or pollster reliability scoring",
        "polled_districts":len(rows),"source_candidates_unverified":True,
        "source_partisan_sponsor_unverified":True,
        "polling_not_election_predictions":True,
        "polls":sorted(rows,key=lambda x:x["race_id"]),
        "exclusions":exclusions,
        "warning":"These are independently parsed public compilation summaries, NOT originals checked one-by-one. The source listing omits sample sizes, actual field dates, and sponsor details for many polls. Generic D/R polls are not evidence of a named candidate's lead. Internal and partisan surveys may be present. Observed shares cannot become calibrated election odds."
    }

def get_page(url=SOURCE):
    if url!=SOURCE:raise ValueError("Only the publicly reviewed research compilation URL is allowed")
    req=Request(url,headers={"User-Agent":"Political-Life-and-Times/1.0 noncommercial civic polling research","Accept":"text/html"})
    with urlopen(req,timeout=35) as r:
        if r.status!=200:raise ValueError("Public polling publisher returned non-200")
        blob=r.read(PAGE_SIZE_LIMIT+1)
    if not 30000<=len(blob)<=PAGE_SIZE_LIMIT:raise ValueError("Unexpected public source HTML size")
    return blob.decode("utf-8")

def main():
    atlas=json.loads((ROOT/"politics-house-atlas.json").read_text(encoding="utf-8"))
    if atlas.get("district_count")!=435 or len(atlas["districts"])!=435:
        raise ValueError("Validated 2026 district inventory must exist first")
    data=parse_page(get_page(),atlas)
    OUT.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    audit={"status":data["status"],"compiled_at":data["compiled_at"],
           "districts_with_latest_published_poll":data["polled_districts"],
           "excluded":data["exclusions"],"original_sources_directly_verified":False}
    REPORT.write_text(json.dumps(audit,indent=2)+"\n",encoding="utf-8")
    print("Secondary-source House district poll summaries:",data["polled_districts"],"districts; original release verification: NOT CLAIMED")
if __name__=="__main__":main()
