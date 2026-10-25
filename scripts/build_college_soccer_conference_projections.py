"""Rebuild provisional NCAA soccer conference tables from verified new finals.
Never changes official snapshot; starts strictly AFTER the snapshot's local date.
Only games with both members of same conference alter conference W/L/D.
"""
import json,datetime as dt,pathlib,re
ROOT=pathlib.Path(__file__).resolve().parents[1]
def read(p):return json.loads((ROOT/p).read_text())
def build():
    directory=read("data/college-soccer-conferences.json")["conferences"]
    ledger=read("data/college-soccer-elo-final-ledger.json")["results"]
    rules=read("data/college-soccer-postseason-rules.json")["conferences"]
    out={}
    for key,meta in directory.items():
        if not key.startswith("men-d1:"):continue
        base=read(meta["standings_feed"])
        rows=[dict(r) for r in base["rows"]]
        members=set(meta["teams"])
        date=(base.get("snapshot_checked_date") or "")[:10]
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}",date):continue
        can_project=all(re.fullmatch(r"\d+-\d+(?:-\d+)?",str(r.get("conference_record",""))) and r.get("conference_points") is not None for r in rows)
        added=[]
        if can_project:
            lookup={r["team_id"]:r for r in rows}
            for game in sorted(ledger,key=lambda g:(g["date"],g["match_id"])):
                if game["gender"]!="men" or game["date"]<=date or game["home_team"] not in members or game["away_team"] not in members:continue
                h,a=lookup[game["home_team"]],lookup[game["away_team"]]
                for row,goals,conceded in ((h,game["home_goals"],game["away_goals"]),(a,game["away_goals"],game["home_goals"])):
                    w,l,d=(list(map(int,row["conference_record"].split("-")))+[0])[:3]
                    if goals>conceded:w+=1
                    elif goals<conceded:l+=1
                    else:d+=1
                    row["conference_record"]=f"{w}-{l}-{d}"
                    row["conference_points"]=w*3+d
                added.append(game["match_id"])
            original={r["team_id"]:i for i,r in enumerate(rows)}
            rows.sort(key=lambda r:(-r["conference_points"],original[r["team_id"]]))
        tie_groups=[]
        for points in sorted({r.get("conference_points") for r in rows if isinstance(r.get("conference_points"),int)},reverse=True):
            tied=[r["team_id"] for r in rows if r.get("conference_points")==points]
            if len(tied)>1:tie_groups.append({"points":points,"teams":tied,"status":"unresolved_requires_official_tiebreaker"})
        field=int((rules.get(key) or {}).get("tournament",{}).get("field") or 0)
        at_cutoff=field>0 and field<len(rows) and rows[field-1].get("conference_points")==rows[field].get("conference_points")
        policy=(rules.get(key) or {}).get("tiebreakers") or {}
        out[key]={"schema_version":1,"tiebreaker_policy":policy,"unresolved_tie_groups":tie_groups,"cutoff_tie_unresolved":bool(at_cutoff),"projected_seeds_certified":not tie_groups and can_project,,"source_name":base.get("source_name"),"source_url":base.get("source_url"),
                  "snapshot_checked_date":date,"projected_through":max([date]+[g["date"] for g in ledger if g["match_id"] in added]),
                  "derived_from_verified_finals":True,"new_finals_applied":len(added),"applied_match_ids":added,
                  "projection_status":"provisional_not_official_tiebreakers" if can_project else "unverified_baseline_no_projection",
                  "note":"Official dated snapshot plus uniquely recorded later intraconference finals. Equal-point order retains snapshot order, not official tiebreakers. Never official tournament seeds.",
                  "rows":rows}
    target=ROOT/"data/college-soccer-projected-standings.json"
    target.write_text(json.dumps({"schema_version":1,"conferences":out},sort_keys=True,separators=(",",":"))+"\n")
    print("Built",len(out),"provisional conference tables")
if __name__=="__main__":build()
