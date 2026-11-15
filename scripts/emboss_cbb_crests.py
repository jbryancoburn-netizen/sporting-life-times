#!/usr/bin/env python3
"""Apply one reproducible raised-ink finish to the approved two-ring masters.

The flat PNGs remain untouched. All shading follows their existing contours;
there is no redraw, new ornament, cropping, or additional ring.
"""
from pathlib import Path
from hashlib import sha256
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import distance_transform_edt, gaussian_filter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/cbb-precomposed-crests'
OUTPUT = ROOT / 'assets/cbb-embossed-crests'
VERSION = '20261115-retro1'


def raised_height(mask, depth, bevel=6):
    """Round the shoulder inward, retaining the source silhouette exactly."""
    distance = np.clip(distance_transform_edt(mask) / bevel, 0, 1)
    shoulder = distance * distance * (3 - 2 * distance)
    return gaussian_filter(shoulder * depth, sigma=1.1)


def emboss(original):
    source = np.asarray(original.convert('RGBA'))
    if source.shape != (512, 512, 4):
        raise ValueError('Expected a verified 512px crest master')
    rgb = source[:, :, :3].astype(np.float32)
    visible = source[:, :, 3] > 0
    # Use the exact same ellipse geometry as the flat crest compiler.
    outer = Image.new('L', (512, 512)); pen = ImageDraw.Draw(outer)
    pen.ellipse((1, 1, 510, 510), fill=255)
    pen.ellipse((22, 22, 489, 489), fill=0)
    inner = Image.new('L', (512, 512)); pen = ImageDraw.Draw(inner)
    pen.ellipse((22, 22, 489, 489), fill=255)
    pen.ellipse((45, 45, 466, 466), fill=0)
    field = Image.new('L', (512, 512))
    ImageDraw.Draw(field).ellipse((45, 45, 466, 466), fill=255)
    artwork = (np.max(np.abs(rgb - [255, 250, 239]), axis=2) > 32) & (np.asarray(field) > 0) & visible
    rings = (np.asarray(outer) > 0) | (np.asarray(inner) > 0)
    height = raised_height(artwork, 10.5)
    height += raised_height(np.asarray(outer) > 0, 9)
    height += raised_height(np.asarray(inner) > 0, 10.5)
    dy, dx = np.gradient(height)
    normal = np.sqrt(dx * dx + dy * dy + 1)
    # Upper-left light; flat pigment interiors retain their school colors.
    illumination = np.clip((.52 * dx + .52 * dy + .68) / normal / .68, .38, 1.55)
    shaded = rgb * illumination[:, :, None]
    highlight = np.clip(illumination - 1, 0, .55)[:, :, None]
    shaded += (255 - rgb) * highlight * .55
    # A tightly confined lower-right contact shadow makes the relief legible
    # in 64–92px scorebug/ranking badges, without a floating outside shadow.
    raised = artwork | rings
    shadow = Image.new('L', (512, 512))
    shadow.paste(Image.fromarray(np.uint8(raised) * 255), (5, 7))
    shadow = np.asarray(shadow.filter(ImageFilter.GaussianBlur(2.2)), dtype=np.float32) / 255
    shadow *= ~raised
    shaded *= (1 - .40 * shadow[:, :, None])
    result = source.copy()
    result[:, :, :3] = np.uint8(np.clip(shaded, 0, 255))
    result[~visible] = source[~visible]
    return Image.fromarray(result)


def main():
    audit = json.loads((ROOT / 'data/cbb-precomposed-crest-audit.json').read_text())
    OUTPUT.mkdir(parents=True, exist_ok=True)
    entries = {}
    for team_id in sorted(audit['crests'], key=int):
        master = SOURCE / (team_id + '.png')
        with Image.open(master) as original:
            output = emboss(original)
            if output.getchannel('A').tobytes() != original.convert('RGBA').getchannel('A').tobytes():
                raise ValueError('Crest silhouette changed: ' + team_id)
        destination = OUTPUT / master.name
        output.save(destination, 'PNG', optimize=True)
        entries[team_id] = {
            'master_sha256': sha256(master.read_bytes()).hexdigest(),
            'embossed_sha256': sha256(destination.read_bytes()).hexdigest(),
        }
    if len(entries) != 365:
        raise ValueError('Incomplete embossed crest library')
    report = {'version': VERSION, 'count': len(entries), 'canvas': 512, 'rings': 2,
              'original_masters_unchanged': True, 'alpha_unchanged': True, 'crests': entries}
    (ROOT / 'data/cbb-embossed-crest-audit.json').write_text(json.dumps(report, indent=2) + '\n')
    print('PASS: 365 embossed crests; original artwork masters, dimensions and alpha preserved; two rings')


if __name__ == '__main__':
    main()
