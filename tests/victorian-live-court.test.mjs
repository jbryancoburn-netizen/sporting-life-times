/* Permanent geometry contract for the Victorian Live Dispatch court.
   Render is deterministic; no feed, browser, or fabricated play data needed. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync('slt-victorian-live.js','utf8');
const page=fs.readFileSync('live-game.html','utf8');
const css=fs.readFileSync('slt-victorian-live.css','utf8');
const begin=src.indexOf('function basketballCourtSVG(){');
const end=src.indexOf('function courtSVG(){',begin);
assert(begin>=0&&end>begin,'Regulation court renderer missing');
const standalone=src.slice(begin,end);
const render=league=>new Function('league',standalone+'\nreturn basketballCourtSVG();')(league);
const check=(league,paint,arc,corner,restricted)=>{
 const svg=render(league);
 assert.match(svg,/viewBox="-18 -18 976 536"/);
 assert.match(svg,/94 feet long by 50 feet wide/);
 assert.equal((svg.match(/class="vld-rim"/g)||[]).length,2,'both basket rings required');
 assert.equal((svg.match(/class="vld-backboard"/g)||[]).length,2,'both backboards required');
 assert.equal((svg.match(/class="vld-paint"/g)||[]).length,2,'both painted keys required');
 assert.equal((svg.match(/class="vld-ft-dash"/g)||[]).length,2,'both free-throw circles required');
 assert.equal((svg.match(/\bvld-three-point"/g)||[]).length,2,'two three-point arcs required');
 assert.match(svg,/cx="470" cy="250" r="60"/,'six-foot center circle missing');
 assert.match(svg,new RegExp('height="'+paint+'"'),'lane must match league dimensions');
 assert.equal((svg.match(/class="vld-restricted"/g)||[]).length,restricted?2:0,
   'restricted-area treatment must follow league rules');
 const match=svg.match(/d="M0 ([\d.]+) H([\d.]+) A([\d.]+) ([\d.]+)/);
 assert(match,'three-point arc is not connected to the corner line');
 assert.equal(Number(match[1]),corner);
 assert(Math.abs(Number(match[3])-arc)<.002,'three-point radius incorrect');
 const x=52.5+Math.sqrt(arc**2-(250-corner)**2);
 assert(Math.abs(Number(match[2])-x)<.015,'three-point arc does not meet corner accurately');
 assert(svg.includes('x="0" y="0" width="940" height="500"'),'regulation hardwood bounds absent');
 assert(!svg.includes('vld-shot"'),'no simulated shot positions on court');
};
check('ncaam',120,22.14583333*10,34,true);
check('ncaaw',120,22.14583333*10,34,false);
check('nba',160,23.75*10,30,true);
assert(css.includes('.vld-court-svg--basketball'),'basketball court-specific styling missing');
assert(css.includes('.vld-shot-floor .vld-court-svg--basketball{max-height:none'),
  'shot tab must preserve full-court proportions');
const jsVersion=page.match(/slt-victorian-live\\.js\\?v=([A-Za-z0-9_-]+)/)?.[1];
const cssVersion=page.match(/slt-victorian-live\\.css\\?v=([A-Za-z0-9_-]+)/)?.[1];
assert(jsVersion&&cssVersion,'live Game Center must load versioned CSS and JavaScript');
assert.equal(jsVersion,cssVersion,'live Game Center CSS and JS must use the same release version');
assert(src.includes('Half-court source coordinates alone do not say which direction'),
  'unoriented source shot coordinates must not become fabricated full-court markers');
console.log('PASS: NCAA men, NCAA women and NBA 94x50 court geometry, rim and lane placement, source gates, responsive assets');
