#!/usr/bin/env python3
"""Reconcile 2026-27 school identities with NCAA-origin 2025-26 numeric crosswalk.

Prefer actual NCAA-team-ID <-> ESPN-team-ID pairs embedded in NCAA-origin
2025-26 player box scores. Use exact team name only as a separately attributed
fallback. Never fuzzy-match, and never silently accept conflicting identities.
"""
import json,re,urllib.request
from pathlib import Path
from collections import defaultdict
from backtest_ncaam_roster_elo import fetch
URL="https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?groups=50&limit=500"
NCAA_BOX="https://github.com/sportsdataverse/sportsdataverse-data/releases/download/ncaa_mbb_player_box/ncaa_mbb_player_box_2026.csv.gz"
def norm(s):return re.sub("[^a-z0-9]","",str(s or "").lower().replace("&","and"))
def crosswalk(canonical,records,box):
    names={}
    byespn={}
    for x in records:
        uid=str(x.get("id") or "").strip()
        if not uid:continue
        byespn[uid]=x
        for label in (x.get("location"),x.get("shortDisplayName"),x.get("displayName")):
            if norm(label):names.setdefault(norm(label),set()).add(uid)
    pair=defaultdict(set);reverse=defaultdict(set)
    for row in box:
        n=str(row.get("team_ncaa_team_id") or "").strip()
        e=str(row.get("team_espn_team_id") or "").strip()
        if n.isdigit() and e.isdigit():
            pair["ncaa:"+n].add(e)
            reverse[e].add("ncaa:"+n)
    matched=[];missing=[];seen=set()
    for t in canonical:
        old=pair.get(t["id"],set())
        candidate=None;method=None
        if len(old)==1:
            eid=next(iter(old))
            if len(reverse[eid])==1 and eid not in seen:
                candidate=eid
                method="verified-NCAA-origin-2026-ID-pair"
        if candidate is None:
            nameids=names.get(norm(t["name"]),set())
            if len(nameids)==1:
                eid=next(iter(nameids))
                if len(reverse.get(eid,set()))<=1 and eid not in seen:
                    candidate=eid;method="exact-team-name-fallback"
        if candidate is None:
            missing.append({"name":t["name"],"id":t["id"],"number_of_ncaabox_candidates":len(old),
                            "number_of_exact_name_candidates":len(names.get(norm(t["name"]),set()))})
            continue
        seen.add(candidate)
        matched.append({"id":t["id"],"name":t["name"],"espn_id":candidate,
            "espn_name":byespn.get(candidate,{}).get("displayName"),
            "match_method":method,
            "source_url":NCAA_BOX if method=="verified-NCAA-origin-2026-ID-pair" else URL})
    return matched,missing
def main():
    root=Path("data")
    canonical=json.loads((root/"ncaam-2026-27-team-registry.json").read_text())["teams"]
    req=urllib.request.Request(URL,headers={"User-Agent":"SportingLifeTimes/1.0"})
    with urllib.request.urlopen(req,timeout=30) as resp:payload=json.loads(resp.read(5000000))
    leagues=[l for sp in payload.get("sports",[]) for l in sp.get("leagues",[])]
    records=[w.get("team",w) for l in leagues for w in l.get("teams",[])]
    if len(records)<300:raise ValueError("Incomplete ESPN team directory")
    matched,missing=crosswalk(canonical,records,fetch("ncaa_mbb_player_box",2026))
    result={"status":"NCAA-origin ID crosswalk; ESPN current roster source",
      "season":"2026-27","primary_identity_source":NCAA_BOX,
      "secondary_directory_source":URL,"teams":matched,"unmatched":missing,
      "registry_count":len(canonical),"espn_count":len(records),"matched":len(matched),
      "matched_by_method":{m:sum(x["match_method"]==m for x in matched) for m in
              ("verified-NCAA-origin-2026-ID-pair","exact-team-name-fallback")}}
    (root/"ncaam-2026-27-espn-team-crosswalk.json").write_text(json.dumps(result,indent=2)+"\n")
    print("NCAA-anchored canonical team crosswalk:",len(matched),"of",len(canonical),
          "; methods:",result["matched_by_method"],"; unresolved:",len(missing))
    if len(matched)<350:raise ValueError("Insufficient NCAA-origin school crosswalk")
if __name__=="__main__":main()
