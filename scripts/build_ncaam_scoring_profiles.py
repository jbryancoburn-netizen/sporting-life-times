#!/usr/bin/env python3
"""Build 2026-27 scoring profiles from VERIFIED 2025-26 NCAA final scores.
True possession metrics cannot be certified: source player box lacks ORB.
This is a prior-season score/defense model, separate from published Elo.
"""
import argparse,json,statistics
from pathlib import Path
from collections import defaultdict
from backtest_ncaam_quality_retrospective import read_gz,school_key,extract_games
def main():
 p=argparse.ArgumentParser();p.add_argument("--source",type=Path,default=Path("historical-normalized"));p.add_argument("--elo",type=Path,default=Path("data/ncaam-2026-27-preseason-player-quality-live.json"));p.add_argument("--out",type=Path,default=Path("data/ncaam-team-scoring-profiles.json"));a=p.parse_args()
 box=read_gz(a.source,"player_box",2026);schedule=read_gz(a.source,"schedule",2026)
 names=defaultdict(set)
 for r in box:
  key=school_key(r.get("team"));tid=str(r.get("team_ncaa_team_id") or "")
  if key and tid:names[key].add(tid)
 programs={k:next(iter(s)) for k,s in names.items() if len(s)==1}
 games,errors=extract_games(schedule,programs,box)
 stats=defaultdict(lambda:{"for":[],"against":[],"totals":[]})
 for g in games:
  home_team,away_team=g["home"],g["away"];hs,aws=g["home_score"],g["away_score"]
  stats[home_team]["for"].append(hs);stats[home_team]["against"].append(aws)
  stats[away_team]["for"].append(aws);stats[away_team]["against"].append(hs)
 total=[(g["home_score"]+g["away_score"])/2 for g in games]
 mean=statistics.mean(total)
 elo=json.loads(Path(a.elo).read_text())
 profiles=[]
 for team in elo["rankings"]:
  src=stats.get(school_key(team["team"]))
  n=len(src["for"]) if src else 0
  observed=n>=10
  # Prior-year team means shrunk toward verified league scoring as continuity decreases.
  # No prospective possession rate or future team play-by-play is invented.
  r=max(0,min(1,float(team.get("returning_minutes_share",0))))
  reliability=(n/(n+15))*(.35+.65*r) if observed else 0
  attack=mean+reliability*(statistics.mean(src["for"])-mean) if observed else mean
  defense=mean+reliability*(statistics.mean(src["against"])-mean) if observed else mean
  profiles.append({"team_id":team["team_id"],"team":team["team"],"prior_games":n,
   "prior_points_scored_per_game":round(statistics.mean(src["for"]),4) if observed else None,
   "prior_points_allowed_per_game":round(statistics.mean(src["against"]),4) if observed else None,
   "projected_offense_ppg":round(attack,4),"projected_defense_allowed_ppg":round(defense,4),
   "observed_returning_minutes_share":round(r,6),"shrinkage_reliability":round(reliability,5),
   "evidence_status":"VERIFIED_PREVIOUS_SEASON_RESULTS" if observed else "LEAGUE_FALLBACK_NO_VERIFIED_PRIOR_GAMES",
   "tempo_possessions":None,"offensive_points_per_100_possessions":None,"defensive_points_per_100_possessions":None})
 out={"model":"ncaam-2026-27-scoring-profile-v1","season":"2026-27",
  "status":"VERIFIED_HISTORICAL_SCORING_PRIORS_NOT_HOLDOUT_CALIBRATED",
  "source_year":2026,"previous_season_games":len(games),"league_mean_points_per_team":round(mean,5),
  "team_count":len(profiles),"teams_with_verified_games":sum(x["prior_games"]>=10 for x in profiles),
  "method":"Previous-season verified points scored/allowed per team shrunk to previous-season league mean according to returning-minute share and prior games",
  "limitations":["No validated possessions or ORB; per-100-possession offense, defense and pace are intentionally null",
  "Historical score teams matched by unique normalized school names; unmatched teams use league mean",
  "Carryover reliability is heuristic, not independently backtested",
  "Matchup predictions must preserve independent Elo win probabilities",
  "Final scores are forecasts, not guaranteed and not venue-adjusted"],"teams":profiles,"extract_exclusions":errors}
 assert len(profiles)==365 and len({x["team_id"] for x in profiles})==365
 a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(out,indent=2)+"\n")
 print("Profiles",len(profiles),"games",len(games),"historical matches",out["teams_with_verified_games"])
if __name__=="__main__":main()
