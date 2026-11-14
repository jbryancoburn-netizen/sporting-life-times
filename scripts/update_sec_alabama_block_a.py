#!/usr/bin/env python3
"""Apply reader-selected 1973–1998 Alabama elephant-through-block-A historical logo.
Edits only Alabama's local SEC audit PNG, its dated source provenance and gallery;
never changes production logos, team stats, RETRO, or other SEC artworks.
"""
from pathlib import Path
from build_sec_1980s_gallery import retrieve, clean
import hashlib, json, re

ROOT=Path(__file__).resolve().parents[1]
ASSET=ROOT/"assets/cbb-sec-1980s/alabama.png"
MANIFEST=ROOT/"data/cbb-sec-1980s-source-manifest.json"
GALLERY=ROOT/"cbb-sec-1980s-preview.html"
GENERATOR=ROOT/"scripts/build_sec_1980s_gallery.py"
IMAGE="https://content.sportslogos.net/logos/30/597/full/alabama_crimson_tide_logo_primary_19737434.png"
ARCHIVE="https://www.sportslogos.net/logos/view/7285/Alabama-Crimson-Tide-Logo/1973/Primary-Logo"
DESCRIPTION="Crimson block A with gray elephant and CRIMSON TIDE ribbon"
ERA="1973–1998"
VERSION="20261114-alabama-block-a-1973"

def main():
    manifest=json.loads(MANIFEST.read_text(encoding="utf8"))
    schools=manifest["schools"]
    assert len(schools)==16
    record=next(r for r in schools if r["slug"]=="alabama")
    assert record["espn_id"]=="333" and record["start_year"]=="1983"
    img, raw=retrieve(IMAGE)
    out, geometry=clean(img)
    assert geometry["gap_to_238px_ring"]>=18, "Elephant artwork collides with rings"
    out.save(ASSET,format="PNG",optimize=True)
    png=ASSET.read_bytes()
    assert png[:8]==bytes.fromhex("89504e470d0a1a0a")
    assert int.from_bytes(png[16:20],"big")==512 and int.from_bytes(png[20:24],"big")==512
    record.update({
      "era":ERA,"description":DESCRIPTION,"start_year":"1973",
      "image_url":IMAGE,"archive_url":ARCHIVE,
      "source_dimensions":list(img.size),
      "original_sha256":hashlib.sha256(raw).hexdigest(),
      "local_sha256":hashlib.sha256(png).hexdigest(),
      "geometry":geometry,
      "selection_status":"reader-approved",
      "selection_note":"Approved historic elephant-through-block-A with ribbon, not separate Big Al mascot"
    })
    MANIFEST.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+"\n",encoding="utf8")

    gallery=GALLERY.read_text(encoding="utf8")
    pattern=r'<article class="school">.*?</article>'
    match=re.search(pattern,gallery,re.S)
    assert match and "Alabama Crimson Tide" in match.group(0)
    old=match.group(0)
    crest=re.search(r'style="(--primary:[^"]+)"',old)
    assert crest,"Preserve original two-color ring"
    card=('<article class="school"><span class="crest" style="'+crest.group(1)+'">'
      '<img src="assets/cbb-sec-1980s/alabama.png?v='+VERSION+'" '
      'alt="Alabama Crimson Tide crimson block A with gray elephant and CRIMSON TIDE ribbon" loading="eager" decoding="async">'
      '<span class="fallback-note">Archive image unavailable</span></span>'
      '<strong>Alabama Crimson Tide</strong><div class="era">Archive era: '+ERA+'</div>'
      '<div class="kind">'+DESCRIPTION+'</div><div class="era">'
      '<a href="'+ARCHIVE+'" target="_blank" rel="noopener noreferrer">Historical source</a></div>'
      '<div class="era">Selected for production</div></article>')
    updated=gallery.replace(old,card,1)
    assert updated.count('<article class="school">')==16
    assert updated.count('assets/cbb-sec-1980s/')==16
    assert 'alabama.png?v='+VERSION in updated
    GALLERY.write_text(updated,encoding="utf8")

    generator=GENERATOR.read_text(encoding="utf8")
    old_fields='"era":"1983–2015","description":"Classic Big Al elephant mascot","start_year":"1983","image_url":"https://content.sportslogos.net/logos/30/597/full/alabama_crimson_tide_logo_mascot_19831902.png","archive_url":"https://www.sportslogos.net/logos/view/59758370/Alabama-Crimson-Tide-Logo/1983/Mascot-Logo"'
    new_fields='"era":"'+ERA+'","description":"'+DESCRIPTION+'","start_year":"1973","image_url":"'+IMAGE+'","archive_url":"'+ARCHIVE+'"'
    assert generator.count(old_fields)==1,"Reproducible SEC source list no longer matches original"
    GENERATOR.write_text(generator.replace(old_fields,new_fields,1),encoding="utf8")
    print("Updated user-approved 1973–1998 Alabama Block-A elephant",geometry,"image SHA",hashlib.sha256(png).hexdigest())

if __name__=="__main__": main()
