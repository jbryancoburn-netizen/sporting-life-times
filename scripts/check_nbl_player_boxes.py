#!/usr/bin/env python3
"""Reject incomplete or irreconcilable sourced NBL player boxscore editions."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
games=json.loads((root/'data/nbl-research-current-ledger.json').read_text())['games']
d=json.loads((root/'data/nbl-player-boxscores.json').read_text())
known={str(g['id']):g for g in games}
seen=set()
for b in d['games']:
 key=str(b['id'])
 assert key in known and key not in seen,('unknown or duplicate',key)
 seen.add(key)
 g=known[key]
 assert (b['home'],b['away'],b['home_score'],b['away_score'])==(g['home'],g['away'],g['home_score'],g['away_score']),key
 assert {t['team'] for t in b['teams']}=={g['home'],g['away']},key
 for team in b['teams']:
  players=team['players']
  assert len(players)>=5 and len({p['id'] or p['name'] for p in players})==len(players),key
  pts=sum(int(p['stats']['points']) for p in players)
  assert pts==g['home_score' if team['team']==g['home'] else 'away_score'],(key,pts)
assert d['games_with_player_boxes']==len(seen)
assert d['games_expected']==len(known)
assert len(seen)+len(d['unavailable'])==len(known)
print(f'NBL validated {len(seen)}/{len(known)} box scores; player totals match final scores')
