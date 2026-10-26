"""Independent MBB news/score feed. Failures retain last-success timestamps and data."""
import concurrent.futures as cf
import datetime as dt
import email.utils
import html
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from zoneinfo import ZoneInfo
from mbb_player_boxscores import parse_boxscore, aggregate
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/mbb-live.json'
FEEDS=[('CBS Sports','https://www.cbssports.com/rss/headlines/college-basketball/'),('NCAA','https://www.ncaa.com/news/basketball-men/d1/rss.xml'),('ESPN','https://www.espn.com/espn/rss/ncb/news')]
def fetch(url):
    req=urllib.request.Request(url,headers={'User-Agent':'SportingLifeTimes/1.0 (+sports newspaper; attributed links)'})
    with urllib.request.urlopen(req,timeout=18) as r:return r.read()
def clean(s):return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>','',s or ''))).strip()
def date(s):
    try:return email.utils.parsedate_to_datetime(s).astimezone(dt.timezone.utc).isoformat()
    except (ValueError,TypeError,AttributeError):return None

def parse_rss(payload,source):
    root=ET.fromstring(payload);items=[]
    for item in root.findall('.//item'):
        title=clean(item.findtext('title'));link=item.findtext('link','').strip();stamp=date(item.findtext('pubDate',''))
        if not title or not link.startswith('https://') or not stamp:continue
        media=item.find('{http://search.yahoo.com/mrss/}content')
        items.append({'title':title,'url':link,'source':source,'published_at':stamp,'summary':clean(item.findtext('description'))[:350],'category':'MBB','image_url':media.get('url') if media is not None else None})
    return items

def parse_scores(data):
    out=[]
    for event in data.get('events',[]):
        comp=(event.get('competitions') or [{}])[0];status=event.get('status',{}).get('type',{})
        competitors=sorted(comp.get('competitors',[]),key=lambda x:x.get('homeAway')=='home')
        out.append({'id':event['id'],'date':event.get('date'),'state':status.get('state'),'status':status.get('shortDetail'),'teams':[{'id':t.get('team',{}).get('id'),'name':t.get('team',{}).get('displayName'),'logo':t.get('team',{}).get('logo'),'score':t.get('score')} for t in competitors]})
    return out

def main():
    now=dt.datetime.now(dt.timezone.utc).isoformat();old=json.loads(OUT.read_text()) if OUT.exists() else {}
    out={**old,'attempted_at':now,'sources':[]}; articles=[]
    def collect(spec):
        name,url=spec
        try:
            rows=parse_rss(fetch(url),name)
            return rows,{'source':name,'url':url,'ok':bool(rows),'articles':len(rows)}
        except Exception as e:return [],{'source':name,'url':url,'ok':False,'error':type(e).__name__}
    with cf.ThreadPoolExecutor(max_workers=3) as pool:
        for rows,status in pool.map(collect,FEEDS):articles.extend(rows);out['sources'].append(status)
    if articles:
        unique={a['url']:a for a in old.get('articles',[])}
        for a in articles:unique[a['url']]=a
        out['articles']=sorted(unique.values(),key=lambda a:a.get('published_at',''),reverse=True)[:150]
        out['news_updated_at']=now
    day=dt.datetime.now(ZoneInfo('America/New_York')).strftime('%Y%m%d')
    score_url='https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=50&limit=1000&dates='+day
    try:
        result=json.loads(fetch(score_url));assert 'events' in result
        out['games']=parse_scores(result);out['scores_updated_at']=now
        out['sources'].append({'source':'ESPN scores','url':score_url,'ok':True})
    except Exception as e:out['sources'].append({'source':'ESPN scores','url':score_url,'ok':False,'error':type(e).__name__})
    # Completed regular-season games only; keyed storage makes repeated ingestion idempotent.
    statpath=ROOT/'data/mbb-current-player-stats.json'
    playerdata=json.loads(statpath.read_text()) if statpath.exists() else {'season':'2026-27','games':{},'players':[]}
    if dt.date(2026,11,1)<=dt.datetime.now().date()<=dt.date(2027,4,30):
        try:
            yesterday=(dt.datetime.now(ZoneInfo('America/New_York'))-dt.timedelta(days=1)).strftime('%Y%m%d')
            events=result.get('events',[]) if 'result' in locals() else []
            events+=json.loads(fetch(score_url.replace(day,yesterday))).get('events',[])
            cross=json.loads((ROOT/'data/ncaam-2026-27-espn-team-crosswalk.json').read_text())
            lookup={str(t['espn_id']):t['id'] for t in cross['teams'] if t.get('espn_id')}
            finals={e['id']:e for e in events if e.get('status',{}).get('type',{}).get('completed') and e.get('season',{}).get('year')==2027 and e.get('season',{}).get('type') in (2,3)}
            for event_id in list(finals)[:50]:
                box=json.loads(fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event='+event_id))
                rows=parse_boxscore(box,lookup)
                if rows:playerdata['games'][event_id]=rows
            playerdata['players']=aggregate(playerdata['games']);playerdata['as_of']=now
        except Exception as e:out['sources'].append({'source':'Player box scores','ok':False,'error':type(e).__name__})
    statpath.write_text(json.dumps(playerdata,separators=(',',':'))+'\n')
    # Team branding is refreshed weekly, independently of the news and scores.
    branding=ROOT/'data/mbb-branding.json'
    if not branding.exists() or dt.datetime.now().timestamp()-branding.stat().st_mtime>7*86400:
        try:
            result=json.loads(fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?limit=1000&groups=50'))
            rows=result['sports'][0]['leagues'][0]['teams']
            brands={x['team']['id']:{k:x['team'].get(k) for k in ('color','alternateColor','displayName','abbreviation')} for x in rows}
            if len(brands)>300:branding.write_text(json.dumps({'as_of':now,'teams':brands},separators=(',',':'))+'\n')
        except Exception:pass
    OUT.write_text(json.dumps(out,separators=(',',':'))+'\n')
    print(json.dumps({'news':len(out.get('articles',[])),'games':len(out.get('games',[])),'sources':out['sources']}))
if __name__=='__main__':main()
