#!/usr/bin/env python3
"""Build SEC 1980s period-correct mascot-first logo audit from fixed, dated original image URLs.
No third-party image URLs at runtime; no source-image alterations or arbitrary cropping.
"""
from __future__ import annotations
from pathlib import Path
import hashlib,json,re
from build_acc_1980s_gallery import retrieve, clean, esc
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/"assets/cbb-sec-1980s"
PAGE=ROOT/"cbb-sec-1980s-preview.html"
MANIFEST=ROOT/"data/cbb-sec-1980s-source-manifest.json"
ROWS=json.loads(r'''[{"slug":"alabama","name":"Alabama Crimson Tide","espn_id":"333","era":"1983–2015","description":"Big Al elephant mascot","image_url":"https://content.sportslogos.net/logos/30/597/full/alabama_crimson_tide_logo_mascot_19831902.png","archive_url":"https://www.sportslogos.net/logos/view/59758370/Alabama-Crimson-Tide-Logo/1983/Mascot-Logo","primary":"#9e1b32","secondary":"#8a8d8f","in_sec_1980s":true},{"slug":"arkansas","name":"Arkansas Razorbacks","espn_id":"8","era":"1967–2001","description":"Charging Razorback","image_url":"https://content.sportslogos.net/logos/30/606/full/arkansas_razorbacks_logo_primary_19677366.png","archive_url":"https://www.sportslogos.net/logos/view/60653121967/Arkansas-Razorbacks-Logo/1967/Primary-Logo","primary":"#9d2235","secondary":"#111111","in_sec_1980s":false},{"slug":"auburn","name":"Auburn Tigers","espn_id":"2","era":"1983–1997","description":"Leaping tiger","image_url":"https://content.sportslogos.net/logos/30/610/full/7316.png","archive_url":"https://www.sportslogos.net/logos/view/7316/Auburn_Tigers/1982/Alternate_Logo","primary":"#002b5c","secondary":"#f26522","in_sec_1980s":true},{"slug":"florida","name":"Florida Gators","espn_id":"57","era":"1980–1994","description":"Classic Albert the Gator","image_url":"https://content.sportslogos.net/logos/31/675/full/r7e2q09sw3hdlvfbetu3.png","archive_url":"https://www.sportslogos.net/logos/view/r7e2q09sw3hdlvfbetu3/Florida-Gators-Logo/1980/Secondary-Logo","primary":"#0021a5","secondary":"#fa4616","in_sec_1980s":true},{"slug":"georgia","name":"Georgia Bulldogs","espn_id":"61","era":"1964–2015","description":"Standing bulldog in Georgia jersey","image_url":"https://content.sportslogos.net/logos/31/687/full/1845_georgia_bulldogs-alternate-1964.png","archive_url":"https://www.sportslogos.net/logos/view/68718451964/Georgia_Bulldogs/1964/Alternate_Logo","primary":"#ba0c2f","secondary":"#2c2a29","in_sec_1980s":true},{"slug":"kentucky","name":"Kentucky Wildcats","espn_id":"96","era":"1986–2005","description":"Classic snarling Wildcat","image_url":"https://content.sportslogos.net/logos/32/721/full/kentucky_wildcats_logo_secondary_19865086.png","archive_url":"https://www.sportslogos.net/logos/view/72168612016/Kentucky-Wildcats-Logo/1986/Secondary-Logo","primary":"#0033a0","secondary":"#111111","in_sec_1980s":true},{"slug":"lsu","name":"LSU Tigers","espn_id":"99","era":"1980–1989","description":"Roaring tiger with slanted LSU lettering","image_url":"https://content.sportslogos.net/logos/32/723/full/6891_lsu_tigers-primary-1980.png","archive_url":"https://www.sportslogos.net/logos/view/72368911980/LSU-Tigers-Logo/1980/Alternate-Logo","primary":"#461d76","secondary":"#fdd023","in_sec_1980s":true},{"slug":"mississippi-state","name":"Mississippi State Bulldogs","espn_id":"344","era":"1986–2009","description":"Walking Bully mascot","image_url":"https://content.sportslogos.net/logos/32/755/full/mississippi_state_bulldogs_logo_alternate_19866498.png","archive_url":"https://www.sportslogos.net/logos/view/75584641986/Mississippi-State-Bulldogs-Logo/1986/Alternate-Logo","primary":"#5d1725","secondary":"#c1c6c8","in_sec_1980s":true},{"slug":"missouri","name":"Missouri Tigers","espn_id":"142","era":"1980–1995","description":"Leaping tiger above MIZZOU","image_url":"https://content.sportslogos.net/logos/32/757/full/missouri_tigers_logo_primary_1980_sportslogosnet-4904.png","archive_url":"https://www.sportslogos.net/logos/view/75749041980/Missouri-Tigers-Logo/1980/Primary-Logo","primary":"#f1b82d","secondary":"#111111","in_sec_1980s":false},{"slug":"oklahoma","name":"Oklahoma Sooners","espn_id":"201","era":"1950–present","description":"Historic Sooner Schooner","image_url":"https://content.sportslogos.net/logos/33/793/full/oklahoma_sooners_logo_secondary_19505999.png","archive_url":"https://www.sportslogos.net/logos/view/3vhmepbam91u95whfpo8/Oklahoma-Sooners-Logo/1950/Secondary-Logo","primary":"#990000","secondary":"#8a8d8f","in_sec_1980s":false},{"slug":"ole-miss","name":"Ole Miss Rebels","espn_id":"145","era":"1983–2002","description":"1983 Ole Miss script wordmark","image_url":"https://content.sportslogos.net/logos/32/754/full/mississippi_rebels_logo_wordmark_1983_sportslogosnet-2189.png","archive_url":"https://www.sportslogos.net/logos/view/75421891983/Mississippi-Rebels-Logo/1983/Wordmark-Logo","primary":"#ce1126","secondary":"#14213d","in_sec_1980s":true},{"slug":"south-carolina","name":"South Carolina Gamecocks","espn_id":"2579","era":"1975–1983","description":"Gamecock inside black C","image_url":"https://content.sportslogos.net/logos/34/834/full/south_carolina_gamecocks_logo_alternate_1975_sportslogosnet-2442.png","archive_url":"https://www.sportslogos.net/logos/view/83424421975/South-Carolina-Gamecocks-Logo/1975/Alternate-Logo","primary":"#73000a","secondary":"#111111","in_sec_1980s":false},{"slug":"tennessee","name":"Tennessee Volunteers","espn_id":"2633","era":"1980–2005","description":"Historic Smokey hound mascot","image_url":"https://content.sportslogos.net/logos/34/861/full/tennessee_volunteers_logo_secondary_19805100.png","archive_url":"https://www.sportslogos.net/logos/view/86136691983/Tennessee-Volunteers-Logo/1980/Secondary-Logo","primary":"#ff8200","secondary":"#2c2a29","in_sec_1980s":true},{"slug":"texas","name":"Texas Longhorns","espn_id":"251","era":"1977–2000","description":"Cowboy-hatted Bevo","image_url":"https://content.sportslogos.net/logos/34/865/full/lmlfr6dq6nw9z6ughm66.png","archive_url":"https://www.sportslogos.net/logo.php?id=lmlfr6dq6nw9z6ughm66","primary":"#bf5700","secondary":"#4d3424","in_sec_1980s":false},{"slug":"texas-am","name":"Texas A&M Aggies","espn_id":"245","era":"1981–2000","description":"Vintage maroon ATM monogram","image_url":"https://content.sportslogos.net/logos/34/866/full/9tk2kr8wodbh951x7cug.png","archive_url":"https://www.sportslogos.net/logos/view/9tk2kr8wodbh951x7cug/Texas-AM-Aggies-Logo/1981/Primary-Logo","primary":"#500000","secondary":"#8a8d8f","in_sec_1980s":false},{"slug":"vanderbilt","name":"Vanderbilt Commodores","espn_id":"238","era":"1984–1991","description":"Vintage V-star speed emblem","image_url":"https://content.sportslogos.net/logos/35/895/full/vanderbilt-commodores-logo-primary-1984-2169.png","archive_url":"https://www.sportslogos.net/logos/view/nqtks26xgrg53xqnt5zh/Vanderbilt-Commodores-Logo/1984/Primary-Logo","primary":"#cfae70","secondary":"#111111","in_sec_1980s":true}]''')
assert len(ROWS)==16 and len({r["espn_id"] for r in ROWS})==16
assert sum(r["in_sec_1980s"] for r in ROWS)==10
def card(r):
 src='assets/cbb-sec-1980s/'+r['slug']+'.png?v=20261114-sec16a'
 return ('<article class="school"><span class="crest" style="--primary:'+r['primary']+';--secondary:'+r['secondary']+'">'
   '<img src="'+src+'" alt="'+esc(r['name']+' '+r['description'])+'" loading="lazy" decoding="async">'
   '<span class="fallback-note">Archive image unavailable</span></span>'
   '<strong>'+esc(r['name'])+'</strong><div class="era">Archive era: '+esc(r['era'])+'</div>'
   '<div class="kind">'+esc(r['description'])+'</div>'
   '<div class="era"><a href="'+esc(r['archive_url'])+'" target="_blank" rel="noopener noreferrer">Historical source</a></div></article>')
