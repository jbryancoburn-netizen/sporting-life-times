#!/usr/bin/env python3
"""Test real 2026-27 college basketball result source availability.
Never claim games were fetched if sources are missing.
"""
import json,urllib.request,urllib.error
from datetime import datetime,timezone
from pathlib import Path
from update_ncaam_season import SCHEDULE
ESPN="https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=20261102&limit=500&groups=50"

def probe():
    report={"checked_at_utc":datetime.now(timezone.utc).isoformat(),
        "ncaa_archive_url":SCHEDULE,"espn_test_url":ESPN}
    try:
        req=urllib.request.Request(SCHEDULE,headers={"User-Agent":"SportingLifeTimes/1.0"})
        with urllib.request.urlopen(req,timeout=35) as response:
            content=response.read(5)
            report["ncaa_archive_http_status"]=response.status
            report["ncaa_archive_gzip_header"]=content.startswith(bytes((31,139)))
    except (urllib.error.HTTPError,urllib.error.URLError,TimeoutError) as e:
        report["ncaa_archive_error"]=str(e)[:250]
    try:
        req=urllib.request.Request(ESPN,headers={"User-Agent":"SportingLifeTimes/1.0"})
        with urllib.request.urlopen(req,timeout=35) as response:
            doc=json.load(response)
        events=doc.get("events",[])
        report["espn_http_status"]=200
        report["espn_events_sample_count"]=len(events)
        if events:
            example=events[0]
            report["espn_event_has_verifiable_final_status"]=isinstance(example.get("status",{}).get("type",{}).get("completed"),bool)
            report["espn_sample_competitor_ids"]=[c.get("team",{}).get("id") for c in example.get("competitions",[{}])[0].get("competitors",[])]
    except (urllib.error.HTTPError,urllib.error.URLError,TimeoutError,ValueError) as e:
        report["espn_error"]=str(e)[:250]
    return report

if __name__=="__main__":
    p=Path("data/ncaam-2026-27-live-source-readiness.json")
    p.parent.mkdir(exist_ok=True)
    result=probe()
    p.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps(result,indent=2))
