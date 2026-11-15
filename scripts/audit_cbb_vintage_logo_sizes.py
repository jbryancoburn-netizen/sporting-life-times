#!/usr/bin/env python3
"""Audit and gently normalize undersized *existing local* college basketball marks.

This script does not download or invent logos. It preserves each school's
authentic artwork and moves only unused transparent canvas into ring-safe space.
Opaque artwork, connected background, ambiguous boundaries, and already-large
marks are reported but never changed.
"""
from pathlib import Path
from io import BytesIO
import json,re
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
RENDER=ROOT/'mbb-logo-system.js'
REPORT=ROOT/'data/cbb-local-logo-sizing-audit.json'
FOLDERS=('cbb-big-ten-1980s','cbb-acc-1980s','cbb-sec-1980s',
 'cbb-big-east-1980s','cbb-atlantic-10-1980s','cbb-mountain-west-1980s')
PATTERN=r"'(\d+)':'(assets/(?:cbb-[a-z0-9-]+)/(?:[a-z0-9-]+/)*[a-z0-9-]+\.png)\?v=[^']+'"
VERSION='ring-safe-sizing-20261115-1'
def analyze(path):
 im=Image.open(path).convert('RGBA')
 w,h=im.size
 alpha=im.getchannel('A')
 bbox=alpha.point(lambda n:255 if n>=32 else 0).getbbox()
 if not bbox:return im,None,'empty_image'
 width=bbox[2]-bbox[0];height=bbox[3]-bbox[1]
 occupancy=max(width/w,height/h)
 if min(w,h)<120:return im,occupancy,'image_too_small'
 if im.getpixel((0,0))[3]>20 or im.getpixel((w-1,h-1))[3]>20:
  return im,occupancy,'opaque_edges_manual_review'
 if occupancy>=0.76:return im,occupancy,'already_ring_safe'
 # Extremely small content can indicate bad source art; flag it for manual review.
 if occupancy<0.14:return im,occupancy,'suspiciously_small_manual_review'
 cropped=im.crop(bbox)
 # Fit to a central safe area, preserving original proportions and no stretching.
 max_side=round(min(w,h)*0.84)
 cropped.thumbnail((max_side,max_side),Image.Resampling.LANCZOS)
 out=Image.new('RGBA',(w,h),(0,0,0,0))
 out.alpha_composite(cropped,((w-cropped.width)//2,(h-cropped.height)//2))
 return out,occupancy,'normalized'
def main():
 renderer=RENDER.read_text()
 mapped={}
 for eid,path in re.findall(PATTERN,renderer):
  if path.split('/')[1] in FOLDERS:mapped[path]=eid
 records=[];updated={}
 for name,eid in sorted(mapped.items()):
  p=ROOT/name
  if not p.is_file():
   records.append(dict(team_id=eid,path=name,status='missing_png'))
   continue
  try:
   image,ratio,status=analyze(p)
   if status=='normalized':
    buf=BytesIO();image.save(buf,'PNG',optimize=True)
    with Image.open(BytesIO(buf.getvalue())) as check:check.verify()
    updated[name]=buf.getvalue()
   records.append(dict(team_id=eid,path=name,status=status,original_occupancy=round(ratio,3) if ratio is not None else None))
  except Exception as ex:
   records.append(dict(team_id=eid,path=name,status='error_manual_review',error=str(ex)[:150]))
 # All image processing and asset writes happen before the renderer changes.
 for path,blob in updated.items():(ROOT/path).write_bytes(blob)
 for path in updated:
  # Bump exactly the altered vintage asset URL, never touch other logos.
  renderer=re.sub(r"('"+re.escape(path)+r"\?v=)[^']+",lambda m:m.group(1)+VERSION,renderer)
 if updated:RENDER.write_text(renderer)
 counts={key:sum(row['status']==key for row in records)
         for key in sorted(set(row['status'] for row in records))}
 doc=dict(scope='all local mapped vintage college basketball logos',
  method='transparent-foreground-bound conservative crop; 84% ring safe size',
  total_mapped=len(records),recentered=len(updated),counts=counts,
  records=records)
 REPORT.parent.mkdir(parents=True,exist_ok=True)
 REPORT.write_text(json.dumps(doc,indent=2)+'\n')
 for row in records:
  if row['status'] in ('missing_png','error_manual_review'):print('REVIEW',row)
 print('Audited',len(records),'vintage marks; normalized',len(updated),'transparent-padding images')
if __name__=='__main__':main()
