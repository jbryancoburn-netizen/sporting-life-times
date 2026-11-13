#!/usr/bin/env python3
"""Source-authenticated 1980s Big Ten sports marks.

The only period marked on the site is the actual design's documented era.
The ten institutions were 1980s Big Ten members; later joiners are NOT
misrepresented as 1980s conference members. Cache all image files in repo.
"""
import concurrent.futures,io,json,pathlib,re,requests
from bs4 import BeautifulSoup
from PIL import Image

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/"assets/cbb-big-ten-1980s";OUT.mkdir(parents=True,exist_ok=True)
MEMBERS={
 "84":("Indiana",709,"Indiana-Hoosiers"),
 "356":("Illinois",706,"Illinois-Fighting-Illini"),
 "2294":("Iowa",712,"Iowa-Hawkeyes"),
 "130":("Michigan",750,"Michigan-Wolverines"),
 "127":("Michigan State",751,"Michigan-State-Spartans"),
 "135":("Minnesota",753,"Minnesota-Golden-Gophers"),
 "77":("Northwestern",787,"Northwestern-Wildcats"),
 "194":("Ohio State",791,"Ohio-State-Buckeyes"),
 "2509":("Purdue",809,"Purdue-Boilermakers"),
 "275":("Wisconsin",914,"Wisconsin-Badgers"),
}
TARGET=1985
session=requests.Session()
session.headers.update({"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/132.0.0.0 Safari/537.36","Accept-Language":"en-US,en;q=0.9"})
def get(url):
 r=session.get(url,timeout=22);r.raise_for_status();return r
def find_one(pair):
 id,(school,slug,name)=pair
 listing=f"https://www.sportslogos.net/logos/list_by_team/{slug}/{name}-Logos/"
 page=get(listing).text
 soup=BeautifulSoup(page,"html.parser")
 links=[]
 for a in soup.select("a[href]"):
  href=a.get("href","")
  if not re.search(r"/logos/view/[^\s\"<>]+/\d{4}/Primary-Logo",href,re.I):continue
  match=re.search(r"/(\d{4})/Primary-Logo",href,re.I)
  if not match:continue
  start=int(match.group(1))
  if start>TARGET:continue
  link=requests.compat.urljoin(listing,href)
  if link not in [x[1] for x in links]:links.append((start,link))
 links.sort(key=lambda x:x[0],reverse=True)
 print("SOURCE",school,"primary page candidates",links[:6],flush=True)
 if not links:raise ValueError("No archival primary logo page with 1980s origin")
 last=""
 for year,url in links:
  try:
   item=get(url).text
   title=BeautifulSoup(item,"html.parser").get_text(" ",strip=True)
   periods=re.findall(r"Primary Logo\s*\(\s*(\d{4})\s*[-–]\s*(\d{4}|Pres)\s*\)",title,re.I)
   if not periods:
    periods=re.findall(r"(\d{4})\s*[-–]\s*(\d{4}|Pres)\s*Primary Logo",title,re.I)
   era=next(((int(a),9999 if b.lower()=="pres" else int(b)) for a,b in periods if int(a)<=TARGET<=(9999 if b.lower()=="pres" else int(b))),None)
   if not era:
    last=f"Archive page does not prove a 1985 logo: {url} periods={periods[:3]}";continue
   parsed=BeautifulSoup(item,"html.parser")
   img_urls=[]
   for element in [*parsed.select('img[src]'),*parsed.select('meta[property="og:image"][content]')]:
    source=element.get("src") or element.get("content") or ""
    source=requests.compat.urljoin(url,source)
    if "content.sportslogos.net/logos/" in source and source not in img_urls:img_urls.append(source)
   # Archive art often also comes from sportslogos' cdn.
   for found in re.findall(r"https?://(?:content\.|cdn\.)?sportslogos\.net/logos/[^\"'<>\s]+?\.(?:png|gif|webp|jpg)",item,re.I):
    if found not in img_urls:img_urls.append(found)
   print("IMAGE",school,len(img_urls),img_urls[:3],flush=True)
   for src in img_urls:
    try:
     resp=get(src);blob=resp.content
     img=Image.open(io.BytesIO(blob));img.load()
     if min(img.size)<150:continue
     img=img.convert("RGBA");bbox=img.getchannel("A").point(lambda n:255 if n>10 else 0).getbbox()
     if not bbox:continue
     img=img.crop(bbox)
     factor=min(1,800/max(img.size))
     if factor<1:img=img.resize((round(img.width*factor),round(img.height*factor)),Image.Resampling.LANCZOS)
     side=max(img.size);padding=round(side*.06)
     out=Image.new("RGBA",(side+2*padding,side+2*padding),(255,255,255,0))
     out.alpha_composite(img,((out.width-img.width)//2,(out.height-img.height)//2))
     file=OUT/(id+".png");out.save(file,optimize=True)
     if file.stat().st_size<1600:continue
     return id,{"school":school,"espn_id":id,"era":str(era[0])+"–"+("present" if era[1]==9999 else str(era[1])),"league_in_1980s":"Big Ten","logo_path":str(file.relative_to(ROOT)),"origin_page":url,"original_image_source":src,"bytes":file.stat().st_size},None
    except Exception as e:
     last=f"image {src}: {type(e).__name__} {e}"
  except Exception as e:
   last=f"page {url}: {type(e).__name__} {e}"
 return id,None,last or "No verified source"

ok={};bad={}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
 for fut in concurrent.futures.as_completed([pool.submit(find_one,x) for x in MEMBERS.items()]):
  try:id,entry,error=fut.result()
  except Exception as e:print("THREAD",e,flush=True);continue
  if entry:ok[id]=entry;print("PASS",id,entry["school"],entry["era"],entry["bytes"],flush=True)
  else:bad[id]=error;print("MISSING",id,error,flush=True)
audit={"schema":"cbb-big-ten-1980s/v1","historical_reference_year":TARGET,"original_1980s_members":10,"confirmed":len(ok),"teams":ok,"unresolved":bad,
"credit":"Historical logo dating research: Chris Creamer’s SportsLogos.Net; trademarks and marks belong to their institutions. Original era verified before caching."}
(ROOT/"data/cbb-big-ten-1980s.json").write_text(json.dumps(audit,indent=2,ensure_ascii=False)+"\n")
print("SUMMARY",json.dumps({"confirmed":len(ok),"unresolved":bad}),flush=True)
if len(ok)!=len(MEMBERS):raise SystemExit("FAIL CLOSED: not all 10 authentic historical Big Ten marks independently verified")
print("PASS: ten authentic 1980s Big Ten logos stored as real local PNGs.")
