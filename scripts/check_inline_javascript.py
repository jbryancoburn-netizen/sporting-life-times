#!/usr/bin/env python3
"""Validate inline JavaScript in published HTML, not just external JS files."""
from html.parser import HTMLParser
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
class Scripts(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.inside = False
        self.parts = []
        self.scripts = []
    def handle_starttag(self, tag, attrs):
        if tag != 'script':
            return
        attrs = dict(attrs)
        self.inside = 'src' not in attrs and attrs.get('type', 'text/javascript') in ('text/javascript', 'module', '')
        self.parts = []
    def handle_data(self, data):
        if self.inside:
            self.parts.append(data)
    def handle_endtag(self, tag):
        if tag == 'script' and self.inside:
            self.scripts.append(''.join(self.parts))
            self.inside = False

count = 0
for path in sorted(ROOT.glob('*.html')):
    parser = Scripts()
    parser.feed(path.read_text(encoding='utf-8'))
    for index, source in enumerate(parser.scripts, 1):
        if not source.strip():
            continue
        count += 1
        result = subprocess.run(['node', '--check', '-'], input=source, text=True, capture_output=True)
        if result.returncode:
            print(f'Invalid inline JavaScript: {path.name}, script {index}\n{result.stderr}', file=sys.stderr)
            sys.exit(1)
print(f'Validated {count} inline scripts across all HTML pages.')
