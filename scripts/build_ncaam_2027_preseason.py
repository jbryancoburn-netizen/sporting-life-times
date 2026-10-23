#!/usr/bin/env python3
"""Build 2026-27 provisional preseason Elo from independently replayed 2025-26 results.

No 2026-27 results are inferred. Membership is carried over as provisional
until the 2026-27 Division I registry is independently verified.
"""
import argparse,json
from datetime import datetime,timezone
from pathlib import Path

def build(previous, registry, carryover=0.65):
    if previous.get("team_count")!=365 or previous.get("games_played",0)<5000:
        raise ValueError("Historical baseline missing expected 365 teams / games")
    if previous.get("status")!="historical-bootstrap-venue-neutral":
        raise ValueError("Expected explicitly provisional venue-neutral historical baseline")
    teams=registry.get("teams",[])
    old=previous["ratings"]
    if len(teams)!=365 or set(old)!={t["id"] for t in teams}:
        raise ValueError("Team registry and historical rating IDs do not match")
    if not 0<=carryover<=1:raise ValueError("Invalid carryover")
    rating={i:round(1500+carryover*(v-1500),4) for i,v in old.items()}
    ranked=sorted(teams,key=lambda t:(-rating[t["id"]],t["id"]))
    return {"model":"slat-ncaam-d1-elo-v1","season":"2026-27",
      "status":"provisional-preseason-2025-26-membership",
      "generated_at":datetime.now(timezone.utc).isoformat(),
      "as_of":"2026-10-22","games_played":0,"team_count":len(teams),
      "carryover":carryover,
      "historical_baseline":"data/ncaam-2025-26-elo-bootstrap.json",
      "historical_note":"2025-26 ratings treated every game as venue-neutral because source lacked verified location.",
      "membership_note":"2025-26 membership carried forward provisionally; 2026-27 D1 changes not yet verified.",
      "prediction_note":"Preseason power index only; win probability and spread are not calibrated.",
      "rankings":[{"rank":n,"team_id":t["id"],"team":t["name"],
          "conference":t.get("conference"),"elo":rating[t["id"]],
          "last_season_elo":old[t["id"]],"season_games":0}
          for n,t in enumerate(ranked,1)]}

def main():
 p=argparse.ArgumentParser()
 p.add_argument("--previous",type=Path,default=Path("data/ncaam-2025-26-elo-bootstrap.json"))
 p.add_argument("--registry",type=Path,default=Path("data/ncaam-2025-26-team-registry.json"))
 p.add_argument("--output",type=Path,default=Path("data/ncaam-2026-27-preseason-provisional.json"))
 a=p.parse_args()
 obj=build(json.loads(a.previous.read_text()),json.loads(a.registry.read_text()))
 a.output.parent.mkdir(parents=True,exist_ok=True)
 # Stable build artifact: publication does not churn on every run.
 obj.pop("generated_at")
 a.output.write_text(json.dumps(obj,indent=2,ensure_ascii=False)+"\n")
 print("PROVISIONAL D1 preseason:",obj["team_count"],"teams; top:",obj["rankings"][0]["team"],obj["rankings"][0]["elo"])
if __name__=="__main__":main()
