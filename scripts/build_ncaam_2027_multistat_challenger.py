#!/usr/bin/env python3
"""2026-27 independent basketball player-stat challenger: SHOOTING / PLAYMAKING / DEFENSE.
Retrospective-only coefficients; no unverified player value. Never overwrites default Elo.
Requires source 2025-26 NCAA box and 2026-27 roster movement audit.
"""
import argparse,csv,gzip,json,math,unicodedata
from collections import defaultdict
from pathlib import Path
FIELDS=("mins","pts","fgm","fga","ftm","fta","ast","tov","stl","blk")
def key(s):
 return "".join(ch for ch in unicodedata.normalize("NFKD",str(s).casefold()) if ch.isalnum() and not unicodedata.combining(ch))
def number(s):
 try:
  v=float(s)
  return v if math.isfinite(v) and v>=0 else None
 except (TypeError,ValueError):return None
def main():
 p=argparse.ArgumentParser();p.add_argument("--box",type=Path,default=Path("historical-normalized/ncaa_mbb_player_box_2026.csv.gz"));p.add_argument("--movement",type=Path,default=Path("data/ncaam-2026-27-player-movement-audit.json"));p.add_argument("--elo",type=Path,default=Path("data/ncaam-2026-27-preseason-player-quality-live.json"));p.add_argument("--weights",type=Path,default=Path("data/ncaam-continuous-stat-optimizer.json"));p.add_argument("--output",type=Path,default=Path("data/ncaam-2026-27-multistat-challenger.json"));a=p.parse_args()
 movement=json.loads(a.movement.read_text());elo=json.loads(a.elo.read_text());study=json.loads(a.weights.read_text())
 assert movement["season"]==elo["season"]=="2026-27" and elo["team_count"]==365
 assert study["status"]=="RETROSPECTIVE_ONLY_NOT_PRESEASON_CERTIFIED"
 weights=study["selected_weights"]
 buckets=defaultdict(lambda:defaultdict(float));ids=defaultdict(set);excluded=defaultdict(int)
 with gzip.open(a.box,"rt",encoding="utf-8",newline="") as file:
  reader=csv.DictReader(file)
  assert all(x in reader.fieldnames for x in FIELDS+("team_ncaa_team_id","player","player_id"))
  for row in reader:
   person=key(row["player"]);school=str(row["team_ncaa_team_id"])
   if not person or not school:continue
   k=(person,school)
   ids[k].add(str(row["player_id"]))
   vals=[number(row.get(x)) for x in FIELDS]
   if any(v is None for v in vals):excluded["incomplete_box_stat_row"]+=1;continue
   if vals[0]>70:excluded["invalid_minutes_row"]+=1;continue
   for col,val in zip(FIELDS,vals):buckets[k][col]+=val
 ratings={t["team_id"]:t for t in elo["rankings"]};out=[];matched=0;unmatched=0
 for team in movement["teams"]:
  tid=team["team_id"];old=ratings.get(tid)
  if old is None:raise ValueError("Mismatch team "+tid)
  totals=defaultdict(float);players=0;seen=set()
  for person in team["players"]:
   source=person.get("prior_school_id")
   if not source or person.get("status") not in ("unique-name-returner-candidate","unique-name-transfer-candidate"):
    continue
   k=(key(person["player"]),source.removeprefix("ncaa:"))
   if k in seen:continue
   seen.add(k)
   raw=buckets.get(k)
   if not raw or len(ids[k])!=1 or raw["mins"]<1:unmatched+=1;continue
   # Exact historical points/minutes agreement, without fuzzy identity joins.
   if abs(raw["mins"]-float(person.get("prior_minutes") or 0))>.06 or abs(raw["pts"]-float(person.get("prior_points") or 0))>.05:
    excluded["movement_box_did_not_reconcile"]+=1;unmatched+=1;continue
   players+=1;matched+=1
   for stat in FIELDS:totals[stat]+=raw[stat]
  prior_minutes=totals["mins"]
  if players>=2 and prior_minutes>=200:
   features={"shooting":(2*totals["fgm"]-totals["fga"]+totals["ftm"]-.5*totals["fta"])/prior_minutes,
     "playmaking":(totals["ast"]-totals["tov"])/prior_minutes,"defense":(totals["stl"]+totals["blk"])/prior_minutes}
  else:features=None
  out.append({"team_id":tid,"team":old["team"],"conference":old.get("conference"),"published_elo":old["elo"],
    "matched_players":players,"matched_previous_minutes":round(prior_minutes,3),"raw_features":features})
 # Center only across observable teams. Unknown teams get zero multistat effect.
 from statistics import median
 observed=[t for t in out if t["raw_features"]]
 if len(observed)<180:raise ValueError("Not enough teams have actual historical multistat evidence")
 centers={k:median(t["raw_features"][k] for t in observed) for k in weights}
 for t in out:
  features=t.pop("raw_features")
  components={k:round(weights[k]*(features[k]-centers[k]),4) if features else 0.0 for k in weights}
  t["components"]=components;t["feature_status"]="VERIFIED_UNIQUE_PRIOR_SCHOOL_BOX_LINK_CANDIDATE" if features else "MISSING_SOURCE_NO_EXTRA_VALUE"
  t["multistat_delta"]=round(sum(components.values()),4)
  t["challenger_elo"]=round(t["published_elo"]+t["multistat_delta"],4)
  # It is an additive diagnostic, not a newly trained full-model coefficient.
 out.sort(key=lambda t:-t["challenger_elo"])
 result={"model":"slat-ncaam-2026-27-multistat-shadow-v1","status":"SHADOW_ONLY_RETROSPECTIVE_WEIGHTS_NOT_PRESEASON_VALIDATED",
  "published_elo_changed":False,"team_count":365,"covered_teams":len(observed),"matched_players":matched,"unmatched_candidates":unmatched,
  "source":"2025-26 NCAA player_box with uniquely identified previous-school player names and reconciled 2026-27 roster candidate histories",
  "coefficients":weights,"feature_medians":centers,"source_exclusions":dict(excluded),
  "limitations":["Current roster identity association remains candidate-level, not opening day as-of certified",
   "The existing scoring-quality feature may overlap with shooting; additive fit has not been tested jointly",
   "Box score steals plus blocks are not comprehensive defensive value",
   "No verified 3pt splits, rebounds, possessions, injuries or freshman prior NCAA values",
   "Do not promote challenger without held-out comparison using identical matchup samples"],
  "teams":out}
 a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(result,indent=2)+"\n")
 print(json.dumps({k:result[k] for k in ("status","covered_teams","matched_players","unmatched_candidates","source_exclusions")},indent=2))
if __name__=="__main__":main()
