"""Normalize final box scores and aggregate by game ID (replays cannot double count)."""
from collections import defaultdict

def parse_boxscore(data, crosswalk):
    rows=[]
    for team in data.get('boxscore',{}).get('players',[]):
        team_id=crosswalk.get(str(team.get('team',{}).get('id')))
        if not team_id:continue
        for group in team.get('statistics',[]):
            labels=group.get('labels',[])
            for p in group.get('athletes',[]):
                if p.get('didNotPlay'):continue
                raw=dict(zip(labels,p.get('stats',[])))
                if not {'PTS','REB','AST','FG'}.issubset(raw):continue
                try:
                    fg=[int(n) for n in raw['FG'].split('-')]
                    ft=[int(n) for n in raw.get('FT','0-0').split('-')]
                    values={k.lower():int(raw.get(k,0)) for k in ['PTS','REB','AST','STL','BLK']}
                except (TypeError,ValueError):continue
                athlete=p.get('athlete',{})
                rows.append({'player_id':str(athlete.get('id')),'name':athlete.get('displayName'),'team_id':team_id,**values,'fgm':fg[0],'fga':fg[1],'ftm':ft[0],'fta':ft[1]})
    return rows

def aggregate(games):
    totals={}
    for rows in games.values():
        for r in rows:
            key=(r['team_id'],r['player_id'])
            p=totals.setdefault(key,{'name':r['name'],'team_id':r['team_id'],'games':0,**{k:0 for k in ['pts','reb','ast','stl','blk','fgm','fga','fta']}})
            p['games']+=1
            for k in ['pts','reb','ast','stl','blk','fgm','fga','fta']:p[k]+=r[k]
    result=[]
    for p in totals.values():
        n=p['games'];den=2*(p['fga']+.44*p['fta'])
        result.append({'name':p['name'],'team_id':p['team_id'],'games':n,**{k:round(p[k]/n,1) for k in ['pts','reb','ast','stl','blk']},'fg':round(100*p['fgm']/p['fga'],1) if p['fga'] else None,'ts':round(100*p['pts']/den,1) if den else None})
    return result
