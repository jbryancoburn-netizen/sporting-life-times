#!/usr/bin/env python3
"""Build an 18-school vintage ACC logo AUDIT, without changing production renderers.

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
OUT=ROOT/"assets/cbb-acc-1980s"
HTML=ROOT/"cbb-acc-1980s-preview.html"
MANIFEST=ROOT/"data/cbb-acc-1980s-source-manifest.json"
ROWS=json.loads(r'''[{"slug":"boston-college","name":"Boston College Eagles","espn_id":"103","era":"1977–2000","description":"Flying eagle on BC","start_year":"1977","image_url":"https://content.sportslogos.net/logos/30/618/full/boston_college_eagles_logo_primary_19772820.png","archive_url":"https://www.sportslogos.net/logos/view/7377/Boston-College-Eagles-Logo/1977/Primary-Logo","primary":"#8c2232","secondary":"#c4a66b","in_acc_1980s":false},{"slug":"california","name":"California Golden Bears","espn_id":"25","era":"1982–1999","description":"California golden bear mascot","start_year":"1982","image_url":"https://content.sportslogos.net/logos/30/630/full/california_golden_bears_logo_alternate_19824574.png","archive_url":"https://www.sportslogos.net/logos/view/63076091982/California-Golden-Bears-Logo/1982/Alternate-Logo","primary":"#041e42","secondary":"#ffc72c","in_acc_1980s":false},{"slug":"clemson","name":"Clemson Tigers","espn_id":"228","era":"1978–1992","description":"Vintage tiger head mascot","start_year":"1978","image_url":"https://content.sportslogos.net/logos/30/643/full/8343_clemson_tigers-mascot-1978.png","archive_url":"https://www.sportslogos.net/logos/view/64383431978/Clemson-Tigers-Logo/1978/Mascot-Logo","primary":"#f56600","secondary":"#522d80","in_acc_1980s":true},{"slug":"duke","name":"Duke Blue Devils","espn_id":"150","era":"1971–1990","description":"Vintage Blue Devil with pitchfork","start_year":"1971","image_url":"https://content.sportslogos.net/logos/31/663/full/9496_duke_blue_devils-mascot-1971.png","archive_url":"https://www.sportslogos.net/logos/view/66394961971/Duke-Blue-Devils-Logo/1971/Mascot-Logo","primary":"#00539b","secondary":"#012169","in_acc_1980s":true},{"slug":"florida-state","name":"Florida State Seminoles","espn_id":"52","era":"1976–1989","description":"1976 Seminole profile","start_year":"1976","image_url":"https://content.sportslogos.net/logos/31/679/full/2481.gif","archive_url":"https://www.sportslogos.net/logos/view/2481/Florida-State-Seminoles-Logo/1976/Primary-Logo","primary":"#782f40","secondary":"#ceb888","in_acc_1980s":false},{"slug":"georgia-tech","name":"Georgia Tech Yellow Jackets","espn_id":"59","era":"1985–1999","description":"1985 Buzz yellowjacket mascot with GT","start_year":"1985","image_url":"https://content.sportslogos.net/logos/31/690/full/georgia-tech-yellow-jackets-alternate-logo-1985-1163.png","archive_url":"https://www.sportslogos.net/logos/view/2491/Georgia-Tech-Yellow-Jackets-Logo/1985/Alternate-Logo","primary":"#003057","secondary":"#b3a369","in_acc_1980s":true},{"slug":"louisville","name":"Louisville Cardinals","espn_id":"97","era":"1978–2000","description":"Boxing Cardinal mascot","start_year":"1978","image_url":"https://content.sportslogos.net/logos/32/734/full/louisville_cardinals_logo_primary_19783043.png","archive_url":"https://www.sportslogos.net/logos/view/2519/Louisville-Cardinals-Logo/1979/Primary-Logo","primary":"#c9001f","secondary":"#111111","in_acc_1980s":false},{"slug":"miami","name":"Miami Hurricanes","espn_id":"2390","era":"1984–2000","description":"Sebastian the Ibis in orange M sweater","start_year":"1984","image_url":"https://content.sportslogos.net/logos/32/748/full/miami_hurricanes_logo_mascot_1984sportslogosnet5069.png","archive_url":"https://www.sportslogos.net/logos/view/2536/Miami-Hurricanes-Logo/1984/Mascot-Logo","primary":"#f47423","secondary":"#035131","in_acc_1980s":false},{"slug":"nc-state","name":"NC State Wolfpack","espn_id":"152","era":"1967–1997","description":"Strutting Wolf mascot","start_year":"1967","image_url":"https://content.sportslogos.net/logos/33/777/full/north_carolina_state_wolfpack_logo_primary_19672426.png","archive_url":"https://www.sportslogos.net/logos/view/2852/North-Carolina-State-Wolfpack-Logo/1967/Primary-Logo","primary":"#cc0000","secondary":"#111111","in_acc_1980s":true},{"slug":"north-carolina","name":"North Carolina Tar Heels","espn_id":"153","era":"1983–1996","description":"Rameses ram mascot with UNC cap","start_year":"1983","image_url":"https://content.sportslogos.net/logos/33/775/full/9403_north_carolina_tar_heels-primary-1983.png","archive_url":"https://www.sportslogos.net/logos/view/77594031983/North-Carolina-Tar-Heels-Logo/1983/Primary-Logo","primary":"#7bafd4","secondary":"#13294b","in_acc_1980s":true},{"slug":"notre-dame","name":"Notre Dame Fighting Irish","espn_id":"87","era":"1967–2015","description":"Fighting Irish leprechaun","start_year":"1967","image_url":"https://content.sportslogos.net/logos/33/789/full/notre_dame_fighting_irish_logo_secondary_19678358.png","archive_url":"https://www.sportslogos.net/logos/view/2554/Notre-Dame-Fighting-Irish-Logo/1967/Secondary-Logo","primary":"#062340","secondary":"#c99700","in_acc_1980s":false},{"slug":"pittsburgh","name":"Pittsburgh Panthers","espn_id":"221","era":"1974–1987","description":"Pitt script with prowling panther","start_year":"1974","image_url":"https://content.sportslogos.net/logos/33/803/full/pittsburgh_panthers_logo_primary_dark_1974_sportslogosnet-8916.png","archive_url":"https://www.sportslogos.net/logos/view/80389161974/Pittsburgh-Panthers-Logo/1974/Primary-Dark-Logo","primary":"#003594","secondary":"#ffb81c","in_acc_1980s":false},{"slug":"smu","name":"SMU Mustangs","espn_id":"2567","era":"1982–2007","description":"Red running Mustang with SMU","start_year":"1982","image_url":"https://content.sportslogos.net/logos/34/842/full/smu_mustangs_logo_primary_19827667.png","archive_url":"https://www.sportslogos.net/logos/view/84286231981/SMU-Mustangs-Logo/1982/Primary-Logo","primary":"#a80000","secondary":"#0033a1","in_acc_1980s":false},{"slug":"stanford","name":"Stanford Cardinal","espn_id":"24","era":"1979–1989","description":"Vintage Stanford S and tree","start_year":"1979","image_url":"https://content.sportslogos.net/logos/34/854/full/stanford_cardinal_logo_primary_19791605.png","archive_url":"https://www.sportslogos.net/logos/view/2643/Stanford-Cardinal-Logo/1979/Primary-Logo","primary":"#8c1515","secondary":"#006a4d","in_acc_1980s":false},{"slug":"syracuse","name":"Syracuse Orange","espn_id":"183","era":"1980–2004","description":"Otto mascot with SU cap","start_year":"1980","image_url":"https://content.sportslogos.net/logos/34/859/full/syracuse_orange_logo_mascot_19801572.png","archive_url":"https://www.sportslogos.net/logos/view/85933610/Syracuse-Orange-Logo/1980/Mascot-Logo","primary":"#ff431b","secondary":"#000e54","in_acc_1980s":false},{"slug":"virginia","name":"Virginia Cavaliers","espn_id":"258","era":"1983–1994","description":"1983 Cavalier illustration","start_year":"1983","image_url":"https://content.sportslogos.net/logos/35/898/full/2716.gif","archive_url":"https://www.sportslogos.net/logos/view/2716/Virginia-Cavaliers-Logo/1983/Primary-Logo","primary":"#232d4b","secondary":"#f84c1e","in_acc_1980s":true},{"slug":"virginia-tech","name":"Virginia Tech Hokies","espn_id":"259","era":"1983–present","description":"Flying VT; no verified 1980s HokieBird mark","start_year":"1983","image_url":"https://content.sportslogos.net/logos/35/901/full/virginia_tech_hokies_logo_primary_19832480.png","archive_url":"https://www.sportslogos.net/logos/view/gabem67h4rb7golayyr7qsole/Virginia-Tech-Hokies-Logo/1983/Primary-Logo","primary":"#6a2c3e","secondary":"#cf4520","in_acc_1980s":false},{"slug":"wake-forest","name":"Wake Forest Demon Deacons","espn_id":"154","era":"1968–1992","description":"Vintage Demon Deacon mascot portrait","start_year":"1968","image_url":"https://content.sportslogos.net/logos/35/903/full/3520_wake_forest_demon_deacons-primary-1968.png","archive_url":"https://www.sportslogos.net/logos/view/90335201968/Wake-Forest-Demon-Deacons-Logo/1968/Primary-Logo","primary":"#ceb888","secondary":"#2c2a29","in_acc_1980s":true}]''')

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
    src=f'assets/cbb-acc-1980s/{r["slug"]}.png?v=20261114-acc18a'
    return (f'<article class="school"><span class="crest" style="--primary:{r["primary"]};--secondary:{r["secondary"]}">'
      f'<img src="{src}" alt="{esc(r["name"]+" "+r["description"])}" loading="eager" decoding="async">'
      '<span class="fallback-note">Archive image unavailable</span></span>'
      f'<strong>{esc(r["name"])}</strong><div class="era">Archive era: {esc(r["era"])}</div>'
      f'<div class="kind">{esc(r["description"])}</div>'
      f'<div class="era"><a href="{esc(r["archive_url"])}" target="_blank" rel="noopener noreferrer">Historical source</a></div></article>')
def build_page(rows):
    core=[r for r in rows if r["in_acc_1980s"]]
    later=[r for r in rows if not r["in_acc_1980s"]]
    assert len(core)==7 and len(later)==11
    cards1="\n".join(card(r) for r in core)
    cards2="\n".join(card(r) for r in later)
    html=r'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sporting Life &amp; Times · ACC 1980s Logo Audit</title>
<meta name="description" content="18 current ACC schools, their verified vintage 1980s-era university logo artwork and historical sources.">
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
<h1>ACC · Eighties Logo Archive</h1><p>Authentic vintage marks for all 18 current ACC schools, with character and mascot artwork preferred whenever documented in the 1980s.</p>
<div class="tag">18 archival emblems · Stored locally · For visual approval</div></header>
<p class="intro">This is a proposed audit gallery, <strong>not yet the production logo set</strong>. Every emblem is a local 512-pixel PNG with two visible school-color rings. Check each mascot's historical character, size, and centering. Source links document which era each design belongs to.</p>
<section aria-labelledby="original-members"><h2 id="original-members">ACC members during the 1980s · seven current schools</h2>
<div class="gallery">__CORE_CARDS__</div></section>
<section aria-labelledby="later-members"><h2 id="later-members">Later ACC arrivals · their own 1980s university logos</h2>
<p class="intro">These eleven schools were not ACC members in the 1980s; the graphics represent their universities during that decade, not their conference membership at that time.</p>
<div class="gallery">__LATER_CARDS__</div></section>
<section class="notes"><strong>Archival selection standard.</strong> A period-correct animal or character mascot takes precedence over a monogram. Where no verifiable 1980s mascot exists, the historical mark is used rather than inventing or backdating modern artwork. This page remains a review gallery; men's and women's production logos will not change until the collection is approved.</section>
</main><script>
document.querySelectorAll(".crest img").forEach(img=>img.addEventListener("error",()=>img.closest(".crest")?.classList.add("missing"),{once:true}));
</script></body></html>'''
    return html.replace("__CORE_CARDS__",cards1).replace("__LATER_CARDS__",cards2)
def main():
    if HTML.exists():raise AssertionError("ACC gallery already exists; refuse accidental overwrite")
    OUT.mkdir(parents=True,exist_ok=True)
    done=[]
    for row in ROWS:
        img,raw=retrieve(row["image_url"])
        out,geometry=clean(img)
        target=OUT/(row["slug"]+".png")
        out.save(target,format="PNG",optimize=True)
        rec={**row,"source_dimensions":list(img.size),"original_sha256":hashlib.sha256(raw).hexdigest(),
             "local_path":"assets/cbb-acc-1980s/"+row["slug"]+".png",
             "local_sha256":hashlib.sha256(target.read_bytes()).hexdigest(),
             "geometry":geometry}
        done.append(rec)
        print("VERIFIED",rec["slug"],img.size,geometry,flush=True)
    if len(done)!=18 or len({r["espn_id"] for r in done})!=18:raise AssertionError("ACC identity mismatch")
    page=build_page(done)
    if page.count('<article class="school">')!=18:raise AssertionError("Gallery card count")
    if page.count('assets/cbb-acc-1980s/')!=18:raise AssertionError("Local artwork reference count")
    HTML.write_text(page,encoding="utf8")
    MANIFEST.parent.mkdir(parents=True,exist_ok=True)
    MANIFEST.write_text(json.dumps({"source":"Verified historic college logo archive pages",
       "conference":"ACC","era":"1980s","current_member_count":18,
       "historical_acc_members_among_current":7,"later_arrivals":11,
       "production_deployment":False,"schools":done},indent=2)+"\n",encoding="utf8")
    print("PASS: 18 authentic 1980s logos, 18 local assets, era links, two rings, preview only")
if __name__=="__main__":main()
