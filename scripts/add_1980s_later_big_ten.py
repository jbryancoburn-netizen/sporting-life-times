#!/usr/bin/env python3
"""Add eight authenticated 1980s university marks to original-ten Big Ten gallery.
Logos are retrieved at BUILD time, normalized to locally stored 512px PNGs.
No browser external image dependencies, invented logos, or CSS positioning hacks.
"""
import hashlib, io, json, math
from pathlib import Path
from urllib.request import Request,urlopen
from PIL import Image
ROOT=Path(__file__).resolve().parent.parent
HTML=ROOT/"cbb-big-ten-1980s-preview.html"
OUT=ROOT/"assets/cbb-big-ten-1980s/centered"
MANIFEST=ROOT/"data/cbb-big-ten-1980s-eight-source-manifest.json"
CDN="https://content.sportslogos.net/logos/"
ARCHIVE="https://www.sportslogos.net/logos/view/"
SCHOOLS=[
("penn-state","Penn State Nittany Lions","1983–1996","1983 primary lion and wordmark","#002D62","#839BB8","33/801/full/penn_state_nittany_lions_logo_primary_19838537.png","1k9prruij590izix314f/Penn-State-Nittany-Lions-Logo/1983/Primary-Logo"),
("nebraska","Nebraska Cornhuskers","1970–1993","1970 primary Nebraska N","#d00000","#dfc49c","33/766/full/nebraska_cornhuskers_logo_primary_19707899.png","u5a0z147qunbzxwnec8ef7bkl/Nebraska-Cornhuskers-Logo/1970/Primary-Logo"),
("maryland","Maryland Terrapins","1983–1988","1983 primary striped M","#e21836","#ffd520","32/743/full/maryland_terrapins_logo_primary_19834082.png","dey5gp0tjfhee7g969ym/Maryland-Terrapins-Logo/1983/Primary-Logo"),
("rutgers","Rutgers Scarlet Knights","1981–1997","1981 primary NJ Rutgers mark","#cc0033","#252525","33/817/full/rutgers_scarlet_knights_logo_primary_19817521.png","evgfofw74nn2qxglvphn/Rutgers-Scarlet-Knights-Logo/1981/Primary-Logo"),
("ucla","UCLA Bruins","1964–1996","1964 bear mascot","#2774ae","#ffd100","35/882/full/ucla_bruins_logo_mascot_19643668.png","88263971964/UCLA-Bruins-Logo/1964/Mascot-Logo"),
("usc","USC Trojans","1974–2016","1974 cardinal Trojan head","#990000","#ffcc00","34/840/full/southern_california_trojans_logo_secondary_19748112.png","2625/USC-Trojans-Logo/1974/Secondary-Logo"),
("oregon","Oregon Ducks","1974–1993","1974 Donald Duck and O","#007030","#fee123","33/797/full/ehrrx1qjof2owakh79jq.png","ehrrx1qjof2owakh79jq/Oregon-Ducks-Logo/1974/Primary-Logo"),
("washington","Washington Huskies","1983–1991","1983 W / Huskies primary","#4b2e83","#b7a57a","35/904/full/washington_huskies_logo_primary_19832955.png","90436971983/Washington-Huskies-Logo/1983/Primary-Logo")
]
def esc(s):return str(s).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace('"',"&quot;")
def fetch(url):
    request=Request(url,headers={
        "User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36",
        "Accept":"image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Referer":"https://www.sportslogos.net/"})
    with urlopen(request,timeout=35) as resp:raw=resp.read(5_500_001)
    if not 1500<=len(raw)<5_500_000:raise ValueError(f"Invalid archive image length {len(raw)} at {url}")
    try:
        with Image.open(io.BytesIO(raw)) as image: art=image.convert("RGBA")
    except Exception as exc:raise ValueError(f"Not a usable historical PNG: {url}") from exc
    if min(art.size)<180:raise ValueError("Archival image too small "+url)
    return art,raw
def points(img):
    p=img.load();ret=[]
    for y in range(img.height):
        for x in range(img.width):
            r,g,b,a=p[x,y]
            if a<90 or (r>245 and g>245 and b>245):continue
            ret.append((x,y))
    return ret
