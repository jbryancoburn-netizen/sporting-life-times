#!/usr/bin/env python3
"""2026 NCAA men's soccer committee-style PRE-SELECTION RPI forecast.

Independent of RETRO: never read Elo, RETRO margins or prediction outputs.
The committee uses many more facts than this public RPI snapshot supplies.
Make those limitations explicit instead of inventing head-to-head evidence.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RPI = DATA / "college-soccer-ncaa-rpi-nov14-2026.json"
AQ = DATA / "college-soccer-ncaa-automatic-bids-2026.json"
CONF = DATA / "college-soccer-conferences.json"
OUT = DATA / "college-soccer-ncaa-selection-projection-2026.json"

def run():
    snapshot = json.loads(RPI.read_text())
    aq_archive = json.loads(AQ.read_text())
    directory = json.loads(CONF.read_text())["conferences"]
    all_schools = {id for k,c in directory.items() if k.startswith("men-d1:") for id in c.get("teams",[])}
    by_school = {x["team_id"]:x for x in snapshot["rows"]}
    if len(by_school)!=len(snapshot["rows"]) or len({x["rpi_rank"] for x in snapshot["rows"]})!=len(snapshot["rows"]):
        raise ValueError("Duplicate RPI team or rank")
    for s in snapshot["rows"]:
        if s["team_id"] not in all_schools:raise ValueError("Unknown RPI school: "+s["team_id"])
        w,l,t=(s[k] for k in ("di_wins","di_losses","di_ties"))
        if min(w,l,t)<0 or (2*w+t>=w+l+t)!=s["at_large_di_record_eligible"]:
            raise ValueError("Division I record eligibility mismatch for "+s["team_id"])
    aqs = []
    for scenario in aq_archive["bids"]:
        # DO NOT take the RETRO-selected team or the RETRO winner forecast:
        # accept only the university/source-certified official final outcome.
        result = scenario.get("championship_result") or {}
        school = scenario["team_id"]
        if not (scenario.get("official_aq") is True and result.get("winner_id")==school
                and result.get("home_team_id") and result.get("away_team_id")
                and str(scenario.get("source_url") or "").startswith("https://")):
            raise ValueError("Conference champion not source verified: "+scenario["conference"])
        if school not in by_school:
            raise ValueError("Verified AQ has no sourced NCAA RPI rank: "+school)
        aqs.append(scenario)
    if len(aqs)!=23 or len({x["team_id"] for x in aqs})!=23:
        raise ValueError("Must use 23 unique verified conference tournament champions")

    conference_by_id = {id:k for k,c in directory.items() if k.startswith("men-d1:") for id in c.get("teams",[])}
    aq_ids = {x["team_id"] for x in aqs}
    # RPI supplies the baseline strength-of-schedule résumé and eligibility
    # from the NCAA's published record. Remaining NCAA committee factors are
    # INSUFFICIENTLY OBSERVED: do not concoct head-to-head or last-eight stats.
    atlarge = sorted((x for x in snapshot["rows"] if x["team_id"] not in aq_ids
                      and x["at_large_di_record_eligible"]),key=lambda x:x["rpi_rank"])
    if len(atlarge)<29:raise ValueError("Insufficient verified DI-eligible at-large candidates")
    by_conference = {x["conference"]:x for x in aqs}
    def outrow(row,bid):
        school=row["team_id"]
        aq = by_conference.get(conference_by_id.get(school)) if bid=="AQ" else None
        return {
            "team_id":school,
            "team":row["school"],
            "conference":conference_by_id[school],
            "bid_type":"official_aq" if bid=="AQ" else "rpi_at_large_projection",
            "rpi_rank":row["rpi_rank"],
            "di_record":str(row["di_wins"])+"-"+str(row["di_losses"])+"-"+str(row["di_ties"]),
            "ncaa_seed":None,  # Never assume projected seed is officially announced.
            "rpi_source_date":snapshot["as_of"],
        }
    field=[outrow(by_school[x["team_id"]],"AQ") for x in aqs]
    field += [outrow(x,"at-large") for x in atlarge[:25]]
    field.sort(key=lambda x:(x["rpi_rank"],x["team_id"]))
    if len(field)!=48 or len({x["team_id"] for x in field})!=48:raise ValueError("Projected field broken")
    for i,team in enumerate(field,1):
        team["projection_order"]=i
        team["projected_seed"]=i if i<=24 else None
        team["projected_bye"]=i<=16
        # These are defined as a RPI-led resume MODEL, not committee seeds.
    projected = {
      "schema_version":1,"season":2026,"selection_date":"2026-11-16",
      "status":"final_preselection_rpi_led_ncaa_criteria_projection_not_official",
      "independent_of_retro":True,
      "rpi_as_of":snapshot["as_of"],"conference_titles_through":"2026-11-15",
      "ranking_source":snapshot["source_url"],
      "official_rpi_reference":snapshot["official_rpi_reference"],
      "official_selection_criteria_url":"https://ncaaorg.s3.amazonaws.com/championships/sports/soccer/d1/men/2026-27D1MSO_PreChampsManual.pdf",
      "seed_rule_source":"https://www.ncaa.org/news/di-field-hockey-mens-soccer-to-seed-50-of-their-championship-brackets/",
      "methodology":{
        "automatic_qualifiers":"All 23 sourced conference tournament champions, independently of RETRO rankings",
        "at_large":"Best 25 eligible non-AQ schools in Nov 14 NCAA RPI order, after subtracting reported non-DI results",
        "seeds":"Projected 1-24 by NCAA RPI position within selected field; first 16 projected byes. NOT NCAA committee seeds.",
        "matchup_advancement":"Lower RPI rank wins each HYPOTHETICAL matchup; no RETRO Elo, proprietary rating, or invented win probabilities",
        "pairings":"Early conference rematches avoided; proposed first-round fixtures illustrative; true host/geography certification absent",
        "incomplete_ncaa_criteria":["updated Nov 15 RPI after Sunday finals","complete head-to-head evidence",
          "common-opponent results","quality wins versus seeded teams","last eight game performance",
          "student-athlete availability","conference and non-conference results beyond reflected RPI",
          "regional advisory committee input","verified NCAA-selected host sites and geographic feasibility"]
      },
      "confidence":"RPI-led published-rules proxy, not a full reproduction of the NCAA committee's judgment",
      "automatic_bids":23,"at_large_bids":25,"field_size":48,"seeded_teams":24,"first_round_byes":16,
      "field":field,
      "first_four_out":[outrow(x,"at-large") for x in atlarge[25:29]],
      "automatic_qualifier_source_urls":[{"conference":x["conference"],"team_id":x["team_id"],"source_url":x["source_url"]} for x in aqs]
    }
    OUT.write_text(json.dumps(projected,indent=2,ensure_ascii=False)+"\n")
    print("NCAA RPI-led projection:",len(field),"teams",sum(x["bid_type"]=="official_aq" for x in field),
          "source dated",snapshot["as_of"],"first four out",[x["team_id"] for x in projected["first_four_out"]])
    return projected

if __name__=="__main__":run()
