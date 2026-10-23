#!/usr/bin/env node
// Regression coverage for current NBA Elo daily arrows, Eastern calendar day, and last-week values.
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=file('nba-elo-movement.js');
const context={window:{},Intl,Date};
runInNewContext(source,context,{filename:'nba-elo-movement.js'});
const {compute,format}=context.window.NBAEloMovement;
assert.equal(typeof compute,'function');
const live=JSON.parse(file('data/nba-2026-27-current-provisional.json'));
const active=compute(live);
assert.ok(active.available,active.reason||'Current ratings lack dated game ledger');
assert.equal(Object.keys(active.daily).length,30);
const total=Object.values(active.daily).reduce((sum,n)=>sum+n,0);
assert.ok(Math.abs(total)<.000001,'Daily Elo changes should sum to zero');
assert.match(format(12.615538),/▲ \+12\.616/);
assert.match(format(-12.615538),/▼ -12\.616/);
assert.match(format(0),/—/);
// Build a fixed first-16-game state without hardcoding future ratings.
// Subtract any later games from current Elo so this test remains valid after nightly updates.
assert.ok(live.events.length>=16,'2026-27 ledger unexpectedly shorter than its first 16 games');
const ratings=Object.fromEntries(live.rankings.map(r=>[r.team,r.elo]));
for(const g of live.events.slice(16).reverse()){
 ratings[g.home]-=g.home_elo_change;
 ratings[g.away]+=g.home_elo_change;
}
const fixture={
 rankings:Object.entries(ratings).map(([team,elo])=>({team,elo})),
 events:live.events.slice(0,16),
 games_played:16
};
const measured=compute(fixture);
assert.equal(measured.available,true,measured.reason);
assert.equal(measured.day,'2026-10-22');
const expected={PHI:12.615538,CLE:-12.615538,OKC:8.740375,DEN:-8.740375};
for(const [team,value] of Object.entries(expected)){
 assert.ok(Math.abs(measured.daily[team]-value)<.000001,team+' daily change incorrect');
}
for(const team of Object.keys(measured.daily)){
 if(!Object.hasOwn(expected,team))assert.ok(Math.abs(measured.daily[team])<.000001,team+' has invented Oct 22 change');
}
const page=file('nba.html'),loader=file('nba-desk-loader.js'),home=file('nba-home.js');
assert.match(page,/nba-elo-movement\.js/);
assert.ok(page.indexOf('nba-elo-movement.js')<page.indexOf('nba-desk-loader.js'));
assert.ok(page.indexOf('nba-elo-movement.js')<page.indexOf('nba-home.js'));
assert.match(loader,/movement\.daily\[t\]/);
assert.match(home,/movement\.daily\[t\]/);
assert.doesNotMatch(loader,/Daily changes unavailable until timestamps are verified/);
console.log('NBA daily Elo PASS: '+measured.day+' PHI +12.616, CLE -12.616, OKC +8.740, DEN -8.740. Active date '+active.day);
