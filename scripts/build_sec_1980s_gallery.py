#!/usr/bin/env python3
"""Build the 16-school vintage SEC logo AUDIT, without changing production renderers.

The image inputs are precise, individually verified SportsLogos historical
archive PNG/GIF source URLs; downloads happen only in this one-off build job.
No image browser runtime references a third-party source.
"""
from __future__ import annotations
from io import BytesIO
from pathlib import Path
from urllib.request import urlopen,Request
from PIL import Image
import hashlib,json,math,sys
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/"assets/cbb-sec-1980s"
HTML=ROOT/"cbb-sec-1980s-preview.html"
MANIFEST=ROOT/"data/cbb-sec-1980s-source-manifest.json"
ROWS=json.loads(r'''[{"slug":"alabama","name":"Alabama Crimson Tide","espn_id":"333","era":"1983–2015","description":"Classic Big Al elephant mascot","start_year":"1983","image_url":"https://content.sportslogos.net/logos/30/597/full/alabama_crimson_tide_logo_mascot_19831902.png","archive_url":"https://www.sportslogos.net/logos/view/59758370/Alabama-Crimson-Tide-Logo/1983/Mascot-Logo","primary":"#9e1b32","secondary":"#828a8f","in_sec_1980s":true},{"slug":"arkansas","name":"Arkansas Razorbacks","espn_id":"8","era":"1967–2001","description":"Charging vintage Razorback hog","start_year":"1967","image_url":"https://content.sportslogos.net/logos/30/606/full/arkansas_razorbacks_logo_primary_19677366.png","archive_url":"https://www.sportslogos.net/logos/view/60653121967/Arkansas-Razorbacks-Logo/1967/Primary-Logo","primary":"#9d2235","secondary":"#4a4a4a","in_sec_1980s":false},{"slug":"auburn","name":"Auburn Tigers","espn_id":"2","era":"1981–2009","description":"Original-era Aubie tiger mascot","start_year":"1981","image_url":"https://content.sportslogos.net/logos/30/610/full/auburn_tigers_logo_mascot_19817720.png","archive_url":"https://www.sportslogos.net/logos/view/7315/Auburn-Tigers-Logo/1981/Mascot-Logo","primary":"#0c2340","secondary":"#e87722","in_sec_1980s":true},{"slug":"florida","name":"Florida Gators","espn_id":"57","era":"1979–1994","description":"Retro Gator interlocking UF emblem","start_year":"1979","image_url":"https://content.sportslogos.net/logos/31/675/full/9ru6ujcdibakxn9gfege.png","archive_url":"https://www.sportslogos.net/logos/view/9ru6ujcdibakxn9gfege/Florida-Gators-Logo/1979/Primary-Logo","primary":"#0021a5","secondary":"#fa4616","in_sec_1980s":true},{"slug":"georgia","name":"Georgia Bulldogs","espn_id":"61","era":"1988–2015","description":"Hairy Dawg bulldog mascot in football uniform","start_year":"1988","image_url":"https://content.sportslogos.net/logos/31/687/full/georgia_bulldogs_logo_mascot_19887191.png","archive_url":"https://www.sportslogos.net/logos/view/68728571997/Georgia-Bulldogs-Logo/1988/Mascot-Logo","primary":"#ba0c2f","secondary":"#111111","in_sec_1980s":true},{"slug":"kentucky","name":"Kentucky Wildcats","espn_id":"96","era":"1973–1986","description":"Leaping attacking wildcat in two blues","start_year":"1973","image_url":"https://content.sportslogos.net/logos/32/721/full/kentucky_wildcats_logo_primary_1973_sportslogosnet-6300.png","archive_url":"https://www.sportslogos.net/logos/view/72163001973/Kentucky-Wildcats-Logo/1973/Primary-Logo","primary":"#0033a0","secondary":"#13294b","in_sec_1980s":true},{"slug":"lsu","name":"LSU Tigers","espn_id":"99","era":"1977–2013","description":"Period-correct tiger-head logo below arched LSU","start_year":"1977","image_url":"https://content.sportslogos.net/logos/32/723/full/h2s3gh9zg304ngzx1h6x.gif","archive_url":"https://www.sportslogos.net/logos/view/h2s3gh9zg304ngzx1h6x/LSU-Tigers-Logo/1977/Secondary-Logo","primary":"#461d7c","secondary":"#fdd023","in_sec_1980s":true},{"slug":"mississippi-state","name":"Mississippi State Bulldogs","espn_id":"344","era":"1967–1986","description":"Classic walking Bully bulldog mascot in MSU sweater","start_year":"1967","image_url":"https://content.sportslogos.net/logos/32/755/full/mississippi_state_bulldogs_logo_primary_19672457.png","archive_url":"https://www.sportslogos.net/logos/view/guja9j41iaenkramphbih8x7r/Mississippi-State-Bulldogs-Logo/1967/Primary-Logo","primary":"#660000","secondary":"#a2aaad","in_sec_1980s":true},{"slug":"missouri","name":"Missouri Tigers","espn_id":"142","era":"1980–1995","description":"Tiger leaping over MIZZOU","start_year":"1980","image_url":"https://content.sportslogos.net/logos/32/757/full/missouri_tigers_logo_primary_1980_sportslogosnet-4904.png","archive_url":"https://www.sportslogos.net/logos/view/75749041980/Missouri-Tigers-Logo/1980/Primary-Logo","primary":"#111111","secondary":"#f1b82d","in_sec_1980s":false},{"slug":"oklahoma","name":"Oklahoma Sooners","espn_id":"201","era":"1979–2000","description":"Slanted two-dimensional OU of the 1980s","start_year":"1979","image_url":"https://content.sportslogos.net/logos/33/793/full/oklahoma_sooners_logo_alternate_19799377.png","archive_url":"https://www.sportslogos.net/logos/view/kkdfeobkcyyg6l3vbr3x/Oklahoma-Sooners-Logo/1979/Alternate-Logo","primary":"#841617","secondary":"#501020","in_sec_1980s":false},{"slug":"ole-miss","name":"Ole Miss Rebels","espn_id":"145","era":"1970–2002","description":"Historical Colonel Reb and Ole Miss emblem; archival identity","start_year":"1970","image_url":"https://content.sportslogos.net/logos/32/754/full/mississippi_rebels_logo_primary_19702191.png","archive_url":"https://www.sportslogos.net/logos/view/2564/Mississippi-Rebels-Logo/1970/Primary-Logo","primary":"#ce1126","secondary":"#14213d","in_sec_1980s":true},{"slug":"south-carolina","name":"South Carolina Gamecocks","espn_id":"2579","era":"1975–2008","description":"Fighting Gamecock inside block C","start_year":"1975","image_url":"https://content.sportslogos.net/logos/34/834/full/south_carolina_gamecocks_logo_primary_19751076.png","archive_url":"https://www.sportslogos.net/logos/view/5gje9m4b1shmcd442rkpxkeb8/South-Carolina-Gamecocks-Logo/1975/Primary-Logo","primary":"#73000a","secondary":"#111111","in_sec_1980s":false},{"slug":"tennessee","name":"Tennessee Volunteers","espn_id":"2633","era":"1980–2005","description":"Smokey bluetick-hound mascot head","start_year":"1980","image_url":"https://content.sportslogos.net/logos/34/861/full/tennessee_volunteers_logo_secondary_19805100.png","archive_url":"https://www.sportslogos.net/logos/view/86136691983/Tennessee-Volunteers-Logo/1980/Secondary-Logo","primary":"#ff8200","secondary":"#58595b","in_sec_1980s":true},{"slug":"texas","name":"Texas Longhorns","espn_id":"251","era":"1983–2011","description":"Hook 'Em Longhorn mascot in cowboy hat","start_year":"1983","image_url":"https://content.sportslogos.net/logos/34/865/full/texas_longhorns_logo_mascot_19815962.png","archive_url":"https://www.sportslogos.net/logos/view/86552221981/Texas-Longhorns-Logo/1983/Mascot-Logo","primary":"#bf5700","secondary":"#333f48","in_sec_1980s":false},{"slug":"texas-am","name":"Texas A&M Aggies","espn_id":"245","era":"1981–2000","description":"Original-era maroon ATM lettermark; no sourced period mascot","start_year":"1981","image_url":"https://content.sportslogos.net/logos/34/866/full/9tk2kr8wodbh951x7cug.png","archive_url":"https://www.sportslogos.net/logos/view/9tk2kr8wodbh951x7cug/Texas-AM-Aggies-Logo/1981/Primary-Logo","primary":"#500000","secondary":"#b1b3b3","in_sec_1980s":false},{"slug":"vanderbilt","name":"Vanderbilt Commodores","espn_id":"238","era":"1975–1984","description":"Original-era gold V centered in five-pointed star","start_year":"1975","image_url":"https://content.sportslogos.net/logos/35/895/full/vanderbilt-commodores-logo-primary-1975-8749.png","archive_url":"https://www.sportslogos.net/logos/view/jtd3lmxi0ge38frad2h8/Vanderbilt-Commodores-Logo/1975/Primary-Logo","primary":"#b19d60","secondary":"#111111","in_sec_1980s":true}]''')

