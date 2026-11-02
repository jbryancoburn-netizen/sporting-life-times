#!/usr/bin/env python3
"""Recover NCAA DIII team logos by exact NCAA.com school-name matching only.

No fuzzy aliases or guessed team colors. Output is an NCAA-org-ID-keyed overlay.
"""
import json, re, urllib.request, unicodedata
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data'
URL='https://www.ncaa.com/json/schools'
def norm(v):
    v=unicodedata.normalize('NFKD',str(v or '')).encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+',' ',v).strip()

def collect(node):
    if isinstance(node,list):
        for x in node: yield from collect(x)
    elif isinstance(node,dict):
        if isinstance(node.get('slug'),str) and any(isinstance(node.get(k),str) for k in ('name','school','title','fullName','school_name','long_name')):
            yield node
        for v in node.values():
            if isinstance(v,(list,dict)):yield from collect(v)

def main():
    req=urllib.request.Request(URL,headers={'User-Agent':'Mozilla/5.0 (school identity verification)'})
    with urllib.request.urlopen(req,timeout=30) as resp: schools=json.load(resp)
    by_name={}
    for x in collect(schools):
        for k in ('name','school','title','fullName','school_name','long_name'):
            n=norm(x.get(k))
            slug=str(x.get('slug',''))
            if n and re.fullmatch(r'[a-z0-9-]+',slug):
                by_name.setdefault(n,set()).add(slug)
    if len(by_name)<100:
        raise ValueError('NCAA school list format changed; refusing unverified logo matching')
    teams={}
    for gender in ('men','women'):
        document=json.loads((DATA/f'd3-{gender}-2026-27.json').read_text())
        for t in document['teams']:
            if t.get('d3_confirmed') and isinstance(t.get('ncaa_org_id'),int):
                teams.setdefault(t['ncaa_org_id'],set()).add(t['name'])
    verified,ambiguous={},{}
    for org,names in teams.items():
        matches=set().union(*(by_name.get(norm(name),set()) for name in names))
        if len(matches)==1:
            verified[str(org)]={'slug':next(iter(matches)),'source':URL,'match':'exact_normalized_name'}
        elif len(matches)>1:ambiguous[str(org)]=sorted(matches)
    result={'source':URL,'matching':'exact_normalized_school_name_only','unique_programs':len(teams),
            'verified_logo_slugs':len(verified),'unmatched':len(teams)-len(verified),
            'ambiguous':ambiguous,'schools':verified}
    (DATA/'d3-verified-logo-slugs-2026-27.json').write_text(json.dumps(result,indent=2)+'\n')
    print('NCAA DIII logo slugs verified',len(verified),'of',len(teams),'distinct schools; ambiguous',len(ambiguous))

if __name__=='__main__':main()
