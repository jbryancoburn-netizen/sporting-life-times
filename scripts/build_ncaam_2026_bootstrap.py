#!/usr/bin/env python3
"""Build a traceable provisional men's D1 2025-26 Elo from NCAA-origin SDV data.

Important: season schedule has designated home/away but no neutral-site flag.
We therefore use venue-neutral Elo for ALL games in this historical bootstrap,
explicitly flagging that limitation. Never silently apply home advantage.
"""
import argparse,csv,gzip,json,re,sys
from collections import Counter
from datetime import datetime
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from ncaam_elo import compute

def read_gz(path):
    with gzip.open(path,"rt",encoding="utf-8-sig",newline="") as f:
        return list(csv.DictReader(f))
def name_key(s):
    return re.sub(r"[^a-z0-9]","",str(s).lower().replace("&","and"))
def run(source,out):
    games=read_gz(source/"season.csv.gz")
    members=read_gz(source/"team-ids.csv.gz")
    if len(members)<350 or len(games)<5000:raise ValueError("Archive too small to represent D1 season")
    teams={}
    names={}
    for row in members:
        ident="ncaa:"+row["id"].strip()
        name=row["team"].strip()
        key=name_key(name)
        if not name or not key or not row["id"].isdigit() or key in names or ident in teams:
            raise ValueError("Nonunique team registry name/ID")
        teams[ident]={"id":ident,"name":name,"division":"D1","conference":row["conference"].strip()}
        names[key]=ident
    used=set()
    parsed=[];rejected=[];unmatched=Counter()
    for row in games:
        gid=row.get("contest_id","").strip()
        h,a=names.get(name_key(row.get("home"))),names.get(name_key(row.get("away")))
        reason=None
        if not gid or gid in used:reason="blank or duplicate contest ID"
        elif not h or not a:
            reason="unmatched/non-D1 teams"
            if not h:unmatched[row.get("home","")]+=1
            if not a:unmatched[row.get("away","")]+=1
        elif h==a:reason="same team twice"
        try:
            day=datetime.strptime(row.get("game_date",""),"%m/%d/%Y").date().isoformat()
            hs,aws=int(row["home_score"]),int(row["away_score"])
            if hs<0 or aws<0 or hs==aws:raise ValueError()
        except (ValueError,TypeError,KeyError):
            day=None;hs=aws=None;reason=reason or "invalid final or date"
        if reason:
            rejected.append({"contest_id":gid,"reason":reason,"home":row.get("home"),"away":row.get("away")})
            continue
        used.add(gid)
        parsed.append({"id":"ncaa:"+gid,"date":day,"home":h,"away":a,"home_score":hs,"away_score":aws,
                       "site":"neutral","overtime":False,
                       "source_url":"https://stats.ncaa.org/contests/"+gid,
                       "provider":"stats.ncaa.org-via-sportsdataverse"})
    if not parsed:raise ValueError("No validated D1-vs-D1 results")
    # Prevent sequential reordering in collector: use game calendar date, then contest identifier.
    parsed.sort(key=lambda g:(g["date"],g["id"]))
    result=compute(teams,parsed,"2025-26")
    result["status"]="historical-bootstrap-venue-neutral"
    result["venue_note"]="Source lacks neutral-site indicator. All games deliberately modelled with ZERO venue advantage; not venue-calibrated."
    result["data_source"]="SportsDataverse NCAA-origin 2026 schedule release; independent SL&T Elo calculation"
    result["coverage"]={"raw_schedule_rows":len(games),"official_d1_teams":len(teams),
                        "accepted_d1_vs_d1_final_games":len(parsed),"excluded_rows":len(rejected),
                        "excluded_reasons":dict(Counter(x["reason"] for x in rejected)),
                        "unmatched_teams":unmatched.most_common(35)}
    out.mkdir(parents=True,exist_ok=True)
    (out/"ncaam-2025-26-elo-bootstrap.json").write_text(json.dumps(result,indent=2)+"\n")
    (out/"ncaam-2025-26-team-registry.json").write_text(json.dumps({"teams":list(teams.values())},indent=2)+"\n")
    (out/"ncaam-2025-26-excluded.json").write_text(json.dumps(rejected,indent=2)+"\n")
    print(json.dumps({"status":result["status"],"coverage":result["coverage"],"top_10":result["rankings"][:10]},indent=2))
    return result
if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--source",type=Path,default=Path("staging/ncaam-sdv-probe"))
    p.add_argument("--output",type=Path,default=Path("staging/ncaam-elo"))
    a=p.parse_args()
    run(a.source,a.output)
