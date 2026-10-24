#!/usr/bin/env python3
"""Find verified ESPN IDs from actual scheduled events for absent NCAA teams."""
import json
from datetime import date,timedelta
from pathlib import Path
from ncaam_espn_source import fetch_day
from update_ncaam_season import school_key

ALIASES={"Queens (NC)":["Queens","Queens University","Queens University of Charlotte","Queens Royals"],
         "Lindenwood":["Lindenwood","Lindenwood Lions"],
         "Southern Ind.":["Southern Indiana","Southern Indiana Screaming Eagles","USI"]}
def audit(fetcher=fetch_day):
    evidence={name:[] for name in ALIASES}
    errors=[]
    for offset in range(21):
        day=date(2026,11,1)+timedelta(days=offset)
        try:events=fetcher(day)
        except Exception as exc:
            errors.append({"date":day.isoformat(),"error":str(exc)[:130]})
            continue
        for event in events:
            for comp in event.get("competitions",[]):
                for c in comp.get("competitors",[]):
                    t=c.get("team") or {}
                    labels=[str(t.get(k) or "") for k in ("location","displayName","shortDisplayName","name")]
                    for name,variants in ALIASES.items():
                        if any(school_key(label)==school_key(variant) for label in labels for variant in variants):
                            row={"espn_id":str(t.get("id") or ""),"event_id":str(event.get("id") or ""),
                                 "date":day.isoformat(),"provider_labels":labels}
                            if row not in evidence[name]:evidence[name].append(row)
    return {"season":"2026-27","provider":"ESPN scheduled event participant IDs",
            "programs":{name:{"observed_ids":sorted({r["espn_id"] for r in found if r["espn_id"]}),
                               "event_evidence":found[:15],
                               "status":"OBSERVED_REQUIRES_VERIFICATION" if found else "NO_ID_OBSERVED"}
                        for name,found in evidence.items()},
            "request_errors":errors,"note":"No candidate is automatically promoted to Elo."}
if __name__=="__main__":
    result=audit()
    path=Path("data/ncaam-2026-27-missing-team-id-evidence.json")
    path.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({name:obj["observed_ids"] for name,obj in result["programs"].items()},indent=2))
