#!/usr/bin/env python3
"""Import historical NCAA men's game scores into 1985-onwards school head-to-head pages.
Uses publicly accessible compact results; never mark coverage complete without validation.
"""
import csv,io,json,re,pathlib,urllib.request,datetime,collections,difflib
root=pathlib.Path(__file__).resolve().parents[1]
dest=root/'data/mbb-head-to-head-1985'
dest.mkdir(parents=True,exist_ok=True)
cross=json.loads((root/'data/ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams']
base='https://huggingface.co/Jensen-holm/Nigl/resolve/main/data/'
def read(name):
 req=urllib.request.Request(base+name,headers={'User-Agent':'Mozilla/5.0 SportingLifeTimes archive importer'})
 with urllib.request.urlopen(req,timeout=90) as r: raw=r.read().decode('utf-8-sig')
 return list(csv.DictReader(io.StringIO(raw)))
def norm(v):
 v=re.sub(r'&',' and ',str(v).casefold())
 return re.sub(r'[^a-z0-9]','',v.replace('university','').replace('college',''))
aliases={'indiana':'indiana','michiganst':'michiganst','michiganstate':'michiganst','saintjohnsny':'stjohns','stjohnsny':'stjohns','connecticut':'uconn','massachusetts':'umass','mississippist':'mississippist','northcarolinast':'ncstate','brighamyoung':'byu','southerncalifornia':'usc','miamifl':'miamifl','miamioh':'miamioh','pennsylvania':'penn','pennst':'pennst','virginiacommonwealth':'vcu','texasamcorpuschristi':'tamcc','californiabaptist':'calbaptist'}
def canonical(s): return aliases.get(norm(s),norm(s))
teamrows=read('MTeams.csv')
names={}
for t in cross:
 for value in [t['name'],t.get('espn_name','')]:
  k=canonical(value)
  if k: names.setdefault(k,set()).add(t['id'])
mapping={};unmatched=[]
for team in teamrows:
 kid=int(team['TeamID']);name=team['TeamName'];k=canonical(name)
 ids=names.get(k,set())
 if len(ids)==1: mapping[kid]=next(iter(ids))
 else: unmatched.append({'kaggle_id':kid,'name':name,'reason':'ambiguous' if ids else 'unmatched'})
seasons={int(r['Season']):datetime.date.fromisoformat(r['DayZero']) for r in read('MSeasons.csv')}
games=[];counts=collections.Counter();source_counts=collections.Counter()
for filename,category in [('MRegularSeasonCompactResults.csv','Regular season / conference tournament'),('MNCAATourneyCompactResults.csv','NCAA Tournament')]:
 for row in read(filename):
  season=int(row['Season'])
  if season<1985: continue
  w,l=int(row['WTeamID']),int(row['LTeamID'])
  if w not in mapping or l not in mapping: counts['unmapped_game_rows']+=1;continue
  home_win=row['WLoc']=='H'
  away_win=row['WLoc']=='A'
  h= w if home_win or (not away_win) else l
  a= l if home_win or (not away_win) else w
  score={w:int(row['WScore']),l:int(row['LScore'])}
  date=(seasons[season]+datetime.timedelta(days=int(row['DayNum']))).isoformat()
  g={'date':date,'season':season,'home_id':mapping[h],'away_id':mapping[a],'home_score':score[h],'away_score':score[a],'location':row['WLoc'],'competition':category,'source_url':'https://www.kaggle.com/competitions/march-machine-learning-mania-2026/data'}
  games.append(g);source_counts[category]+=1
pair=collections.defaultdict(list)
for g in games:
 key='_'.join(sorted([g['home_id'],g['away_id']])).replace(':','-')
 pair[key].append(g)
for key,rows in pair.items():
 rows.sort(key=lambda g:g['date'],reverse=True)
 end=max(g['season'] for g in rows)
 payload={'coverage_start_year':1985,'coverage_end_year':end,'validated':False,'source':'Kaggle compact historical results mirrored in Jensen-holm/Nigl','games':rows}
 (dest/(key+'.json')).write_text(json.dumps(payload,separators=(',',':'),ensure_ascii=False))
report={'generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'historical_games_mapped':len(games),'game_rows_by_source':source_counts,'mapped_kaggle_teams':len(mapping),'unmatched_kaggle_teams':unmatched,'pair_files':len(pair),'coverage_start_year':1985,'source_snapshot_max_year':max(g['season'] for g in games),'limitations':'Regular compact includes conference tournament games with no distinct round classifier; excludes NIT and other secondary tournaments; unmatched teams omitted; dataset historical mirror may not include recent seasons.'}
(dest/'import-status.json').write_text(json.dumps(report,indent=2,default=dict))
print(json.dumps({k:v for k,v in report.items() if k!='unmatched_kaggle_teams'},indent=2,default=dict))
if len(games)<100000 or len(mapping)<250: raise SystemExit('Low coverage; refusing to claim successful import')
