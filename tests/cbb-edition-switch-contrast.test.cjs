'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const css=fs.readFileSync('cbb-universal-nav.css','utf8');
test('men and women edition toggles have explicit active/inactive contrast in both mobile and desktop',()=>{
 assert.match(css,/body \.cbb-mobile-toolbar \.cbb-edition-switch a\.cbb-gender-option\.is-active/);
 assert.match(css,/body nav\.cbb-universal-nav \.cbb-edition-switch a\.cbb-gender-option\.is-active/);
 assert.match(css,/\[aria-current="page"\]/);
 assert.match(css,/background:#413025!important;\s*color:#fff7e9!important;\s*-webkit-text-fill-color:#fff7e9!important/);
 assert.match(css,/background:#f5e9d4!important;\s*color:#302419!important;\s*-webkit-text-fill-color:#302419!important/);
 for(const p of ['ncaam-rankings.html','ncaaw-rankings.html']){
  assert.match(fs.readFileSync(p,'utf8'),/cbb-universal-nav\.css\?v=edition-switch-contrast-20261115/);
 }
});
