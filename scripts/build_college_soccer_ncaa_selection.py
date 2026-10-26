"""NCAA Division I men's soccer selection forecast (not an NCAA committee ranking).
Builds a traceable 48-team preliminary forecast, 23 provisional AQs and 25 at-large.
RPI is never fabricated: until comprehensive season game data exists, Elo is an
explicit interim predictive proxy and committee selection probabilities are withheld.
"""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def read(p): return json.loads((ROOT/p).read_text())
def build():
    directory=read("data/college-soccer-conferences.json")["conferences"]
    projections=read("data/college-soccer-projected-standings.json")["conferences"]
    elo=read("data/college-soccer-elo.json")
    rules=read("data/college-soccer-postseason-rules.json")
    ratings={r["team_id"]:r for r in elo["cohorts"]["men-d1"]}
    conferences={k:v for k,v in directory.items() if k.startswith("men-d1:")}
    if len(conferences)!=23:raise ValueError("Expected 23 DI men's AQ conferences")
    members={}
    for key,meta in conferences.items():
        for t in meta["teams"]:
            if t in members:raise ValueError("Duplicate conference membership: "+t)
            members[t]=key
    picks=[]
    for key,meta in conferences.items():
        projection=projections.get(key,{})
        available=[r for r in projection.get("rows",[]) if r.get("team_id") in ratings and isinstance(r.get("conference_points"),int)]
        # Conference projected bracket champion is not inferable from table leader.
        # Use strongest available Elo among projected tournament entrants ONLY as scenario champion.
        rule=rules.get("conferences",{}).get(key,{})
        field=int(rule.get("tournament",{}).get("field") or 0)
        if not available:
            candidate=max((ratings[t] for t in meta["teams"] if t in ratings),key=lambda r:r["elo"],default=None)
            method="elo_fallback_no_usable_conference_table"
        else:
            candidates=available[:field] if field else available
            candidate=max((ratings[r["team_id"]] for r in candidates),key=lambda r:r["elo"],default=None)
            method="elo_simulation_placeholder_from_available_tournament_field" if field else "elo_placeholder_without_verified_tournament_field"
        if candidate is None:raise ValueError("No rated team for "+key)
        picks.append({"conference":key,"conference_name":meta.get("short") or meta["name"],"team_id":candidate["team_id"],"team":candidate["team"],"elo":candidate["elo"],"method":method,"official_aq":False})
    aqids={r["team_id"] for r in picks}
    pool=sorted((r for r in ratings.values() if r["team_id"] not in aqids),key=lambda r:(-r["elo"],r["team_id"]))
    selected=pool[:25]
    if len(selected)!=25 or len(aqids)!=23:raise ValueError("Invalid selection counts")
    entrants=[{"team_id":r["team_id"],"team":r["team"],"conference":r["conference"],"elo":r["elo"],"bid_type":"projected_aq"} for r in picks]+[
       {"team_id":r["team_id"],"team":r["team"],"conference":members.get(r["team_id"],"independent_or_unmapped"),"elo":r["elo"],"bid_type":"proxy_at_large"} for r in selected]
    entrants.sort(key=lambda x:(-x["elo"],x["team_id"]))
    for i,entry in enumerate(entrants,1):
        entry["experimental_strength_order"]=i
        entry["ncaa_seed"]=None
        entry["first_round_bye_candidate"]=i<=16
        entry["seeded_24_candidate"]=i<=24
    output={"schema_version":1,"season":2026,"rating_cutoff":elo["as_of"],
      "selection_date":"2026-11-16","field_size":48,"automatic_bids":23,"at_large_bids":25,
      "seeded_teams":24,"first_round_byes":16,
      "status":"experimental_proxy_not_selection_criteria_certified",
      "methodology":{"automatic_bids":"Illustrative conference champion picked by Elo among available provisional tournament entrants; not official AQs or title probabilities.",
         "at_large":"Top 25 remaining teams by independently maintained Elo, used ONLY as an explicit interim proxy, not actual NCAA RPI or committee selection criteria.",
         "strength_order":"Elo-order illustration, NOT NCAA bracket seed or committee ranking.",
         "withheld":["official NCAA RPI","adjusted RPI","strength-of-schedule comparisons","quality wins / losses","head-to-head and common opponents","committee judgment","selection probabilities"],
         "future_requirements":["complete DI season fixtures and results","2026 selection-manual approved criteria","official NCAA RPI reconciliation","eligibility verification","conference AQ winners and division tiebreak rules","at-large cutline backtest"]},
      "official_sources":["https://www.ncaa.org/championship/division-i/mens-soccer/","https://www.ncaa.org/news/di-field-hockey-mens-soccer-to-seed-50-of-their-championship-brackets/","https://www.ncaatickets.com/mens-college-cup-road-to-the-championship"],
      "automatic_bid_scenarios":picks,"at_large_proxy":[{"team_id":r["team_id"],"team":r["team"],"elo":r["elo"],"conference":members.get(r["team_id"],"independent_or_unmapped")} for r in selected],
      "first_four_out_proxy":[{"team_id":r["team_id"],"team":r["team"],"elo":r["elo"],"conference":members.get(r["team_id"],"independent_or_unmapped")} for r in pool[25:29]],"field":entrants}
    path=ROOT/"data/college-soccer-ncaa-selection-forecast.json"
    path.write_text(json.dumps(output,indent=2)+"\n")
    print("Built experimental field:",len(entrants),"AQ scenarios:",len(picks),"at-large:",len(selected))
if __name__=="__main__":build()
