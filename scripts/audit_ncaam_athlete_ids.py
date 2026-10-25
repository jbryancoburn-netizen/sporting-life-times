import json,argparse
from pathlib import Path
from collections import defaultdict
from backtest_ncaam_quality_retrospective import read_gz,player_key
def ids(rows):
 d=defaultdict(set)
 for r in rows:
  k=str(r.get("player_id") or "").strip()
  if k:d[k].add(player_key(r.get("player")))
 return d
p=argparse.ArgumentParser();p.add_argument("--source",type=Path,required=True);p.add_argument("--out",type=Path,required=True);a=p.parse_args()
result={}
for y in (2024,2025,2026):
 old=read_gz(a.source,"player_box",y-1);new=read_gz(a.source,"team_rosters",y)
 a_ids=ids(old);b_ids=ids(new);same=set(a_ids)&set(b_ids)
 result[str(y)]={"prior_box_with_id":sum(bool(r.get("player_id")) for r in old),
 "roster_with_id":sum(bool(r.get("player_id")) for r in new),
 "roster_entries":len(new),"ids_shared":len(same),
 "ids_single_name_agreement":sum(len(a_ids[k])==len(b_ids[k])==1 and a_ids[k]==b_ids[k] for k in same),
 "ids_disagree_or_ambiguous":sum(not (len(a_ids[k])==len(b_ids[k])==1 and a_ids[k]==b_ids[k]) for k in same)}
out={"production_promotion_allowed":False,"cross_season_ids_certified":False,"years":result}
a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out))
