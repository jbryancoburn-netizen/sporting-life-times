#!/usr/bin/env python3
"""Compare ESPN NBL26 source candidates with independently published Basketball.com.au box-score archive.

Research-only until all 178 league+playoff games reconcile. A source outage never
constitutes evidence that games match.
"""
import argparse, json, re, unicodedata
from html.parser import HTMLParser
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen

ARTICLE="https://www.basketball.com.au/news/complete-2025-26-nbl-season-schedule-and-fixture-list-of-all-165-regular-season-games"
ALIASES={"Tasmania JackJumpers":"Tasmania Jackjumpers"}
CUP_FINAL_ID="401858632"

class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True);self.parts=[];self.blocked=0
    def handle_starttag(self,tag,attrs):
        if tag in ("script","style","noscript"):self.blocked+=1
    def handle_endtag(self,tag):
        if tag in ("script","style","noscript") and self.blocked:self.blocked-=1
    def handle_data(self,data):
        if not self.blocked:self.parts.append(data)

def compact(text):
    text=unicodedata.normalize("NFKC",unescape(text))
    return re.sub(r"\\s+"," ",text).strip().casefold()

def visible(html):
    p=VisibleText();p.feed(html);return compact(" ".join(p.parts))

def audit(data,article_text):
    if data.get("status")!="uncertified_source_candidates":
        raise ValueError("Expected research candidate source payload")
    games=[g for g in data.get("games",[]) if g.get("id")!=CUP_FINAL_ID]
    found=[];unmatched=[]
    for g in games:
        home=ALIASES.get(g["home"],g["home"])
        away=ALIASES.get(g["away"],g["away"])
        scoreline=compact(f"{home} {g['home_score']} {away} {g['away_score']}")
        match=scoreline in article_text
        (found if match else unmatched).append({"id":g["id"],"date":g["played_at"],"scoreline":scoreline})
    return {"provider":"basketball.com.au","article_url":ARTICLE,
            "ESPN_candidates_excluding_cup":len(games),
            "matched_scorelines":len(found),"unmatched_count":len(unmatched),
            "unmatched":unmatched[:40],
            "status":"all_scorelines_matched" if len(games)==178 and not unmatched else "partial_or_unreconciled",
            "qualification":"Matches team names and scorelines; full date and venue reconciliation requires a separate check.",
            "production_approved":False}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--candidate",required=True)
    ap.add_argument("--output",required=True)
    args=ap.parse_args()
    data=json.loads(Path(args.candidate).read_text())
    try:
        request=Request(ARTICLE,headers={"User-Agent":"Mozilla/5.0 (compatible; SportingLifeTimes/1.0)"})
        with urlopen(request,timeout=35) as response:
            raw=response.read(4_000_000).decode("utf-8","replace")
        result=audit(data,visible(raw))
    except Exception as exc:
        result={"provider":"basketball.com.au","article_url":ARTICLE,
                "status":"source_unavailable","reason":str(exc)[:280],
                "production_approved":False}
    out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(result,indent=2)+"\\n")
    print(json.dumps({k:result.get(k) for k in
        ("status","ESPN_candidates_excluding_cup","matched_scorelines","unmatched_count","reason")},indent=2))
if __name__=="__main__":main()
