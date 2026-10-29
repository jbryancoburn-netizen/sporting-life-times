#!/usr/bin/env python3
"""Fill missing calendar fields from the SEC website's own schedule API.

Requires an exact local date and two uniquely resolved school identities.
Never replaces an existing announced field or creates an inferred fixture.
"""
import collections, datetime, json, pathlib, re, sys
from zoneinfo import ZoneInfo
DATA=pathlib.Path(__file__).resolve().parents[1]/'data'
SOURCE='https://www.secsports.com/schedule/basketball-m'
def key(s):
 s=str(s or '').lower().replace('state','st').replace('saint','st')
 s=re.sub(r'^(?:the )?university of | university$','',s)
 return re.sub('[^a-z0-9]','',s)
def main(raw):
 ix=collections.defaultdict(set)
 for t in json.loads((DATA/'ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams']:
  for n in [t['name'],t.get('espn_name')]:
   if n:ix[key(n)].add(str(t['espn_id']))
 for tid,t in json.loads((DATA/'mbb-logo-registry.json').read_text())['teams'].items():
  for k in ['school','display_name','provider_team_name']:
   if t.get(k):ix[key(t[k])].add(tid)
 aliases={'North Carolina Central':'2428','Alcorn State':'2016','LSU New Orleans':'2443',
 'Arkansas-Pine Bluff':'2029','SE Louisiana':'2545','Mississippi Valley State':'2400',
 'Northern Kentucky':'94','Central Arkansas':'2110','Southeast Missouri State':'2546',
 'North Alabama':'2453','UL Monroe':'2433','Northern Arizona':'2464','Prairie View A&M':'2504',
 'Fairleigh Dickinson':'161','Eastern Illinois':'2197','Queens University':'2511',
 'Southern Indiana':'88','Southern':'2582','Eastern Kentucky':'2198','West Georgia':'2698',
 "St. John's":'2599','Middle Tennessee':'2393','South Florida':'58','Central Michigan':'2117',
 'Long Island University':'112358','UT Rio Grande Valley':'292'}
 for name,tid in aliases.items():ix[key(name)].add(tid)
 def resolve(e,side):
  o=e.get(side+'_opponent') or {}
  names=[o.get('name'),o.get('long_name'),e.get(side+'_opponent_name')]
  ids=set().union(*(ix.get(key(n),set()) for n in names if n))
  return next(iter(ids)) if len(ids)==1 else ''
 docs={p.stem:json.loads(p.read_text()) for p in (DATA/'mbb-schedules-2026-27').glob('*.json') if p.stem.isdigit()}
 changes=[];facts=[];counts=collections.Counter();changed=set();unknown=[]
 for source in raw['data']:
  a,b=resolve(source,'first'),resolve(source,'second')
  if not a or not b or a==b:
   unknown.append([source.get('first_opponent_name'),source.get('second_opponent_name')]);continue
  when=datetime.datetime.fromisoformat(source['datetime'].replace('Z','+00:00')).astimezone(ZoneInfo('America/New_York'))
  day=when.date().isoformat()
  if not ('2026-11-01'<=day<='2027-03-08') or source.get('is_exhibition'):continue
  tv=list(dict.fromkeys((x.get('media_label') or x.get('source_label')) for x in source.get('schedule_event_broadcasts',[]) if (x.get('media_label') or x.get('source_label'))))
  time=when.strftime('%I:%M %p').lstrip('0')+' ET' if source.get('tba')=='non_tba' and not source.get('is_all_day') else ''
  fact=dict(source_event_id=source['id'],date=day,teams=[a,b],arena=source.get('venue'),city=source.get('location'),broadcasts=tv,time=time,neutral=source.get('neutral'),first_home=source.get('first_opponent_home_team'),second_home=source.get('second_opponent_home_team'),source_url=SOURCE)
  facts.append(fact)
  for owner in [a,b]:
   matches=[]
   for e in docs.get(owner,{}).get('events',[]):
    ids={str(x.get('team',{}).get('id') or '') for x in e['competitions'][0]['competitors']}
    if e['date'][:10]==day and ids=={a,b}:matches.append(e)
   if len(matches)!=1:continue
   e=matches[0];c=e['competitions'][0];v=c.setdefault('venue',{});added=[];counts['matched_calendar_games']+=1
   if fact['arena'] and not v.get('arenaName'):
    v.update(arenaName=fact['arena'],arena_source_url=SOURCE,arena_source_type='official_conference_game_feed');added.append('arenas')
   if fact['city'] and not (v.get('official_school_city') or v.get('address',{}).get('city')):
    v.update(official_school_city=fact['city'],city_source_url=SOURCE);added.append('cities')
   if tv and not (c.get('broadcasts') or e.get('broadcasts')):
    c['broadcasts']=[{'names':tv,'source_url':SOURCE}];e['broadcast_source_url']=SOURCE;added.append('broadcasts')
   old=e.get('official_school_time') or e.get('official_time') or ''
   if time and (not old or re.search('TBA|TBD',old,re.I)):
    e.update(official_school_time=time,official_school_time_source=SOURCE);added.append('tipoffs')
   neutral=fact['neutral'];ha,hb=fact['first_home'],fact['second_home']
   sides={a:'neutral',b:'neutral'} if neutral is True else ({a:'home' if ha else 'away',b:'home' if hb else 'away'} if neutral is False and type(ha)is bool and type(hb)is bool and ha!=hb else {})
   if sides and not e.get('site_verified'):
    for p in c['competitors']:p['homeAway']=sides[str(p['team']['id'])]
    e.update(site_verified=True,neutralSite=neutral,site_source_url=SOURCE);e.pop('site_conflict',None);added.append('sites')
   if added:
    changed.add(owner);counts.update(added);changes.append({'id':owner,'event_id':e['id'],'source_event_id':source['id'],'fields':added})
 for owner in changed:(DATA/'mbb-schedules-2026-27'/f'{owner}.json').write_text(json.dumps(docs[owner],ensure_ascii=False,separators=(',',':'))+'\n')
 report={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source_url':SOURCE,'summary':{'schools_updated':len(changed),'source_games_read':len(raw['data']),**counts},'changes':changes,'unresolved_matchups':unknown,'official_game_evidence':facts}
 (DATA/'mbb-sec-official-feed-recovery.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(report['summary']));print('Unresolved',unknown)
if __name__=='__main__':main(json.loads(pathlib.Path(sys.argv[1]).read_text()))
