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
    rating_path=ROOT/'data'/'epl-ratings.json'
    if rating_path.exists():
        try:
            d=json.loads(rating_path.read_text(encoding='utf8'))
            standings=d.get('standings',[])
            history=d.get('elo_history',{})
            ratings=d.get('ratings',{})
            if len(standings)!=20 or len({x.get('club') for x in standings})!=20:
                issues.append('EPL: standings must contain 20 unique clubs')
            if len(history)!=20:
                issues.append(f'EPL: expected 20 club Elo histories, found {len(history)}')
            appearances=0
            fixture_teams={}
            for row in standings:
                club=row['club']; games=int(row.get('played',0))
                if int(row.get('won',0))+int(row.get('drawn',0))+int(row.get('lost',0))!=games:
                    issues.append(f'EPL: W-D-L mismatch for {club}')
                points=3*int(row.get('won',0))+int(row.get('drawn',0))
                if int(row.get('points',-1))!=points:
                    issues.append(f'EPL: points mismatch for {club}')
                hist=history.get(club,[])
                if len(hist)!=games+1:
                    issues.append(f'EPL: Elo history length mismatch for {club}')
                if hist and club in ratings and abs(float(hist[-1]['elo'])-float(ratings[club]))>.001:
                    issues.append(f'EPL: latest Elo mismatch for {club}')
                for entry in hist[1:]:
                    fixture=str(entry.get('fixture_id',''))
                    if not fixture:
                        issues.append(f'EPL: missing fixture id for {club}')
                    else:
                        fixture_teams.setdefault(fixture,[]).append(club)
                    appearances+=1
            if appearances!=2*int(d.get('completed_matches',-1)):
                issues.append('EPL: replay history appearances differ from completed finals')
            for fixture,teams in fixture_teams.items():
                if len(teams)!=2 or teams[0]==teams[1]:
                    issues.append(f'EPL: fixture {fixture} incorrectly appears for {teams}')
            season=d.get('season_results')
            if season is not None:
                fixture_ids=[str(x.get('fixture_id')) for x in season]
                if len(season)!=int(d.get('completed_matches',-1)) or len(set(fixture_ids))!=len(fixture_ids):
                    issues.append('EPL: season archive total or fixture IDs inconsistent')
        except Exception as e:
            issues.append(f'EPL: unable to audit ratings: {e}')
    print(f'Checked {len(pages)} HTML pages, {len(used_js)} referenced JS files and JSON files.')
    for x in issues:print('FAIL:',x)
    return 1 if issues else 0
if __name__=='__main__':sys.exit(check())