def normalize(art):
    bbox=art.getchannel("A").getbbox()
    if not bbox:raise AssertionError("Archive image has no visible alpha")
    art=art.crop(bbox)
    scale=min(434/art.width,434/art.height,2.0)
    def render(sc):
        w,h=max(1,round(art.width*sc)),max(1,round(art.height*sc))
        asset=art.resize((w,h),Image.Resampling.LANCZOS)
        canvas=Image.new("RGBA",(512,512),(255,255,255,255))
        canvas.alpha_composite(asset,((512-w)//2,(512-h)//2))
        ink=points(canvas)
        if len(ink)<900:raise AssertionError("No suitable visible logo ink")
        radius=max(math.hypot(x-256,y-256) for x,y in ink)
        return canvas,ink,radius
    canvas,ink,radius=render(scale)
    if radius>218:canvas,ink,radius=render(scale*(216.4/radius))
    if radius>220 or radius<65:raise AssertionError(f"Logo doesn't fit circular ring: {radius}")
    x0,x1=min(x for x,y in ink),max(x for x,y in ink)+1
    y0,y1=min(y for x,y in ink),max(y for x,y in ink)+1
    if max(abs((x0+x1)/2-256),abs((y0+y1)/2-256))>10:raise AssertionError("Logo artwork not centered")
    return canvas,{"bbox":[x0,y0,x1,y1],"radius_px":round(radius,2),"gap_to_238px_circle":round(238-radius,2),"ink_pixels":len(ink)}
def main():
    html=HTML.read_text(encoding="utf8")
    if html.count('<article class="school">')!=10 or 'id="additional-1980s"' in html:
        raise AssertionError("Expected original-ten gallery baseline; refuse duplicate expansion")
    OUT.mkdir(parents=True,exist_ok=True)
    records=[];cards=[]
    for slug,name,era,kind,primary,secondary,path,archive in SCHOOLS:
        url=CDN+path
        original,raw=fetch(url)
        result,metrics=normalize(original)
        dest=OUT/(slug+".png")
        result.save(dest,format="PNG",optimize=True)
        sourcepage=ARCHIVE+archive
        records.append({"school":name,"used_in_1980s":True,"period":era,"logo_type":kind,
             "archive_page":sourcepage,"archival_image_url":url,
             "archival_png_sha256":hashlib.sha256(raw).hexdigest(),
             "local_file":str(dest.relative_to(ROOT)),
             "local_sha256":hashlib.sha256(dest.read_bytes()).hexdigest(),
             "geometry":metrics})
        cards.append('<article class="school"><span class="crest" style="--primary:'+primary+';--secondary:'+secondary+'">'+
             '<img src="assets/cbb-big-ten-1980s/centered/'+slug+'.png?v=20261114-bigten18a" alt="'+esc(name+" "+kind+" historical 1980s logo")+
             '" loading="eager" decoding="async"><span class="fallback-note">Image unavailable</span></span>'+
             '<strong>'+esc(name)+'</strong><div class="era">Archive era: '+era+'</div>'+
             '<div class="era"><a href="'+esc(sourcepage)+'" target="_blank" rel="noopener noreferrer">Historical source</a></div></article>')
        print("SOURCE OK:",name,original.size,metrics)
    block='<section id="additional-1980s" aria-labelledby="later-arrivals"><h2 id="later-arrivals">The eight later arrivals · their logos in the 1980s</h2>'+
          '<p class="intro">These eight universities joined the Big Ten after the 1980s. Their authentic logos were used during that decade; they are not presented as Big Ten members of that era. Each image is stored locally.</p>'+
          '<div class="gallery">'+"\n".join(cards)+'</div></section>\n'
    marker='<section aria-labelledby="scorebugs">'
    if html.count(marker)!=1:raise AssertionError("Preview changed, cannot insert collection")
    html=html.replace(marker,block+marker)
    html=html.replace('<h1>The Big Ten in the Eighties</h1>','<h1>Big Ten · Eighties Logo Archive</h1>')
    html=html.replace('The genuine historical logos of the ten universities competing in the Big Ten during the 1980s—framed in larger, bold, two-color rings. The same crests will be used by the men\'s and women\'s editions.',
        '1980s logos for all 18 current Big Ten schools: the original ten members and eight later arrivals, each displayed with bold double-color rings for your audit.')
    html=html.replace('Ten original-era emblems · Stored locally','18 historical emblems · Stored locally')
    html=html.replace('Original-era logo collection</h2>','Original ten Big Ten schools · their 1980s logos</h2>')
    if html.count('<article class="school">')!=18 or html.count('?v=20261114-bigten18a')!=8:
        raise AssertionError("Expected exactly 18 distinct gallery entries")
    if '--slt-ink-' in html or 'cbb-big-ten-optical-center' in html:raise AssertionError("CSS/JS offset regression")
    HTML.write_text(html,encoding='utf8')
    MANIFEST.parent.mkdir(parents=True,exist_ok=True)
    MANIFEST.write_text(json.dumps({"theme":"1980s","current_big_ten_count":18,
        "original_1980s_big_ten_members":10,"later_arrivals":records},indent=2)+'\n',encoding="utf8")
    print("PASS: 8 local historic PNGs, 18 school cards, eight credited original-era sources, no remote runtime images")
if __name__=="__main__":main()
