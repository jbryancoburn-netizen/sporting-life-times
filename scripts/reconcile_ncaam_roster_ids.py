#!/usr/bin/env python3
"""Establish audited ESPN-to-canonical 2026-27 school IDs from team list."""
import json,re,urllib.request
from pathlib import Path
URL="https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?groups=50&limit=500"
def norm(s):return re.sub("[^a-z0-9]","",str(s or "").lower().replace("&","and"))
def main():
    root=Path("data")
    canonical=json.loads((root/"ncaam-2026-27-team-registry.json").read_text())["teams"]
    url=urllib.request.Request(URL,headers={"User-Agent":"SportingLifeTimes/1.0"})
    with urllib.request.urlopen(url,timeout=30) as resp:payload=json.loads(resp.read(5000000))
    sports=payload.get("sports",[])
    leagues=[l for s in sports for l in s.get("leagues",[])]
    records=[w.get("team",w) for l in leagues for w in l.get("teams",[])]
    index={}
    for x in records:
        for label in (x.get("location"),x.get("shortDisplayName"),x.get("displayName")):
            if norm(label):index.setdefault(norm(label),[]).append(x)
    matched=[];missing=[]
    for t in canonical:
        found={str(e.get("id")):e for e in index.get(norm(t["name"]),[])}
        if len(found)==1:
            e=list(found.values())[0]
            matched.append({"id":t["id"],"name":t["name"],"espn_id":str(e["id"]),
                 "espn_name":e.get("displayName"),"source_url":URL})
        else:missing.append({"name":t["name"],"id":t["id"],"number_of_exact_candidates":len(found)})
    result={"status":"candidate-crosswalk-needs-review","season":"2026-27",
      "source_url":URL,"teams":matched,"unmatched":missing,"registry_count":len(canonical),
      "espn_count":len(records),"matched":len(matched)}
    (root/"ncaam-2026-27-espn-team-crosswalk.json").write_text(json.dumps(result,indent=2)+"\n")
    print("ESPN teams:",len(records),"canonical matched:",len(matched),"unmatched:",len(missing))
    if len(records)<300:raise ValueError("Insufficient ESPN D1 listing")
if __name__=="__main__":main()
