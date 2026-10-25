#!/usr/bin/env python3
"""Batch-discover official season-specific NCAA basketball roster pages.

Use broad 2026-27 university URL directory as discovery seeds ONLY.
A historical URL is never itself proof of an opening-day roster.
"""
import argparse,concurrent.futures,json,re,urllib.request,urllib.error
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlparse,urlunparse
YEARS=(2024,2025,2026)
def historical_url(url,year):
    p=urlparse(url)
    path=p.path.rstrip("/")
    if not re.search(r"/sports/mens-basketball/roster$",path):
        return None
    year_path=f"{year-1}-{year%100:02d}"
    return urlunparse(p._replace(path=path+"/"+year_path,query="",fragment=""))
def check(item):
    school,year,url=item
    result={"team":school,"season_end_year":year,"candidate_url":url,
            "status":"UNVERIFIED","preopening_membership_verified":False}
    try:
        req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; SportingLifeTimes-Research/1.0)"})
        with urllib.request.urlopen(req,timeout=12) as resp:
            data=resp.read(350000)
            status=resp.status
            final_url=resp.url
        body=data.decode("utf8","replace")
        expected=f"{year-1}-{year%100:02d}"
        result.update(http_status=status,resolved_url=final_url,
            season_string_found=expected in body,
            player_name_context_found=bool(re.search("(?i)(roster|student-athlete|jersey)",body)),
            status="RETRIEVED_CANDIDATE_NOT_DATE_VERIFIED")
    except Exception as exc:
        result.update(status="FETCH_FAILED",error=str(exc)[:160])
    return result
def main():
    a=argparse.ArgumentParser()
    a.add_argument("--batch",type=int,default=0)
    a.add_argument("--batch-size",type=int,default=100)
    a.add_argument("--workers",type=int,default=12)
    a.add_argument("--directory",default="data/ncaam-2026-27-official-roster-urls.json")
    a.add_argument("--outdir",default="data/ncaam-historical-bulk-discovery")
    args=a.parse_args()
    if args.batch_size<1 or args.workers<1:raise ValueError("invalid batch size")
    directory=json.loads(Path(args.directory).read_text())
    schools=sorted(directory.items())
    left=args.batch*args.batch_size
    selected=schools[left:left+args.batch_size]
    tasks=[(school,year,historical_url(url,year))
           for school,url in selected for year in YEARS
           if historical_url(url,year)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        results=list(pool.map(check,tasks))
    output={"generated_utc":datetime.now(timezone.utc).isoformat(),
       "batch":args.batch,"batch_size":args.batch_size,
       "school_directory_count":len(schools),
       "schools_in_batch":len(selected),"historical_page_candidates":len(tasks),
       "retrieved":sum(x["status"]=="RETRIEVED_CANDIDATE_NOT_DATE_VERIFIED" for x in results),
       "season_string_matches":sum(x.get("season_string_found",False) for x in results),
       "preopening_rosters_certified":0,
       "status":"BULK_HISTORICAL_URL_DISCOVERY_ONLY","results":results}
    target=Path(args.outdir)/f"batch-{args.batch:02d}.json"
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(output,indent=2)+"\n")
    print(json.dumps({k:v for k,v in output.items() if k!="results"},indent=2))
if __name__=="__main__":main()
