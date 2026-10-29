#!/usr/bin/env python3
"""Populate MBB rosters for every school while preserving official athletics data.
Official school files always win; ESPN is a labeled fallback until verified school assets exist.
"""
import concurrent.futures,json,pathlib,urllib.request,datetime,time
root=pathlib.Path(__file__).resolve().parents[1]
teams=json.loads((root/'data/ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams']
dest=root/'data/mbb-rosters-2026-27';dest.mkdir(exist_ok=True)
def fetch(team):
 ident=str(team['espn_id']);target=dest/(ident+'.json')
 if target.exists():
  try:
   old=json.loads(target.read_text())
   if old.get('players') and old.get('source','').startswith('https://') and 'espn' not in old.get('source','').lower():
    return ident,'official-preserved',len(old['players'])
  except (ValueError,OSError): pass
 url=f'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/{ident}/roster?season=2027'
 for attempt in range(2):
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 SportingLifeTimes/1.0'})
   with urllib.request.urlopen(req,timeout=25) as r: data=json.load(r)
   entries=data.get('athletes') or []
   athletes=[p for item in entries for p in (item.get('items',[]) if isinstance(item.get('items'),list) else [item])]
   athletes=[p for p in athletes if p.get('displayName')]
   if not athletes: return ident,'no-source',0
   players=[]
   for p in athletes:
    photo=p.get('headshot') or {}
    players.append({'name':p['displayName'],'jersey':p.get('jersey',''),'position':(p.get('position') or {}).get('displayName',''),'year':(p.get('experience') or {}).get('displayValue',''),'headshot_url':photo.get('href','')})
   content={'season':'2026-27','team_id':team['id'],'team':team['name'],'source':url,'source_priority':'ESPN fallback; replace with official university athletics roster when verified','fetched_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'players':players}
   if target.exists():
    try:
     prior=json.loads(target.read_text())
     if len(prior.get('players',[]))>len(players): return ident,'larger-existing-preserved',len(prior['players'])
     # Preserve unchanged player lists without committing 364 duplicate files
     # daily. Only actual roster/portrait/jersey changes trigger file writes.
     if prior.get('players')==players and prior.get('source')==url:
      return ident,'unchanged',len(players)
    except (OSError,ValueError): pass
   target.write_text(json.dumps(content,ensure_ascii=False,separators=(',',':'))+'\n')
   return ident,'fallback-updated',len(players)
  except Exception as e:
   if attempt: return ident,'error: '+str(e)[:90],0
   time.sleep(1)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex: result=list(ex.map(fetch,teams))
summary={'attempted_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'teams':len(teams),'official_preserved':sum(r[1]=='official-preserved' for r in result),'fallback_updated':sum(r[1]=='fallback-updated' for r in result),'unchanged':sum(r[1]=='unchanged' for r in result),'errors':[{'id':r[0],'message':r[1]} for r in result if r[1].startswith('error')],'no_source':sum(r[1]=='no-source' for r in result)}
(dest/'refresh-status.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:len(v) if k=='errors' else v for k,v in summary.items()}))
