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
CSS='<link rel="stylesheet" href="shared-team-crests.css?v=20261026teamring1">'
JS='<script src="shared-team-crests.js?v=20261026teamring1" defer></script>'
TAG=CSS+JS
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
