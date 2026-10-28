#!/usr/bin/env python3
"""Seed up to 100 missing arena REFERENCES using the current RealGM 2026-27 directory.
References are explicitly provisional; never promote to verified home_arena without school evidence.
"""
import json,re,pathlib,requests,collections
from bs4 import BeautifulSoup
from rapidfuzz import fuzz
root=pathlib.Path(__file__).resolve().parents[1];data=root/'data'
p=data/'mbb-arena-registry.json';reg=json.loads(p.read_text())
cross=json.loads((data/'ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams']
url='https://basketball.realgm.com/ncaa/teams'
resp=requests.get(url,headers={'User-Agent':'Mozilla/5.0'},timeout=30);resp.raise_for_status()
soup=BeautifulSoup(resp.text,'html.parser')
def norm(x):
 x=str(x or '').lower().replace('&',' and ')
 x=re.sub(r'\b(university|college|the)\b','',x)
 return re.sub('[^a-z0-9]','',x)
entries=[]
for table in soup.select('table'):
 heads=[h.get_text(' ',strip=True).lower() for h in table.select('thead th')]
 if not heads:
  first=table.find('tr')
  if first:heads=[h.get_text(' ',strip=True).lower() for h in first.find_all(['th','td'])]
 if 'school' not in heads or 'home venue' not in heads:continue
 school_i=heads.index('school');venue_i=heads.index('home venue')
 for tr in table.select('tbody tr'):
  cells=tr.find_all(['td','th'])
  if len(cells)<=max(school_i,venue_i):continue
  school=cells[school_i].get_text(' ',strip=True);venue=cells[venue_i].get_text(' ',strip=True)
  if school and venue and venue not in ('-','TBA'):entries.append((school,venue))
if len(entries)<250:raise RuntimeError('Venue directory parse produced only '+str(len(entries))+' rows: refusing update.')
aliases={'u albany':'albany','uc irvine':'california irvine','uc riverside':'california riverside','uc davis':'california davis','uc san diego':'california san diego','uc santa barbara':'california santa barbara','uic':'illinois chicago','iu indy':'iupui','fdu':'fairleigh dickinson','st bonaventure':'saint bonaventure','ole miss':'mississippi','unc':'north carolina','byu':'brigham young','utrgv':'texas rio grande valley'}
existing=collections.defaultdict(set)
for school,venue in entries:existing[norm(school)].add((school,venue))
added=[];ambiguous=[]
for t in cross:
 if len(added)>=100:break
 tid=str(t.get('espn_id',''));item=reg['teams'].get(tid)
 if not item or item.get('home_arena') or item.get('arena_reference_candidate'):continue
 names=[t.get('name',''),t.get('espn_name','')]
 # Strip team nickname only when exact school alias already matches.
 keys={norm(n) for n in names if n}
 for n in names:
  alias=aliases.get(str(n).lower())
  if alias:keys.add(norm(alias))
 matches=set()
 for key in keys:matches.update(existing.get(key,set()))
 if len(matches)!=1:
  # Non-exact matches are unsafe for venue assignment; leave unresolved.
  ambiguous.append(t.get('name'));continue
 src_name,venue=next(iter(matches))
 item['arena_reference_candidate']=venue
 item['arena_reference_source']=url
 item['arena_reference_school_name']=src_name
 item['arena_reference_status']='secondary_directory_pending_official_school_confirmation'
 added.append({'school':t['name'],'arena':venue,'directory_school':src_name,'source':url})
p.write_text(json.dumps(reg,indent=2)+'\n')
report={'new_secondary_arena_references':len(added),'verified_home_arenas_unchanged':sum(bool(v.get('home_arena')) for v in reg['teams'].values()),'directory_rows':len(entries),'references':added,'unmatched_schools':ambiguous,'warning':'Secondary-source candidates are not verified and are not used as canonical live home arenas.'}
(data/'mbb-100-arena-reference-import.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ('references','unmatched_schools')},indent=2))
