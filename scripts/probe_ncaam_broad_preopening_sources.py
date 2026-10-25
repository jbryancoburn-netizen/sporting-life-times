#!/usr/bin/env python3
"""Acquire independently date-attributed NCAA preseason media evidence.

Candidates are discoveries, NOT proven preopening rosters. A source counts as
content-attested only if retrieved text names 2+ players (when given anchors).
Never use guessed publication dates, an index URL, or a future snapshot as proof.
"""
import argparse,concurrent.futures,hashlib,io,json,re,urllib.request
from datetime import date,datetime,timezone
from html.parser import HTMLParser
from pathlib import Path
OPENING={2024:date(2023,11,6),2025:date(2024,11,4),2026:date(2025,11,3)}
class Strip(HTMLParser):
    def __init__(self):super().__init__();self.parts=[]
    def handle_data(self,data):self.parts.append(data)
def fetch(spec):
    r=dict(spec,status="NOT_VALIDATED",preopening_roster_verified=False)
    yr=spec["season_end_year"];stamp=spec.get("published_date")
    if stamp:
        r["candidate_date_preopening"]=date.fromisoformat(stamp)<OPENING[yr]
    else:r["candidate_date_preopening"]=False
    try:
        req=urllib.request.Request(spec["url"],headers={"User-Agent":"Mozilla/5.0 (research archival retrieval)"})
        with urllib.request.urlopen(req,timeout=18) as resp:
            mime=resp.headers.get("Content-Type","")
            body=resp.read(21*1024*1024+1)
        if len(body)>21*1024*1024:raise ValueError("Source exceeds size limit")
        r["response_mime"]=mime;r["sha256_retrieved_now"]=hashlib.sha256(body).hexdigest()
        r["content_bytes"]=len(body)
        if body.startswith(b"%PDF"):
            from pypdf import PdfReader
            pdf=PdfReader(io.BytesIO(body),strict=False)
            text=" ".join((p.extract_text() or "") for p in pdf.pages[:min(20,len(pdf.pages))])
            r["pages_parsed"]=min(20,len(pdf.pages))
        else:
            reader=Strip();reader.feed(body.decode("utf8","replace"))
            text=" ".join(reader.parts)
        normalized=" ".join(text.split())
        r["has_roster_heading"]=bool(re.search(r"(?i)(numerical roster|2024-25 roster|2025-26 roster|2023-24 roster|team roster|student-athlete profiles)",normalized))
        r["has_season_text"]=f"{yr-1}-{str(yr)[-2:]}" in normalized
        r["parsed_chars"]=len(normalized)
        r["status"]="RETRIEVED_REVIEW_NEEDED"
        # Genuine retrieval is insufficient by itself for preopening membership.
        # Persist neither full copyrighted content nor inferred player lists.
        r["preopening_roster_verified"]=False
    except Exception as e:
        r["status"]="FETCH_OR_PARSE_FAILED";r["error"]=str(e)[:240]
    return r
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--sources",default="data/ncaam-historical-preopening-source-candidates.json")
    ap.add_argument("--output",default="data/ncaam-broad-preopening-source-probe.json")
    args=ap.parse_args()
    spec=json.loads(Path(args.sources).read_text())
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        result=list(pool.map(fetch,spec["sources"]))
    output={"generated_utc":datetime.now(timezone.utc).isoformat(),
        "season_opening_dates":{str(k):v.isoformat() for k,v in OPENING.items()},
        "scope":"initial independent school and conference media-guide discovery",
        "status":"CANDIDATE_SOURCE_RETRIEVAL_NOT_ROSTER_CERTIFICATION",
        "summary":{"candidates":len(result),
            "retrieved":sum(x["status"]=="RETRIEVED_REVIEW_NEEDED" for x in result),
            "preopening_dated_retrieved":sum(x["status"]=="RETRIEVED_REVIEW_NEEDED" and x["candidate_date_preopening"] for x in result),
            "candidate_roster_headings":sum(bool(x.get("has_roster_heading")) for x in result),
            "verified_complete_historical_preopening_rosters":0},
        "results":result}
    Path(args.output).parent.mkdir(parents=True,exist_ok=True)
    Path(args.output).write_text(json.dumps(output,indent=2)+"\n")
    print(json.dumps(output["summary"],indent=2))
if __name__=="__main__":main()
