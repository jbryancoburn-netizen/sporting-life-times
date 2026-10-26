#!/usr/bin/env python3
"""Discover and archive official UCLA historical men's basketball season-results PDFs.
No API key, no bypasses, no generated scores. Respects HTTP errors and rate limits.
Download source PDFs only to workflow artifacts; publish metadata, not copyrighted PDFs.
"""
import argparse,hashlib,html.parser,json,re,time,urllib.parse,urllib.request
from pathlib import Path
INDEX="https://uclabruins.com/ucla-basketball-archives"
class Anchors(html.parser.HTMLParser):
 def __init__(self):
  super().__init__();self.links=[];self.href=None;self.label=[];self.current_season=None
 def handle_starttag(self,t,a):
  if t=="a":self.href=dict(a).get("href");self.label=[]
 def handle_data(self,s):
  if self.href is not None:self.label.append(s)
  else:
   m=re.search(r"(19\\d{2})\\s*[-–]\\s*(\\d{2})\\s+Season",s,re.I)
   if m:self.current_season=int(m.group(1))+1
 def handle_endtag(self,t):
  if t=="a" and self.href:
   self.links.append((self.href," ".join(" ".join(self.label).split()),self.current_season))
   self.href=None;self.label=[]
def get(url,limit=12_000_000):
 req=urllib.request.Request(url,headers={"User-Agent":"SLAT-Historical-Source-Audit/1.0 (public research; one request per season)"})
 with urllib.request.urlopen(req,timeout=40) as r:
  b=r.read(limit+1);content_type=r.headers.get("Content-Type","")
 if len(b)>limit:raise ValueError("Source exceeds safety size")
 return b,content_type
def discover(source):
 parser=Anchors();parser.feed(source.decode("utf-8","replace"))
 candidates=[]
 for href,label,season in parser.links:
  absolute=urllib.parse.urljoin(INDEX,href)
  if not absolute.startswith("https://"):continue
  # UCLA site often labels the PDF 'Results' within a season block.
  if season and 1950<=season<=1984 and ("results" in label.lower() or "statistics" in label.lower()):
   candidates.append({"url":absolute,"label":label,"season":season})
 return candidates
def main():
 p=argparse.ArgumentParser();p.add_argument("--out",type=Path,default=Path("data/ncaam-ucla-official-archive-manifest.json"))
 p.add_argument("--download-dir",type=Path,default=Path("historical-normalized/ucla-pdf"));p.add_argument("--max-downloads",type=int,default=12);a=p.parse_args()
 a.download_dir.mkdir(parents=True,exist_ok=True)
 page,_=get(INDEX);links=discover(page)
 manifest={"source":INDEX,"source_sha256":hashlib.sha256(page).hexdigest(),"candidate_links":len(links),"files":[],"status":"ARCHIVE_DISCOVERY_ONLY_NO_GAMES_CERTIFIED","no_scores_imputed":True}
 for i,row in enumerate(sorted(links,key=lambda x:x["season"])[:a.max_downloads]):
  url=row["url"];entry={"url":url,"label":row["label"],"season":row["season"]}
  try:
   data,ctype=get(url)
   if not (data.startswith(b"%PDF-") or "pdf" in ctype.lower()):
    raise ValueError("Not a PDF document")
   digest=hashlib.sha256(data).hexdigest()
   dest=a.download_dir/(digest[:16]+".pdf");dest.write_bytes(data)
   entry.update({"sha256":digest,"bytes":len(data),"local_file":str(dest),"file_verified_pdf_header":data.startswith(b"%PDF-")})
  except Exception as exc:entry["error"]=str(exc)[:200]
  manifest["files"].append(entry)
  time.sleep(1)
 manifest["successful_pdf_downloads"]=sum("sha256" in x for x in manifest["files"])
 a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(manifest,indent=2)+"\n")
 print(json.dumps({"candidates":len(links),"pdf_downloads":manifest["successful_pdf_downloads"]},indent=2))
 if manifest["successful_pdf_downloads"]==0:raise ValueError("Official UCLA source returned no usable historical result PDFs; inspect manifest and do not claim acquisition")
if __name__=="__main__":main()
