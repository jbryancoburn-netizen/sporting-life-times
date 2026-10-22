"""Auditable roster-aware NBA Elo overlays. Never infer player availability or invent minutes."""
import json, math, argparse
from pathlib import Path

def build(base, roster):
    if base.get("league") != "NBA" or len(base.get("rankings", [])) != 30:
        raise ValueError("Expected validated 30-team NBA base ratings")
    teams={r["team"]:r["elo"] for r in base["rankings"]}
    if len(teams)!=30 or any(not math.isfinite(x) for x in teams.values()):
        raise ValueError("Invalid base ratings")
    if roster.get("league")!="NBA" or not roster.get("as_of_utc") or not roster.get("source"):
        raise ValueError("Roster inputs require league, timestamp and source")
    entries=roster.get("players",[])
    if not isinstance(entries,list) or not entries:
        raise ValueError("No verified player records: do not fabricate roster adjustments")
    seen=set(); offsets={t:0.0 for t in teams}; gameday={t:0.0 for t in teams}; coverage={t:0 for t in teams}; minutes_total={t:0.0 for t in teams}
    for p in entries:
        team=p.get("team"); pid=p.get("player_id")
        if team not in teams or not pid or (team,pid) in seen: raise ValueError("Unknown team or duplicate/missing player")
        seen.add((team,pid))
        # expected_impact_elo is a sourced player impact in Elo units at full playing time.
        # Values are centered around replacement level by the input producer.
        impact=p.get("expected_impact_elo"); minutes=p.get("projected_minutes")
        if isinstance(impact,bool) or not isinstance(impact,(int,float)) or not math.isfinite(impact) or abs(impact)>150:
            raise ValueError("Unverified or implausible player impact")
        if isinstance(minutes,bool) or not isinstance(minutes,(int,float)) or not math.isfinite(minutes) or not 0<=minutes<=48:
            raise ValueError("Missing or invalid projected minutes")
        availability=p.get("availability")
        if availability not in ("available","out","questionable","doubtful"):
            raise ValueError("Missing player availability")
        prob={"available":1.0,"out":0.0,"questionable":0.5,"doubtful":0.25}[availability]
        # 240 team minutes; each player impact is proportional to minutes share.
        contribution=impact*minutes/48
        offsets[team]+=contribution
        gameday[team]+=contribution*prob
        coverage[team]+=1\n        minutes_total[team]+=minutes
    if any(total>240.001 for total in minutes_total.values()):\n        raise ValueError("Projected team minutes exceed 240")\n    result=[]
    for team,elo in teams.items():
        # Explicitly mark partial coverage. Never publish as validated full-team ratings.
        result.append(dict(team=team,traditional_elo=round(elo,3),
                           roster_adjusted_elo=round(elo+offsets[team],3) if coverage[team]>=8 and 190<=minutes_total[team]<=240.001 else None,
                           game_day_elo=round(elo+gameday[team],3) if coverage[team]>=8 else None,
                           player_records=coverage[team],projected_team_minutes=round(minutes_total[team],1),\n                           coverage="provisional" if coverage[team]>=8 and 190<=minutes_total[team]<=240.001 else "insufficient"))
    return dict(league="NBA",model="USRS roster-aware Elo overlay v1",status="provisional",
                as_of_utc=roster["as_of_utc"],source=roster["source"],
                methodology="Player impact in Elo units weighted by projected minutes/48; game-day adjustment weighted by availability probabilities; requires >=8 sourced player records and 190-240 projected team minutes per team",
                ratings=sorted(result,key=lambda r:-r["traditional_elo"]))

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("base");p.add_argument("roster");p.add_argument("output")
    a=p.parse_args()
    Path(a.output).write_text(json.dumps(build(json.loads(Path(a.base).read_text()),json.loads(Path(a.roster).read_text())),indent=2)+"\n")
