#!/usr/bin/env python3
"""Create normalized, transparent pro-basketball badges from existing local team art.

Only transparent or border-connected near-white background pixels are removed.
Enclosed white lettering and details are preserved. No team colors are altered.
These are artwork-only PNGs; the newspaper CSS draws the two team-color rings.
"""
from __future__ import annotations
import json
from collections import deque
from pathlib import Path

try:
    from PIL import Image
except ImportError as err:
    raise SystemExit("Pillow is required: python3 -m pip install pillow") from err

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets"
DEST = SOURCE / "pro-basketball-logos"
EXPECTED = {"euroleague": 20, "nbl": 10}
TARGET = 256


def edge_matte(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    width, height = image.size
    pixels = image.load()
    # If transparency exists, honor the original shape rather than applying
    # a white-background heuristic to intentionally pale team artwork.
    if image.getextrema()[3][0] < 245:
        return image
    def white_neutral(x: int, y: int) -> bool:
        red, green, blue, alpha = pixels[x, y]
        return alpha >= 235 and min(red, green, blue) >= 237 and max(red, green, blue) - min(red, green, blue) <= 16
    visited = bytearray(width * height)
    work = deque()
    for x in range(width):
        for y in (0, height - 1):
            index = y * width + x
            if not visited[index] and white_neutral(x, y):
                visited[index] = 1
                work.append((x, y))
    for y in range(height):
        for x in (0, width - 1):
            index = y * width + x
            if not visited[index] and white_neutral(x, y):
                visited[index] = 1
                work.append((x, y))
    while work:
        x, y = work.popleft()
        red, green, blue, alpha = pixels[x, y]
        pixels[x, y] = (red, green, blue, 0)
        for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= next_x < width and 0 <= next_y < height:
                index = next_y * width + next_x
                if not visited[index] and white_neutral(next_x, next_y):
                    visited[index] = 1
                    work.append((next_x, next_y))
    return image


def normalize(source: Path, target: Path) -> dict:
    with Image.open(source) as original:
        raw = original.convert("RGBA")
    artwork = edge_matte(raw)
    bound = artwork.getchannel("A").point(lambda alpha: 255 if alpha > 20 else 0).getbbox()
    if not bound:
        raise ValueError(f"Logo has no visible artwork: {source}")
    piece = artwork.crop(bound)
    max_side = max(piece.size)
    available = round(TARGET * 0.91)
    piece.thumbnail((available, available), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (TARGET, TARGET), (0, 0, 0, 0))
    canvas.alpha_composite(piece, ((TARGET - piece.width) // 2, (TARGET - piece.height) // 2))
    target.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(target, format="PNG", optimize=True)
    return {"name": source.name, "src_size": list(raw.size), "bounds": list(bound), "output": list(piece.size),
            "alpha_corner": canvas.getpixel((0, 0))[3]}


def main() -> None:
    results = {}
    for name, count in EXPECTED.items():
        source = SOURCE / ("euroleague-logos" if name == "euroleague" else "nbl-logos")
        originals = sorted(source.glob("*.png"))
        if len(originals) != count:
            raise ValueError(f"Expected {count} {name} logos; found {len(originals)}")
        results[name] = [normalize(path, DEST / name / path.name) for path in originals]
        for row in results[name]:
            if row["alpha_corner"] != 0:
                raise ValueError("Outer logo corner must be transparent: " + row["name"])
        print(f"Normalized {len(results[name])} {name} club marks")
    manifest = DEST / "manifest.json"
    manifest.write_text(json.dumps({"schema": "pro-basketball-transparent-artwork-v1",
                                    "method": "edge-connected white matte removal, bounding-box centering",
                                    "teams": results}, indent=2) + "\n", encoding="utf-8")
    print("Saved", manifest)


if __name__ == "__main__":
    main()
