#!/usr/bin/env python3
"""Verify published NCAA Elo HTML, JavaScript, and 365-team datasets over HTTP."""
import argparse
import hashlib
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime,timezone
from pathlib import Path
FILES={
  "ncaam-elo.html":("elo-quality-comparison","ncaam-elo-page.js"),
  "ncaam-elo-page.js":("data/ncaam-2026-27-scoring-quality-shadow.json","SHADOW_ONLY_DO_NOT_PROMOTE"),
  "data/ncaam-2026-27-scoring-quality-shadow.json":("SHADOW_ONLY_DO_NOT_PROMOTE","roster_informed_elo"),
  "data/ncaam-2026-27-preseason-roster-informed.json":("provisional-roster-identity-linked",),
}
def sha(x):return hashlib.sha256(x).hexdigest()
def check(base,path,root):
    expected=(root/path).read_bytes()
    request=urllib.request.Request(base.rstrip("/")+"/"+path,
        headers={"User-Agent":"SportingLifeTimes-PublicationCheck/1.0","Cache-Control":"no-cache"})
    with urllib.request.urlopen(request,timeout=25) as r:
        body=r.read(2000000)
        status=r.status
    if status!=200:raise ValueError(f"{path} HTTP {status}")
    if not all(s.encode() in body for s in FILES[path]):
        raise ValueError(f"{path} public version is missing required NCAA rating content")
    if sha(body)!=sha(expected):
        raise ValueError(f"{path} is not yet the same version as repository")
    if path.endswith(".json"):
        doc=json.loads(body)
        if doc.get("team_count")!=365 or doc.get("season")!="2026-27" or len(doc.get("rankings",[]))!=365:
            raise ValueError(f"{path} missing complete 365 team rating universe")
        if "scoring-quality-shadow" in path:
            if doc.get("production_elo_approved") is not False or doc.get("status")!="SHADOW_ONLY_DO_NOT_PROMOTE":
                raise ValueError("Experiment incorrectly promoted on public site")
    return {"path":path,"http":status,"bytes":len(body),"sha256":sha(body)}
def main():
    a=argparse.ArgumentParser()
    a.add_argument("--base",default="https://jbryancoburn-netizen.github.io/sporting-life-times/")
    a.add_argument("--tries",type=int,default=18)
    a.add_argument("--pause",type=int,default=12)
    a.add_argument("--out",default="data/ncaam-publication-status.json")
    args=a.parse_args()
    report={"website":args.base,"status":"FAIL","checked_utc":datetime.now(timezone.utc).isoformat(),
            "attempts":0,"files":[],"last_error":""}
    for attempt in range(1,args.tries+1):
        report["attempts"]=attempt
        try:
            report["files"]=[check(args.base,name,Path(".")) for name in FILES]
            report["status"]="PASS"
            report["last_error"]=""
            break
        except (OSError,ValueError,TimeoutError,urllib.error.URLError) as exc:
            report["last_error"]=str(exc)[:650]
            print(f"Live publication attempt {attempt}/{args.tries}: {exc}",file=sys.stderr,flush=True)
            if attempt<args.tries:time.sleep(args.pause)
    destination=Path(args.out)
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2))
    return report["status"]=="PASS"
if __name__=="__main__":sys.exit(0 if main() else 1)