def main():
 if PAGE.exists():raise RuntimeError("SEC archive gallery already exists: refuse overwrite")
 acc=(ROOT/'cbb-acc-1980s-preview.html').read_text(encoding='utf8')
 style=re.search(r'<style>.*?</style>',acc,re.S)
 if not style:raise AssertionError("Shared ACC gallery stylesheet missing")
 OUT.mkdir(parents=True,exist_ok=True)
 records=[]
 for row in ROWS:
  if not row['image_url'].startswith('https://content.sportslogos.net/logos/'):raise AssertionError('Untrusted source: '+row['slug'])
  original,raw=retrieve(row['image_url'])
  normalized,geometry=clean(original)
  file=OUT/(row['slug']+'.png')
  normalized.save(file,format='PNG',optimize=True)
  if geometry['gap_to_238px_ring']<18:raise AssertionError('Ring collision: '+row['slug'])
  records.append({**row,'source_dimensions':list(original.size),
    'original_sha256':hashlib.sha256(raw).hexdigest(),
    'local_path':'assets/cbb-sec-1980s/'+row['slug']+'.png',
    'local_sha256':hashlib.sha256(file.read_bytes()).hexdigest(),
    'geometry':geometry})
  print('VERIFIED',row['slug'],original.size,geometry,flush=True)
 original=[r for r in records if r['in_sec_1980s']]
 later=[r for r in records if not r['in_sec_1980s']]
 html='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sporting Life &amp; Times · SEC 1980s Logo Audit</title>
