#!/usr/bin/env python3
"""Read-only health audit of the NBA daily data pipeline. Never invents game or player data."""
import json
from datetime import datetime,timezone
from pathlib import Path
root=Path(__file__).resolve().parents[1]
def read(path):
 try:return json.loads((root/path).read_text())
 except (OSError,ValueError):return {}
def age(value,now):
 try:return round((now-datetime.fromisoformat(value.replace('Z','+00:00'))).total_seconds()/3600,2)
 except (TypeError,ValueError,AttributeError):return None
now=datetime.now(timezone.utc)
elo=read('data/nba-2026-27-current-provisional.json')
boxes=read('data/nba-game-center.json')
players=read('data/nba-player-leaders.json')
news=read('data/nba-top-stories.json')
roster=read('data/nba-roster-wire-snapshot.json')
completed=[g for g in boxes.get('games',[]) if g.get('state')=='post' and g.get('players')]
boxfixtures={(str(g.get('date') or '')[:10],tuple(sorted(t.get('code') for t in g.get('teams',[]) if t.get('code')))) for g in completed}
elofixtures={(str(g.get('date') or '')[:10],tuple(sorted([g.get('home'),g.get('away')]))) for g in elo.get('events',[])}
snap={
 'checked_at':now.isoformat(),
 'elo':{'teams':len(elo.get('rankings',[])),'completed_games':len(elo.get('events',[])),'games_played':elo.get('games_played')},
 'box_scores':{'completed_games':len(completed),'player_lines':sum(len(g.get('players',[])) for g in completed),'updated_at':boxes.get('updated_at'),'age_hours':age(boxes.get('updated_at'),now),'fixtures_missing_player_boxes':len(elofixtures-boxfixtures)},
 'player_stats':{'players':len(players.get('season_totals',[])),'leader_rows':len(players.get('rows',[])),'updated_at':players.get('updated_at'),'age_hours':age(players.get('updated_at'),now)},
 'news':{'stories':len(news.get('articles',[])),'updated_at':news.get('updated_at'),'age_hours':age(news.get('updated_at'),now)},
 'roster':{'injuries':len(roster.get('injuries',[])),'transactions':len(roster.get('transactions',[])),'injury_age_hours':age(roster.get('injuries_as_of'),now),'transaction_age_hours':age(roster.get('transactions_as_of'),now)},
}
issues=[]
if snap['elo']['teams']!=30 or snap['elo']['completed_games']!=snap['elo']['games_played']:issues.append('elo_ledger_inconsistent')
if not completed:issues.append('no_player_box_scores')
if not snap['player_stats']['players']:issues.append('no_player_season_totals')
if not snap['news']['stories']:issues.append('no_nba_news')
for label,field,threshold in [('box_scores','age_hours',6),('player_stats','age_hours',6),('news','age_hours',4)]:
 value=snap[label][field]
 if value is None or value>threshold:issues.append(label+'_stale')
snap['issues']=issues
snap['status']='attention' if issues else 'healthy'
dest=root/'data/nba-pipeline-health.json'
dest.write_text(json.dumps(snap,indent=2,ensure_ascii=False)+'\n')
print(json.dumps(snap,indent=2))
if issues:raise SystemExit('Pipeline warning: '+', '.join(issues))
