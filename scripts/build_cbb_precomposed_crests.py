#!/usr/bin/env python3
"""Build one local, precomposed, two-ring crest per verified NCAA DI program.

The actual artwork comes from the approved local CBB heritage archive when
available, otherwise the exact identity-verified logo registry. No original
artwork is redrawn, no browser-side per-school sizing, and no runtime CDN.
Fails closed on missing logos, bad source identities, or poor ring geometry.
"""
from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from PIL import Image, ImageDraw, ImageChops, ImageStat
import json, re

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'assets/cbb-precomposed-crests'
REPORT=ROOT/'data/cbb-precomposed-crest-audit.json'
SIDE=512
VERS='20261115-precomposed1'
registry=json.loads((ROOT/'data/mbb-logo-registry.json').read_text())['teams']
colors=json.loads((ROOT/'data/dual-ring-team-palette.json').read_text())['mbb']
cross=json.loads((ROOT/'data/ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams']
javascript=(ROOT/'mbb-logo-system.js').read_text()
# Only exact ESPN-ID-to-local-asset associations in the six approved heritage maps.
heritage={}
for group in ('BIG_TEN_HERITAGE','ACC_HERITAGE','SEC_HERITAGE','BIG_EAST_HERITAGE','A10_HERITAGE','MOUNTAIN_WEST_HERITAGE'):
    match=re.search(r'const '+group+r'=Object\.freeze\(\{(.*?)\}\);',javascript,re.S)
    if not match:raise RuntimeError('Heritage group missing: '+group)
    for team_id,path in re.findall(r"'(\d+)'\s*:\s*'(assets/cbb-[^'?]+\.png)(?:\?[^']+)?'",match.group(1)):
        if team_id in heritage:raise RuntimeError('Duplicate identity '+team_id)
        heritage[team_id]=path
assert len(registry)==len(colors)==len(cross)==365
assert len(heritage)>=80
assert all(registry[str(t['espn_id'])]['canonical_id']==t['id'] for t in cross)

def foreground_bounds(im):
    alpha=im.getchannel('A')
    if alpha.getextrema()[0]<245:
        bbox=alpha.point(lambda n:255 if n>8 else 0).getbbox()
        if not bbox:raise ValueError('Transparent source has no visible artwork')
        return bbox,'alpha'
    # Opaque white paper in vintage sources is NOT a logo silhouette.
    # Use an extremely conservative near-white background test for centering.
    corners=[im.getpixel(pt)[:3] for pt in ((0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1))]
    if all(min(c)>230 and max(c)-min(c)<35 for c in corners):
        imrgb=im.convert('RGB')
        # Preserve light-colored lettering by retaining all non-paper ink.
        mask=imrgb.convert('L').point(lambda x:255 if x<228 else 0)
        bbox=mask.getbbox()
        if bbox and max(bbox[2]-bbox[0],bbox[3]-bbox[1])>=32:return bbox,'white-paper'
    return (0,0,im.width,im.height),'full-canvas'

def fetch_source(team_id,reg):
    if team_id in heritage:
        path=ROOT/heritage[team_id]
        if not path.is_file():raise ValueError('Missing original heritage asset '+str(path))
        return path.read_bytes(),'local-heritage',str(path.relative_to(ROOT))
    if reg.get('logo_url_verified') is not True or reg.get('provider_identity_status') not in ('provider_identity_matched','provider_identity_matched_alias'):
        raise ValueError('No independently identity-verified logo '+team_id)
    urls=[str(reg.get('official_logo_url') or reg.get('logo_url') or '')]
    urls.extend(str(x) for x in reg.get('provider_logo_candidates',[]) if x)
    seen=set();errors=[]
    for url in urls:
        if url in seen:continue
        seen.add(url)
        host=urlsplit(url).hostname or ''
        # The URL must be an exact member of the ID-certified registry, hosted
        # on the provider's approved CDN. Alternate GUIDs are not guessed.
        if host!='a.espncdn.com' or not url.startswith('https://'):
            continue
        try:
            request=Request(url,headers={'User-Agent':'SportingLifeTimes/1.0 (archived crest compiler)','Accept':'image/png'})
            with urlopen(request,timeout=25) as response:
                binary=response.read(5_000_001)
            if len(binary)>5_000_000 or len(binary)<250:raise ValueError('Invalid image length')
            with Image.open(BytesIO(binary)) as im:
                im.verify()
            with Image.open(BytesIO(binary)) as im:
                if im.width<110 or im.height<110 or im.width>8192 or im.height>8192:
                    errors.append('undersized '+str(im.size)+' '+url)
                    continue
            return binary,'verified-provider-source',url
        except Exception as exc:
            errors.append(type(exc).__name__+' '+str(exc)[:100])
    raise ValueError('No high-resolution verified source for '+team_id+'; '+str(errors[:4]))

def build(team_id):
    reg=registry[team_id]
    src,origin,provenance=fetch_source(team_id,reg)
    with Image.open(BytesIO(src)) as opened:
        opened.load()
        if opened.width<110 or opened.height<110 or opened.width>8192 or opened.height>8192:
            raise ValueError('Source unsuitable for quality enlargement: '+team_id)
        im=opened.convert('RGBA')
        if max(im.size)>1800:im.thumbnail((1800,1800),Image.Resampling.LANCZOS)
    bounds,method=foreground_bounds(im)
    margin=max(3,round(max(bounds[2]-bounds[0],bounds[3]-bounds[1])*.025))
    x0=max(0,bounds[0]-margin); y0=max(0,bounds[1]-margin)
    x1=min(im.width,bounds[2]+margin); y1=min(im.height,bounds[3]+margin)
    art=im.crop((x0,y0,x1,y1))
    if method=='white-paper':
        # Historical source images often have an opaque WHITE RECTANGLE.
        # Flood only near-white paper CONNECTED TO THE OUTER EDGE, not white
        # letters, eyes or internal artwork. Preserve all pigment pixels.
        for corner in ((0,0),(art.width-1,0),(0,art.height-1),(art.width-1,art.height-1)):
            pixel=art.getpixel(corner)
            if pixel[3]>240 and min(pixel[:3])>=231 and max(pixel[:3])-min(pixel[:3])<=26:
                ImageDraw.floodfill(art,corner,(255,255,255,0),thresh=14)
        if art.getpixel((0,0))[3]>32 and art.getpixel((art.width-1,art.height-1))[3]>32:
            raise ValueError('Unremoved rectangular paper background '+team_id)
    if min(art.size)<25:raise ValueError('Suspect clipped mascot '+team_id)
    # The source artwork is fitted entirely INSIDE the inner white opening;
    # so no mascot tail or head can touch or cross the baked-in ring.
    allowed=352
    factor=min(allowed/art.width,allowed/art.height)
    # A square-safe bbox is not circle-safe for diagonally extended mascots.
    # Fit the full alpha silhouette inside the circular opening, leaving
    # actual visible clearance before the second ring. Never clip ink.
    safe=Image.new('L',(SIDE,SIDE),0)
    ImageDraw.Draw(safe).ellipse((60,60,452,452),fill=255)
    for attempt in range(16):
        resized=art.resize((max(1,round(art.width*factor)),max(1,round(art.height*factor))),Image.Resampling.LANCZOS)
        ink=Image.new('RGBA',(SIDE,SIDE),(0,0,0,0))
        pos=((SIDE-resized.width)//2,(SIDE-resized.height)//2)
        ink.alpha_composite(resized,pos)
        alpha=ink.getchannel('A').point(lambda v:255 if v>8 else 0)
        if alpha.getbbox() and not ImageChops.subtract(alpha,safe).getbbox():
            break
        factor*=.94
    else:
        raise ValueError('Mascot silhouette cannot fit inside ring: '+team_id)
    bbox=alpha.getbbox()
    if not bbox or min(bbox[0],bbox[1],SIDE-bbox[2],SIDE-bbox[3])<55:
        raise ValueError('Logo outside safe inset: '+team_id)
    primary=colors[team_id]['primary'];secondary=colors[team_id]['secondary']
    def rgb(h):
        if not re.fullmatch('#[a-fA-F0-9]{6}',h):raise ValueError('Missing school color '+team_id)
        return tuple(bytes.fromhex(h[1:]))
    p,q=rgb(primary),rgb(secondary)
    if p==q:raise ValueError('Indistinct school colors '+team_id)
    canvas=Image.new('RGBA',(SIDE,SIDE),(0,0,0,0));d=ImageDraw.Draw(canvas)
    # Exactly TWO adjacent colored annuli; no white outline/third ring.
    d.ellipse((1,1,510,510),fill=p+(255,))
    d.ellipse((22,22,489,489),fill=q+(255,))
    d.ellipse((45,45,466,466),fill=(255,250,239,255))
    # Keep opaque or flat-source artwork fully intact within the 422px disk.
    canvas.alpha_composite(ink)
    path=OUT/(team_id+'.png');canvas.save(path,'PNG',optimize=True)
    verified=Image.open(path).convert('RGBA')
    if verified.size!=(512,512) or verified.getpixel((256,4))[:3]!=p or verified.getpixel((256,28))[:3]!=q:
        raise ValueError('Baked ring failed audit '+team_id)
    return {'id':team_id,'school':reg['school'],'heritage':origin=='local-heritage',
            'source':provenance,'bbox':list(bounds),'fit_method':method,
            'artwork_px':list(resized.size),'primary':primary,'secondary':secondary}

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    items={};errors=[]
    # Keep threads bounded to avoid overloading the verified source.
    with ThreadPoolExecutor(max_workers=10) as pool:
        jobs={pool.submit(build,id):id for id in sorted(registry,key=int)}
        for job in as_completed(jobs):
            id=jobs[job]
            try:items[id]=job.result()
            except Exception as e:errors.append(id+': '+str(e))
    if errors:
        raise SystemExit('CREST RELEASE BLOCKED; '+str(len(errors))+' failures:\n'+'\n'.join(sorted(errors)))
    if len(items)!=365:raise SystemExit('Incomplete local crest library')
    REPORT.write_text(json.dumps({'schema':'cbb-precomposed-two-ring-v1',
      'season':'2026-27','count':len(items),'vintage_count':sum(x['heritage'] for x in items.values()),
      'canvas':512,'rings':2,'original_artwork_unchanged':True,
      'crests':items},indent=2)+'\n')
    print('PASS: generated 365 self-hosted authentic-source 512px two-ring crests')
    print('Vintage crests:',sum(x['heritage'] for x in items.values()))
if __name__=='__main__':main()
