#!/usr/bin/env python3
"""Publish the archive attribution and exact eras supplied by the source catalog."""
from pathlib import Path
from html import escape
import json
import re

ROOT = Path(__file__).resolve().parents[1]
catalog = json.loads((ROOT / 'data/cbb-retro-archive.json').read_text())
rows = []
normalize = lambda s: re.sub('[^a-z0-9]', '', s.lower())
for school in sorted(catalog['schools'], key=lambda r: r['school'].lower()):
    name = escape(school['school'])
    archival_name = school.get('archival_name')
    if archival_name and normalize(archival_name) != normalize(school['display_name']):
        name += '<br><small>Published as ' + escape(archival_name) + '</small>'
    era = str(school['start']) + '–' + str(school['end'] or 'Present')
    source = escape(school.get('source_name', 'Sports Logo History'))
    url = escape(school['page_url'], quote=True)
    rows.append('<tr><th scope="row">' + name + '</th><td>' + era +
                '</td><td><a href="' + url + '">' + source + '</a></td></tr>')
page = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Historical Logo Credits | Sporting Life &amp; Times</title><style>body{margin:0;background:#f3e9d5;color:#30251d;font:16px/1.5 Georgia,serif}main{max-width:900px;margin:auto;padding:24px 16px}h1{border-block:4px double #735d43;padding:12px 0;font-size:clamp(28px,5vw,44px)}a{color:#713d2b}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px;border-bottom:1px solid #c4ae8f}thead th{font-size:13px;text-transform:uppercase}caption{text-align:left;margin:18px 0}small{font-weight:normal}footer{margin:20px 0}@media(max-width:500px){th,td{padding:7px 4px;font-size:13px}}</style></head><body><main><a href="ncaam-rankings.html?poll=retro">← The National Rankings</a><h1>Historical Logo Credits</h1><p>Our school crests feature authentic historical artwork within the familiar double rings. The catalog below credits ARCHIVE_COUNT archived marks sourced from <a href="https://sportslogohistory.com/">Sports Logo History</a> and <a href="https://www.sportslogos.net/">SportsLogos.Net</a>.</p><p>School names identify today’s programs; dates describe when each selected design was used. Earlier identities and alternate marks are included. Where older artwork could not be verified, some schools use explicitly dated early-2000s legacy designs.</p><table><caption>Historical artwork in the school crest library</caption><thead><tr><th scope="col">School</th><th scope="col">Design era</th><th scope="col">Archive source</th></tr></thead><tbody>ARCHIVE_ROWS</tbody></table><footer>Sporting Life &amp; Times · Historical logos remain the marks of their respective institutions.</footer></main></body></html>'''
page = page.replace('ARCHIVE_COUNT', str(catalog['count'])).replace('ARCHIVE_ROWS', '\n'.join(rows))
(ROOT / 'cbb-logo-credits.html').write_text(page + '\n')
print('PASS:', catalog['count'], 'archive sources and exact eras credited')
