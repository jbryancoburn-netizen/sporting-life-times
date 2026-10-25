#!/usr/bin/env python3
"""Static site release audit. No dependencies, no fabricated data."""
from pathlib import Path
from html.parser import HTMLParser
import json, re, sys
ROOT=Path(__file__).resolve().parents[1]
class Refs(HTMLParser):
    def __init__(self): super().__init__(); self.assets=[]; self.links=[]; self.nested=[]; self.anchors=0
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='a':
            if self.anchors: self.nested.append(a.get('href',''))
            self.anchors+=1
        if tag=='script' and a.get('src'): self.assets.append(a['src'])
        if tag=='link' and a.get('rel')=='stylesheet' and a.get('href'): self.assets.append(a['href'])
        if tag=='a' and a.get('href'): self.links.append(a['href'])
    def handle_endtag(self,tag):
        if tag=='a' and self.anchors:self.anchors-=1
def check():
    issues=[]
    pages=sorted(ROOT.glob('*.html'))
    used_js=set()
    for path in pages:
        p=Refs()
        try:p.feed(path.read_text(encoding='utf8'))
        except Exception as e:issues.append(f'{path.name}: HTML parse error {e}')
        seen=set()
        for asset in p.assets:
            base=asset.split('?')[0].split('#')[0]
            if base.startswith(('http:','https:','//','data:')):continue
            if base in seen:issues.append(f'{path.name}: duplicate asset {base}')
            seen.add(base)
            local=(ROOT/base.lstrip('/'))
            if not local.exists():issues.append(f'{path.name}: missing {base}')
            if base.endswith('.js'):used_js.add(base)
        if p.nested:issues.append(f'{path.name}: nested anchors {p.nested[:3]}')
    for path in list(ROOT.glob('*.json'))+list((ROOT/'data').glob('*.json')):
        try:json.loads(path.read_text(encoding='utf8'))
        except Exception as e:issues.append(f'{path.relative_to(ROOT)}: invalid JSON {e}')
    print(f'Checked {len(pages)} HTML pages, {len(used_js)} referenced JS files and JSON files.')
    for x in issues:print('FAIL:',x)
    return 1 if issues else 0
if __name__=='__main__':sys.exit(check())
