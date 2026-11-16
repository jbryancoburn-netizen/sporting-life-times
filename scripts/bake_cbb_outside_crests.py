#!/usr/bin/env python3
"""Incrementally bake VERIFIED outside-Division-I team identities into local crests.

Only registry-backed exact identities are eligible. Failures stay as audited
unbaked entries rather than receiving invented monograms or fuzzy school logos.
The shared browser renderer only switches to files in the generated manifest.
"""
from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from PIL import Image, ImageDraw, ImageOps
from hashlib import sha256
import json, re, os, time

ROOT=Path(__file__).resolve().parents[1]
CATALOG=ROOT/'data/mbb-out-of-division-opponent-logos.json'
MANIFEST=ROOT/'data/cbb-outside-local-crest-manifest.json'
OUT=ROOT/'assets/cbb-outside-crests'
OUT.mkdir(parents=True,exist_ok=True)
registry=json.loads(CATALOG.read_text())['teams']
prior=json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {'teams':{}}
existing=prior.get('teams',{})
MAX=int(os.environ.get('CREST_BATCH','140'))
workers=min(10,max(1,int(os.environ.get('CREST_WORKERS','8'))))
def valid_hex(x):return bool(re.fullmatch(r'#[0-9A-Fa-f]{6}',str(x or '')))
def source_bytes(entry):
    urls=[entry.get('logo_url'),entry.get('logo_alternate_url')]
    failures=[]
    for url in filter(None,urls):
        if not str(url).startswith('https://'):continue
        host=urlparse(url).hostname or ''
        if not host or host in ('localhost','127.0.0.1'):continue
        try:
            req=Request(url,headers={'User-Agent':'SportingLifeTimes-CrestArchive/1.0','Accept':'image/png,image/jpeg,image/webp,image/svg+xml'})
            with urlopen(req,timeout=13) as response:
                if response.url and urlparse(response.url).scheme!='https':raise ValueError('insecure redirect')
                raw=response.read(5_000_001)
            if len(raw)<300 or len(raw)>5_000_000:raise ValueError('invalid size')
            if raw.lstrip().startswith(b'<') and b'<svg' in raw[:2000]:
                import cairosvg
                raw=cairosvg.svg2png(bytestring=raw,output_width=600,output_height=600)
            with Image.open(BytesIO(raw)) as im:
                im.verify()
            with Image.open(BytesIO(raw)) as im:
                if min(im.size)<65 or max(im.size)>5000:raise ValueError('low resolution or excessive dimensions')
                return im.convert('RGBA'),url
        except Exception as exc:failures.append(f'{host}: {type(exc).__name__}')
    raise ValueError(', '.join(failures[:2]) or 'no valid image source')
def bake(team_id,entry):
    # Identity match must have been explicitly reviewed/recorded in the registry.
    if not entry.get('identity_verification'):raise ValueError('identity not verified')
    name=entry.get('school') or entry.get('corrected_name')
    if not name or not entry.get('logo_url'):raise ValueError('missing identity or logo')
    primary=entry.get('primary');secondary=entry.get('secondary')
    if not valid_hex(primary) or not valid_hex(secondary) or primary.lower()==secondary.lower():
        primary,secondary='#385866','#a58d67'
    im,url=source_bytes(entry)
    # Only trim transparent source padding. No recoloring of institutional art.
    alpha=im.getchannel('A')
    bbox=alpha.point(lambda a:255 if a>10 else 0).getbbox()
    if not bbox:raise ValueError('empty art')
    if bbox!=(0,0,*im.size):im=im.crop(bbox)
    art=ImageOps.contain(im,(272,272),Image.Resampling.LANCZOS)
    canvas=Image.new('RGBA',(384,384),(0,0,0,0));d=ImageDraw.Draw(canvas)
    d.ellipse((1,1,382,382),fill=primary)
    d.ellipse((15,15,368,368),fill=secondary)
    d.ellipse((32,32,351,351),fill='#fff8ed')
    px=(384-art.width)//2;py=(384-art.height)//2
    canvas.alpha_composite(art,(px,py))
    # Safe circular aperture: if visible art crosses inner opening, reject.
    import PIL.ImageChops
    mask=Image.new('L',(384,384),0);ImageDraw.Draw(mask).ellipse((36,36,347,347),fill=255)
    ink=Image.new('L',(384,384),0);ink.paste(art.getchannel('A'),(px,py))
    if PIL.ImageChops.subtract(ink,mask).getbbox():raise ValueError('artwork reaches crest rings')
    out=OUT/(team_id+'.png')
    canvas.save(out,'PNG',optimize=True)
    return {'path':out.relative_to(ROOT).as_posix(),'school':name,'source':url,
            'sha256':sha256(out.read_bytes()).hexdigest(),'source_verified':entry.get('identity_verification')}
def main():
    remaining=[(str(i),v) for i,v in registry.items()
      if not (str(i) in existing and (ROOT/existing[str(i)].get('path','')).is_file()
          and existing[str(i)].get('school')==(v.get('school') or v.get('corrected_name')))]
    remaining=remaining[:MAX]
    success=dict(existing);failed={}
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures={pool.submit(bake,i,v):i for i,v in remaining}
        for f in as_completed(futures):
            i=futures[f]
            try:success[i]=f.result()
            except Exception as e:failed[i]=str(e)[:180]
    success={i:v for i,v in success.items() if (ROOT/v.get('path','')).is_file()}
    result={'schema':'cbb-outside-local-crests-v1','source_registry':CATALOG.relative_to(ROOT).as_posix(),
      'total_registry':len(registry),'count':len(success),'processed_this_run':len(remaining),
      'failed_this_run':failed,'teams':dict(sorted(success.items()))}
    MANIFEST.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
    print(f'Local outside-DI crests: {len(success)}/{len(registry)}; new attempts {len(remaining)}, failures {len(failed)}')
    for i,reason in list(failed.items())[:20]:print('UNBAKED',i,reason)
if __name__=='__main__':main()
