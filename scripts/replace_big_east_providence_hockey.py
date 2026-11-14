#!/usr/bin/env python3
"""Replace mistaken 1973 hockey Friar in *review-only* Big East gallery with PC athletic logo.
Historical attribution is honest: this documented non-hockey athletics identity dates
to 1996–2002, not the 1980s. No other Big East assets or live site logos change.
"""
from pathlib import Path
from build_big_east_1980s_gallery import image_from_archive
from build_acc_1980s_gallery import retrieve,clean
import re,json,hashlib

ROOT=Path(__file__).resolve().parents[1]
ARCHIVE="https://www.sportslogos.net/logos/view/80890881982/Providence-Friars-Logo/1996/Primary-Logo"
DESCRIPTION="Interlocking PC athletics crest with FRIARS banner, NOT a hockey mascot"
NOTE="NON-HOCKEY replacement from 1996–2002 athletics identity. Not an authentic 1980s logo. The original 1980s Providence basketball crest remains unverified."
VERSION="20261114-pc-nonhockey-1996"
def main():
    file=ROOT/"data/cbb-big-east-1980s-source-manifest.json"
    m=json.loads(file.read_text(encoding="utf8"))
    assert len(m["schools"])==11 and m["production_deployment"] is False
    r=next(x for x in m["schools"] if x["slug"]=="providence")
    assert r["espn_id"]=="2507" and "hockey-specific" in r["description"]
    r["archive_url"]=ARCHIVE
    image_url=image_from_archive(r)
    im,raw=retrieve(image_url)
    art,geo=clean(im)
    assert geo["gap_to_238px_ring"]>=18
    target=ROOT/r["local_path"]
    art.save(target,"PNG",optimize=True)
    bytes_png=target.read_bytes()
    assert bytes_png[:8]==bytes.fromhex("89504e470d0a1a0a")
    assert int.from_bytes(bytes_png[16:20],"big")==512 and int.from_bytes(bytes_png[20:24],"big")==512
    r.update({"era":"1996–2002","start_year":"1996","description":DESCRIPTION,"context_note":NOTE,
       "image_url":image_url,"source_dimensions":list(im.size),"original_sha256":hashlib.sha256(raw).hexdigest(),
       "local_sha256":hashlib.sha256(bytes_png).hexdigest(),"geometry":geo,
       "selection_status":"hockey-art-rejected","selection_note":"Reader rejected hockey-specific Friar; this is a dated non-hockey fallback pending original 1980s basketball emblem"})
    file.write_text(json.dumps(m,indent=2,ensure_ascii=False)+"\n",encoding="utf8")
    gallery=ROOT/"cbb-big-east-1980s-preview.html"
    html=gallery.read_text(encoding="utf8")
    matches=[x for x in re.finditer(r'<article class="school">.*?</article>',html,re.S)
       if '<strong>Providence Friars</strong>' in x.group(0)]
    assert len(matches)==1
    card=matches[0].group()
    assert card.count("hockey-specific")>=2
    new=card.replace("providence.png?v=20261114-big-east11a","providence.png?v="+VERSION)
    new=re.sub(r'alt="[^"]+"', 'alt="Providence Friars interlocking PC athletics crest with FRIARS banner, 1996–2002"',new,count=1)
    new=new.replace('Era: 1973–2002','Era: 1996–2002 (not 1980s)')
    new=new.replace('Period-correct skating Friar illustration; hockey-specific mark',DESCRIPTION)
    new=re.sub(r'<div class="caution">.*?</div>','<div class="caution">'+NOTE+'</div>',new,count=1)
    new=re.sub(r'href="https://www\.sportslogos\.net/logos/view/80864481973/Providence-Friars-Logo/1973/Misc-Logo"', 'href="'+ARCHIVE+'"',new,count=1)
    html=html.replace(card,new,1)
    assert html.count('<article class="school">')==11
    assert 'skating Friar' not in html and "1973–2002" not in html
    html=html.replace("Providence shows a period-correct, hockey-specific mascot mark, not an alleged 1980s basketball crest; ",
     "Providence's hockey-specific mascot artwork has been rejected; the displayed interlocking PC athletics mark dates to 1996–2002, NOT the 1980s; ")
    gallery.write_text(html,encoding="utf8")
    gen=ROOT/"scripts/build_big_east_1980s_gallery.py"
    old=gen.read_text(encoding="utf8")
    start=old.index(' {"slug":"providence"')
    end=old.index('\n {"slug":"st-johns"',start)
    replacement=(' {"slug":"providence","name":"Providence Friars","espn_id":"2507","era":"1996–2002",'
    '"description":"'+DESCRIPTION+'","archive_url":"'+ARCHIVE+'","primary":"#111111",'
    '"secondary":"#999999","in_big_east_1980s":True,"context_note":"'+NOTE+'"},')
    updated=old[:start]+replacement+old[end:]
    gen.write_text(updated,encoding="utf8")
    test=ROOT/"tests/cbb-big-east-heritage-gallery.test.cjs"
    suite=test.read_text(encoding="utf8")
    suite=suite.replace('assert.match(bySlug.providence.context_note,/hockey-specific/);',
       "assert.match(bySlug.providence.context_note,/NON-HOCKEY/);\\n assert.equal(bySlug.providence.era,'1996–2002');")
    suite=suite.replace("assert.match(gallery,/hockey-specific/);",
       "assert.match(gallery,/NOT the 1980s/);\\n assert(!gallery.includes('skating Friar'));")
    test.write_text(suite,encoding="utf8")
    print("PASS: removed the hockey Friar. Providence now non-hockey athletics PC (1996–2002; clearly disclosed)",geo)

if __name__=="__main__":main()
