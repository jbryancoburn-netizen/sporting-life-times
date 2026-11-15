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
 assert.match(htmlW,/wbb-rankings\.js\?v=ranking-readable-20261114/);
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

test('Rhode Island and Loyola images are normalized at source, not scaled with CSS',()=>{
 const source=read('mbb-logo-system.js');
 for(const [id,slug] of [['227','rhode-island'],['2350','loyola-chicago']]){
  const data=fs.readFileSync(path.join(root,'assets/cbb-atlantic-10-1980s',slug+'.png'));
  assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(data.readUInt32BE(16),512,'normalized width '+slug);
  assert.equal(data.readUInt32BE(20),512,'normalized height '+slug);
  assert(source.includes(slug+'.png?v=normalized-source-20261115-1'));
  assert(!css.includes('.mbb-mark[data-espn-id="'+id+'"]'),'Removed per-school scaling '+slug);
 }
 assert(css.includes('.mbb-mark::before{'));
 assert(css.includes('z-index:3!important'));
});
