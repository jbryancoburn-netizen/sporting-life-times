'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
test('men’s RETRO full register and Power 10 show readable labeled ratings and records',()=>{
 const js=read('mbb-elo-primary.js'),css=read('mbb-elo-primary.css');
 assert.match(js,/cbb-elo-record/);
 assert.match(js,/cbb-elo-rating/);
 assert.match(js,/cbb-mobile-stat-label/);
 assert.match(js,/cbb-power-retro/);
 assert.match(js,/cbb-overall-record/);
 assert.match(css,/grid-template-columns:48px minmax\(0,1fr\) 108px/);
 assert.match(css,/\.cbb-elo-table tbody tr>td:nth-child\(2\)\{grid-column:2 \/ 4;grid-row:1/);
 assert.match(css,/\.cbb-elo-power\{display:grid;grid-template-columns:37px 78px minmax\(0,1fr\)/);
 assert.match(read('ncaam-elo.html'),/mbb-elo-primary\.css\?v=ranking-readable-20261114/);
});
test('women’s ranking cards keep names and W–L / RETRO in a distinct column from 82px crests',()=>{
 const css=read('ncaaw-rankings.html'),js=read('wbb-rankings.js');
 assert.match(css,/\.wbbr-entry\{grid-template-columns:58px 92px minmax\(0,1fr\) 134px/);
 assert.match(css,/\.wbbr-entry\{grid-template-columns:46px 70px minmax\(0,1fr\);grid-template-rows:auto auto/);
 assert.match(css,/\.wbbr-value\{grid-column:3;grid-row:2/);
 assert.match(js,/wbbr-stat-caption/);
 assert.match(js,/wbbr-record/);
 assert.match(js,/wbbr-retro/);
 assert.match(css,/wbb-rankings\.js\?v=ranking-readable-20261114/);
});
test('alternate national rankings uses stacked mobile metadata only for RETRO, without affecting external polls',()=>{
 const html=read('ncaam-rankings.html');
 assert.match(html,/rank-table-wrap--retro/);
 assert.match(html,/k==='retro'/);
 assert.match(read('basketball-ranking-layout.css'),/\.rank-table-wrap--retro \.rank-table tbody tr\{display:grid/);
 assert.match(html,/content:'RETRO '/);
 assert.match(html,/content:'W–L '/);
 assert.match(html,/size:'power'/);
});
