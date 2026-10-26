#!/usr/bin/env node
// Verify the deployed NBA newspaper's Elo movement contract and published data.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const page=read('nba.html'),js=read('nba-newspaper.js');
const live=JSON.parse(read('data/nba-2026-27-current-provisional.json'));
assert.match(page,/id="app"/);
assert.match(page,/nba-newspaper\.js/);
assert.match(js,/function dailyElo\(t\)/);
assert.match(js,/data\.current\?\.movement\?\.daily_change\?\.\[t\]/);
assert.match(js,/\['Daily Δ','num'\]/);
assert.match(js,/function standingRows\(list\)/);
assert.match(js,/function standings\(\)/);
assert.match(js,/function rankings\(\)/);
assert.match(js,/dailyElo\(t\)/);
assert.match(js,/delta=Number\.isFinite\(seed\[t\]\)\?rates\[t\]-seed\[t\]/);
assert.equal(live.rankings.length,30,'Expected exactly 30 NBA Elo teams');
assert.equal(live.events.length,live.games_played,'Every published final must appear exactly once');
const teams=new Set(live.rankings.map(r=>r.team));
assert.equal(teams.size,30,'Duplicate NBA rating teams');
const moves=live.movement?.daily_change;
assert.ok(moves&&Object.keys(moves).length===30,'Missing NBA daily movement snapshot');
for(const [team,v] of Object.entries(moves)){
 assert.ok(teams.has(team),'Unknown team in movement: '+team);
 assert.ok(Number.isFinite(v),'Nonfinite daily Elo for '+team);
}
const sum=Object.values(moves).reduce((a,b)=>a+b,0);
assert.ok(Math.abs(sum)<0.0001,'Daily Elo must be zero sum');
const ids=live.events.map(g=>String(g.id||g.game_id||''));
assert.ok(ids.every(Boolean),'Missing final game IDs');
assert.equal(new Set(ids).size,ids.length,'Duplicate final game IDs');
console.log('NBA newspaper Elo PASS: 30 teams, '+ids.length+' unique finals, zero-sum daily movement, live standings and season movement contracts');
