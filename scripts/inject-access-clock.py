#!/usr/bin/env python3
"""Insert the shared reader access timestamp into all root newspaper pages at build time."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
tag='<script src="site-access-clock.js?v=1" defer></script>'
count=0
for file in sorted(root.glob("*.html")):
    html=file.read_text(encoding="utf-8")
    if 'site-access-clock.js' in html:
        continue
    if not re.search(r'</body\s*>', html, re.I):
        continue
    html=re.sub(r'</body\s*>', lambda m:tag+m.group(), html, count=1, flags=re.I)
    file.write_text(html,encoding="utf-8")
    count+=1
assert count or any('site-access-clock.js' in p.read_text(encoding="utf-8") for p in root.glob('*.html'))
print(f"Reader access clock inserted into {count} newspaper pages")
