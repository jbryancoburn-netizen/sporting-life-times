#!/usr/bin/env python3
"""Build *review-only* 11 current Big East schools' genuine 1980s archival crest gallery.

Historic team marks are retrieved once from dated archives and normalized to
self-hosted 512px PNGs, optically centered inside the existing school-color rings.
No runtime third-party images. Never change published men's/women's logos prior
to the user's visual selection.
"""
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import urlparse
from html import unescape,escape
import hashlib,json,re,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_acc_1980s_gallery import retrieve,clean,HEADERS
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"assets/cbb-big-east-1980s"
GALLERY=ROOT/"cbb-big-east-1980s-preview.html"
MANIFEST=ROOT/"data/cbb-big-east-1980s-source-manifest.json"
ROWS=[
 {"slug":"butler","name":"Butler Bulldogs","espn_id":"2086","era":"1970–1985","description":"Smiling bulldog in BULLDOGS sweater leaning on block B","archive_url":"https://www.sportslogos.net/logos/view/62577531969/Butler-Bulldogs-Logo/1970/Secondary-Logo","image_url":"https://content.sportslogos.net/logos/30/625/full/butler_bulldogs_logo_secondary_1969_sportslogosnet-7753.png","primary":"#13294b","secondary":"#a3a7aa","in_big_east_1980s":False},
 {"slug":"uconn","name":"UConn Huskies","espn_id":"41","era":"1981–2002","description":"Jonathan Husky in Connecticut/Huskies roundel","archive_url":"https://www.sportslogos.net/logos/view/88496581982/UConn-Huskies-Logo/1981/Primary-Logo","primary":"#000e2f","secondary":"#b6bdc4","in_big_east_1980s":True},
 {"slug":"creighton","name":"Creighton Bluejays","espn_id":"156","era":"1972–1994","description":"Billy Bluejay wearing C sweater","archive_url":"https://www.sportslogos.net/logos/view/7501/Creighton-Bluejays-Logo/1972/Primary-Logo","primary":"#005ca9","secondary":"#f3b837","in_big_east_1980s":False},
 {"slug":"depaul","name":"DePaul Blue Demons","espn_id":"305","era":"1975–1999","description":"Billy Blue Demon mascot, red and blue","archive_url":"https://www.sportslogos.net/logos/view/aip0jtchrk9ft2sgsc1g/DePaul-Blue-Demons-Logo/1975/Alternate-Logo","image_url":"https://content.sportslogos.net/logos/31/656/full/depaul_blue_demons_logo_alternate_19796726.png","primary":"#00529b","secondary":"#e31837","in_big_east_1980s":False},
 {"slug":"georgetown","name":"Georgetown Hoyas","espn_id":"46","era":"1985–1995","description":"Jack the Bulldog snarling in cap with G","archive_url":"https://www.sportslogos.net/logos/view/2485/Georgetown-Hoyas-Logo/1985/Primary-Logo","image_url":"https://content.sportslogos.net/logos/31/686/full/2485.png","primary":"#041e42","secondary":"#888b8d","in_big_east_1980s":True},
 {"slug":"marquette","name":"Marquette Golden Eagles","espn_id":"269","era":"1971–1994","description":"Historical Marquette Warriors-era head emblem (retired mark)","archive_url":"https://www.sportslogos.net/logos/view/znf7zqotu9aqfavmmr9s/Marquette-Golden-Eagles-Logo/1971/Primary-Logo","primary":"#003366","secondary":"#ffcc00","in_big_east_1980s":False,"context_note":"Historical Warriors-era Native American-themed artwork, retired; displayed as an attributed historical record, not current identity"},
 {"slug":"providence","name":"Providence Friars","espn_id":"2507","era":"1973–2002","description":"Period-correct skating Friar illustration; hockey-specific mark","archive_url":"https://www.sportslogos.net/logos/view/80864481973/Providence-Friars-Logo/1973/Misc-Logo","image_url":"https://content.sportslogos.net/logos/33/808/full/providence_friars_logo_misc_1973_sportslogosnet-6448.png","primary":"#111111","secondary":"#999999","in_big_east_1980s":True,"context_note":"Only period-authenticated Friar graphic located in the archive; hockey-specific, NOT claimed as 1980s basketball crest. Reader should review."},
 {"slug":"st-johns","name":"St. John's Red Storm","espn_id":"2599","era":"1980–1991","description":"Authentic 1980s St. John's red script wordmark","archive_url":"https://www.sportslogos.net/logos/view/zkthhqlhahs6qwosubu6/St-Johns-Red-Storm-Logo/1980/Wordmark-Logo","primary":"#c8102e","secondary":"#002d72","in_big_east_1980s":True,"context_note":"1980s wordmark selected for review instead of backdating current Storm character branding"},
 {"slug":"seton-hall","name":"Seton Hall Pirates","espn_id":"2550","era":"1982–1998","description":"Old pirate head with eye patch, tricorn and knife","archive_url":"https://www.sportslogos.net/logos/view/7110/Seton-Hall-Pirates-Logo/1982/Primary-Logo","image_url":"https://content.sportslogos.net/logos/34/831/full/seton_hall_pirates_logo_primary_19828655.png","primary":"#004488","secondary":"#b2b6bb","in_big_east_1980s":True},
 {"slug":"villanova","name":"Villanova Wildcats","espn_id":"222","era":"1958–1994","description":"Mid-century Villanova varsity emblem used through 1980s","archive_url":"https://www.sportslogos.net/logos/view/89710361968/Villanova-Wildcats-Logo/1958/Primary-Logo","primary":"#002664","secondary":"#70adcf","in_big_east_1980s":True},
 {"slug":"xavier","name":"Xavier Musketeers","espn_id":"2752","era":"1983–1996","description":"1983 running Musketeer with hat and cape","archive_url":"https://www.sportslogos.net/logos/view/91936301983/Xavier-Musketeers-Logo/1983/Primary-Logo","primary":"#0c2340","secondary":"#a0a0a0","in_big_east_1980s":False}
]

