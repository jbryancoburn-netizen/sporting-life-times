'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=path=>fs.readFileSync(path,'utf8');

test('women’s mobile rank badges reserve room for the whole number before the logo',()=>{
 const page=source('ncaaw-rankings.html');
 const renderer=source('wbb-rankings.js');
 assert.match(renderer,/class="wbbr-number">#'\+esc\(t\.rank\)/);
 assert.match(page,/\.wbbr-entry\{grid-template-columns:48px 70px minmax\(0,1fr\) 64px/);
 assert.match(page,/\.wbbr-list \.wbbr-entry>\.wbbr-number\{width:46px;height:44px;font-size:14px/);
 assert.match(page,/\.wbbr-entry\{grid-template-columns:46px 64px minmax\(0,1fr\) 58px/);
 assert.match(page,/\.wbbr-list \.wbbr-entry>\.wbbr-number\{width:44px;height:42px;font-size:13px/);
 assert.doesNotMatch(page,/grid-template-columns:30px 49px minmax\(0,1fr\)/);
 assert.match(page,/\.wbbr-entry \.mbb-mark\{--mbb-size:82px/);
 assert.doesNotMatch(page,/\.wbbr-list \.wbbr-entry \.mbb-mark\{[^}]*overflow:hidden/);
});

test('men’s national register gives three-digit ranks their own mobile place cell',()=>{
 const css=source('mbb-elo-primary.css');
 const page=source('ncaam-elo.html');
 assert.match(css,/\.cbb-elo-table th:nth-child\(1\),\.cbb-elo-table td:nth-child\(1\)\{width:16%\}/);
 assert.match(css,/\.cbb-elo-table td\.cbb-elo-rank \.victorian-number\{box-sizing:border-box;width:100%;max-width:40px/);
 assert.match(page,/mbb-elo-primary\.css\?v=power-crests-20261114/);
});
