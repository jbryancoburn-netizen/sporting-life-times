#!/usr/bin/env node
// Guard the NBA page against source-policy regressions.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const page=read('nba.html'),ui=read('nba-desk-loader.js'),home=read('nba-home.js'),model=read('nba-elo-model.js'),policy=read('SOURCE_POLICY.md');
assert.match(policy,/ESPN is an optional, attributed \*\*last-resort fallback\*\*/);
// The current NBA edition renders its modules into #app using nba-newspaper.js.
assert.match(page,/id="app"/);
assert.match(page,/nba-newspaper\\.js/);
assert.match(read('nba-newspaper.js'),/nba-game-center|nba-2026-27-current-provisional/);
console.log('NBA newspaper mount and data references PASS');
