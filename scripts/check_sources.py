#!/usr/bin/env python3
"""Validate registry structure and optionally probe candidate public HTTP endpoints.

Usage:
  python scripts/check_sources.py
  python scripts/check_sources.py --probe
Only probes explicitly allowlisted, low-cost GET endpoints. No scraping, authentication,
or retries. Probe success is technical reachability, NOT redistribution permission.
"""
import argparse
import json
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from datetime import datetime, timezone

ROOT=Path(__file__).resolve().parents[1]
REGISTRY=ROOT/"data/sports-source-registry.json"
PROBES={
 "mlb_stats":"https://statsapi.mlb.com/api/v1/sports",
 "nhl_web":"https://api-web.nhle.com/v1/score/now",
 "nba_live":"https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json",
 "jolpica_f1":"https://api.jolpi.ca/ergast/f1/current/last/results.json",
}
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--probe",action="store_true")
    args=parser.parse_args()
    data=json.loads(REGISTRY.read_text(encoding="utf-8"))
    sources=data["sources"]
    ids=[x["id"] for x in sources]
    assert len(ids)==len(set(ids)), "Duplicate provider IDs"
    for s in sources:
        for field in ("id","name","sport","coverage","url","auth","access","role","notes","verified_live","rights_cleared"):
            assert field in s, (s.get("id"),field)
        assert s["url"].startswith("https://"),s["id"]
        assert isinstance(s["coverage"],list) and s["coverage"],s["id"]
    print("Validated",len(sources),"source entries;",len(set(x["sport"] for x in sources)),"sport categories")
    if args.probe:
        output={"checked_at":datetime.now(timezone.utc).isoformat(),"results":[]}
        for id,url in PROBES.items():
            try:
                req=Request(url,headers={"User-Agent":"SportingLifeTimesSourceCheck/1.0","Accept":"application/json"})
                with urlopen(req,timeout=10) as response:
                    status=response.status
                    response.read(128)
                result={"id":id,"status":"reachable","http_status":status}
            except (HTTPError,URLError,TimeoutError,OSError) as exc:
                result={"id":id,"status":"failed","error":str(exc)[:160]}
            output["results"].append(result)
            print(id,result["status"])
        (ROOT/"data/source-health.json").write_text(json.dumps(output,indent=2)+"\n",encoding="utf-8")
if __name__=="__main__":
    main()
