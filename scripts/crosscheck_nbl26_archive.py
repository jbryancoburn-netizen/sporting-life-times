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
    return re.sub(r"\s+"," ",text).strip().casefold()

def visible(html):
    p=VisibleText();p.feed(html);return compact(" ".join(p.parts))

# These exceptions were separately reviewed against game-level scores, rather
# than silently overriding source data to match an article's typed summary.
# "article_line" is the exact discrepant text expected in the article.
REVIEWED={
 "401787560":{"article_line":"South East Melbourne Phoenix 81 Adelaide 36ers 93",
   "kind":"article_score_discrepancy",
   "evidence":"https://www.basketball-reference.com/international/schedules/se-melbourne/2026.html"},
 "401787588":{"article_line":"Sydney Kings 117 Cairns Taipans 77",
   "kind":"article_score_discrepancy",
   "evidence":"https://www.basketball-reference.com/international/schedules/sydney/2026.html"},
 "401787629":{"article_line":"New Zealand Breakers 106 Illawarra Hawks 94",
   "kind":"article_score_discrepancy",
   "evidence":"https://www.hawks.com.au/news/game-report-hawks-breakers-rd20-nbl26"},
 "401787634":{"article_line":"South East Melbourne Phoenix 88 Sydney Kings 113",
   "kind":"article_score_discrepancy",
   "evidence":"https://www.basketball.com.au/games/south-east-melbourne-phoenix-v-sydney-kings-men-08-02-2026"},
 "401863732":{"article_line":"Sydney Kings 89 Perth Wildcats 75",
   "kind":"article_reverses_team_order",
   "evidence":"https://www.basketball.com.au/games/perth-wildcats-v-sydney-kings-men-14-03-2026"}
}

def audit(data,article_text):
    if data.get("status")!="uncertified_source_candidates":
        raise ValueError("Expected research candidate source payload")
    games=[g for g in data.get("games",[]) if g.get("id")!=CUP_FINAL_ID]
    found=[];unmatched=[];reviewed=[]
    for g in games:
        home=ALIASES.get(g["home"],g["home"])
        away=ALIASES.get(g["away"],g["away"])
        scoreline=compact(f"{home} {g['home_score']} {away} {g['away_score']}")
        entry={"id":g["id"],"date":g["played_at"],"scoreline":scoreline}
        if scoreline in article_text:
            found.append(entry)
            continue
        exception=REVIEWED.get(g["id"])
        if exception and compact(exception["article_line"]) in article_text:
            reviewed.append({**entry,"article_line":exception["article_line"],
                             "discrepancy":exception["kind"],"independent_game_source":exception["evidence"],
                             "review_status":"documented_manual_crosscheck_not_automatically_certified"})
        else:
            unmatched.append(entry)
    complete=len(games)==178 and not unmatched
    return {"provider":"basketball.com.au","article_url":ARTICLE,
            "ESPN_candidates_excluding_cup":len(games),
            "matched_scorelines":len(found),
            "documented_discrepancies":len(reviewed),
            "discrepancy_details":reviewed,
            "unmatched_count":len(unmatched),"unmatched":unmatched[:40],
            "status":"reconciled_with_documented_discrepancies" if complete and reviewed else
                     "all_scorelines_matched" if complete else "partial_or_unreconciled",
            "qualification":"178 candidates accounted for only when the external article contains the recorded exceptional wording; the five exceptions cite independent game-level evidence but were manually reviewed, not continuously authenticated. Full date and venue reconciliation remains separate.",
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
    out.write_text(json.dumps(result,indent=2))
    print(json.dumps({k:result.get(k) for k in
        ("status","ESPN_candidates_excluding_cup","matched_scorelines","unmatched_count","reason")},indent=2))
if __name__=="__main__":main()
