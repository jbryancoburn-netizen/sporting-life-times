#!/usr/bin/env python3
"""Fetch & certify genuine historical NBA emblems as local PNG assets.

Read the verified-era source registry. Refuse to publish if a single historic
mark is inaccessible or fails raster validation. Do not substitute initials.
"""
import io, json, pathlib, re, urllib.request
from PIL import Image
import cairosvg

ROOT = pathlib.Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "data/nba-vintage-logos.json"
OUT = ROOT / "assets/nba-vintage-logos"
OUT.mkdir(parents=True, exist_ok=True)
catalog = json.loads(REGISTRY.read_text())
teams = catalog["teams"]
assert len(teams)==30, "Historical registry must have exactly 30 NBA teams"

def fetch_image(url):
    req=urllib.request.Request(url,headers={
       "User-Agent":"Mozilla/5.0 (compatible; SportingLifeTimes/1.0; historical NBA image validator)",
       "Accept":"image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5",
       "Referer":"https://logocdn.com/",
    })
    with urllib.request.urlopen(req,timeout=22) as response:
       body=response.read(8_000_001)
       mime=response.headers.get("Content-Type","")
       if len(body)>8_000_000:raise ValueError("Logo exceeds maximum source size")
       if len(body)<500:raise ValueError("Logo source unexpectedly small")
       if body.startswith(b"\x89PNG\r\n\x1a\n") or body[:2] in (b"RI", b"\xff\xd8"):
           img=Image.open(io.BytesIO(body));img.load();return img.convert("RGBA"),mime
       if b"<svg" in body[:3500]:
           png=cairosvg.svg2png(bytestring=body,output_width=900,output_height=900)
           img=Image.open(io.BytesIO(png));img.load();return img.convert("RGBA"),mime
       try:
           img=Image.open(io.BytesIO(body));img.load();return img.convert("RGBA"),mime
       except Exception as e:
           raise ValueError("Not a decodable image") from e

results={};errors=[]
for code,mark in sorted(teams.items()):
    url=mark["archive_source_url"]
    if not url.startswith("https://assets.logocdn.com/images/sports/nba/"):
       errors.append(code+": untrusted source host");continue
    candidates=[url,url.replace("https://assets.logocdn.com/images/sports/nba/","https://i.logocdn.com/nba/")]
    for source in candidates:
        try:
            image,mime=fetch_image(source)
            alpha=image.getchannel("A")
            box=alpha.point(lambda a:255 if a>12 else 0).getbbox()
            if not box:raise ValueError("No visible logo")
            image=image.crop(box)
            w,h=image.size
            if min(w,h)<90:raise ValueError("Image resolution too small")
            # Preserve the entire original mark with transparent padding.
            side=max(w,h)
            scale=min(1,760/side)
            if scale<1:image=image.resize((max(1,round(w*scale)),max(1,round(h*scale))),Image.Resampling.LANCZOS)
            side=max(image.size)
            pad=round(side*.06)
            canvas=Image.new("RGBA",(side+2*pad,side+2*pad),(0,0,0,0))
            canvas.alpha_composite(image,((canvas.width-image.width)//2,(canvas.height-image.height)//2))
            dest=OUT / (code+".png")
            buf=io.BytesIO();canvas.save(buf,format="PNG",optimize=True)
            if len(buf.getvalue())<1400:raise ValueError("Implausibly small raster")
            dest.write_bytes(buf.getvalue())
            results[code]={"source":source,"width":canvas.width,"height":canvas.height,"size_bytes":dest.stat().st_size,"era":mark["era"],"path":str(dest.relative_to(ROOT))}
            print(f"PASS {code}: {mark['era']} -> {dest.relative_to(ROOT)} ({dest.stat().st_size} bytes)")
            break
        except Exception as e:
            print(f"RETRY {code} {source}: {e}",flush=True)
    else:
        errors.append(code+": archival artwork could not be retrieved and validated")
if errors or len(results)!=30:
    raise SystemExit("FAIL vintage logo audit: "+"; ".join(errors))
(ROOT/"data/nba-vintage-logo-audit.json").write_text(json.dumps({"validated":30,"status":"PASS","teams":results},indent=2)+"\n")
print("PASS: ALL 30 genuine historical NBA images downloaded, validated and cached locally.")
