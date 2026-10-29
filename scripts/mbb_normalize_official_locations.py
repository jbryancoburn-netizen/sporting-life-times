#!/usr/bin/env python3
"""Separate facilities and cities explicitly combined in saved official game locations."""
import json,re,pathlib,collections,importlib.util
from urllib.parse import urlparse
sp=importlib.util.spec_from_file_location('fields',pathlib.Path(__file__).with_name('mbb_complete_official_fields.py'));m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
counts=collections.Counter();schools=[]
def official(url):
 host=urlparse(url or '').hostname or ''
 return url.startswith('https://') and not any(x in host for x in ['espn.com','realgm.com','sports-reference.com','wikipedia.org'])
known=set()
for item in m.TEAMS:
 doc=json.loads((m.DATA/'mbb-schedules-2026-27'/(str(item['espn_id'])+'.json')).read_text())
 for event in doc.get('events',[]):
  venue=event['competitions'][0].get('venue',{});name=venue.get('arenaName','')
  if name and official(venue.get('arena_source_url','')) and 'default' not in venue.get('arena_source_type',''):
   cleaned,_=m.split_location(name)
   if cleaned and ',' not in cleaned:known.add(cleaned)

def split(text):
 arena,city=m.split_location(text)
 if arena:return arena,city
 suffixes=[name for name in known if text.lower().endswith(name.lower()) and (len(text)==len(name) or not text[-len(name)-1].isalnum())]
 if suffixes:
  name=max(suffixes,key=len);prefix=text[:-len(name)].strip(' ,/|')
  if not prefix or ',' in prefix or prefix.isupper():return text[-len(name):],prefix
 return '',text

for team in m.TEAMS:
 tid=str(team['espn_id']);p=m.DATA/'mbb-schedules-2026-27'/(tid+'.json');d=json.loads(p.read_text());stats=collections.Counter()
 for e in d.get('events',[]):
  v=e['competitions'][0].setdefault('venue',{})
  sources=[(v.get('official_school_city',''),v.get('city_source_url','')),(v.get('official_school_location',''),v.get('source_url',''))]
  if e.get('official_source') and 'default' not in v.get('arena_source_type',''):
   sources.append((v.get('fullName',''),e.get('school_source_url') or d.get('source_url','')))
  for text,url in sources:
   if not text or not official(url) or re.search('Choose|Select|All Games|Schedule|Location Filter',text,re.I):continue
   arena,city=split(text)
   if not arena:continue
   if not v.get('arenaName'):
    v.update(arenaName=arena,arena_source_url=url,arena_source_type='explicit_official_game_location');stats['arenas_added']+=1
   if v.get('official_school_city')==text:
    if city:v['official_school_city']=city;v['city_source_url']=url;stats['combined_cities_cleaned']+=1
    elif m.norm(v['official_school_city'])==m.norm(arena):
     del v['official_school_city'];v.pop('city_source_url',None);stats['facility_labels_removed_from_city']+=1
   if city and not v.get('official_school_city') and not v.get('address',{}).get('city'):
    v['official_school_city']=city;v['city_source_url']=url;stats['cities_added']+=1
  if v.get('official_school_city') and v.get('arenaName') and m.norm(v['official_school_city'])==m.norm(v['arenaName']):
   del v['official_school_city'];v.pop('city_source_url',None);stats['facility_labels_removed_from_city']+=1
 if stats:
  p.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n');schools.append({'id':tid,'school':team['name'],**dict(stats)});counts.update(stats)
report={'summary':{'schools_updated':len(schools),**dict(counts)},'schools':schools,'method':'Parse explicit per-game official location strings only; no home-arena defaults.'}
(m.DATA/'mbb-official-location-normalization.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report['summary']))
