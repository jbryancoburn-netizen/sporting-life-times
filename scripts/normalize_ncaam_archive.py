#!/usr/bin/env python3
"""Convert archived NCAA D1 scoreboards to an auditable games file and ID registry.

Only emits final games with valid NCAA team identifiers, explicit home/away,
and no conflicting duplicates. Reports missing and rejected games separately.
"""
import argparse,csv,json,re
from pathlib import Path
from collections import Counter

FIELDS=["game_id","date","home_id","away_id","home_score","away_score","site","status","source_url","provider","overtime"]
def team_id(team):
    # NCAA game display names alone are not safe stable IDs across seasons.
    for key in ("teamId","teamID","team_id","id"):
        value=team.get(key)
        if value is not None and str(value).strip().isdigit():return "ncaa:"+str(value).strip()
    names=team.get("names") or {}
    seo=str(names.get("seo") or "").strip().lower()
    if re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*",seo):
        return "ncaa-seo:"+seo
    return None
def team_name(team):
    names=team.get("names") or {}
    return (names.get("full") or names.get("short") or names.get("seo") or team.get("name") or "").strip()
def parse(record):
    games=[];rejected=[]
    day=record["day"]
    canonical=record["canonical_url"]
    for wrapper in record["payload"]["games"]:
        game=wrapper.get("game",wrapper)
        gameid=str(game.get("gameID") or game.get("gameId") or "").strip()
        home,away=game.get("home") or {},game.get("away") or {}
        h,a=team_id(home),team_id(away)
        why=None
        if not gameid:why="missing game ID"
        elif not h or not a or h==a:why="missing or identical canonical NCAA team IDs"
        elif not team_name(home) or not team_name(away):why="missing team name"
        status=str(game.get("gameState") or game.get("finalMessage") or "").lower()
        is_final=bool(re.search(r"final|complete",status))
        if not is_final:
            continue
        try:
            hs,aws=int(home.get("score")),int(away.get("score"))
            if hs==aws or min(hs,aws)<0:raise ValueError()
        except (TypeError,ValueError):
            why=why or "invalid final score"
            hs=aws=None
        # The scoreboard game listing can contain neutral courts identified
        # through multiple version-dependent fields. Unknown venue is rejected.
        venue=game.get("site") or game.get("gameLocation") or {}
        if isinstance(venue,dict):
            neutral=venue.get("neutralSite",venue.get("isNeutral",game.get("neutralSite")))
        else:neutral=game.get("neutralSite")
        if isinstance(neutral,str):neutral=neutral.lower() in ("true","yes","1")
        if neutral is True:site="neutral"
        elif neutral is False:site="home"
        else:
            site=None
            why=why or "unverified neutral-site status"
        if why:
            rejected.append({"id":gameid,"date":day,"reason":why,
                "home_id":h,"away_id":a,"home_score":hs,"away_score":aws,
                "home_name":team_name(home),"away_name":team_name(away),
                "source_url":canonical})
            continue
        games.append(({"game_id":"ncaa:"+gameid,"date":day,"home_id":h,"away_id":a,
            "home_score":hs,"away_score":aws,"site":site,"status":"Final",
            "source_url":canonical,"provider":"ncaa-origin-bridge",
            "overtime":"true" if re.search(r"\bOT\b|overtime",str(game.get("finalMessage","")),re.I) else "false"},
            {h:team_name(home),a:team_name(away)}))
    return games,rejected

def convert(root,out,registry,report,expected_days=None):
    rows={}; names={};rejections=[];days=[]
    paths=sorted(root.glob("*/*/*.json"))
    if not paths:
        raise ValueError("No historical scoreboard archives were found; refusing empty output")
    for path in paths:
        record=json.loads(path.read_text(encoding="utf-8"))
        if not record.get("raw_sha256") or not record.get("source_url") or not isinstance(record.get("payload",{}).get("games"),list):
            raise ValueError("Unverifiable archive: "+str(path))
        day=record["day"]
        if day in days:raise ValueError("Duplicate archive day "+day)
        if path.stem!=day[-2:] or path.parent.name!=day[5:7] or path.parent.parent.name!=day[:4]:
            raise ValueError("Archive path/date mismatch: "+str(path))
        days.append(day)
        games,bad=parse(record)
        rejections.extend(bad)
        for game,team_names in games:
            gid=game["game_id"]
            if gid in rows and rows[gid]!=game:
                raise ValueError("Conflicting event ID: "+gid)
            rows[gid]=game
            for i,name in team_names.items():
                if i in names and names[i]!=name:
                    # retain first observed official name, aliases reviewed later
                    pass
                else:names[i]=name
    if expected_days is not None and set(expected_days)!=set(days):
        raise ValueError("Archive day coverage mismatch")
    out.parent.mkdir(parents=True,exist_ok=True)
    with out.open("w",newline="",encoding="utf-8") as f:
        writer=csv.DictWriter(f,fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(sorted(rows.values(),key=lambda x:(x["date"],x["game_id"])))
    # Registry is a CANDIDATE; the NCAA scoreboard also includes non-D1 opponents.
    # Manual or official membership verification must precede model ingestion.
    registry.parent.mkdir(parents=True,exist_ok=True)
    registry.write_text(json.dumps({"status":"unverified-candidates","teams":[
        {"id":i,"name":name,"division":"UNVERIFIED"}
        for i,name in sorted(names.items())]},indent=2)+"\n",encoding="utf-8")
    pending=report.with_name("ncaam-unresolved-finals.json")
    pending.parent.mkdir(parents=True,exist_ok=True)
    pending.write_text(json.dumps(rejections,indent=2)+"\n",encoding="utf-8")
    summary={"archive_days":len(days),"unique_finals":len(rows),"candidate_teams":len(names),
             "rejection_reasons":dict(Counter(x["reason"] for x in rejections)),
             "rejected_final_count":len(rejections),"rejections":rejections,
             "release_ready":False,"blockers":["verify D1 membership of every team",
             "resolve rejected games and missing venue data","validate full season date coverage",
             "cross-check season game counts and scores",
             "bridge SEO aliases are candidates, not NCAA numeric IDs",
             "upstream NCAA bridge does not expose neutral-site field reliably"]}
    report.parent.mkdir(parents=True,exist_ok=True)
    report.write_text(json.dumps(summary,indent=2)+"\n",encoding="utf-8")
    return summary

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--root",type=Path,default=Path("data/ncaam-source-archive"))
    p.add_argument("--out",type=Path,default=Path("staging/ncaam-final-candidates.csv"))
    p.add_argument("--registry",type=Path,default=Path("staging/ncaam-team-candidates.json"))
    p.add_argument("--report",type=Path,default=Path("staging/ncaam-coverage-report.json"))
    args=p.parse_args()
    print(json.dumps(convert(args.root,args.out,args.registry,args.report),indent=2))
if __name__=="__main__":main()
