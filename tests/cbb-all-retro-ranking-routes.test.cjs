'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
test('both men’s RETRO ranking URLs use the 2026 vintage shared crest with larger artwork',()=>{
 const main=read('ncaam-elo.html'),poll=read('ncaam-rankings.html'),css=read('mbb-logo-system.css');
 for(const page of [main,poll])assert.match(page,/mbb-logo-system\.css\?v=power-art-20261114c/);
 assert.match(read('basketball-ranking-layout.css'),/\.rank-school \.mbb-mark\{--mbb-size:76px/);
 assert.match(read('basketball-ranking-layout.css'),/\.rank-school \.mbb-mark\{--mbb-size:64px/);
 assert.match(poll,/size:'power'/);
 assert.doesNotMatch(poll,/\.rank-school \.mbb-mark\{--mbb-size:(?:32|40)px/);
 assert.match(css,/\.cbb-elo-power \.mbb-mark\{--mbb-size:92px/);
 assert.match(poll,/\.rank-wbb-mark/,'women’s alternate poll tab remains intact');
});
