#!/usr/bin/env python3
"""Audit the High Point preseason jump from verified D-I player production.
This is player-level diagnostics, not an unvalidated Elo recalibration.
"""
import json
from pathlib import Path

DATA=Path(__file__).resolve().parents[1]/"data"
def check():
    movement=json.loads((DATA/"ncaam-2026-27-player-movement-audit.json").read_text())
    cross=json.loads((DATA/"ncaam-2026-27-direct-player-crosswalk.json").read_text())
    rankings=json.loads((DATA/"ncaam-2026-27-preseason-roster-informed.json").read_text())
    high=next(t for t in movement["teams"] if t["team_id"]=="ncaa:609608")
    rating=next(t for t in rankings["rankings"] if t["team_id"]=="ncaa:609608")
    ids={str(p["current_id"]):p for p in high["players"]}
    links={str(l["id"]):l for l in cross["links"] if str(l["id"]) in ids}
    players=[]
    for pid,p in ids.items():
        link=links.get(pid)
        prior=p.get("prior_school_id")
        good=bool(link and link.get("method") in ("name_jersey","name","last_jersey")
                  and prior and link.get("prior")==prior
                  and isinstance(p.get("prior_minutes"),(int,float))
                  and p["prior_minutes"]>0 and isinstance(p.get("prior_points"),(int,float)))
        segment=("returner" if prior==high["team_id"] else "transfer") if good else "unverified"
        players.append({"player":p["player"],"current_id":pid,"segment":segment,
            "prior_school_id":prior if good else None,
            "historical_minutes":round(p["prior_minutes"],2) if good else None,
            "historical_points":p["prior_points"] if good else None,
            "historical_ppg":round(p["prior_points"]/p["prior_games"],2)
                if good and p.get("prior_games",0)>0 else None,
            "historical_points_per_minute":round(p["prior_points"]/p["prior_minutes"],4)
                if good else None,
            "historical_link_method":link["method"] if good else None})
    assert len(players)==high["roster_players"]==17
    verified=[p for p in players if p["segment"]!="unverified"]
    assert len(verified)==rating["evidence_player_count"]==12
    assert sum(p["segment"]=="transfer" for p in verified)==8
    assert sum(p["segment"]=="returner" for p in verified)==4
    assert abs(rating["elo"]-rating["base_elo"]-rating["offseason_adjustment"])<0.00021
    players.sort(key=lambda p:(p["segment"]=="unverified",
                 -(p["historical_minutes"] or 0),p["player"]))
    result={"season":"2026-27","team":"High Point","team_id":high["team_id"],
      "research_only":True,"production_elo_changed":False,
      "current_roster_players":len(players),"verified_prior_d1_histories":len(verified),
      "unverified_roster_players":len(players)-len(verified),
      "rating":{"baseline_elo":rating["base_elo"],
                "roster_adjustment":rating["offseason_adjustment"],
                "published_preseason_elo":rating["elo"],"published_rank":rating["rank"]},
      "identification":"Historical points per game and points per minute are descriptive, not opponent-adjusted player value.",
      "unaddressed":["Opponent-adjusted scoring/efficiency",
                     "Previous-school competition strength",
                     "Departing-player impact",
                     "Projected 2026-27 minutes and rotation capacity",
                     "Defensive, rebounding and playmaking efficiency",
                     "Historical opening-day roster as-of provenance"],
      "players":players}
    print(json.dumps(result,indent=2))
    return result
if __name__=="__main__":
    check()
