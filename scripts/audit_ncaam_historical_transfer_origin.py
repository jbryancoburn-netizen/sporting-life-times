#!/usr/bin/env python3
"""Retrospective historical transfer source-school evidence audit.

Link unique normalized player names in prior NCAA game boxes to the
following season's roster, exclude ambiguous identities, then join the
origin program to independent prior-season Elo derived from score replay.
This is RESEARCH evidence; historical rosters lack verified opening-date captures.
"""
import argparse,json
from pathlib import Path
from collections import defaultdict
from backtest_ncaam_quality_retrospective import read_gz,extract_games,school_key,player_key,collect_prior_stats,unadjusted_end

def origin_features(roster,prior_box,prior_elos):
    prior,_,_,errors,ambiguous=collect_prior_stats(prior_box)
    current=defaultdict(set)
    for row in roster:
        school=school_key(row.get("team"))
        person=player_key(row.get("player"))
        if school and person:current[school].add(person)
    output=[]
    excluded=defaultdict(int)
    for dest,names in current.items():
        minutes=weighted=0.
        sources=set()
        for name in names:
            if name not in prior:
                excluded["unmatched_or_ambiguous_prior_name"]+=1
                continue
            old,m,points,games=prior[name]
            if old==dest:continue
            if old not in prior_elos:
                excluded["previous_program_elo_missing"]+=1
                continue
            minutes+=m
            weighted+=m*prior_elos[old]
            sources.add(old)
            excluded["linked_transfer_records"]+=1
        output.append({"destination":dest,"unique_source_programs":len(sources),
            "verified_exact_name_transfer_minutes":round(minutes,4),
            "prior_school_weighted_elo":round(weighted/minutes,4) if minutes else None,
            "prior_school_elo_relative_to_1500":round((weighted/minutes-1500)/200,6) if minutes else None})
    return output,{"ambiguous_prior_names_excluded":ambiguous,"teams_with_origin_strength":sum(x["prior_school_weighted_elo"] is not None for x in output),
                   "matched_transfer_records":excluded["linked_transfer_records"],"excluded":dict(excluded)}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--source",type=Path,required=True)
    parser.add_argument("--output",type=Path,default=Path("data/ncaam-historical-transfer-origin-evidence.json"))
    args=parser.parse_args()
    prior_elo={}
    seasons={}
    for year in (2023,2024,2025,2026):
        boxes=read_gz(args.source,"player_box",year)
        roster=read_gz(args.source,"team_rosters",year)
        schools={school_key(x["team"]):str(x["team_id"]) for x in roster}
        if year>2023:
            old=read_gz(args.source,"player_box",year-1)
            data,audit=origin_features(roster,old,prior_elo)
            seasons[str(year)]={"audit":audit,"teams":data}
        games,_=extract_games(read_gz(args.source,"schedule",year),schools,boxes)
        assert len(games)>3000
        prior_elo=unadjusted_end(games,prior_elo,schools)
    result={"model":"ncaam-retrospective-transfer-origin-research-v1",
       "status":"RETROSPECTIVE_UNCERTIFIED_OPENING_DAY",
       "season_data":seasons,"independent_previous_school_elo":True,
       "same_person_confirmed_by_strict_id":False,
       "historical_roster_timing_certified":False,"production_approved":False,
       "limitations":["Historical current rosters were not preserved as confirmed pre-opening snapshots",
                     "Names are matched only when unique in the preceding NCAA player box",
                     "Source-school ratings are independently replayed; never third-party Elo",
                     "Unmatched and ambiguous players excluded without imputed values"]}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({y:z["audit"] for y,z in seasons.items()},indent=2))
if __name__=="__main__":main()
