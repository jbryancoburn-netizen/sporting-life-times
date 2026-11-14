#!/usr/bin/env python3
"""Prioritize the verified 1985 Buzz mascot over Georgia Tech's GT monogram."""
from pathlib import Path
from PIL import Image
import hashlib,json
from build_acc_1980s_gallery import ROOT,OUT,HTML,MANIFEST,retrieve,clean
SOURCE="https://content.sportslogos.net/logos/31/690/full/georgia-tech-yellow-jackets-alternate-logo-1985-1163.png"
ARCHIVE="https://www.sportslogos.net/logos/view/2491/Georgia-Tech-Yellow-Jackets-Logo/1985/Alternate-Logo"
OLD_DESC="Vintage interlocking GT; no verified 1980s Buzz mark"
NEW_DESC="1985 Buzz yellowjacket mascot with GT"
OLD_ERA="1967–2015"
NEW_ERA="1985–1999"
def once(source,old,new,amount=1):
    if source.count(old)!=amount:raise AssertionError("Unexpected target count: "+old[:80])
    return source.replace(old,new)
def main():
    raw_img,raw=retrieve(SOURCE)
    out,geom=clean(raw_img)
    dest=OUT/"georgia-tech.png"
    original=dest.read_bytes()
    if not dest.is_file():raise AssertionError("ACC gallery must exist first")
    manifest=json.loads(MANIFEST.read_text())
    rows=manifest["schools"]
    match=[x for x in rows if x["slug"]=="georgia-tech"]
    if len(match)!=1 or match[0]["description"]!=OLD_DESC:
        raise AssertionError("Georgia Tech manifest has changed; don't replace unreviewed asset")
    row=match[0]
    assert row["local_sha256"]==hashlib.sha256(original).hexdigest()
    row.update({"description":NEW_DESC,"era":NEW_ERA,"start_year":"1985",
      "image_url":SOURCE,"archive_url":ARCHIVE,"source_dimensions":list(raw_img.size),
      "original_sha256":hashlib.sha256(raw).hexdigest(),"geometry":geom})
    text=HTML.read_text()
    text=once(text,OLD_DESC,NEW_DESC)
    text=once(text,f"Archive era: {OLD_ERA}</div><div class=\"kind\">{NEW_DESC}",
                   f"Archive era: {NEW_ERA}</div><div class=\"kind\">{NEW_DESC}")
    text=once(text,'https://www.sportslogos.net/logos/view/2493/Georgia-Tech-Yellow-Jackets-Logo/1967/Primary-Logo',ARCHIVE)
    # Bust the very first cache key for the corrected source PNG only.
    text=once(text,'assets/cbb-acc-1980s/georgia-tech.png?v=20261114-acc18a',
                  'assets/cbb-acc-1980s/georgia-tech.png?v=20261114-acc-buzz85')
    if text.count('<article class="school">')!=18:raise AssertionError("18 gallery entries no longer intact")
    if geom["gap_to_238px_ring"]<18:raise AssertionError("Real Buzz mascot crowds rings")
    out.save(dest,format="PNG",optimize=True)
    row["local_sha256"]=hashlib.sha256(dest.read_bytes()).hexdigest()
    MANIFEST.write_text(json.dumps(manifest,indent=2)+"\n")
    HTML.write_text(text)
    print("PASS: documented 1985 Buzz and GT, original artwork intact, local 512px PNG, 18 logos unchanged")
    print(json.dumps(row,indent=2))
if __name__=="__main__":main()
