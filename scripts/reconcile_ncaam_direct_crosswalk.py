#!/usr/bin/env python3
"""Verify 2026-27 ESPN roster IDs against pinned 2025-26 NCAA->ESPN crosswalk.

SportsDataverse source has distinct NCAA and ESPN numeric IDs. Its
prior-season team/athlete mapping is used only as identity evidence, never Elo.
Identity links are typed by source matching method. Do not assign missing prior
minutes or guess incoming talent.
"""
import argparse
import hashlib
import json
import urllib.request
from collections import Counter
from pathlib import Path

SOURCE_COMMIT="3ee3a2feece4e854e6a2a44d92495dd5c558c2fa"
SOURCE_BLOB_SHA="a3ef41958b35d2880643f9d24756d6edc20aead3"
SOURCE_PATH="mbb/xwalk/espn_athlete_id/2026.json"
SOURCE_URL=f"https://raw.githubusercontent.com/sportsdataverse/ncaa-mbb-hoops-raw/{SOURCE_COMMIT}/{SOURCE_PATH}"
STRONG_METHODS={"name_jersey","name","last_jersey"}
ALL_METHODS=STRONG_METHODS|{"jaro_winkler"}

def load_pinned_crosswalk():
    request=urllib.request.Request(SOURCE_URL,headers={"User-Agent":"SportingLifeTimes/1.0"})
    with urllib.request.urlopen(request,timeout=90) as response:
        content=response.read(2500000)
    digest=hashlib.sha1(b"blob "+str(len(content)).encode()+b"\0"+content).hexdigest()
    if digest!=SOURCE_BLOB_SHA:
        raise ValueError("Cross-provider ID source changed from pinned verified blob: "+digest)
    result=json.loads(content)
    if not isinstance(result,list) or len(result)<5000:
        raise ValueError("Incomplete NCAA ESPN historical ID crosswalk")
    return result

