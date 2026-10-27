#!/usr/bin/env python3
"""NBA logo contract: fail publication if an extra ring/wrapper is reintroduced."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
js=(ROOT/'shared-team-crests.js').read_text()
inject=(ROOT/'scripts/inject-team-crests.py').read_text()
assert "if(/^nba(?:[-.]|$)/i.test(location.pathname.split('/').pop()||''))return;" in js, 'NBA exclusion missing from global crest wrapper'
assert 'if re.match(r"nba(?:[-.]|$)", path.name, re.IGNORECASE):' in inject, 'NBA exclusion missing from injection'
pages=['nba.html','nba-rankings.html','nba-standings.html','nba-conference.html','nba-playoffs.html']
for page in pages:
 html=(ROOT/page).read_text()
 assert 'nba-logo-layout-final.css' in html, f'{page} missing one-ring stylesheet'
 assert 'shared-team-crests.js' not in html and 'shared-team-crests.css' not in html, f'{page} has competing logo wrapper'
assets=ROOT/'assets/nba-logos'
expected=set('ATL BOS BKN CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS'.split())
assert {p.stem for p in assets.glob('*.png')}==expected, 'Local NBA team logos incomplete'
core=(ROOT/'nba-newspaper.js').read_text()
assert "const logo=c=>'assets/nba-logos/'" in core, 'Local NBA logo source replaced'
css=(ROOT/'nba-logo-layout-final.css').read_text()
assert 'border:3px solid var(--nba-club-color)' in css, 'Brand-colored single ring removed'
print('PASS: NBA logo contract locked: 30 local marks, 5 pages, no shared wrapper, one-ring CSS.')
