#!/usr/bin/env python3
"""Bump every consumer of the SINGLE shared CBB crest renderer.

The source art, rings, and mascot optical fit are compiled into local PNGs.
No per-school CSS/JS positioning overrides or manually patched HTML pages.
"""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
TAG=re.compile(r'(mbb-logo-system\.(?:css|js)|wbb-rankings\.js)\?v=[A-Za-z0-9._-]+')
VERSION='cbb-precomposed-20261115-v1'
pages=updated=references=0
for path in ROOT.glob('*.html'):
    old=path.read_text(encoding='utf-8')
    if not TAG.search(old):continue
    pages+=1
    new,count=TAG.subn(lambda m:m.group(1)+'?v='+VERSION,old)
    references+=count
    if new!=old:
        path.write_text(new,encoding='utf-8')
        updated+=1
if pages<5 or references<8:
    raise SystemExit('Too few CBB logo clients detected; aborting cache update')
print('PASS CBB crest integration:',pages,'HTML pages,',references,'script/style references,',updated,'cache changes')
