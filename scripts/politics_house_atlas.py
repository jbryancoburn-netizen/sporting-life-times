#!/usr/bin/env python3
"""Build 435 complete *pages* of sourced US House context, NOT 2026 predictions.

The FEC gives us the 435-seat geographic ID inventory, not ballot candidates.
The 2024 House election extract and 2024 presidential county aggregate are
prior-cycle observations. Nine redrawn 2026 states cannot use an identically
numbered 2024 district return as current-boundary context.
2026 poll records use a separate source-reviewed candidate poll ledger.
"""
from __future__ import annotations
import datetime as dt
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/"politics-house-atlas.json"
STATES=set("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split())
MAP_CHANGED=set("AL CA FL LA NC OH TN TX UT".split())
POLL_FILE="politics-house-district-polls.json"

def load(name):
    return json.loads((ROOT/name).read_text(encoding="utf-8"))

def finite_vote(n):
    return isinstance(n,int) and not isinstance(n,bool) and n>=0

def build(fec,historical,county,ballots,geography,politics,polls,compiled=None,unopposed=None):
    if fec.get("status")!="ok" or fec.get("cycle")!=2026 or fec.get("house_district_inventory")!=435:
        raise ValueError("FEC actual 2026 congressional district list incomplete")
    if historical.get("status")!="ok" or 2024 not in historical.get("years",[]):
        raise ValueError("Original 2024 House returns unavailable")
    if county.get("status")!="ok" or county.get("election_year")!=2024 or county.get("geography")!="county_or_equivalent_not_congressional_district":
        raise ValueError("Unverified 2024 county presidential returns")
    if ballots.get("model_eligible") is not False:
        raise ValueError("Do not treat partial official candidate records as certified forecasts")
    if geography.get("status")!="OFFICIAL_2026_BOUNDARY_VINTAGE_RESEARCH_ONLY" or set(geography.get("official_2026_boundary_change_states",[]))!=MAP_CHANGED:
        raise ValueError("2026 district boundary vintage guard missing")
    if polls.get("election_year")!=2026 or polls.get("status")!="SOURCE_ATTRIBUTED_INDIVIDUAL_HOUSE_POLLS":
        raise ValueError("Polls require vetted district-specific evidence ledger")
    position={s[0]:{"name":s[1],"col":s[2],"row":s[3]} for s in politics.get("states",[])}
    if set(position)!=STATES:
        raise ValueError("State map must contain every state")
    pres={s["state"]:s for s in county.get("states",[]) if s.get("state") in STATES}
    if set(pres)!=STATES:raise ValueError("Presidential county return state coverage incomplete")
    for code,row in pres.items():
        if not finite_vote(row.get("dem_votes")) or not finite_vote(row.get("rep_votes")) or row["dem_votes"]+row["rep_votes"]<=0:
            raise ValueError("Missing real 2024 statewide presidential votes for "+code)
    old={}
    for x in historical.get("house",[]):
        if x.get("year")!=2024:continue
        rid=x.get("id")
        if rid in old:raise ValueError("Duplicate 2024 House result "+str(rid))
        old[rid]=x
    source_urls={s["id"]:s["url"] for s in ballots.get("sources",[])}
    candidates={}
    for race in ballots.get("races",[]):
        if race.get("office")!="H":continue
        if race["id"] in candidates:raise ValueError("Duplicate official House ballot")
        candidates[race["id"]]=race
    race_polls={}
    for p in polls.get("polls",[]):
        rid=p.get("race_id")
        if rid not in {r["id"] for r in fec["house"]}: raise ValueError("Poll incorrectly assigned to invalid 2026 House district "+str(rid))
        if p.get("source_verified") is not True or p.get("election_year")!=2026 or not p.get("source_url","").startswith("https://"):
            raise ValueError("Unsourced or incorrectly dated district poll")
        parties=[c.get("party") for c in p.get("candidates",[])]
        if len(parties)<2 or any(x not in ("D","R","I","L","G","O") for x in parties):
            raise ValueError("Poll candidate fields invalid")
        if p.get("end_date","")<"2026-01-01" or p.get("end_date","")>"2026-11-03":
            raise ValueError("Poll dated outside 2026 campaign")
        if not 100<=p.get("sample_size",0)<=15000:
            raise ValueError("Poll lacks valid sample size")
        for c in p["candidates"]:
            if not isinstance(c.get("pct"),(float,int)) or not 0<=c["pct"]<=100: raise ValueError("Invalid poll percentage")
        row={**p,"source_tier":"original_release_checked","question_type":"named_house"}
        race_polls.setdefault(rid,[]).append(row)
    if compiled is not None:
        if compiled.get("status")!="SECONDARY_LATEST_HOUSE_POLL_COMPILATION_NOT_PRIMARY_VERIFIED" or compiled.get("election_year")!=2026 or not 95<=compiled.get("polled_districts",0)<=135:
            raise ValueError("Public secondary House district poll compilation is not certified")
        if compiled["polled_districts"]!=len(compiled.get("polls",[])):
            raise ValueError("Public compilation count does not match rows")
        for p in compiled["polls"]:
            rid=p.get("race_id")
            if rid not in {row["id"] for row in fec["house"]}:raise ValueError("Compiled poll points outside 2026 House districts")
            if p.get("source_verified") is not False or p.get("compilation_verified") is not True or p.get("sample_size") is not None or p.get("sponsorship_not_independently_verified") is not True:
                raise ValueError("Secondhand polling must never claim independently checked originals, samples or sponsor")
            if p.get("source_type")!="public_nyt_cc_by_compilation_as_reported_by_peoples_poll" or p.get("compilation_url")!="https://peoplespoll.com/house":
                raise ValueError("Not a publicly reviewed compilation source")
            if not p.get("source_url","").startswith("https://") or not "2026-" in p.get("end_date",""):
                raise ValueError("Missing published poll date or original hyperlink")
            if p.get("question_type") not in ("generic_house","named_house"):
                raise ValueError("Unclassified candidate-vs-generic poll")
            if len(p.get("candidates",[]))<2 or sum(c.get("pct",0) for c in p["candidates"])>101.5:
                raise ValueError("Impossible or incomplete public poll percentages")
            if any(c.get("party") not in ("D","R","I","L","G","O") or not isinstance(c.get("pct"),(int,float)) or not 0<=c["pct"]<=100 for c in p["candidates"]):
                raise ValueError("Invalid public poll party or percentage")
            previous=race_polls.get(rid,[])
            # The same original survey is not counted twice because two
            # publishers described it. Prefer a directly checked release.
            duplicate=any(q["source_url"].rstrip("/").casefold()==p["source_url"].rstrip("/").casefold()
                          or (abs((dt.date.fromisoformat(q["end_date"])-dt.date.fromisoformat(p["end_date"])).days)<=3
                              and q["pollster"].split()[0].casefold().strip(",")==p["pollster"].split()[0].casefold().strip(","))
                          for q in previous)
            if not duplicate:race_polls.setdefault(rid,[]).append({**p,"source_tier":"public_compilation_not_original_checked"})
    for vals in race_polls.values():
        vals.sort(key=lambda p:(p["end_date"],p.get("source_tier")=="original_release_checked",p["id"]),reverse=True)
    # Recover historically unopposed winners from original election-office
    # documents without fabricating votes or a numerical margin. This is
    # winner-only context, not a substitute for MEDSL counted-vote records.
    recovered={}
    if unopposed is not None:
        if (unopposed.get("status")!="OFFICIAL_2024_UNOPPOSED_HOUSE_WINNER_CONTEXT_NO_VOTE_TOTALS"
            or unopposed.get("reference_election")!="2024-11-05"):
            raise ValueError("Unverified official winner-only historical evidence")
        rows=unopposed.get("records",[])
        if {x.get("id") for x in rows}!={"FL-20","OK-03"} or len(rows)!=2:
            raise ValueError("Winner-only results must reconcile exactly two independently sourced omissions")
        for x in rows:
            rid=x["id"]
            if x.get("year")!=2024 or x.get("contest_status")!="elected_unopposed" or x.get("general_election_vote_totals_available") is not False:
                raise ValueError("Numeric votes or election status fabricated for "+rid)
            if x.get("party") not in ("D","R") or not x.get("winner") or x.get("state")+"-"+x.get("district")!=rid:
                raise ValueError("Invalid original unopposed winner")
            url=x.get("source_url","")
            if not (url.startswith("https://dos.elections.myflorida.com/candidates/CanList.asp") if rid=="FL-20"
                    else url.startswith("https://former.okhouse.gov/Journals/HJ2025/")):
                raise ValueError("Original official election source missing for "+rid)
            if rid in old:
                raise ValueError("Winner-only recovery must not overwrite actual numeric vote totals")
            if x.get("verified_2026_geographic_comparability")!=(x["state"] not in MAP_CHANGED):
                raise ValueError("Historical voting geography incorrectly inherited for "+rid)
            recovered[rid]=x
    records=[]
    all_ids=set()
    for row in fec["house"]:
        rid=row["id"]
        if rid in all_ids or row.get("state") not in STATES or not rid.startswith(row["state"]+"-"):
            raise ValueError("FEC district inventory contains duplicate/invalid House ID")
        all_ids.add(rid)
        state=row["state"]
        dist=rid.split("-")[1]
        if len(dist)!=2 or not dist.isdigit():raise ValueError("Noncanonical district ID")
        hist=old.get(rid)
        past=None
        if hist:
            if hist.get("party_winner") not in ("D","R"):raise ValueError("Unverified 2024 House winner party")
            dv,rv=hist.get("dem_votes"),hist.get("rep_votes")
            if not finite_vote(dv) or not finite_vote(rv):raise ValueError("Invalid 2024 House winner total")
            pp=hist.get("two_party_margin")
            if not hist.get("both_major_parties") or not isinstance(pp,(int,float)):
                pp=None
            past={"year":2024,"winner":hist.get("winner_name"),"party":hist["party_winner"],
                  "dem_votes":dv,"rep_votes":rv,"other_votes":hist.get("other_votes"),
                  "total_votes":hist.get("total_votes"),"dem_two_party_margin_pp":pp,
                  "both_major_parties":hist.get("both_major_parties") is True,
                  "source_url":hist.get("source"),
                  "same_2026_geography":state not in MAP_CHANGED}
        current=candidates.get(rid)
        record={"id":rid,"state":state,"district":dist,"at_large":dist=="00",
                "2026_boundaries_revised":state in MAP_CHANGED,
                "official_2026_candidate_snapshot":None if not current else {
                    "reviewed_at":ballots["reviewed_at"],
                    "source_id":current["source_id"],
                    "source_url":source_urls.get(current["source_id"]),
                    "candidates":current["candidates"],
                    "contest_status":current.get("contest_status","general_ballot_listed")
                },
                "registered_fec_filings_2026":row.get("registered_filings",0),
                "fec_records_are_not_qualified_nominees":True,
                "2024_house_result_on_prior_boundaries":past,
                "2024_unopposed_official_context":recovered.get(rid),
                "district_specific_2026_polls":race_polls.get(rid,[]),
                "2026_forecast":None}
        records.append(record)
    if len(records)!=435 or len(all_ids)!=435 or len({r["id"] for r in records})!=435:
        raise ValueError("Every House office must get exactly one unique page")
    if any(id not in all_ids for id in candidates): raise ValueError("Official candidate record outside 435 House IDs")
    states=[]
    for code in sorted(STATES):
        ids=[r for r in records if r["state"]==code]
        dem=pres[code]["dem_votes"];rep=pres[code]["rep_votes"]
        margin=round((dem-rep)/(dem+rep)*100,3)
        states.append({
            "code":code,"name":position[code]["name"],"col":position[code]["col"],"row":position[code]["row"],
            "district_count":len(ids),"district_ids":[d["id"] for d in ids],
            "2024_presidential_actual":{"dem_votes":dem,"rep_votes":rep,"dem_margin_pp":margin,
                 "winner_party":"D" if margin>0 else "R" if margin<0 else "TIE",
                 "source_url":county.get("source")},
            "2026_house_poll_count":sum(len(d["district_specific_2026_polls"]) for d in ids),
            "2026_verified_house_nominee_offices":sum(bool(d["official_2026_candidate_snapshot"]) for d in ids),
            "2026_congressional_map_changed":code in MAP_CHANGED
        })
    if sum(s["district_count"] for s in states)!=435:raise ValueError("Seat apportionment mismatch")
    old_missing=sorted(all_ids-set(old))
    if len(old_missing)>5:raise ValueError("Too many missing 2024 House return rows")
    return {
        "status":"COMPLETE_435_DISTRICT_RESEARCH_ATLAS_NOT_FORECAST",
        "generated_at":dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "election_date":"2026-11-03",
        "district_count":435,"state_count":50,
        "2024_house_results_found":len(all_ids-set(old_missing)),
        "2024_house_result_missing_districts":old_missing,
        "2024_unopposed_winners_verified":len(recovered),
        "2026_official_ballot_offices":len(candidates),
        "2026_district_poll_count":sum(len(x["district_specific_2026_polls"]) for x in records),
        "2026_polled_districts":sum(bool(x["district_specific_2026_polls"]) for x in records),
        "2026_directly_checked_release_count":sum(sum(p.get("source_tier")=="original_release_checked" for p in x["district_specific_2026_polls"]) for x in records),
        "2026_secondary_compilation_poll_count":sum(sum(p.get("source_tier")=="public_compilation_not_original_checked" for p in x["district_specific_2026_polls"]) for x in records),
        "2026_changed_map_states":sorted(MAP_CHANGED),
        "source_notes":{
            "district_id_source":"FEC 2026 candidate master district index; NOT proof of ballot access",
            "prior_house_results":historical.get("source")+" (2024 House official-source-derived election returns)",
            "state_shading":"2024 actual statewide presidential two-party vote margin, never 2026 state prediction",
            "district_shading":"Most recent directly sourced 2026 district poll (when valid), otherwise 2024 actual House winner and two-party vote margin ONLY where unchanged congressional boundaries; gray denotes insufficient comparable evidence",
            "2026_polls":"politics-house-district-polls.json directly checked originals, plus politics-house-polls-compilation.json secondary public latest-poll summaries; each individually attributed; NOT averages or election outcomes",
            "2026_official_candidates":"State government snapshot; remaining districts have no confirmed candidate slate",
            "geography":"U.S. Census 120th Congressional District geography guard; nine states changed 2026 boundaries",
            "2024_unopposed_winners":"Two official state election-office unopposed winners are recovered separately; no general-election vote totals or margins are imputed"
        },
        "states":states,"districts":records,
        "forecast_eligible":False,"certified_2026_probabilities":0,
        "warning":"Compiled latest poll summaries are secondary evidence with samples and sponsorship unverified; historical margins are previous election results, not 2026 probabilities. Redistricted states' 2024 district returns do NOT apply to 2026 geography. Generic ballot surveys, national polls, DDHQ probabilities and candidate filings are never presented as district-specific polling. Missing data remain labeled."
    }

def validate_florida_original_block_records(comparisons, florida):
    """Independently re-derive 28 district matches from the official Florida block matrix.

    This is geometric block membership, not voter turnout or demographic weight.
    """
    if (florida.get("status")!="OFFICIAL_BLOCK_REASSIGNMENTS_VERIFIED_NOT_VOTE_RESULTS"
        or florida.get("source_block_inventory_identical") is not True
        or florida.get("2020_census_block_vintage_aligned") is not True
        or florida.get("congressional_districts_each_plan")!=28):
        raise ValueError("Florida 2024/2026 official Census block comparison unavailable")
    matrix=florida["comparison"]["matrix"]
    if florida["comparison"]["total_2020_census_blocks"]!=390066:
        raise ValueError("Unexpected Florida source block inventory")
    ledger=comparisons["records"]
    certified_unchanged=0
    for number in range(1,29):
        code=f"{number:02}"
        old=sum(int(r["2020_blocks"]) for r in matrix if r["district_2024"]==code)
        current=sum(int(r["2020_blocks"]) for r in matrix if r["district_2026"]==code)
        shared=sum(int(r["2020_blocks"]) for r in matrix if r["district_2024"]==code and r["district_2026"]==code)
        incoming=current-shared
        outgoing=old-shared
        if old<=0 or current<=0 or incoming<0 or outgoing<0:
            raise ValueError("Invalid Florida original census block assignment "+code)
        expected="verified_same_district_blocks" if incoming==0 and outgoing==0 else "verified_changed_district_blocks"
        record=ledger[f"FL-{code}"]
        if (record["status"]!=expected
            or record.get("same_2026_geography") is not (expected=="verified_same_district_blocks")
            or record.get("previous_plan_blocks")!=old
            or record.get("current_plan_blocks")!=current
            or record.get("matching_2020_blocks")!=shared
            or record.get("incoming_2020_blocks")!=incoming
            or record.get("outgoing_2020_blocks")!=outgoing):
            raise ValueError("Florida block findings disagree with official source in FL-"+code)
        certified_unchanged+=expected=="verified_same_district_blocks"
    if certified_unchanged!=5:
        raise ValueError("Florida district identity certification no longer agrees with source")
    if sum(int(r["2020_blocks"]) for r in matrix)!=390066:
        raise ValueError("Florida original block comparison has inconsistent total assignments")
    return True


def apply_verified_district_evidence(atlas, finalists, comparisons):
    """Preserve state-certified 2024 finalists and assess geography per district.

    The source MEDSL extract aggregates same-party candidates into party totals.
    Neither a second Democrat nor a second Republican is an unopposed contest.
    A state map revision alone cannot establish a specific numbered district moved.
    """
    verified=finalists.get("records",{})
    boundary=comparisons.get("records",{})
    if finalists.get("schema_version")!=1 or len(verified)!=7:
        raise ValueError("Expected seven verified 2024 finalist contests")
    if comparisons.get("schema_version")!=1 or len(boundary)!=435:
        raise ValueError("A 435-district map-comparison ledger is mandatory")
    if {r["id"] for r in atlas["districts"]}!=set(boundary):
        raise ValueError("Every House district requires a map comparison")
    for district in atlas["districts"]:
        rid=district["id"]
        evidence=boundary[rid]
        status=evidence.get("status")
        if status not in ("pending_district_block_comparison","unchanged_state_vintage","verified_same_district_blocks","verified_changed_district_blocks"):
            raise ValueError("Unknown district geography status "+rid)
        match=status in ("unchanged_state_vintage","verified_same_district_blocks")
        if (evidence.get("same_2026_geography") is True)!=match:
            raise ValueError("District geography match lacks verification "+rid)
        district["2024_to_2026_geography_comparison"]=status
        district["2022_to_2024_geography_comparison"]=evidence["comparison_2022_to_2024"]
        district["2024_to_2026_same_geography_verified"]=match
        if "matching_2020_blocks" in evidence:
            district["2024_to_2026_block_comparison"]={
                "same_blocks":evidence["matching_2020_blocks"],
                "incoming_blocks":evidence["incoming_2020_blocks"],
                "outgoing_blocks":evidence["outgoing_2020_blocks"],
                "source_url":evidence["source_url"],"unweighted":True,
            }
        result=district.get("2024_house_result_on_prior_boundaries")
        if result:
            result["same_2026_geography"]=match
            result["geography_comparison_status"]=status
        official=verified.get(rid)
        if not official:continue
        if result is None:raise ValueError("No historical vote tally "+rid)
        people=official["finalists"]
        if len(people)!=2 or people[0]["votes"]<people[1]["votes"]:
            raise ValueError("Finalist ordering incorrect "+rid)
        if (sum(c["votes"] for c in people if c["party"]=="D")!=result["dem_votes"]
            or sum(c["votes"] for c in people if c["party"]=="R")!=result["rep_votes"]
            or result["both_major_parties"]):
            raise ValueError("Candidate totals mismatch MEDSL party aggregate "+rid)
        if official["total_votes"]!=sum(c["votes"] for c in people)+official["write_in_votes"]:
            raise ValueError("Certified 2024 vote totals do not reconcile "+rid)
        if not official["source_url"].startswith("https://"):
            raise ValueError("Official election source is missing "+rid)
        result.update({
            "finalists":people,"contest_type":official["contest_type"],
            "write_in_votes":official["write_in_votes"],
            "total_votes":official["total_votes"],
            "other_votes":sum(c["votes"] for c in people if c["party"] not in ("D","R"))+official["write_in_votes"],
            "winner_runner_up_margin_votes":people[0]["votes"]-people[1]["votes"],
            "candidate_vote_source_url":official["source_url"],
            "candidate_vote_source_authority":official["source_authority"]
        })
    atlas["2024_verified_finalist_contests"]=len(verified)
    atlas["2024_verified_same_party_finalist_contests"]=sum(x["contest_type"]=="same_party_finalists" for x in verified.values())
    atlas["2024_to_2026_district_geography_pending_count"]=sum(x["status"]=="pending_district_block_comparison" for x in boundary.values())
    atlas["2024_to_2026_geography_verified_same_district_count"]=sum(x["status"]=="verified_same_district_blocks" for x in boundary.values())
    atlas["2024_to_2026_geography_verified_changed_district_count"]=sum(x["status"]=="verified_changed_district_blocks" for x in boundary.values())
    if atlas["2024_to_2026_geography_verified_same_district_count"]!=5 or atlas["2024_to_2026_geography_verified_changed_district_count"]!=23:
        raise ValueError("Verified Florida 28-district block inventory no longer reconciles")
    atlas["source_notes"]["historic_top_two_elections"]="Certified same-party 2024 general election candidates retain individual results and vote margins."
    atlas["source_notes"]["district_geography_audit"]="Florida official block comparisons prove five districts unchanged and 23 changed; 145 districts elsewhere remain individually pending. State redraw alone never proves every district changed."
    atlas["source_notes"]["district_shading"]="2024 House returns are previous-cycle results and are comparable to 2026 only after district-specific geography review."
    atlas["warning"]="2024 finalists remain on record including same-party races. A revised state map alone does not prove each district changed. Historical votes never become 2026 predictions."
    return atlas

def main():
    data=build(load("politics-fec-race-index.json"),load("politics-historical-contests.json"),
               load("politics-2024-county-presidential.json"),load("politics-official-ballots.json"),
               load("politics-2026-district-geography.json"),load("politics-data.json"),
               load(POLL_FILE),load("politics-house-polls-compilation.json"),load("politics-2024-unopposed-house.json"))
    district_comparisons=load("politics-district-boundary-comparability.json")
    validate_florida_original_block_records(district_comparisons,load("politics-fl-2024-2026-block-transition.json"))
    data=apply_verified_district_evidence(data,load("politics-2024-finalist-results.json"),district_comparisons)
    OUTPUT.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    print("House atlas:",data["district_count"],"districts,",data["2024_house_results_found"],
          "historical results,",data["2026_official_ballot_offices"],
          "official candidate offices,",data["2026_polled_districts"],"polled districts")
if __name__=="__main__":main()
