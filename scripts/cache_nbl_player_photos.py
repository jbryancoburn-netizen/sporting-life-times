#!/usr/bin/env python3
import json,re,urllib.request,urllib.parse,concurrent.futures,datetime
from pathlib import Path
from bs4 import BeautifulSoup
import cv2,numpy as np
FACE=cv2.CascadeClassifier(cv2.data.haarcascades+'haarcascade_frontalface_default.xml')
R=Path(__file__).resolve().parents[1]
D=R/'assets/nbl-player-photos'
D.mkdir(parents=True,exist_ok=True)
box=json.loads((R/'data/nbl-player-boxscores.json').read_text())
people={str(a['id']):a['name'] for g in box['games'] for t in g['teams'] for a in t['players'] if a.get('id')}
def norm(s):return re.sub('[^a-z0-9]','',s.lower())
def get(u):
 req=urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'})
 with urllib.request.urlopen(req,timeout=18) as r:return r.read(),r.headers.get('Content-Type','')
page,_=get('https://www.nbl.com.au/players')
soup=BeautifulSoup(page,'html.parser')
links={}
for a in soup.select('a[href*="/players/"]'):
 u=urllib.parse.urljoin('https://www.nbl.com.au',a.get('href',''))
 m=re.search(r'/players/([^/?]+)',u)
 if m:
  slug=re.sub(r'-[0-9a-f]{8}-[0-9a-f-]{27,}$','',m.group(1))
  links[norm(slug)]=u
print('NBL profiles indexed:',len(links),flush=True)
# Include official sitemap profile links where exposed.
try:
 sitemap,_=get('https://www.nbl.com.au/sitemap.xml')
 for u in re.findall(r'https?://[^<\\s]+/players/[^<\\s]+',sitemap.decode('utf-8','replace')):
  m=re.search(r'/players/([^/?]+)',u)
  if m:
   slug=re.sub(r'-[0-9a-f]{8}-[0-9a-f-]{27,}$','',m.group(1))
   links[norm(slug)]=u
 print('Sitemap profiles indexed:',len(links),flush=True)
except Exception as e:
 print('Sitemap unavailable:',str(e)[:90],flush=True)
def work(item):
 pid,name=item
 u=links.get(norm(name))
 if not u:return pid,None
 try:
  raw,_=get(u)
  doc=BeautifulSoup(raw,'html.parser')
  headings=[h for h in doc.find_all(['h1','h2']) if norm(h.get_text(' ',strip=True))==norm(name)]
  candidates=[h.find_next('img') for h in headings]
  candidates += [im for im in doc.find_all('img') if norm(name) in norm(im.get('alt',''))]
  for im in candidates:
   if im is None:continue
   src=im.get('src','') or im.get('data-src','')
   if not src.startswith('https://cdn.prod.website-files.com/'):continue
   data,ct=get(src.split('?')[0])
   if not ct.startswith('image/') or len(data)<4000:continue
   image=cv2.imdecode(np.frombuffer(data,np.uint8),cv2.IMREAD_COLOR)
   if image is None:continue
   gray=cv2.cvtColor(image,cv2.COLOR_BGR2GRAY)
   if len(FACE.detectMultiScale(gray,scaleFactor=1.08,minNeighbors=4,minSize=(32,32)))<1:continue
   ext='.webp' if 'webp' in ct else '.png' if 'png' in ct else '.jpg'
   out=D/(pid+ext)
   out.write_bytes(data)
   return pid,{'name':name,'path':'assets/nbl-player-photos/'+out.name,'profile':u}
 except Exception as e:print(name,str(e)[:70],flush=True)
 return pid,None
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
 result=dict(pool.map(work,people.items()))
found={k:v for k,v in result.items() if v}
(D/'manifest.json').write_text(json.dumps({'updated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'players':found,'matched':len(found),'total':len(people),'face_verified':True},indent=2)+'\n')
print('FACE-VERIFIED PLAYER PHOTOS',len(found),'/',len(people),flush=True)

# Faces required; logos never qualify.

# OpenCV 4 face detection pinned in workflow.
