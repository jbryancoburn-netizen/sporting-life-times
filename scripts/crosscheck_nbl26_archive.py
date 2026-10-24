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
# Five scoreline discrepancies in the independently published summary article.
# Reconcile ONLY when the individual official NBL article corroborates its result.
OFFICIAL_EXCEPTIONS={
    "401787560":{"url":"https://www.nbl.com.au/news/lethal-dj-shoots-sixers-over-phoenix","score":"94-81","date":"2025-11-22","clubs":["adelaide","phoenix"]},
    "401787588":{"url":"https://www.nbl.com.au/news/kings-stay-hot-by-dominating-snakes","score":"119-77","date":"2025-12-21","clubs":["kings","taipans"]},
    "401787629":{"url":"https://www.nbl.com.au/news/breakers-dig-deep-to-just-stay-alive","score":"106-95","date":"2026-02-07","clubs":["breakers","hawks"]},
    "401787634":{"url":"https://www.nbl.com.au/news/kings-send-message-with-win-over-phoenix","score":"114-88","date":"2026-02-08","clubs":["kings","phoenix"]},
    "401863732":{"url":"https://www.nbl.com.au/news/kings-take-charge-in-perth-to-advance","score":"89-75","date":"2026-03-14","clubs":["kings","wildcats"]},
}

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

def check_official_exception(game,source_text):
    reference=OFFICIAL_EXCEPTIONS.get(game.get("id"))
    if reference is None or str(game.get("date",""))[:10]!=reference["date"]:
        return False
    src=compact(source_text).replace("–","-").replace("—","-").replace("‑","-")
    parts=reference["score"].split("-")
    score_pattern=r"(?<!\\d)"+parts[0]+r"\\s*-\\s*"+parts[1]+r"(?!\\d)"
    return bool(re.search(score_pattern,src)) and all(name in src for name in reference["clubs"])

def corroborate_official_outliers(report):
    findings=[]
    for game in report.get("unmatched",[]):
        meta=OFFICIAL_EXCEPTIONS.get(game["id"])
        if not meta:
            findings.append({"id":game["id"],"status":"no_official_exception_documented"})
            continue
        try:
            req=Request(meta["url"],headers={"User-Agent":"Mozilla/5.0 (compatible; SportingLifeTimes/1.0)"})
            with urlopen(req,timeout=35) as response:
                raw=response.read(3_000_000).decode("utf-8","replace")
            matched=check_official_exception(game,visible(raw))
            findings.append({"id":game["id"],"status":"confirmed_by_nbl" if matched else "official_article_score_not_found",
                             "official_url":meta["url"],"expected":meta["score"]})
        except Exception as exc:
            findings.append({"id":game["id"],"status":"official_source_unavailable",
                             "official_url":meta["url"],"reason":str(exc)[:150]})
    report["official_exception_checks"]=findings
    confirmed=sum(x["status"]=="confirmed_by_nbl" for x in findings)
    report["officially_corroborated_outliers"]=confirmed
    report["total_independently_corroborated_scorelines"]=report.get("matched_scorelines",0)+confirmed
    report["status"]="all_178_scorelines_corroborated" if (
        report.get("ESPN_candidates_excluding_cup")==178 and
        report["total_independently_corroborated_scorelines"]==178
    ) else "partial_or_unreconciled"
    report["production_approved"]=False
    return report

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
        result=corroborate_official_outliers(audit(data,visible(raw)))
    except Exception as exc:
        result={"provider":"basketball.com.au","article_url":ARTICLE,
                "status":"source_unavailable","reason":str(exc)[:280],
                "production_approved":False}
    out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(result,indent=2))
    print(json.dumps({k:result.get(k) for k in
        ("status","ESPN_candidates_excluding_cup","matched_scorelines","officially_corroborated_outliers","total_independently_corroborated_scorelines","unmatched_count","reason")},indent=2))
if __name__=="__main__":main()
