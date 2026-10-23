#!/usr/bin/env python3
"""Generate captured NBA player leaderboards from actual official NBA box scores.
Never represent the captured sample as full-season NBA leaders.
"""
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "data/nba-game-center.json"
destination = ROOT / "data/nba-player-leaders.json"
data = json.loads(source.read_text(encoding="utf-8"))
games = [g for g in data.get("games", []) if g.get("state") == "post" and g.get("players")]
# The official NBA CDN and ESPN may both capture one final: count it only once.
seen_fixtures=set()
deduplicated=[]
for game in sorted(games,key=lambda g:len(g.get("players") or []),reverse=True):
    teams=game.get("teams") or []
    codes=sorted(t.get("code") for t in teams if t.get("code"))
    day=str(game.get("date") or "")[:10]
    key=(day,tuple(codes))
    if len(codes)!=2 or not day or key in seen_fixtures:
        continue
    seen_fixtures.add(key)
    deduplicated.append(game)
games=deduplicated
players = defaultdict(lambda: {"gp":0, "pts":0, "reb":0, "ast":0, "stl":0, "blk":0, "tov":0,"fgm":0,"fga":0,"fg3m":0,"fg3a":0,"ftm":0,"fta":0})
for game in games:
    for p in game.get("players", []):
        pid = str(p.get("id") or "")
        name = str(p.get("name") or "").strip()
        if not pid.isdigit() or not name:
            continue
        key = (pid, name, str(p.get("team") or ""))
        row = players[key]
        row["gp"] += 1
        for field in ("pts", "reb", "ast", "stl", "blk", "tov", "fgm", "fga", "fg3m", "fg3a", "ftm", "fta"):
            row[field] += int(p.get(field) or 0)

rows = []
for stat, field in {"ppg":"pts", "rpg":"reb", "apg":"ast", "spg":"stl", "bpg":"blk"}.items():
    ranked = sorted(((v[field]/v["gp"], k, v) for k,v in players.items() if v["gp"]),key=lambda t:(-t[0],t[1][1]))[:15]
    rows.extend({"stat":stat,"player":key[1],"team":key[2],"value":round(avg,3),"gp":record["gp"]} for avg,key,record in ranked)
for stat,made,attempted in (("fg_pct","fgm","fga"),("fg3_pct","fg3m","fg3a"),("ft_pct","ftm","fta")):
    ranked=sorted(((100*v[made]/v[attempted],k,v) for k,v in players.items() if v[attempted]>=max(1,v["gp"])),key=lambda t:(-t[0],t[1][1]))[:15]
    rows.extend({"stat":stat,"player":k[1],"team":k[2],"value":round(avg,3),"gp":v["gp"],"made":v[made],"attempted":v[attempted]} for avg,k,v in ranked)
season_totals=[{"id":k[0],"player":k[1],"team":k[2],**dict(v),
  "ppg":round(v["pts"]/v["gp"],3),"rpg":round(v["reb"]/v["gp"],3),"apg":round(v["ast"]/v["gp"],3),
  "fg_pct":round(100*v["fgm"]/v["fga"],3) if v["fga"] else None,
  "fg3_pct":round(100*v["fg3m"]/v["fg3a"],3) if v["fg3a"] else None,
  "ft_pct":round(100*v["ftm"]/v["fta"],3) if v["fta"] else None,
  "ts_pct":round(100*v["pts"]/(2*(v["fga"]+0.44*v["fta"])),3) if v["fga"]+0.44*v["fta"] else None}
  for k,v in players.items() if v["gp"]]
result = {"updated_at":datetime.now(timezone.utc).isoformat(),"season":"2026-27",
    "source":"NBA.com official boxscores; independent captured-game leaderboard (incomplete sample)",
    "url":"https://www.nba.com/stats/leaders",
    "sample_only":True,
    "coverage":{"completed_boxscores":len(games),"unique_players":len(players)},
    "rows":rows,"season_totals":season_totals}
destination.parent.mkdir(parents=True,exist_ok=True)
destination.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("NBA captured player leaders:",len(players),"players from",len(games),"verified game box scores")
