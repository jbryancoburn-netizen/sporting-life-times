#!/usr/bin/env python3
"""Self-host actual certified college basketball artwork for both genders.

Source downloads happen ONLY during the archive build, never in a browser.
Each school must retain its exact ESPN identity. Missing modern artwork is
not replaced with an unrelated letter-logo or a guessed school identity.
"""
import concurrent.futures, io, json, pathlib, re, threading, urllib.request
from PIL import Image
import cairosvg

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/"assets/cbb-school-logos"
OUT.mkdir(parents=True,exist_ok=True)
reg=json.loads((ROOT/"data/mbb-logo-registry.json").read_text())["teams"]
outside=json.loads((ROOT/"data/mbb-out-of-division-opponent-logos.json").read_text())["teams"]
assert len(reg)==365, "Missing certified 365-school registry"
assert len(outside)>500, "Missing non-D-I schedule opponent catalog"

def trustworthy(url):
    return bool(re.match(r"^https://(?:a\.espncdn\.com/i/teamlogos/ncaa/|www\.ncaa\.com/sites/default/files/images/logos/schools/)",url or "",re.I))
def get_one(code,row,primary):
    urls=[]
    for candidate in ([row.get("official_logo_url"),row.get("logo_url")] + list(row.get("provider_logo_candidates") or [])+[row.get("logo_alternate_url")]):
        if candidate and trustworthy(candidate) and candidate not in urls:urls.append(candidate)
    diagnostics=[]
    for url in urls[:5]:
        try:
            req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; SLT historical archive cache)","Accept":"image/png,image/svg+xml,image/webp,image/*;q=0.8"})
            with urllib.request.urlopen(req,timeout=19) as r:
                src=r.read(2_800_001)
                if len(src)>2_800_000:raise ValueError("oversize")
            if not src or len(src)<1000:raise ValueError("too-small-source")
            if b"<svg" in src[:2500]:
                png=cairosvg.svg2png(bytestring=src,output_width=600,output_height=600)
                img=Image.open(io.BytesIO(png))
            else:
                img=Image.open(io.BytesIO(src))
            img.load()
            if min(img.size)<64:raise ValueError("undersized-art")
            img=img.convert("RGBA")
            bbox=img.getchannel("A").point(lambda x:255 if x>10 else 0).getbbox()
            if not bbox:raise ValueError("fully-transparent")
            img=img.crop(bbox)
            factor=min(1,560/max(img.size))
            if factor<1:img=img.resize((round(img.width*factor),round(img.height*factor)),Image.Resampling.LANCZOS)
            side=max(img.size); padding=max(6,round(side*.055))
            canvas=Image.new("RGBA",(side+padding*2,side+padding*2),(255,255,255,0))
            canvas.alpha_composite(img,((canvas.width-img.width)//2,(canvas.height-img.height)//2))
            data=io.BytesIO();canvas.save(data,format="PNG",optimize=True)
            if len(data.getvalue())<700:raise ValueError("PNG implausibly small")
            dest=OUT/(str(code)+".png");dest.write_bytes(data.getvalue())
            return code,{"path":str(dest.relative_to(ROOT)),"bytes":len(data.getvalue()),"size":canvas.width,"school":row.get("school") or row.get("corrected_name") or row.get("feed_name") or "","source":url,"group":"Division I" if primary else "verified schedule opponent"},None
        except Exception as e:
            diagnostics.append(f"{type(e).__name__}: {str(e)[:60]}")
    return code,None,"; ".join(diagnostics[:4]) if diagnostics else "no verified art source"

work=[(str(id),row,True) for id,row in reg.items()]
work += [(str(id),row,False) for id,row in outside.items() if str(id) not in reg]
records={};missing={}
with concurrent.futures.ThreadPoolExecutor(max_workers=22) as pool:
    futures=[pool.submit(get_one,*args) for args in work]
    for i,completed in enumerate(concurrent.futures.as_completed(futures),1):
        id,data,err=completed.result()
        if data:records[id]=data
        else:missing[id]=err
        if i%100==0:print(f"CACHE {i}/{len(work)} complete, valid={len(records)}, unresolved={len(missing)}",flush=True)
coverage=sum(1 for code in reg if code in records)
manifest={"schema":"cbb-local-logos/v1","verified_count":len(records),"division_i_count":coverage,"division_i_required":365,"outside_count":sum(1 for c in records if c not in reg),"outside_total":len(outside),"teams":records,"unresolved":missing,"source_policy":"Source URLs are provenance only. All CBB artwork is referenced via local assets or a visible missing-logo marker at browser runtime."}
(ROOT/"data/cbb-local-logos.json").write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+"\n")
print("SUMMARY",json.dumps({"division_i":coverage,"expected":365,"outside":manifest["outside_count"],"outside_total":len(outside),"unresolved":len(missing),"first_unresolved":list(missing.items())[:12]}),flush=True)
if coverage!=365:raise SystemExit("FAIL CLOSED: missing Division I cached artwork")
print("PASS: all 365 verified Division I program logos cached locally. No external runtime image requests.")
