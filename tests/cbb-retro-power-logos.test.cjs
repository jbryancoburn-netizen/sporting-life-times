'use strict';
const fs=require('node:fs'),path=require('node:path'),test=require('node:test'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const htmlM=read('ncaam-elo.html'),htmlW=read('ncaaw-rankings.html');
const css=read('mbb-logo-system.css'),men=read('mbb-elo-primary.css'),women=read('wbb-rankings.js');
const palette=JSON.parse(read('data/dual-ring-team-palette.json')).mbb;
const teams=JSON.parse(read('data/ncaaw-2026-27-teams.json')).teams;
test('both RETRO editions show first-party two-ring crest markup and larger crests',()=>{
 assert.match(read('mbb-elo-primary.js'),/MBBLogos\.byNCAA\(t\.team_id,'power',t\.team\)/);
 assert.match(men,/\.cbb-elo-mobile-delta\{display:none/);
 assert.doesNotMatch(men,/\.cbb-elo-school img\{max-width:29px/);
 assert.match(css,/\.cbb-elo-school \.mbb-mark\{--mbb-size:76px/);
 assert.match(css,/\.cbb-elo-power \.mbb-mark\{--mbb-size:92px/);
 assert.match(htmlM,/mbb-logo-system\.css\?v=power-art-20261114c/);
 assert.match(htmlW,/wbb-rankings\.js\?v=power-crest-20261114/);
 assert.match(htmlW,/\.wbbr-entry \.mbb-mark\{--mbb-size:82px/);
 assert.match(css,/\.cbb-elo-school \.mbb-mark:not\(\.mbb-mark--heritage\)>img\.mbb-mark__img/);
 assert.match(htmlW,/overflow:visible!important/);
 assert.doesNotMatch(htmlW,/\.wbbr-list \.wbbr-entry \.mbb-mark\{[^}]*overflow:hidden/);
});
test('all 363 women basketball teams have two distinct nonwhite logo ring colors',()=>{
 assert.equal(teams.length,363);
 for(const team of teams){
  const p=palette[String(team.team_id)];
  assert(p,'Missing published ring colors for '+team.team);
  assert(/^#[a-f\d]{6}$/i.test(p.primary)&&/^#[a-f\d]{6}$/i.test(p.secondary));
  assert.notEqual(p.primary.toLowerCase(),p.secondary.toLowerCase());
 }
 assert.match(women,/ringColors=palette\?\.mbb\|\|\{\}/);
 assert.match(women,/mbb-mark--power/);
 assert.match(women,/MBBLogos\?\.retroURLForESPN\?\.\(id\)/);
});
test('women’s rankings are independent of an optional palette request',()=>{
 assert.match(women,/req\('data\/dual-ring-team-palette\.json'\)\.catch\(\(\)=>null\)/);
 assert.doesNotMatch(women,/throw Error\('Published two-color logo registry incomplete'\)/);
});
