#!/usr/bin/env python3
"""Activate 16 verified SEC heritage crests, and the reader-approved Pitt 1980s mascot.
This one-time release makes no changes to game, RETRO or ingestion code.
"""
from pathlib import Path
import sys,json,re,hashlib
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_acc_1980s_gallery import retrieve,clean

ROOT=Path(__file__).resolve().parents[1]
PITT_URL="https://content.sportslogos.net/logos/33/803/full/pittsburgh_panthers_logo_alternate_1980_sportslogosnet-6579.png"
PITT_ARCHIVE="https://www.sportslogos.net/logos/view/80365791980/Pittsburgh-Panthers-Logo/1980/Alternate-Logo"
PITT_DESC="Standing gold panther wearing P sweater over block PITT"
PITT_VERSION="20261114-pitt-standing-1980-approved1"
JS_VERSION="cbb-heritage-sec16-pitt-20261114b"
SEC_VERSION="20261114-sec16-live1"

def file(p):return ROOT/p
def read(p):return file(p).read_text(encoding="utf8")
def write(p,s):file(p).write_text(s,encoding="utf8")
def replace_once(src,old,new,label):
    n=src.count(old)
    assert n==1,f"{label}: expected one exact anchor, found {n}"
    return src.replace(old,new,1)

def main():
    image,raw=retrieve(PITT_URL)
    art,geometry=clean(image)
    assert geometry["gap_to_238px_ring"]>=18,"Selected standing panther too close to rings"
    asset=file("assets/cbb-acc-1980s/pittsburgh.png")
    art.save(asset,"PNG",optimize=True)
    binary=asset.read_bytes()
    assert binary[:8]==bytes.fromhex("89504e470d0a1a0a")
    assert int.from_bytes(binary[16:20],"big")==512 and int.from_bytes(binary[20:24],"big")==512

    accfile="data/cbb-acc-1980s-source-manifest.json"
    acc=json.loads(read(accfile))
    assert len(acc["schools"])==18
    pitt=next(s for s in acc["schools"] if s["slug"]=="pittsburgh")
    assert pitt["espn_id"]=="221" and pitt["era"]=="1974–1987"
    pitt.update({"era":"1980–1989","description":PITT_DESC,"start_year":"1980",
                 "image_url":PITT_URL,"archive_url":PITT_ARCHIVE,
                 "source_dimensions":list(image.size),
                 "original_sha256":hashlib.sha256(raw).hexdigest(),
                 "local_sha256":hashlib.sha256(binary).hexdigest(),
                 "geometry":geometry,"selection_status":"reader-approved",
                 "selection_note":"Standing panther wearing P sweater atop block PITT (Option 1)"})
    acc["production_deployment"]=True
    write(accfile,json.dumps(acc,ensure_ascii=False,indent=2)+"\n")

    page="cbb-acc-1980s-preview.html"
    html=read(page)
    cards=[m for m in re.finditer(r'<article class="school">.*?</article>',html,re.S)
          if "<strong>Pittsburgh Panthers</strong>" in m.group()]
    assert len(cards)==1
    old=cards[0].group()
    oldmark=re.search(r'style="(--primary:[^"]+)"',old)
    assert oldmark
    new=('<article class="school"><span class="crest" style="'+oldmark.group(1)+'">'
     '<img src="assets/cbb-acc-1980s/pittsburgh.png?v='+PITT_VERSION+'" '
     'alt="Pittsburgh Panthers standing gold panther in P sweater atop PITT" loading="eager" decoding="async">'
     '<span class="fallback-note">Archive image unavailable</span></span>'
     '<strong>Pittsburgh Panthers</strong><div class="era">Archive era: 1980–1989</div>'
     '<div class="kind">'+PITT_DESC+'</div>'
     '<div class="era"><a href="'+PITT_ARCHIVE+'" target="_blank" rel="noopener noreferrer">Historical source</a></div>'
     '<div class="era">Reader selected: Option 1</div></article>')
    html=replace_once(html,old,new,"Pitt ACC gallery")
    assert 'published historical ACC logo designs' in html,'ACC production banner was not previously released'
    assert 'now used across men’s and women’s college basketball' in html,'ACC page production note is missing'
    assert html.count('<article class="school">')==18
    write(page,html)

    generator="scripts/build_acc_1980s_gallery.py"
    source=read(generator)
    oldfields='"era":"1974–1987","description":"Pitt script with prowling panther","start_year":"1974","image_url":"https://content.sportslogos.net/logos/33/803/full/pittsburgh_panthers_logo_primary_dark_1974_sportslogosnet-8916.png","archive_url":"https://www.sportslogos.net/logos/view/80389161974/Pittsburgh-Panthers-Logo/1974/Primary-Dark-Logo"'
    newfields='"era":"1980–1989","description":"'+PITT_DESC+'","start_year":"1980","image_url":"'+PITT_URL+'","archive_url":"'+PITT_ARCHIVE+'"'
    write(generator,replace_once(source,oldfields,newfields,"Reproducible ACC archive builder"))

    secfile="data/cbb-sec-1980s-source-manifest.json"
    sec=json.loads(read(secfile))
    rows=sec["schools"]
    assert len(rows)==16 and len({r["espn_id"] for r in rows})==16
    assert next(r for r in rows if r["slug"]=="alabama")["selection_status"]=="reader-approved"
    for r in rows:
        assert file(r["local_path"]).exists()
        assert r["geometry"]["gap_to_238px_ring"]>=18
        assert hashlib.sha256(file(r["local_path"]).read_bytes()).hexdigest()==r["local_sha256"]
    sec["production_deployment"]=True
    write(secfile,json.dumps(sec,indent=2,ensure_ascii=False)+"\n")
    secpage="cbb-sec-1980s-preview.html"
    html=read(secpage)
    html=replace_once(html,"not yet the production logo set","the current shared men's and women's production logo set","SEC review banner")
    html=replace_once(html,"This page remains a review gallery; men's and women's production logos will not change until the collection is approved.","These 16 local crests now appear in the shared men's and women's production renderer. Historical selections can still be improved based on reader review.","SEC notes")
    write(secpage,html)

    jsfile="mbb-logo-system.js"
    js=read(jsfile)
    pittOld="'221':'assets/cbb-acc-1980s/pittsburgh.png?v=20261114-acc18-live1'"
    pittNew="'221':'assets/cbb-acc-1980s/pittsburgh.png?v="+PITT_VERSION+"'"
    js=replace_once(js,pittOld,pittNew,"Pitt production mapping")
    secmap="const SEC_HERITAGE=Object.freeze({\n"+",\n".join(
      " '"+r["espn_id"]+"':'"+r["local_path"]+"?v="+SEC_VERSION+"'" for r in rows)+"\n});\n"
    oldfunc="const retroURLForESPN=id=>BIG_TEN_HERITAGE[String(id)]||ACC_HERITAGE[String(id)]||'';"
    newfunc=secmap+"const retroURLForESPN=id=>BIG_TEN_HERITAGE[String(id)]||ACC_HERITAGE[String(id)]||SEC_HERITAGE[String(id)]||'';"
    js=replace_once(js,oldfunc,newfunc,"SEC renderer mapping")
    js=replace_once(js,"heritageACCTeamIds:()=>Object.keys(ACC_HERITAGE),","heritageACCTeamIds:()=>Object.keys(ACC_HERITAGE),heritageSECTeamIds:()=>Object.keys(SEC_HERITAGE),","SEC introspection")
    write(jsfile,js)

    # Publish refreshed shared JS to ALL reader templates referencing the prior build.
    pages=[]
    for path in ROOT.glob("*.html"):
       body=path.read_text(encoding="utf8")
       if "mbb-logo-system.js?v=acc18-production-20261114a" in body:
           body=body.replace("mbb-logo-system.js?v=acc18-production-20261114a","mbb-logo-system.js?v="+JS_VERSION)
           path.write_text(body,encoding="utf8")
           pages.append(path.name)
    assert len(pages)>=14,("Shared CBB reader templates dropped: ",pages)

    # Existing test contracts must describe current deployment, not old audit-only posture.
    for f,conference in [("tests/cbb-sec-heritage-gallery.test.cjs","SEC"),("tests/cbb-acc-heritage-gallery.test.cjs","ACC")]:
        test=read(f)
        test=replace_once(test,"assert.equal(manifest.production_deployment,false);","assert.equal(manifest.production_deployment,true);",conference+" state")
        if conference=='SEC': test=replace_once(test,"not yet the production logo set","the current shared men's and women's production logo set","SEC gallery")
        else: test=replace_once(test,"not yet the production logo set","published historical ACC logo designs","ACC gallery")
        if conference=="SEC":test=test.replace("does not change production renderer","publishes selected production crests")
        write(f,test)
    t="tests/cbb-acc-heritage-production.test.cjs"
    suite=read(t)
    suite=replace_once(suite,"url=s.local_path+'?v=20261114-acc18-live1';","url=s.local_path+'?v='+(id==='221'?'"+PITT_VERSION+"':'20261114-acc18-live1');","Pitt renderer acceptance URL")
    suite=replace_once(suite,"mbb-logo-system.js?v=acc18-production-20261114a","mbb-logo-system.js?v="+JS_VERSION,"CBB page cache acceptance")
    write(t,suite)

    # Audit the same whole-network renderer for all 365 men and matched women's IDs.
    script="scripts/audit-mbb-logo-system.cjs"
    a=read(script)
    before=" const anyVintage=id=>!!(vintage[id]||vintageACC[id]);"
    secmap_test=" const vintageSEC="+json.dumps({r["espn_id"]:r["slug"] for r in rows},indent=2)+";\n"
    after=secmap_test+" assert.equal(Object.keys(vintageSEC).length,16,'SEC archive needs all 16 schools');\n const anyVintage=id=>!!(vintage[id]||vintageACC[id]||vintageSEC[id]);"
    a=replace_once(a,before,after,"Whole-network SEC audit")
    old="vintageACC[id]?'assets/cbb-acc-1980s/'+vintageACC[id]+'.png?v=20261114-acc18-live1':item.logo_url;"
    new=("vintageACC[id]?'assets/cbb-acc-1980s/'+vintageACC[id]+'.png?v='+(id==='221'?'"+PITT_VERSION+"':'20261114-acc18-live1'):\n"
         "   vintageSEC[id]?'assets/cbb-sec-1980s/'+vintageSEC[id]+'.png?v="+SEC_VERSION+"':item.logo_url;")
    a=replace_once(a,old,new,"Whole-network expected SEC and Pitt URL")
    write(script,a)
    print("SUCCESS: Pitt Option 1 historical PNG and provenance",geometry,
          "; 16 SEC local logos in men's and women's shared renderer; CBB reader pages",len(pages),pages)

if __name__=="__main__":main()
