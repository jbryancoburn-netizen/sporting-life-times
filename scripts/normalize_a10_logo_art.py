#!/usr/bin/env python3
"""Normalize only verified local source assets; never change school identities or rings."""
from pathlib import Path
from PIL import Image
import json

targets = [
  Path("assets/cbb-atlantic-10-1980s/rhode-island.png"),
  Path("assets/cbb-atlantic-10-1980s/loyola-chicago.png"),
]
for path in targets:
    original = Image.open(path).convert("RGBA")
    alpha = original.getchannel("A")
    # Ignore nearly invisible anti-aliased edge pixels.
    mask = alpha.point(lambda v: 255 if v > 8 else 0)
    bounds = mask.getbbox()
    if bounds is None:
        raise ValueError(f"Logo is empty: {path}")
    cropped = original.crop(bounds)
    width, height = cropped.size
    longest = max(width, height)
    if not 50 <= longest <= 1024:
        raise ValueError(f"Unusual original crest bounds: {path}: {bounds}")
    scale = 400 / longest
    resized = cropped.resize((round(width*scale),round(height*scale)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (512,512), (0,0,0,0))
    canvas.alpha_composite(resized, ((512-resized.width)//2,(512-resized.height)//2))
    canvas.save(path, format="PNG", optimize=True)
    result=Image.open(path).convert("RGBA")
    bbox=result.getchannel("A").point(lambda v:255 if v>8 else 0).getbbox()
    assert result.size==(512,512) and max(bbox[2]-bbox[0],bbox[3]-bbox[1])==400
    print(json.dumps({"path":str(path),"original_size":original.size,"source_bbox":bounds,"normalized_size":result.size,"normalized_bbox":bbox}))
