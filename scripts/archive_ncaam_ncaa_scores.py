#!/usr/bin/env python3
"""Fetch, checksum and archive NCAA-origin men's D1 daily scoreboard responses.

This collects SOURCE EVIDENCE, not approved Elo input. Parsing, identity mapping,
coverage reconciliation and the release gate must run separately.
"""
import argparse
import hashlib
import json
import time
from datetime import date,timedelta,datetime,timezone
from pathlib import Path
from urllib.request import Request,urlopen

DEFAULT_BASE="https://ncaa-api.henrygd.me"
def dates(start,end):
    d=start
    while d<=end:
        yield d
        d+=timedelta(days=1)
def fetch_one(day,base,timeout=25):
    url=f"{base.rstrip('/')}/scoreboard/basketball-men/d1/{day:%Y/%m/%d}/all-conf"
    req=Request(url,headers={"Accept":"application/json","User-Agent":"SportingLifeTimesNCAAMArchive/1.0"})
    with urlopen(req,timeout=timeout) as response:
        body=response.read(6_000_000)
    parsed=json.loads(body)
    if not isinstance(parsed,dict) or not isinstance(parsed.get("games"),list):
        raise ValueError("Unexpected NCAA scoreboard payload shape")
    return url,parsed,hashlib.sha256(body).hexdigest()
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--start",type=date.fromisoformat,required=True)
    p.add_argument("--end",type=date.fromisoformat,required=True)
    p.add_argument("--base",default=DEFAULT_BASE)
    p.add_argument("--root",type=Path,default=Path("data/ncaam-source-archive"))
    p.add_argument("--max-days",type=int,default=15)
    a=p.parse_args()
    days=(a.end-a.start).days+1
    if days<1 or days>a.max_days or a.max_days<1:
        p.error("Invalid window; process in bounded 15-day batches by default")
    errors=[]
    for d in dates(a.start,a.end):
        dest=a.root/f"{d:%Y}"/f"{d:%m}"/f"{d:%d}.json"
        try:
            url,payload,sha=fetch_one(d,a.base)
            record={"source_url":url,"canonical_url":f"https://www.ncaa.com/scoreboard/basketball-men/d1/{d:%Y/%m/%d}/all-conf",
                    "source_kind":"NCAA-origin via independently operated ncaa-api bridge",
                    "retrieved_at":datetime.now(timezone.utc).isoformat(),
                    "raw_sha256":sha,"day":d.isoformat(),"count":len(payload["games"]),"payload":payload}
            dest.parent.mkdir(parents=True,exist_ok=True)
            dest.write_text(json.dumps(record,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
            print(d,len(payload["games"]),"archived")
        except Exception as ex:
            errors.append({"day":d.isoformat(),"error":type(ex).__name__+": "+str(ex)[:200]})
            print(d,"FAILED",errors[-1]["error"])
        time.sleep(0.4)
    if errors:
        a.root.mkdir(parents=True,exist_ok=True)
        (a.root/"errors.json").write_text(json.dumps(errors,indent=2)+"\n")
        raise SystemExit(f"{len(errors)} date(s) failed; no claim of complete coverage")
if __name__=="__main__":main()
