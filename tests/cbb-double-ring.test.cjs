'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const css = fs.readFileSync('mbb-logo-system.css', 'utf8');
test('two wider adjacent colored strokes use one shared responsive ring token', () => {
  assert.match(css, /--mbb-ring:clamp\(2\.5px,calc\(var\(--mbb-size\) \* \.058\),7\.5px\)/);
  const outer = css.match(/\.mbb-mark\s*\{([\s\S]*?)\n\}/);
  const inner = css.match(/\.mbb-mark::before\s*\{([\s\S]*?)\n\}/);
  assert.ok(outer, 'outer ring CSS available');
  assert.ok(inner, 'inner ring CSS available');
  assert.match(outer[1], /border:var\(--mbb-ring\) solid var\(--mbb-primary/);
  assert.match(inner[1], /inset:0!important/);
  assert.match(inner[1], /border:var\(--mbb-ring\) solid var\(--mbb-secondary/);
  assert.match(inner[1], /background:transparent!important/);
  assert.match(css, /\.mbb-mark::after\{content:none!important;display:none!important\}/);
  assert.match(css, /object-fit:contain!important/);
});
