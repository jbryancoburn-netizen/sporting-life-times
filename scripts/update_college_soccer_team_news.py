#!/usr/bin/env python3
"""Fetch public NCAA soccer headlines; publish only explicit, matched program stories.
Uses Google News RSS search as a discovery index. Links remain with the publishers.
A failed scan does not erase previously saved headlines.
"""
import datetime as dt
import email.utils
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from html import unescape
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
RANK=ROOT/'data/college-soccer-elo.json'
OUT=ROOT/'data/college-soccer-team-news.json'
QUERIES=[
 '"NCAA" "men\'s soccer"',
 '"NCAA" "women\'s soccer"',
 '"Division II" "men\'s soccer"',
 '"Division II" "women\'s soccer"',
 '"Division III" "men\'s soccer"',
 '"Division III" "women\'s soccer"',
 '"college soccer" "men"',
 '"college soccer" "women"',
]
def clean(s):
 return re.sub(r'<[^>]*>',' ',unescape(s or '')).strip()
def when(value):
 try:
  d=email.utils.parsedate_to_datetime(value)
  return d.astimezone(dt.timezone.utc).isoformat()
 except (ValueError,TypeError): return None
def words_match(hay,needle):
 return bool(re.search(r'(?<![a-z0-9])'+re.escape(needle.lower())+r'(?![a-z0-9])',hay))
def main():
 now=dt.datetime.now(dt.timezone.utc)
 teams=[]
 for cohort,rows in json.loads(RANK.read_text())['cohorts'].items():
  for row in rows:
   name=row['team'].strip()
   if len(name)<5: continue
   teams.append((cohort+':'+row['team_id'],name,cohort.split('-')[0]))
 old={}
 if OUT.exists():
  try:
   old={a['url']:a for a in json.loads(OUT.read_text()).get('articles',[]) if a.get('url')}
  except (ValueError,KeyError): pass
 selected={}
 failures=[]
 for q in QUERIES:
  feed='https://news.google.com/rss/search?'+urllib.parse.urlencode({'q':q+' when:7d','hl':'en-US','gl':'US','ceid':'US:en'})
  try:
   req=urllib.request.Request(feed,headers={'User-Agent':'Mozilla/5.0 (compatible; SportingLifeTimesNewsBot/1.0)'})
   with urllib.request.urlopen(req,timeout=22) as resp: root=ET.fromstring(resp.read(1200000))
  except Exception as e:
   failures.append(q+': '+type(e).__name__)
   continue
  for item in root.findall('.//item'):
   title=clean(item.findtext('title'))
   summary=clean(item.findtext('description'))
   link=(item.findtext('link') or '').strip()
   published=when(item.findtext('pubDate'))
   source=clean(item.findtext('source')) or 'News publisher'
   if not (title and link and link.startswith('https://') and published):continue
   if dt.datetime.fromisoformat(published)<now-dt.timedelta(days=7):continue
   hay=(title+' '+summary).lower()
   if not any(w in hay for w in ('soccer','football program','soccer team')):continue
   # Gender is assigned only if stated explicitly: avoid cross-posting a men's story to women's pages.
   women=bool(re.search(r"women(?:'s|s)?|female|ladies",hay))
   men=bool(re.search(r"\bmen(?:'s|s)?\b|male",hay))
   if women==men:continue
   gender='women' if women else 'men'
   keys=sorted({k for k,name,g in teams if g==gender and words_match(hay,name)})
   if not keys:continue
   a={'title':title,'url':link,'source':source,'published_at':published,'summary':'','team_keys':keys}
   if link in selected:selected[link]['team_keys']=sorted(set(selected[link]['team_keys'])|set(keys))
   else:selected[link]=a
 # Preserve only recently published old entries after successful or failed scans.
 for link,article in old.items():
  try: recent=dt.datetime.fromisoformat(article['published_at'].replace('Z','+00:00'))>now-dt.timedelta(days=7)
  except (KeyError,ValueError):recent=False
  if recent and link not in selected:selected[link]=article
 articles=sorted(selected.values(),key=lambda a:a['published_at'],reverse=True)[:700]
 payload={'schema_version':1,'updated_at':now.isoformat(),'source':'Google News RSS search discovery; original publisher links','queries_attempted':len(QUERIES),'queries_failed':len(failures),'articles':articles,'notice':'Only articles explicitly identifying a soccer program and gender are assigned; unmatched programs show no stories. Feed discovery is not exhaustive.'}
 OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
 print('stories',len(articles),'queries failed',len(failures))
 if len(failures)==len(QUERIES):raise RuntimeError('All news queries failed; kept old stories')
if __name__=='__main__': main()
