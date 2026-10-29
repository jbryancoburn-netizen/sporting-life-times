#!/usr/bin/env python3
"""Install the shared NCAA-soccer-inspired team crest treatment on every published HTML page.

Run in the Pages artifact build rather than editing hundreds of individual desks:
- Covers existing and future sports pages, no page-specific copy/paste.
- Idempotent, keeps metadata/navigation and any pre-existing scripts unchanged.
- Also supplies an explicit --check mode for release verification.
"""
from pathlib import Path
import re
import sys

ROOT=Path(__file__).resolve().parents[1]
CSS='<link rel="stylesheet" href="shared-team-crests.css?v=20261026cfb4">'
JS='<script src="shared-team-crests.js?v=20261027nbaexclusion14" defer></script>'
TAG=CSS+JS
FAVICON='<script src="site-tab-icons.js?v=20261028allpapers1" defer></script>'
assert (ROOT/'site-tab-icons.js').is_file(), 'Universal browser tab icon controller missing'
CHECK='--check' in sys.argv
assert (ROOT/"shared-team-crests.css").is_file(), "Team crest stylesheet missing"
assert (ROOT/"shared-team-crests.js").is_file(), "Team crest runtime missing"
files=sorted(ROOT.glob("*.html"))
eligible=0
changed=0
missing=[]
for path in files:
    source=path.read_text(encoding="utf-8")
    if not re.search(r"</head\s*>",source,re.IGNORECASE):
        continue
    eligible+=1
    if 'site-tab-icons.js' not in source:
        if CHECK:
            missing.append(path.name + ' missing contextual browser icon')
        else:
            source=re.sub(r'</head\s*>',lambda match:FAVICON+match.group(),source,count=1,flags=re.I)
            path.write_text(source,encoding='utf-8')
            changed+=1
    # Both NBA and men's D-I basketball own their complete crest components.
    # Installing the generic global IMG wrapper here stacks extra circular borders.
    if re.match(r"nba(?:[-.]|$)|ncaam(?:[-.]|$)|college-basketball\\.html$", path.name, re.IGNORECASE):
        if CHECK and ("shared-team-crests.css" in source or "shared-team-crests.js" in source):
            missing.append(path.name + " must not load shared-team-crests")
        elif not CHECK:
            clean=re.sub(r'<link\\b[^>]+href="shared-team-crests\\.css[^"]*"[^>]*>',"",source,flags=re.I)
            clean=re.sub(r'<script\\b[^>]+src="shared-team-crests\\.js[^"]*"[^>]*>\\s*</script>',"",clean,flags=re.I)
            if clean!=source:
                path.write_text(clean,encoding="utf-8")
                changed+=1
        continue
    if "shared-team-crests.css" in source and "shared-team-crests.js" in source:
        continue
    if CHECK:
        missing.append(path.name)
        continue
    # Replace an existing partial tag, rather than accidentally duplicating it.
    source=re.sub(r'<link\b[^>]+href="shared-team-crests\.css[^"]*"[^>]*>',"",source,flags=re.I)
    source=re.sub(r'<script\b[^>]+src="shared-team-crests\.js[^"]*"[^>]*>\s*</script>',"",source,flags=re.I)
    source=re.sub(r"</head\s*>",lambda match:TAG+match.group(),source,count=1,flags=re.I)
    path.write_text(source,encoding="utf-8")
    changed+=1
assert eligible>=130, f"Unexpectedly low newspaper HTML coverage: {eligible}"
assert not missing, "Sports pages missing the shared team-crest system: "+", ".join(missing)
print(f"Team crest system: {eligible} HTML pages checked, {changed} newly instrumented")
