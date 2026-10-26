#!/usr/bin/env python3
"""Release-blocking NCAA 2026-27 multistat integration test. No invented inputs."""
import json,math,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[1]
def load(name):
 path=root/"data"/name
 return json.loads(path.read_text())
def test():
 main=load("ncaam-2026-27-preseason-player-quality-live.json")
 assert len(main["rankings"])==365
 old={t["team_id"]:t for t in main["rankings"]}
 assert len(old)==365
 for t in old.values():
  assert all(math.isfinite(t[k]) for k in ("elo","base_elo","quality_component","retention_component","transfer_component"))
  assert abs(t["elo"]-t["base_elo"]-t["offseason_adjustment"])<.005
 path=root/"data/ncaam-2026-27-multistat-challenger.json"
 if not path.exists():
  print("BLOCKED: challenger 365-team output has not published. No full comparison is possible.")
  return 2
 challenger=json.loads(path.read_text())
 assert challenger["status"]=="SHADOW_ONLY_RETROSPECTIVE_WEIGHTS_NOT_PRESEASON_VALIDATED"
 assert challenger["published_elo_changed"] is False and challenger["team_count"]==365
 new={t["team_id"]:t for t in challenger["teams"]}
 assert set(old)==set(new)
 assert challenger["covered_teams"]>=180
 for tid,t in new.items():
  assert math.isfinite(t["challenger_elo"])
  assert abs(t["published_elo"]-old[tid]["elo"])<.005
  assert abs(t["challenger_elo"]-t["published_elo"]-sum(t["components"].values()))<.012
  assert set(t["components"])=={"shooting","playmaking","defense"}
  assert t["feature_status"] in ("VERIFIED_UNIQUE_PRIOR_SCHOOL_BOX_LINK_CANDIDATE","MISSING_SOURCE_NO_EXTRA_VALUE")
 print("PASS: 365-team identity, stable primary Elo, sources and challenger component arithmetic")
 print("NOT A HOLDOUT BACKTEST: historical preseason roster-time verification still needed")
 return 0
if __name__=="__main__":
 try:sys.exit(test())
 except (AssertionError,KeyError,ValueError) as e:print("FAILED",repr(e));sys.exit(1)
