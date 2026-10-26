"""Build compact newspaper data from the existing independently maintained ledgers."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
def read(name, fallback=None):
    p=ROOT/name
    return json.loads(p.read_text()) if p.exists() else fallback

def build():
    historical=read('data/ncaam-2025-26-elo-bootstrap.json',{})
    games=[{k:g.get(k) for k in ('id','date','home','away','home_score','away_score','site','source_url','home_after','away_after')} for g in historical.get('ledger',[])]
    prod=read('data/ncaam-2025-26-player-production-ledger.json',{})
    players=[]
    for p in prod.get('player_records',[]):
        n=p.get('games',0); t=p.get('totals',{})
        if not n: continue
        players.append(dict(name=p['name'],team_id=p['team_id'],games=n,
            pts=round(t.get('pts',0)/n,1),reb=round((t.get('orb',0)+t.get('drb',0))/n,1),
            ast=round(t.get('ast',0)/n,1),stl=round(t.get('stl',0)/n,1),blk=round(t.get('blk',0)/n,1),
            fg=round(100*t.get('fgm',0)/t['fga'],1) if t.get('fga') else None,
            ts=round(100*p['true_shooting'],1) if p.get('true_shooting') is not None else None))
    roster=read('data/ncaam-2026-27-individual-player-values.json',{})
    current=[{k:p.get(k) for k in ('player','team_id','role','historical_games','historical_points','historical_minutes','score_status')} for p in roster.get('players',[])]
    out={'historical_season':'2025-26','roster_season':'2026-27',
        'history_note':'Verified 2025–26 archive; not an all-time series.',
        'player_source':prod.get('source'), 'games':games,'players':players,'roster':current}
    (ROOT/'data/mbb-newspaper-archive.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
    print(f'Built {len(games)} archived games, {len(players)} player stat lines, {len(current)} roster records')
if __name__=='__main__':build()
