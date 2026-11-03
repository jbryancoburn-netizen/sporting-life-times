'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const js=fs.readFileSync('cbb-live-center.js','utf8'),court=fs.readFileSync('cbb-live-court.js','utf8');
assert(js.includes('function currentView(g)'), 'live status source exists');
assert(!js.includes('TO — · CH — · FOULS —'), 'unavailable live-stat placeholders removed');
assert(!js.includes('cbb-preview-'+"'"+'"'), 'do not show statistics in compact bug');
assert(js.includes('cbb-ncaa-pilot-root'), 'NCAA pilot lives only in expanded Gamefile');
const worlds={window:{},setInterval:()=>0,clearInterval:()=>{}};
vm.runInNewContext(court,worlds);
const g={phase:'live',away:{team:{id:'1',displayName:'Away'}},home:{team:{id:'2',displayName:'Home'}}};
const plays=worlds.window.SLTCourt.parsePlays({plays:[
{id:'1',text:'Away scores',awayScore:2,homeScore:0},
{id:'2',text:'Home scores',awayScore:2,homeScore:3},
{id:'3',text:'Away scores',awayScore:4,homeScore:3},
{id:'4',text:'Away scores',awayScore:7,homeScore:3}
]});
assert.match(worlds.window.SLTCourt.latestRun(plays,g),/5 unanswered/);
assert.equal(worlds.window.SLTCourt.latestRun([],g),'');
const p=fs.readFileSync('cbb-ncaa-pilot.js','utf8');
assert(!p.includes('setInterval'), 'optional demo has no bulk polling');
assert(p.includes('60000')&&p.includes('goodId'), 'rate and identifier guards');
const sandbox={window:{}};
vm.runInNewContext(p,sandbox);
const sample={periods:[{number:1,playbyplayStats:[{description:'A made jumper',clock:'18:30'}]}]};
assert.equal(sandbox.window.SLTNCAAPilot.parse(sample)[0].text,'A made jumper');
console.log('SLT CourtCast live source-first smoke checks passed');
