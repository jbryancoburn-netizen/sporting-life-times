'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const css=fs.readFileSync('slt-hub-masthead-fix.css','utf8');
for(const name of ['index.html','sports.html']){
  const html=fs.readFileSync(name,'utf8');
  assert(html.includes('slt-hub-masthead-fix.css?v=20261103-hub-restore1'),name);
  assert(html.includes('class="slt-hub-wordmark"'),name);
  assert(!html.includes('class="newspaper-wordmark"'),name);
  assert(html.indexOf('slt-hub-masthead-fix.css')>html.indexOf('slt-broadcast-overhaul.css'),name);
}
assert.match(css,/a\.slt-brand-link\s*\{/);
assert.match(css,/display:flex!important/);
assert.match(css,/background:#091f3d!important/);
assert.match(css,/\.slt-brand-globe svg\s*\{/);
assert.match(css,/max-height:100%!important/);
assert.match(css,/\.site-nav\s*\{/);
assert.match(css,/flex-flow:row nowrap!important/);
assert.match(css,/\.league-hub \.hub-nav\{display:none!important\}/);
console.log('PASS: SLT Sports Desks masthead constrains globe, protects contrast and compresses navigation');
