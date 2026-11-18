#!/usr/bin/env python3
"""Freeze independent current-season-only pregame basketball predictions.
No historic data, RETRO ratings or RETRO forecasts are input features.
Men: only games on dates strictly after today's New York date (no reliable tipoff in snapshot).
Women: only games with future source tipoffs; exclude venues without verified location.
Existing capture records are immutable.
"""
import json, math, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data'
OUT=DATA/'cbb-season-shadow-captures-2026-27.json'
NOW=datetime.datetime.now(datetime.timezone.utc)
TODAY=NOW.astimezone(ZoneInfo('America/New_York')).date().isoformat()

def load(name):return json.loads((DATA/name).read_text(encoding='utf-8'))
def day(g):return str(g.get('date',''))[:10]
def valid(g):
    return g.get('site_verified') is True and all(isinstance(g.get(k),(int,float)) and math.isfinite(g[k]) and g[k]>=0 for k in ('home_score','away_score')) and g['home_score']!=g['away_score'] and g.get('home_id') and g.get('away_id')
def model(games,date):
    prior=[g for g in games if day(g)<date]
    if len(prior)<80:return None
    avg=sum(g['home_score']+g['away_score'] for g in prior)/len(prior)
    entries={}
    def get(k):return entries.setdefault(str(k),[[],[]])
    for g in prior:
        h,a=str(g['home_id']),str(g['away_id'])
        margin=g['home_score']-g['away_score']-(0 if g.get('neutral') else 4)
        deviation=g['home_score']+g['away_score']-avg
        get(h)[0].append((a,margin));get(a)[0].append((h,-margin))
        get(h)[1].append((a,deviation));get(a)[1].append((h,deviation))
    strengths={k:0. for k in entries};paces=strengths.copy()
    for _ in range(35):
        strengths2={k:sum(v+strengths.get(opp,0) for opp,v in obj[0])/(len(obj[0])+2) for k,obj in entries.items()}
        paces2={k:sum(v-paces.get(opp,0) for opp,v in obj[1])/(len(obj[1])+2) for k,obj in entries.items()}
        strengths,paces=strengths2,paces2
    return avg,entries,strengths,paces
def forecast(m,g,neutral):
    if not m:return None
    avg,entries,s,p=m;h,a=str(g['home_id']),str(g['away_id'])
    if h not in entries or a not in entries:return None
    margin=s[h]-s[a]+(0 if neutral else 4)
    total=avg+p[h]+p[a]
    home=(total+margin)/2;away=(total-margin)/2
    if min(home,away)<0 or not all(math.isfinite(x) for x in (margin,home,away)):return None
    return {'home_score':round(home),'away_score':round(away),'home_margin':round(margin,3),'total':round(total,3)}
def main():
    existing=load(OUT.name) if OUT.exists() else {'season':'2026-27','model':'season-only-score-opponent-adjusted-v1','captures':[]}
    seen={(x['gender'],str(x['game_id'])) for x in existing['captures']}
    added=0
    for gender in ('men','women'):
        if gender=='men':
            scores=load('mbb-2026-2027-results.json')['games']
            upcoming=load('ncaam-2026-27-upcoming-forecasts.json')['games']
            di=None
        else:
            scores=load('ncaaw-2026-27-verified-games.json')['games']
            upcoming=load('ncaaw-2026-27-games.json')['upcoming']
            di={str(x['team_id']) for x in load('ncaaw-2026-27-retro-primary.json')['rankings']}
        scores=[g for g in scores if valid(g) and (di is None or str(g['home_id']) in di and str(g['away_id']) in di)]
        cache={}
        for g in upcoming:
            date=day(g)
            if not date or not g.get('home_id') or not g.get('away_id') or (di is not None and (str(g['home_id']) not in di or str(g['away_id']) not in di)):continue
            key=(gender,str(g.get('id','')).removeprefix('espn:'))
            if not key[1] or key in seen:continue
            if gender=='men':
                if date<=TODAY:continue
                if g.get('venue_verification') not in ('verified_home','neutral'):continue
                neutral=g.get('venue_verification')=='neutral'
            else:
                if g.get('site_verified') is not True:continue
                try:tip=datetime.datetime.fromisoformat(g['date'].replace('Z','+00:00'))
                except (TypeError,ValueError):continue
                if tip.tzinfo is None or tip<=NOW:continue
                neutral=g.get('neutral') is True
            if date not in cache:cache[date]=model(scores,date)
            prediction=forecast(cache[date],g,neutral)
            if prediction is None:continue
            existing['captures'].append({'gender':gender,'game_id':key[1],'game_date':date,'home_id':str(g['home_id']),'away_id':str(g['away_id']),
                                        'captured_at':NOW.isoformat().replace('+00:00','Z'),'capture_policy':'future_day_only' if gender=='men' else 'before_source_tipoff',
                                        'source_tipoff_utc':g.get('date') if gender=='women' else None,'neutral':neutral,**prediction})
            seen.add(key);added+=1
    if added:
        existing['captures'].sort(key=lambda x:(x['game_date'],x['gender'],x['game_id']))
        OUT.write_text(json.dumps(existing,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'new_captures':added,'total_captures':len(existing['captures']),'as_of':TODAY}))
if __name__=='__main__':main()
