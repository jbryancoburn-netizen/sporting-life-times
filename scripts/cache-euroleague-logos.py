#!/usr/bin/env python3
"""Cache actual 2026-27 club logos from the public official EuroLeague brand pack."""
from pathlib import Path
import sys, io, json, hashlib, urllib.request
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"assets/euroleague-logos"
SOURCE="https://hub.euroleague.tech/en/app/17/files/file/publicsharedownload/35857?token=3a3fbbf414232e31c4fa6abb91182b46be7de45516fb62f11754cc9570254a10c0346f8ff8e0683e9109170dfc8566b45a800651d8d1d44e35660b5287265dd2"
# Page indices verified visually against the official EuroLeague 2026-27 30-page guide.
PAGES={"IST":2,"BES":3,"RED":4,"DUB":5,"MIL":7,"BAR":9,"MUN":11,"ULK":12,
 "HTA":13,"BAS":15,"ASV":16,"TEL":18,"OLY":20,"PAN":22,"PRS":24,
 "PAR":25,"MAD":26,"PAM":27,"VIR":28,"ZAL":29}
def audit():
 from PIL import Image,ImageChops
 assert len(PAGES)==20
 for code in PAGES:
  file=OUT/(code+".png")
  assert file.is_file() and file.stat().st_size>1300, "Missing official EuroLeague crest: "+code
  with Image.open(file) as pic:
   pic.load()
   assert pic.size==(256,256)
   d=ImageChops.difference(pic.convert("RGB"),Image.new("RGB",(256,256),"white"))
   box=d.getbbox()
   assert box and box[2]-box[0]>30 and box[3]-box[1]>30, "Blank logo "+code
 print("Verified all 20 official EuroLeague crest PNGs")
def build():
 import fitz
 from PIL import Image,ImageChops
 req=urllib.request.Request(SOURCE,headers={"User-Agent":"Mozilla/5.0","Accept":"application/pdf,*/*"})
 with urllib.request.urlopen(req,timeout=80) as rs:raw=rs.read(40_000_000)
 assert raw.startswith(b"%PDF") and len(raw)>50000,"Invalid EuroLeague 2026-27 official PDF"
 pdf=fitz.open(stream=raw,filetype="pdf")
 assert pdf.page_count>=30, "Official logo guide structure changed"
 OUT.mkdir(parents=True,exist_ok=True)
 for code,pageno in PAGES.items():
  pix=pdf[pageno].get_pixmap(matrix=fitz.Matrix(2,2),alpha=False)
  rgb=Image.frombytes("RGB",(pix.width,pix.height),pix.samples)
  diff=ImageChops.difference(rgb,Image.new("RGB",rgb.size,"white")).convert("L")
  bb=diff.point(lambda x:255 if x>32 else 0).getbbox()
  assert bb is not None,"Missing logo artwork for "+code
  cropped=rgb.crop(bb)
  assert min(cropped.size)>35,"Bad crest dimensions for "+code
  cropped.thumbnail((218,218),Image.Resampling.LANCZOS)
  out=Image.new("RGB",(256,256),"white")
  out.paste(cropped,((256-cropped.width)//2,(256-cropped.height)//2))
  out.save(OUT/(code+".png"),"PNG",optimize=True)
 manifest={"season":"2026-27","source":"2026-27 official EuroLeague club logo pack",
 "source_page":"https://brandcenter.euroleague.net/en/?section=Teams-Assets",
 "pdf_sha256":hashlib.sha256(raw).hexdigest(),"clubs":{c:"assets/euroleague-logos/"+c+".png" for c in PAGES}}
 (OUT/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
 audit()
if __name__=="__main__":
 if "--check" in sys.argv:audit()
 elif "--if-missing" in sys.argv and all((OUT/(c+".png")).exists() for c in PAGES):audit()
 else:build()
