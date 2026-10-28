#!/usr/bin/env python3
"""Build canonical MBB logo identity and arena reference without inventing venue assignments."""
import pathlib,json,collections,re
root=pathlib.Path(__file__).resolve().parents[1];data=root/'data'
teams=[t for t in json.loads((data/'ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams'] if t.get('espn_id')]
brand=json.loads((data/'mbb-branding.json').read_text()).get('teams',{})
registry={};arena_candidates=collections.defaultdict(lambda:collections.defaultdict(lambda:{'games':0,'sources':set()}))
for t in teams:
 tid=str(t['espn_id']);b=brand.get(tid,{})
 registry[tid]={'school':t['name'],'canonical_id':t['id'],'espn_id':tid,'display_name':b.get('displayName') or t.get('espn_name') or t['name'],'primary_color':b.get('color') or None,'primary_color_verified':tid in brand,'logo_url':'https://a.espncdn.com/i/teamlogos/ncaa/500/'+tid+'.png','logo_url_verified':False,'official_logo_url':None}
 p=data/'mbb-schedules-2026-27'/(tid+'.json')
 if not p.exists():continue
 for e in json.loads(p.read_text()).get('events',[]):
  c=(e.get('competitions') or [{}])[0];v=c.get('venue') or {}
  own=next((x for x in c.get('competitors',[]) if str((x.get('team') or {}).get('id'))==tid),{})
  arena=v.get('arenaName')
  if not arena:continue
  # Only learn usual home courts from explicitly source-verified home games.
  if own.get('homeAway')!='home' or e.get('site_verified') is not True:continue
  entry=arena_candidates[tid][arena];entry['games']+=1
  source=v.get('arena_source_url') or v.get('source_url') or e.get('site_source_url') or ''
  if source:entry['sources'].add(source)
arenas={}
for tid,t in registry.items():
 c=arena_candidates[tid]
 options=sorted(({'arena':a,'verified_home_games':d['games'],'official_sources':sorted(d['sources'])} for a,d in c.items()),key=lambda x:-x['verified_home_games'])
 arenas[tid]={'school':t['school'],'home_arena':options[0]['arena'] if options and options[0]['verified_home_games']>=2 and options[0]['official_sources'] else None,'home_arena_source':options[0]['official_sources'][0] if options and options[0]['verified_home_games']>=2 and options[0]['official_sources'] else None,'candidates':options,'note':'Candidate learned only from previously official-source-verified home games; do not auto-assign alternate or neutral sites.'}
(data/'mbb-logo-registry.json').write_text(json.dumps({'method':'School identity and branding registry; image URLs still require HTTP verification','teams':registry},indent=2)+'\n')
(data/'mbb-arena-registry.json').write_text(json.dumps({'method':'Candidate home arenas derived only from source-verified home games','teams':arenas},indent=2)+'\n')
report={'schools':len(teams),'schools_with_brand_color':sum(v['primary_color_verified'] for v in registry.values()),'schools_with_verified_home_arena_candidates':sum(bool(v['home_arena']) for v in arenas.values()),'official_image_urls_verified':0}
(data/'mbb-registry-build-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