def reconcile(crosswalk,movement,official):
    if movement.get("season")!="2026-27" or movement.get("roster_teams")!=365 or len(movement.get("teams",[]))!=365:
        raise ValueError("Expected complete 365-team NCAA roster audit")
    indexed={};by_ncaa={};allrows=0
    for x in crosswalk:
        if x.get("espn_athlete_id") in (None,""):
            continue
        eid=str(x["espn_athlete_id"])
        n=str(x.get("ncaa_player_id") or "")
        school=str(x.get("ncaa_team_id") or "")
        method=x.get("match_method")
        if not eid.isdigit() or not n.isdigit() or not school.isdigit() or method not in ALL_METHODS:
            raise ValueError("Malformed or unsupported source crosswalk identity")
        if eid in indexed and indexed[eid]!=x:
            raise ValueError("Conflicting NCAA source for ESPN athlete: "+eid)
        if n in by_ncaa and by_ncaa[n]!=eid:
            raise ValueError("Conflicting ESPN athletes for NCAA player: "+n)
        by_ncaa[n]=eid
        indexed[eid]=x;allrows+=1
    if len(indexed)<5000:
        raise ValueError("Insufficient historical NCAA ESPN athlete evidence")
    official_index={str(x["espn_athlete_id"]):x for x in official.get("records",[])}
    if len(official_index)!=34 or len(official.get("records",[]))!=34:
        raise ValueError("Expected 34 uniquely sourced ambiguous identity resolutions")
    linked=[];without=[];corrected=[];tiers=Counter();origins=Counter();seen=set()
    official_found=set()
    for school in movement["teams"]:
        tid=school["team_id"]
        for athlete in school["players"]:
            eid=str(athlete.get("current_id") or "")
            if not eid or eid in seen:
                raise ValueError("Missing or duplicate current ESPN athlete ID: "+eid)
            seen.add(eid)
            oldstatus=athlete["status"]
            x=indexed.get(eid)
            if x is None:
                without.append({"espn_athlete_id":eid,"player":athlete["player"],
                                "current_team_id":tid,"previous_status":oldstatus})
                continue
            prior="ncaa:"+str(x["ncaa_team_id"])
            newstatus="returner" if prior==tid else "transfer"
            proof=official_index.get(eid)
            if proof is not None:
                official_found.add(eid)
                if proof["team_id"]!=tid or proof["name"]!=athlete["player"] or proof["prior_team_id"]!=prior:
                    raise ValueError("Independent institutional record disagrees with NCAA ID crosswalk: "+eid)
                if proof["classification"]!=newstatus:
                    raise ValueError("Independent institutional returner/transfer status disagrees: "+eid)
            expect={"unique-name-returner-candidate":"returner",
                    "unique-name-transfer-candidate":"transfer"}.get(oldstatus)
            if expect is not None and expect!=newstatus:
                corrected.append({"espn_athlete_id":eid,"player":athlete["player"],"team_id":tid,
                                  "from_unverified":expect,"to_source_linked":newstatus,
                                  "previous_raw_prior_school":athlete.get("prior_school_id"),
                                  "source_prior_school":prior})
            method=x["match_method"]
            origins[oldstatus]+=1
            tiers[method]+=1
            linked.append({
                "espn_athlete_id":eid,"player":athlete["player"],"current_team_id":tid,
                "prior_team_id":prior,"historical_ncaa_player_id":str(x["ncaa_player_id"]),
                "class":"source_linked_"+newstatus,
                "source_match_method":method,
                "source_crosswalk_confidence":"strong" if method in STRONG_METHODS else "fuzzy_review_required",
                "institutional_evidence_agrees":bool(proof),
                "previous_raw_status":oldstatus,
                "historical_minutes_validated":False,
                "production_player_minutes_authorized":False})
    if len(seen)!=movement.get("players_audited"):
        raise ValueError("Roster player audit count changed unexpectedly")
    notlinked=sorted(set(official_index)-official_found)
    if any(official_index[eid]["classification"]!="new-to-d1" for eid in notlinked):
        raise ValueError("Previously ambiguous named player lacks expected NCAA source ID: "+str(notlinked))
    linked.sort(key=lambda x:(x["current_team_id"],x["espn_athlete_id"]))
    without.sort(key=lambda x:(x["current_team_id"],x["espn_athlete_id"]))
    corrected.sort(key=lambda x:(x["team_id"],x["player"]))
    return {"season":"2026-27",
            "source_name":"SportsDataverse NCAA->ESPN per-player season 2026 identity crosswalk",
            "source_commit":SOURCE_COMMIT,
            "source_blob_sha":SOURCE_BLOB_SHA,
            "source_url":SOURCE_URL,
            "source_match_method_counts":dict(tiers),
            "source_prior_status_counts":dict(origins),
            "roster_players":len(seen),
            "source_crosswalk_id_links":len(linked),
            "source_strong_id_links":sum(tiers[m] for m in STRONG_METHODS),
            "source_fuzzy_matches_need_review":tiers["jaro_winkler"],
            "current_players_without_crosswalk":len(without),
            "previously_ambiguous_linked":len(official_found),
            "previously_ambiguous_incoming_without_prior_d1_link":len(notlinked),
            "source_resolved_name_only_classification_errors":len(corrected),
            "total_link_accounted_for":len(linked)+len(without)==len(seen),
            "historical_minutes_loaded":False,
            "production_elo_approved":False,
            "warning":"An upstream name+jersey crosswalk is evidence of two-system ID linkage, not independently verified 2025-26 NCAA player minutes or temporally valid season-opening rosters.",
            "name_candidate_corrections":corrected,
            "linked":linked,
            "unlinked":without}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--movement",type=Path,default=Path("data/ncaam-2026-27-player-movement-audit.json"))
    p.add_argument("--official",type=Path,default=Path("data/ncaam-2026-27-official-player-resolutions.json"))
    p.add_argument("--out",type=Path,default=Path("data/ncaam-2026-27-direct-player-crosswalk.json"))
    a=p.parse_args()
    result=reconcile(load_pinned_crosswalk(),
        json.loads(a.movement.read_text(encoding="utf-8")),
        json.loads(a.official.read_text(encoding="utf-8")))
    a.out.write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print(json.dumps({key:result[key] for key in
          ("roster_players","source_crosswalk_id_links","source_strong_id_links",
           "source_fuzzy_matches_need_review","current_players_without_crosswalk",
           "source_resolved_name_only_classification_errors")},indent=2))
if __name__=="__main__":main()