def image_from_archive(row):
    link=row["archive_url"]
    headers={**HEADERS,"Referer":"https://www.sportslogos.net/"}
    try:
        with urlopen(Request(link,headers=headers),timeout=35) as reply: raw=reply.read(3_000_000).decode("utf8","replace")
    except Exception as e:
        alt=link.replace("www.sportslogos.net","sportslogos.net")
        with urlopen(Request(alt,headers=headers),timeout=35) as reply:raw=reply.read(3_000_000).decode("utf8","replace")
    candidates=[]
    for tags in re.findall(r'<meta[^>]+>',raw,re.I):
        if re.search(r'(?:og:image|twitter:image)',tags,re.I):
           m=re.search(r'\bcontent\s*=\s*["\x27]([^"\x27]+)',tags,re.I)
           if m:candidates.append(unescape(m.group(1)))
    candidates+=re.findall(r'https?://content\.sportslogos\.net/logos/\d+/\d+/full/[^\s"<>\\]+',raw)
    # Archive logo pages can include recommendations and sidebars: require
    # that URL names the exact school/team archive folder.
    selected=[]
    teamcodes={"butler":"625","uconn":"884","creighton":"652","depaul":"656","georgetown":"686",
               "marquette":"760","providence":"808","st-johns":"845","seton-hall":"831",
               "villanova":"897","xavier":"919"}
    code=teamcodes[row["slug"]]
    for x in candidates:
        x=unescape(x).replace("\\/","/").split("#",1)[0].split("?",1)[0]
        if re.match(r'^https://content\.sportslogos\.net/logos/\d+/'+code+r'/full/[^" ]+\.(?:png|gif|jpg|webp)$',x,re.I):
            selected.append(x)
    assert selected,("No source archive illustration found",row["slug"],link)
    # og:image is first, and represents exactly the historical logo page.
    return selected[0]

def card(r):
    img='assets/cbb-big-east-1980s/'+r["slug"]+'.png?v=20261114-big-east11a'
    return ('<article class="school"><span class="crest" style="--primary:'+r["primary"]+';--secondary:'+r["secondary"]+'">'
      '<img src="'+img+'" alt="'+escape(r["name"]+" "+r["description"],quote=True)+'" loading="eager" decoding="async">'
      '<span class="fallback-note">Image unavailable</span></span>'
      '<strong>'+escape(r["name"])+'</strong><div class="era">Era: '+escape(r["era"])+'</div>'
      '<div class="kind">'+escape(r["description"])+'</div>'
      + ('<div class="caution">'+escape(r["context_note"])+'</div>' if r.get("context_note") else '')
      + '<div class="era"><a href="'+escape(r["archive_url"],quote=True)+'" target="_blank" rel="noopener noreferrer">Historical source</a></div></article>')

