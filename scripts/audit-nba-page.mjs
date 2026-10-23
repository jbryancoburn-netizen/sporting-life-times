#!/usr/bin/env node
// Guard the NBA page against source-policy regressions.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const page=read('nba.html'),ui=read('nba-elo-page.js'),model=read('nba-elo-model.js'),policy=read('SOURCE_POLICY.md');
assert.match(policy,/ESPN is an optional, attributed \*\*last-resort fallback\*\*/);
assert.match(page,/id="nba-elo-scoreboard"/);
assert.match(page,/id="nba-elo-grid"/);
assert.match(page,/id="nba-elo-standings"/);
assert.match(page,/nba-elo-page\.js/);
assert.match(ui,/m\.rawEvents/);
assert.match(model,/rawEvents:cur\.events/);
assert.doesNotMatch(ui,/site\.api\.espn\.com|site\.web\.api\.espn\.com/);
assert.doesNotMatch(model,/site\.api\.espn\.com|site\.web\.api\.espn\.com/);
console.log('NBA page structure and official-first browser policy PASS');
