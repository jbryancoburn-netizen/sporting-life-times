#!/usr/bin/env python3
"""Check logo IDs against an independent provider team identity endpoint.
HTTP success alone is not proof that the displayed crest belongs to the school.
"""
import json,pathlib,concurrent.futures,requests,re,collections
root=pathlib.Path(__file__).resolve().parents[1];data=root/'data'
p=data/'mbb-logo-registry.json';logos=json.loads(p.read_text())
session=requests.Session();session.headers['User-Agent']='Mozilla/5.0'
def norm(s):return re.sub('[^a-z0-9]','',str(s or '').lower())
def check(item):
 tid,t=item
 url='https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/'+tid
 try:
  res=requests.get(url,timeout=10,headers={'User-Agent':'Mozilla/5.0'})
  if not res.ok:return tid,'provider_unavailable',None
  obj=res.json().get('team') or {}
  pid=str(obj.get('id') or '')
  candidates=[obj.get('displayName'),obj.get('name'),obj.get('shortDisplayName')]
  supplied={norm(t.get('school')),norm(t.get('display_name'))}
  # An ESPN ID match ties the endpoint to the crosswalk, but does not verify team logo pixels.
  valid=pid==tid and bool(set(map(norm,candidates)) & supplied)
  returned=[x.get('href') for x in obj.get('logos',[]) if isinstance(x,dict)]
  return tid,'provider_identity_matched' if valid else 'provider_identity_mismatch',{'team_id':pid,'display_name':obj.get('displayName'),'logos':returned[:3]}
 except Exception:return tid,'provider_unavailable',None
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:results=list(pool.map(check,logos['teams'].items()))
count=collections.Counter()
for tid,status,meta in results:
 entry=logos['teams'][tid];entry['provider_identity_status']=status
 if meta:
  entry['provider_team_name']=meta['display_name']
  entry['provider_logo_candidates']=meta['logos']
 count[status]+=1
p.write_text(json.dumps(logos,indent=2)+'\n')
arena=json.loads((data/'mbb-arena-registry.json').read_text())['teams']
report={'schools':len(logos['teams']),'logo_identity_results':dict(count),'arenas_with_source':sum(bool(v.get('home_arena')) for v in arena.values()),'official_crest_verified':0,'note':'Provider identity check is an independent school-ID and image-manifest comparison, not visual/official-university-brand certification. Never call the image official merely because the URL loads.'}
(data/'mbb-school-logo-identity-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