def main():
    if GALLERY.exists():raise AssertionError("Big East gallery already exists; do not overwrite original")
    OUT.mkdir(parents=True,exist_ok=True)
    acc=json.loads((ROOT/"data/ncaam-2026-27-espn-team-crosswalk.json").read_text())
    women=json.loads((ROOT/"data/ncaaw-2026-27-teams.json").read_text())
    ids={str(t["espn_id"]) for t in acc["teams"]}
    woman_ids={str(t["team_id"]) for t in women["teams"]}
    assert len(ROWS)==11 and len({r["espn_id"] for r in ROWS})==11
    assert all(r["espn_id"] in ids and r["espn_id"] in woman_ids for r in ROWS)
    assert sum(bool(r["in_big_east_1980s"]) for r in ROWS)==6
    done=[]
    for row in ROWS:
       url=row.get("image_url") or image_from_archive(row)
       im,bytes_in=retrieve(url)
       output,geometry=clean(im)
       assert geometry["gap_to_238px_ring"]>=18,("Ring collision",row["slug"])
       target=OUT/(row["slug"]+".png")
       output.save(target,"PNG",optimize=True)
       b=target.read_bytes()
       assert b[:8]==bytes.fromhex("89504e470d0a1a0a") and int.from_bytes(b[16:20],"big")==512
       done.append({**row,"image_url":url,"source_dimensions":list(im.size),
         "original_sha256":hashlib.sha256(bytes_in).hexdigest(),"local_path":"assets/cbb-big-east-1980s/"+row["slug"]+".png",
         "local_sha256":hashlib.sha256(b).hexdigest(),"geometry":geometry})
       print("CERTIFIED",row["slug"],url,geometry,flush=True)
    style=(ROOT/"cbb-acc-1980s-preview.html").read_text().split("<style>",1)[1].split("</style>",1)[0]
    style+="\n.caution{border-top:1px solid #b39b79;padding-top:5px;font:11px/1.45 Arial,sans-serif;color:#71441b;margin:8px 0}\n"
    member="\n".join(card(r) for r in done if r["in_big_east_1980s"])
    newcomers="\n".join(card(r) for r in done if not r["in_big_east_1980s"])
    html=('<!doctype html><html lang="en"><head><meta charset="utf-8">'
      '<meta name="viewport" content="width=device-width,initial-scale=1">'
      '<title>Sporting Life &amp; Times · Big East 1980s Logo Review</title>'
      '<meta name="description" content="11 period-authentic Big East school logos for editorial review, with local artwork and dated sources.">'
      '<style>'+style+'</style></head><body><main class="wrap">'
      '<header class="masthead"><div class="eyebrow">Sporting Life &amp; Times · Collegiate Basketball</div>'
      '<h1>Big East · Eighties Logo Archive</h1>'
      '<p>Eleven current universities, their authentic 1980s-era emblem choices and archival provenance.</p>'
      '<div class="tag">11 authentic marks · local assets · visual review</div></header>'
      '<p class="intro">This is an <strong>editorial review gallery, not a production logo release.</strong> '
      'The six members that played in the Big East during the 1980s appear first. '
      'The other five use emblems from their universities in that decade, not claims of historical conference membership.</p>'
      '<section><h2>1980s Big East schools · six current members</h2><div class="gallery">'+member+'</div></section>'
      '<section><h2>Later conference arrivals · five schools</h2><div class="gallery">'+newcomers+'</div></section>'
      '<section class="notes"><strong>Archival review notes.</strong> Providence shows a period-correct, hockey-specific mascot mark, not an alleged 1980s basketball crest; Marquette represents a since-retired Warriors-era design. '
      'These are preserved as attributed historical records for evaluation. No men's or women's production logo will change before your review.</section>'
      '</main><script>document.querySelectorAll(".crest img").forEach(img=>img.addEventListener("error",()=>img.closest(".crest")?.classList.add("missing"),{once:true}));</script></body></html>')
    assert html.count('<article class="school">')==11
    assert html.count('assets/cbb-big-east-1980s/')==11
    assert 'content.sportslogos.net' not in html
    GALLERY.write_text(html,encoding="utf8")
    MANIFEST.write_text(json.dumps({"source":"SportsLogos.Net dated historical school logo archive; verified historical marks",
      "conference":"Big East","era":"1980s","current_member_count":11,"historical_big_east_members_among_current":6,
      "later_arrivals":5,"production_deployment":False,"schools":done},indent=2,ensure_ascii=False)+"\n",encoding="utf8")
    print("PASS: Big East 11 local logos review-only; 6 historical conference participants and 5 later arrivals")

if __name__=="__main__":main()
