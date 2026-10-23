#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const page=read('nba.html'),home=read('nba-home.js');
const elo=JSON.parse(read('data/nba-2026-27-current-provisional.json'));
new Function(home);
assert.match(page,/id="nba-results-rail"/);
assert.match(page,/id="nba-results-status"/);
assert.match(page,/nba-scorebug-match/);
assert.match(page,/@media\(max-width:680px\)/);
assert.match(home,/<details class="nba-scorebug"/);
assert.match(home,/home_elo_change/);
assert.doesNotMatch(home,/nba-results-brief/);
assert.equal(elo.events.length,elo.games_played);
const fixtures=elo.events.slice(-16);
assert.ok(fixtures.length>0);
for(const g of fixtures)assert.ok(Number.isFinite(g.home_score)&&Number.isFinite(g.away_score)&&Number.isFinite(g.home_elo_change)&&g.home&&g.away);
console.log('NBA results rail PASS: '+fixtures.length+' verified game scorebugs, Elo details, no duplicate article briefs, responsive side rail');