<meta name="description" content="16 historical 1980s college athletic emblems for all current SEC teams, with sourced archival marks.">
'''+style.group(0)+'''</head><body><main class="wrap">
<header class="masthead"><div class="eyebrow">Sporting Life &amp; Times · Collegiate Basketball</div>
<h1>SEC · Eighties Logo Archive</h1><p>Original-era emblems for all 16 current SEC schools. Animals and characters are preferred to generic monograms whenever a period mascot is verified.</p>
<div class="tag">16 archival emblems · Stored locally · For visual approval</div></header>
<p class="intro">This is an archive review, not a deployment of SEC logos to men's or women's scorebugs. Every image has been sourced from a dated historical logo archive, converted to 512-pixel local PNG and optically centered inside the same two school-color rings as the Big Ten and ACC.</p>
<section aria-labelledby="founders"><h2 id="founders">Ten SEC schools of the 1980s</h2>
<div class="gallery">'''+chr(10).join(card(r) for r in original)+'''</div></section>
<section aria-labelledby="later"><h2 id="later">Six later SEC arrivals · their own 1980s logos</h2>
<p class="intro">Arkansas and South Carolina joined in 1992; Missouri and Texas A&amp;M in 2012; Oklahoma and Texas in 2024. Their logos are from the 1980s, not from the date of SEC membership.</p>
<div class="gallery">'''+chr(10).join(card(r) for r in later)+'''</div></section>
<section class="notes"><strong>Historic sourcing:</strong> Every card links to its actual dated archive entry, not a modern team logo. Some marks entered service before 1980 but remained in use during the decade. Mascots are preferred when verifiable; the 1983 Ole Miss script is presented as a period wordmark. This gallery does not alter production scorebugs, data or publishing. Source files are local and never hotlinked at runtime.</section>
</main><script>document.querySelectorAll(".crest img").forEach(img=>img.addEventListener("error",()=>img.closest(".crest")?.classList.add("missing"),{once:true}));</script></body></html>'''
 if html.count('<article class="school">')!=16:raise AssertionError('SEC card coverage')
 if html.count('assets/cbb-sec-1980s/')!=16:raise AssertionError('SEC local image count')
 PAGE.write_text(html,encoding='utf8')
 MANIFEST.parent.mkdir(exist_ok=True)
 MANIFEST.write_text(json.dumps({'source':'Dated SportsLogos historical archive image originals','conference':'SEC','era':'1980s','current_member_count':16,'historical_sec_members_among_current':10,'later_arrivals':6,'production_deployment':False,'schools':records},indent=2)+'\n',encoding='utf8')
if __name__=='__main__':main()
