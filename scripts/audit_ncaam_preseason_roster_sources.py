#!/usr/bin/env python3
"""Audit official pre-opening NCAA roster documents WITHOUT inventing immutable capture dates.

Original school-hosted documents with URL-dated publication are evidence of
historically announced rosters, but are NOT byte-certified preseason snapshots.
Archive CDX timestamps, when independently retrieved, are recorded separately.
"""
import concurrent.futures
import hashlib
import io
import json
import re
import urllib.parse
import urllib.request
from datetime import date,datetime,timezone
from pathlib import Path

SOURCES=[
 {"team":"Duke","season_end_year":2024,"kind":"preseason_pdf",
  "published_date":"2023-10-06",
  "url":"https://goduke.com/documents/download/2023/10/6/2023-24_Preseason_Information.pdf"},
 {"team":"Duke","season_end_year":2025,"kind":"preseason_pdf",
  "published_date":"2024-09-26",
  "url":"https://goduke.com/documents/download/2024/9/26/2024-25_Duke_MBB_Preseason_Information.pdf"},
 {"team":"Duke","season_end_year":2026,"kind":"preseason_pdf",
  "published_date":"2025-10-16",
  "url":"https://goduke.com/documents/download/2025/10/16/2025-26_Duke_MBB_Preseason_Information.pdf"},
 {"team":"Indiana","season_end_year":2024,"kind":"pregame_game_notes_pdf",
  "published_date":"2023-11-02",
  "url":"https://iuhoosiers.com/documents/download/2023/11/2/23_24_EX2_Marian.pdf"},
 {"team":"Indiana","season_end_year":2026,"kind":"initial_roster_article",
  "published_date":"2025-06-02",
  "url":"https://iuhoosiers.com/news/2025/6/2/mens-basketball-mens-basketball-announces-initial-2025-26-roster"}
]
OPENING_DATES={2024:"2023-11-06",2025:"2024-11-04",2026:"2025-11-03"}

def fetch_limited(url,size=12*1024*1024,timeout=32):
    headers={"User-Agent":"SportingLifeTimes-RosterProvenance/1.0 research contact GitHub repository"}
    with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=timeout) as resp:
        content_type=resp.headers.get("Content-Type","")
        payload=resp.read(size+1)
        if len(payload)>size:raise ValueError("Document exceeds 12MiB guard")
        return payload,content_type

def audit_source(spec):
    from pypdf import PdfReader
    record=dict(spec)
    record["preseason_dated_url"]=date.fromisoformat(spec["published_date"])<date.fromisoformat(OPENING_DATES[spec["season_end_year"]])
    record["content_fetched"]=False
    record["immutable_prior_to_first_game_content_verified"]=False
    record["source_published_date_basis"]="date embedded in official school URL; not an archive capture timestamp"
    try:
        raw,mime=fetch_limited(spec["url"])
        record["content_type"]=mime
        record["bytes"]=len(raw)
        record["sha256_fetched_now"]=hashlib.sha256(raw).hexdigest()
        if spec["kind"].endswith("pdf"):
            if not raw.startswith(b"%PDF"):raise ValueError("Not a PDF payload")
            reader=PdfReader(io.BytesIO(raw),strict=False)
            record["page_count"]=len(reader.pages)
            segments=[]
            for page in reader.pages[:min(25,len(reader.pages))]:
                segments.append(page.extract_text() or "")
            text=" ".join(segments)
            record["roster_section_identified"]=bool(re.search(r"(TEAM\s+ROSTER|20(?:23|24|25)-2[456]\s+ROSTER|NUMERICAL\s+ROSTER)",text,re.I))
            if not record["roster_section_identified"]:
                raise ValueError("No extractable roster section in scanned PDF; needs manual verification")
        else:
            text=raw.decode("utf8",errors="replace")
            record["initial_only"]=True
            record["roster_section_identified"]=("Initial 2025-26 Roster" in text or "initial 2025-26 roster" in text.lower())
            if not record["roster_section_identified"]:
                raise ValueError("Initial-roster announcement marker missing")
        record["content_fetched"]=True
        record["status"]="DATED_OFFICIAL_CONTENT_RETRIEVED_NO_HISTORICAL_CAPTURE"
    except Exception as exc:
        record["status"]="SOURCE_UNAVAILABLE_OR_UNREADABLE"
        record["error"]=str(exc)[:450]
    return record

def archive_probe(spec):
    # Wayback record timestamp is independent and immutable capture chronology;
    # limit to a tiny, polite group, without treating unconfirmed captures as evidence.
    address="https://web.archive.org/cdx/search/cdx?"+urllib.parse.urlencode({
        "url":spec["url"],"output":"json","from":str(spec["season_end_year"]-1),
        "to":str(spec["season_end_year"]-1),"fl":"timestamp,original,statuscode",
        "filter":"statuscode:200","limit":"10"})
    out={"team":spec["team"],"season_end_year":spec["season_end_year"],
         "original":spec["url"],"cdx_query":address,"status":"unavailable"}
    try:
        payload,_=fetch_limited(address,size=100000,timeout=25)
        data=json.loads(payload)
        capture=[{"timestamp_utc":r[0],"original":r[1]} for r in data[1:]
                 if len(r)>2 and r[2]=="200" and r[0][:8]<OPENING_DATES[spec["season_end_year"]].replace("-","")]
        out.update(status="checked",pregame_archived_captures=capture[:10],
                   count_valid_pregame_capture_records=len(capture))
    except Exception as exc:
        out["error"]=str(exc)[:350]
    return out

def main():
    from argparse import ArgumentParser
    ap=ArgumentParser()
    ap.add_argument("--output",default="data/ncaam-preseason-roster-source-provenance.json")
    args=ap.parse_args()
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
        records=list(ex.map(audit_source,SOURCES))
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
        archives=list(ex.map(archive_probe,SOURCES))
    for r,a in zip(records,archives):
        r["wayback_index"]=a
        r["immutable_prior_to_first_game_content_verified"]=False
        # Wayback CDX capture metadata alone does not prove the archived BYTES
        # contain the claimed roster. Need to retrieve+match archived PDF bytes.
    summary={"school_season_documents_tested":len(records),
             "official_documents_retrieved":sum(r["content_fetched"] for r in records),
             "preseason_dated_documents_retrieved":sum(r["content_fetched"] and r["preseason_dated_url"] for r in records),
             "fully_verified_365_team_preseason_roster_snapshots":0,
             "dataset_complete_for_2024_2025_training_2026_holdout":False}
    result={"audit":"ncaam-2024-2026-original-preopening-roster-sources",
            "created_utc":datetime.now(timezone.utc).isoformat(),
            "status":"PARTIAL_SCHOOL_PRESEASON_DOCUMENT_EVIDENCE",
            "existing_retrospective_rosters_promotable":False,
            "rule":"School document URL date is indicative, but only a pre-opening immutable capture containing parsed roster proves as-of membership.",
            "summary":summary,"sources":records}
    Path(args.output).parent.mkdir(parents=True,exist_ok=True)
    Path(args.output).write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps(summary,indent=2))
    if summary["official_documents_retrieved"]==0:
        print("WARN: Official document requests unavailable, archiving query evidence for alternate approach")
if __name__=="__main__":main()
