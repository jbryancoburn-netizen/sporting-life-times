#!/usr/bin/env python3
"""Normalize archival Big Ten artwork into centered, locally served PNG assets.

The marks are copied from the existing historical preview, without recreating
or changing the original team logos. No browser-time positioning adjustments.
"""
from __future__ import annotations
import base64
from io import BytesIO
from pathlib import Path
import re
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PAGE = ROOT / 'cbb-big-ten-1980s-preview.html'
OUT = ROOT / 'assets/cbb-big-ten-1980s/centered'
SCHOOLS = {
    'Indiana Hoosiers': 'indiana',
    'Illinois Fighting Illini': 'illinois',
    'Iowa Hawkeyes': 'iowa',
    'Michigan Wolverines': 'michigan',
    'Michigan State Spartans': 'michigan-state',
    'Minnesota Golden Gophers': 'minnesota',
    'Northwestern Wildcats': 'northwestern',
    'Ohio State Buckeyes': 'ohio-state',
    'Purdue Boilermakers': 'purdue',
    'Wisconsin Badgers': 'wisconsin'
}
IMAGE = re.compile(r'(<img\s+src=")([^"]+)("\s+alt="([^"]+)")')
SIDE = 512
ART = 432

def quantile(hist, frac, total):
    limit = max(1, int(total * frac))
    cumulative = 0
    for i, count in enumerate(hist):
        cumulative += count
        if cumulative >= limit:
            return i
    return len(hist) - 1

def bounds(img):
    img = img.convert('RGBA')
    w, h = img.size
    corners = [img.getpixel(p) for p in ((0,0),(w-1,0),(0,h-1),(w-1,h-1))]
    opaque = all(p[3] > 245 for p in corners)
    background = tuple(sorted(p[k] for p in corners)[2] for k in range(3)) if opaque else (255,255,255)
    xc, yc = [0]*w, [0]*h
    total = 0
    for y in range(h):
        for x in range(w):
            r,g,b,a = img.getpixel((x,y))
            if a < 60:
                continue
            if opaque and max(abs(r-background[0]),abs(g-background[1]),abs(b-background[2])) < 22:
                continue
            if not opaque and r > 248 and g > 248 and b > 248:
                continue
            xc[x] += 1
            yc[y] += 1
            total += 1
    if total < 50:
        raise ValueError('No distinct logo artwork found')
    x0, x1 = quantile(xc, .0015, total), quantile(xc, .9985, total)+1
    y0, y1 = quantile(yc, .0015, total), quantile(yc, .9985, total)+1
    if x1-x0 < 25 or y1-y0 < 25:
        raise ValueError('Artwork unexpectedly small')
    return (x0,y0,x1,y1)

def center_image(raw):
    with Image.open(BytesIO(raw)) as opened:
        img = opened.convert('RGBA')
    x0,y0,x1,y1 = bounds(img)
    pad = max(2,round(max(x1-x0,y1-y0)*.02))
    img = img.crop((max(0,x0-pad),max(0,y0-pad),min(img.width,x1+pad),min(img.height,y1+pad)))
    factor = min(ART/img.width,ART/img.height)
    img = img.resize((max(1,round(img.width*factor)),max(1,round(img.height*factor))), Image.Resampling.LANCZOS)
    original = Image.open(BytesIO(raw)).convert('RGBA')
    fill = (255,255,255,0) if original.getpixel((0,0))[3] < 50 else (255,255,255,255)
    output = Image.new('RGBA',(SIDE,SIDE),fill)
    output.alpha_composite(img,((SIDE-img.width)//2,(SIDE-img.height)//2))
    visual = bounds(output)
    if abs((visual[0]+visual[2])/2-SIDE/2)>8 or abs((visual[1]+visual[3])/2-SIDE/2)>8:
        raise ValueError('Visible artwork remains off-center')
    encoded = BytesIO()
    output.save(encoded,format='PNG',optimize=True)
    return encoded.getvalue()

def main():
    original = PAGE.read_text(encoding='utf8')
    OUT.mkdir(parents=True,exist_ok=True)
    seen,done = set(),set()
    def replace(m):
        prefix, src, suffix, alt = m.groups()
        names = [name for name in SCHOOLS if alt.startswith(name+' ')]
        if len(names)!=1:
            raise ValueError('Unknown logo '+alt)
        school=names[0]
        seen.add(school)
        target = 'assets/cbb-big-ten-1980s/centered/'+SCHOOLS[school]+'.png'
        file = ROOT/target
        if src.startswith('data:image/png;base64,'):
            if school not in done:
                file.write_bytes(center_image(base64.b64decode(src.split(',',1)[1],validate=True)))
                done.add(school)
        elif src == 'assets/cbb-big-ten-1980s/minnesota-running-gopher-user.webp':
            if school not in done:
                file.write_bytes(center_image((ROOT/src).read_bytes()))
                done.add(school)
        elif src == target:
            if not file.is_file():
                raise ValueError('Centered image missing: '+target)
        else:
            raise ValueError('Unexpected source: '+src[:100])
        return prefix+target+suffix
    page,count = IMAGE.subn(replace,original)
    if count != 14 or seen != set(SCHOOLS) or len(done) not in (0,10):
        raise AssertionError((count,seen,done))
    page = re.sub(r'<script defer src="cbb-big-ten-optical-center\.js[^"]*"></script>','',page)
    page = page.replace('transform:translate(calc(-50% + var(--slt-ink-x, 0%)),calc(-50% + var(--slt-ink-y, 0%)));',
                        'transform:translate(-50%,-50%);')
    if '--slt-ink-' in page or 'cbb-big-ten-optical-center' in page:
        raise AssertionError('Client-side logo offsets still present')
    PAGE.write_text(page,encoding='utf8')
    for school, slug in SCHOOLS.items():
        target=OUT/(slug+'.png')
        with Image.open(target) as img:
            if img.size!=(512,512): raise AssertionError(target)
            x0,y0,x1,y1=bounds(img)
            if max(abs((x0+x1)/2-256),abs((y0+y1)/2-256))>8: raise AssertionError((school,x0,y0,x1,y1))
    print('PASS: 10 source-centered PNGs, 14 references, and zero client-side logo positioning patches')

if __name__ == '__main__':
    main()