HEADERS={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
         "Accept":"image/avif,image/webp,image/apng,image/*,*/*;q=0.8","Referer":"https://www.sportslogos.net/"}
def retrieve(url):
    req=Request(url,headers=HEADERS)
    with urlopen(req,timeout=45) as f:raw=f.read(5_500_001)
    if not 1700<len(raw)<5_500_000:raise ValueError(f"Archive image too small/large: {url}")
    with Image.open(BytesIO(raw)) as opened:
        if opened.width<100 or opened.height<100:raise AssertionError("Historic logo too low resolution: "+url)
        img=opened.convert("RGBA")
    return img,raw
def visible(img):
    # Transparent and white padding are ignored; dark/red/gold mascot pixels
    # remain intact. The original drawing is never cut at a fixed height.
    pixels=img.load()
    xs,ys=[],[]
    for y in range(img.height):
      for x in range(img.width):
        r,g,b,a=pixels[x,y]
        if a<80 or (r>=247 and g>=247 and b>=247):continue
        xs.append(x);ys.append(y)
    if len(xs)<200:raise AssertionError("Source contains no visible mascot pixels")
    return min(xs),min(ys),max(xs)+1,max(ys)+1
def clean(img):
    # Convert GIF to RGBA, remove only blank background around ENTIRE art.
    bbox=visible(img)
    pad=max(2,round(max(img.size)*.004))
    x0,y0,x1,y1=bbox
    src=img.crop((max(0,x0-pad),max(0,y0-pad),min(img.width,x1+pad),min(img.height,y1+pad)))
    scale=min(432/src.width,432/src.height)
    def attempt(s):
        size=(max(1,round(src.width*s)),max(1,round(src.height*s)))
        art=src.resize(size,Image.Resampling.LANCZOS)
        output=Image.new("RGBA",(512,512),(255,255,255,255))
        output.alpha_composite(art,((512-size[0])//2,(512-size[1])//2))
        ink=visible(output)
        x0,y0,x1,y1=ink
        pixels=output.load()
        radius=0.
        for y in range(y0,y1):
            for x in range(x0,x1):
                r,g,b,a=pixels[x,y]
                if a<80 or (r>=247 and g>=247 and b>=247):continue
                radius=max(radius,math.hypot(x-256,y-256))
        return output,ink,radius
    output,ink,radius=attempt(scale)
    if radius>217:output,ink,radius=attempt(scale*215/radius)
    if radius>220 or radius<70:raise AssertionError(f"Image doesn't fit rings (radial={radius}): {bbox}")
    return output,{"source_bbox":bbox,"centered_bbox":ink,"radius_px":round(radius,1),
                  "gap_to_238px_ring":round(238-radius,1)}
def esc(x):
    return str(x).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace('"',"&quot;")
def card(r):
    src=f'assets/cbb-sec-1980s/{r["slug"]}.png?v=20261114-sec16b'
    return (f'<article class="school"><span class="crest" style="--primary:{r["primary"]};--secondary:{r["secondary"]}">'
      f'<img src="{src}" alt="{esc(r["name"]+" "+r["description"])}" loading="eager" decoding="async">'
      '<span class="fallback-note">Archive image unavailable</span></span>'
      f'<strong>{esc(r["name"])}</strong><div class="era">Archive era: {esc(r["era"])}</div>'
      f'<div class="kind">{esc(r["description"])}</div>'
      f'<div class="era"><a href="{esc(r["archive_url"])}" target="_blank" rel="noopener noreferrer">Historical source</a></div></article>')
def build_page(rows):
    core=[r for r in rows if r["in_sec_1980s"]]
    later=[r for r in rows if not r["in_sec_1980s"]]
    assert len(core)==10 and len(later)==6
    cards1="\n".join(card(r) for r in core)
    cards2="\n".join(card(r) for r in later)
    html=r'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sporting Life &amp; Times · SEC 1980s Logo Audit</title>
<meta name="description" content="16 current SEC schools, their verified vintage 1980s-era university logo artwork and historical sources.">
<style>
:root{--paper:#ede5d3;--stock:#f7f0e4;--ink:#2b221a;--brown:#735b47;--rule:#aea18c;--muted:#766b5d;color-scheme:light}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Georgia,'Century Schoolbook','Times New Roman',serif}
.wrap{max-width:1320px;margin:0 auto;padding:20px clamp(12px,3.1vw,40px) 68px}
.masthead{border-top:8px double var(--ink);border-bottom:5px double var(--ink);text-align:center;padding:14px 12px 20px}
.eyebrow{font:700 11px/1.5 Arial,sans-serif;letter-spacing:1.9px;text-transform:uppercase;color:var(--brown)}
h1{font:900 clamp(31px,5vw,64px)/.97 Georgia,serif;letter-spacing:-1.4px;text-transform:uppercase;margin:9px auto 12px;max-width:1000px}
.masthead p{font:15px/1.55 Georgia,serif;max-width:820px;margin:0 auto}
.tag{display:inline-block;border:1px solid #5d5144;padding:5px 12px;margin-top:14px;font:700 11px/1.5 Arial,sans-serif;letter-spacing:1.2px;text-transform:uppercase}
.intro{margin:22px auto 15px;font-size:15px;line-height:1.5}
h2{font-size:26px;margin:30px 0 16px;border-bottom:2px solid #5f5447;padding:0 0 8px}
.gallery{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:13px}
.school{border:1px solid #bbab96;background:var(--stock);padding:17px 10px 14px;text-align:center;min-width:0}
.school .crest{margin:0 auto}
.school strong{font-size:15px;line-height:1.25;display:block;min-height:37px;margin-top:12px;overflow-wrap:break-word}
.era{font:11px/1.35 Arial,sans-serif;color:var(--muted);margin-top:4px}
.kind{font:12px/1.4 Georgia,serif;color:#554536;margin:5px 0 7px;min-height:31px}
.crest{position:relative;display:block;flex:none;overflow:hidden;isolation:isolate;border-radius:50%;
  width:var(--diameter,120px);height:var(--diameter,120px);min-width:var(--diameter,120px);
  border:var(--stroke,6px) solid var(--primary);background:#fff;box-sizing:border-box}
.crest::before{position:absolute;inset:0;content:"";border:var(--stroke,6px) solid var(--secondary);border-radius:50%;z-index:3;pointer-events:none}
.crest img{position:absolute;display:block;top:50%;left:50%;transform:translate(-50%,-50%);
  width:calc(100% - 18px);height:calc(100% - 18px);object-fit:contain;z-index:2}
.fallback-note{display:none;font:10px Arial,sans-serif;position:absolute;inset:35% 0 0;color:#8f2e25}
.crest.missing img{display:none}.crest.missing .fallback-note{display:block}
.notes{border-top:4px double #6c5e50;margin-top:30px;padding-top:13px;color:#594f42;line-height:1.55;font-size:13px}
a{color:#74412e}a:focus-visible{outline:3px solid #bd672f}
@media(max-width:1080px){.gallery{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:820px){.gallery{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:520px){.wrap{padding:12px 9px 50px}.gallery{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
 .school{padding:12px 4px 11px}.school strong{font-size:13px;min-height:32px}
 .school .crest{--diameter:104px;--stroke:5px}.school .crest img{width:calc(100% - 14px);height:calc(100% - 14px)}}
@media(max-width:360px){.school .crest{--diameter:91px;--stroke:4px}}
</style></head><body><main class="wrap">
<header class="masthead"><div class="eyebrow">Sporting Life &amp; Times · Collegiate Basketball</div>
<h1>SEC · Eighties Logo Archive</h1><p>Authentic vintage marks for all 16 current SEC schools, with character and mascot artwork preferred whenever documented in the 1980s.</p>
<div class="tag">16 archival emblems · Stored locally · For visual approval</div></header>
<p class="intro">This is a proposed audit gallery, <strong>not yet the production logo set</strong>. Every emblem is a local 512-pixel PNG with two visible school-color rings. Check each mascot's historical character, size, and centering. Source links document which era each design belongs to.</p>
<section aria-labelledby="original-members"><h2 id="original-members">SEC members during the 1980s · ten current schools</h2>
<div class="gallery">__CORE_CARDS__</div></section>
<section aria-labelledby="later-members"><h2 id="later-members">Later SEC arrivals · their own 1980s university logos</h2>
<p class="intro">These six schools were not SEC members in the 1980s; the graphics represent their universities during that decade, not their conference membership at that time.</p>
<div class="gallery">__LATER_CARDS__</div></section>
<section class="notes"><strong>Archival selection standard.</strong> A period-correct animal or character mascot takes precedence over a monogram. Where no verifiable 1980s mascot exists, the historical mark is used rather than inventing or backdating modern artwork. This page remains a review gallery; men's and women's production logos will not change until the collection is approved.</section>
</main><script>
document.querySelectorAll(".crest img").forEach(img=>img.addEventListener("error",()=>img.closest(".crest")?.classList.add("missing"),{once:true}));
</script></body></html>'''
    return html.replace("__CORE_CARDS__",cards1).replace("__LATER_CARDS__",cards2)
def main():
    if HTML.exists() and 'SEC · Eighties Logo Archive' not in HTML.read_text(encoding="utf8"):
        raise AssertionError("Refuse to replace unrelated gallery")
    OUT.mkdir(parents=True,exist_ok=True)
    done=[]
    for row in ROWS:
        img,raw=retrieve(row["image_url"])
        out,geometry=clean(img)
        target=OUT/(row["slug"]+".png")
        out.save(target,format="PNG",optimize=True)
        rec={**row,"source_dimensions":list(img.size),"original_sha256":hashlib.sha256(raw).hexdigest(),
             "local_path":"assets/cbb-sec-1980s/"+row["slug"]+".png",
             "local_sha256":hashlib.sha256(target.read_bytes()).hexdigest(),
             "geometry":geometry}
        done.append(rec)
        print("VERIFIED",rec["slug"],img.size,geometry,flush=True)
    if len(done)!=16 or len({r["espn_id"] for r in done})!=16:raise AssertionError("SEC identity mismatch")
    page=build_page(done)
    if page.count('<article class="school">')!=16:raise AssertionError("Gallery card count")
    if page.count('assets/cbb-sec-1980s/')!=16:raise AssertionError("Local artwork reference count")
    HTML.write_text(page,encoding="utf8")
    MANIFEST.parent.mkdir(parents=True,exist_ok=True)
    MANIFEST.write_text(json.dumps({"source":"Verified historic college logo archive pages",
       "conference":"SEC","era":"1980s","current_member_count":16,
       "historical_sec_members_among_current":10,"later_arrivals":6,
       "production_deployment":False,"schools":done},indent=2)+"\n",encoding="utf8")
    print("PASS: 16 authentic 1980s logos, 16 local assets, era links, two rings, preview only")
if __name__=="__main__":main()
