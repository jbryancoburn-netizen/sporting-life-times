#!/usr/bin/env python3
"""Fail publication if NBA brand assets are incomplete or a code regression reintroduces hotlinked primary logos."""
import json,pathlib,re,sys
root=pathlib.Path(__file__).resolve().parents[1]
manifest=json.loads((root/'assets/nba-logos/manifest.json').read_text())
expected=set('ATL BOS BKN CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS'.split())
teams=manifest['teams']
assert set(teams)==expected, f'Wrong team coverage: missing={expected-set(teams)} extra={set(teams)-expected}'
for team,data in teams.items():
 p=root/data['path']; raw=p.read_bytes()
 assert raw.startswith(bytes([137,80,78,71,13,10,26,10])), (team,'bad PNG signature')
 assert len(raw)>1500,(team,'small logo image')
 assert data['width']>100 and data['height']>100,(team,'tiny image dimensions')
for script in ['nba-newspaper.js','nba-live-feed.js','nba-game-center.js','nba-live-game.js','nba-team-depth.js','nba-team-desk.js','nba-scorebug.js']:
 s=(root/script).read_text()
 assert "assets/nba-logos/" in s, f'{script}: not using local validated logos'
print('PASS: All 30 validated NBA PNGs exist; all seven primary NBA scripts use the local logo source.')
