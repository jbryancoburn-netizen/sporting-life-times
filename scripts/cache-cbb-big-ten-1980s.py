#!/usr/bin/env python3
"""Locally cache independently dated 1980s Big Ten school marks.

No browser-side downloads or guessed 1980s logos. SportsLogoHistory.com
provides a source timeline and 250px transparent PNG reproductions. If a
school cannot be independently validated, fail closed and leave the published
modern local mark alone.
"""
import concurrent.futures,io,json,pathlib,re,requests
from bs4 import BeautifulSoup
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/"assets/cbb-big-ten-1980s"
OUT.mkdir(parents=True,exist_ok=True)
MEMBERS={
 "84":("Indiana","indiana-hoosiers",1979,1997),
 "356":("Illinois","illinois-fighting-illini",1981,1995),
 "2294":("Iowa","iowa-hawkeyes",1979,9999),
 "130":("Michigan","michigan-wolverines",1901,1994),
 "127":("Michigan State","michigan-state-spartans",1977,2010),
 "135":("Minnesota","minnesota-golden-gophers",1986,9999),
 "77":("Northwestern","northwestern-wildcats",1981,2011),
 "194":("Ohio State","ohio-state-buckeyes",1968,1987),
 "2509":("Purdue","purdue-boilermakers",1980,1994),
 "275":("Wisconsin","wisconsin-badgers",1970,1991)
}
def download(url):
 r=requests.get(url,headers={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/132.0.0.0 Safari/537.36","Accept-Language":"en-US,en;q=0.9"},timeout=28);r.raise_for_status();return r

def get_school(row):
 id,(name,slug,start,end)=row
 url="https://sportslogohistory.com/"+slug+"-primary-logo/"
 resp=download(url); soup=BeautifulSoup(resp.text,"html.parser")
 plain=soup.get_text(" ",strip=True)
 periods=re.findall(r"(\d{4})\s*[-–]\s*(\d{4}|Present)",plain,re.I)
 matches=[(int(a),9999 if b.lower()=="present" else int(b)) for a,b in periods if int(a)==start]
 if (start,end) not in matches and not (end==9999 and any(a==start and b==9999 for a,b in matches)):
  raise ValueError(f"School source lacks independently dated {start}-{end} primary mark; periods {periods[:20]}")
 images=[]
 if id=="84":print("RAW_IMAGE_ELEMENTS",json.dumps([str(x)[:1100] for x in soup.find_all("img") if "1979" in str(x.get("alt",""))][:3]),flush=True)
 for img in soup.find_all("img"):
  src=img.get("data-src") or img.get("src") or ""
  src=requests.compat.urljoin(url,src)
  if not re.match(r"https://(?:www\.)?sportslogohistory\.com/wp-content/uploads/.+\.(?:png|jpg|jpeg|webp)",src,re.I):continue
  alt=img.get("alt","")
  near=[]
  for sib in (img.find_previous(string=re.compile(r"\d{4}\s*[-–]\s*(?:\d{4}|Present)",re.I)),img.find_next(string=re.compile(r"\d{4}\s*[-–]\s*(?:\d{4}|Present)",re.I))):
   near.append(str(sib or "").strip()[:100])
  score=(100 if re.search(r"(?<!\d)"+str(start)+r"(?!\d)",src) else 0)+(60 if str(start) in alt else 0)+(15 if str(start) in " ".join(near) else 0)
  images.append((score,src,alt,near))
 images.sort(reverse=True)
 print("SOURCE_CANDIDATES",name,"era",start,end,"found",len(images),json.dumps(images[:10]),flush=True)
 if not images:raise ValueError("No accessible logo source images found")
 candidates=[x for x in images if x[0]>=60]
 if not candidates:raise ValueError("No image explicitly tied to the historically verified start year")
 for score,src,alt,near in candidates:
  try:
   image=Image.open(io.BytesIO(download(src).content));image.load()
   if min(image.size)<180:continue
   image=image.convert("RGBA");box=image.getchannel("A").point(lambda a:255 if a>10 else 0).getbbox()
   if not box:continue
   image=image.crop(box); side=max(image.size);pad=round(side*.06)
   out=Image.new("RGBA",(side+2*pad,side+2*pad),(0,0,0,0))
   out.alpha_composite(image,((out.width-image.width)//2,(out.height-image.height)//2))
   dest=OUT/(id+".png");out.save(dest,format="PNG",optimize=True)
   if dest.stat().st_size<1400:continue
   return id,{"school":name,"espn_id":id,"era":f"{start}–{end if end!=9999 else 'present'}","logo_path":str(dest.relative_to(ROOT)),"source_url":url,"image_source_url":src,"bytes":dest.stat().st_size},None
  except Exception as e:print("CANDIDATE_FAIL",name,str(e)[:250],flush=True)
 return id,None,"No verifiable, large authentic logo image"

ok={};bad={}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
 futures=[pool.submit(get_school,item) for item in MEMBERS.items()]
 for fut in concurrent.futures.as_completed(futures):
  try:
   id,data,error=fut.result()
   if data:ok[id]=data;print("PASS",id,data["school"],data["era"],data["bytes"],flush=True)
   else:bad[id]=error;print("MISSING",id,error,flush=True)
  except Exception as e:print("ARCHIVE_ERROR",type(e).__name__,str(e)[:350],flush=True)
result={"schema":"cbb-big-ten-1980s/v1","historical_reference_year":1985,"original_1980s_members":10,
"confirmed":len(ok),"teams":ok,"unresolved":bad,"credit":"Historic logo dating and reproduction: SportsLogoHistory.com. Marks remain their universities' property."}
(ROOT/"data/cbb-big-ten-1980s.json").write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n")
print("SUMMARY",json.dumps({"confirmed":len(ok),"unresolved":bad}),flush=True)
if len(ok)!=10:raise SystemExit("FAIL CLOSED: not all 10 1980s Big Ten logos independently verified and cached")
print("PASS: ten authenticated Big Ten marks self-hosted as historical PNGs.")
