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
players = defaultdict(lambda: {"gp":0, "pts":0, "reb":0, "ast":0, "stl":0, "blk":0})
for game in games:
    for p in game.get("players", []):
        pid = str(p.get("id") or "")
        name = str(p.get("name") or "").strip()
        if not pid.isdigit() or not name:
            continue
        key = (pid, name, str(p.get("team") or ""))
        row = players[key]
        row["gp"] += 1
        for field in ("pts", "reb", "ast", "stl", "blk"):
            row[field] += int(p.get(field) or 0)

rows = []
for stat, field in {"ppg":"pts", "rpg":"reb", "apg":"ast", "spg":"stl", "bpg":"blk"}.items():
    ranked = sorted(((v[field]/v["gp"], k, v) for k,v in players.items() if v["gp"]),key=lambda t:(-t[0],t[1][1]))[:15]
    rows.extend({"stat":stat,"player":key[1],"team":key[2],"value":round(avg,3),"gp":record["gp"]} for avg,key,record in ranked)
result = {"updated_at":datetime.now(timezone.utc).isoformat(),"season":"2026-27",
    "source":"NBA.com official boxscores; independent captured-game leaderboard (incomplete sample)",
    "url":"https://www.nba.com/stats/leaders",
    "sample_only":True,
    "coverage":{"completed_boxscores":len(games),"unique_players":len(players)},
    "rows":rows}
destination.parent.mkdir(parents=True,exist_ok=True)
destination.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("NBA captured player leaders:",len(players),"players from",len(games),"verified game box scores")
