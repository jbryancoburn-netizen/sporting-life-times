#!/usr/bin/env node
// Propagate independently verified NBA finals into the dated schedule without
// claiming its upstream scoreboard was fetched when the endpoint was blocked.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export function reconcileSchedule(schedule, earned) {
  assert.equal(earned.season, '2026-27', 'Incorrect NBA season');
  assert.ok(Array.isArray(earned.events), 'Missing Elo final ledger');
  assert.equal(earned.events.length, earned.games_played, 'Elo final count mismatch');
  assert.ok(Array.isArray(schedule.games), 'Missing NBA schedule games');
  const finals = new Map();
  for (const event of earned.events) {
    assert.ok(event.id && !finals.has(String(event.id)), 'Duplicate Elo final ID');
    assert.ok(Number.isInteger(event.home_score) && Number.isInteger(event.away_score) &&
      event.home_score !== event.away_score, 'Invalid verified final');
    finals.set(String(event.id), event);
  }
  const scheduleIds = new Set();
  let updated = 0, matched = 0;
  const games = schedule.games.map(game => {
    assert.ok(game.id && !scheduleIds.has(String(game.id)), 'Duplicate schedule ID');
    scheduleIds.add(String(game.id));
    const event = finals.get(String(game.id));
    if (!event) return game;
    matched++;
    const home = game.teams?.find(team => team.home_away === 'home');
    const away = game.teams?.find(team => team.home_away === 'away');
    assert.ok(home && away, 'Schedule missing home/away: ' + game.id);
    assert.equal(home.code, event.home, 'NBA final home team mismatch: ' + game.id);
    assert.equal(away.code, event.away, 'NBA final away team mismatch: ' + game.id);
    if (game.state === 'post') {
      if (home.score !== null && home.score !== undefined)
        assert.equal(Number(home.score), event.home_score, 'Conflicting home final: ' + game.id);
      if (away.score !== null && away.score !== undefined)
        assert.equal(Number(away.score), event.away_score, 'Conflicting away final: ' + game.id);
    }
    const next = {
      ...game,
      state: 'post',
      status: game.state === 'post' && game.status ? game.status : 'Final',
      teams: game.teams.map(team => ({
        ...team,
        score: team.home_away === 'home' ? event.home_score : event.away_score
      }))
    };
    if (JSON.stringify(next) !== JSON.stringify(game)) updated++;
    return next;
  });
  const result = {...schedule, games};
  if (updated) result.elo_synced_at = new Date().toISOString();
  // updated_at must remain the real ESPN scoreboard fetch time.
  return {schedule: result, updated, matched};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const read = name => JSON.parse(readFileSync(new URL('../data/' + name, import.meta.url), 'utf8'));
  const schedule = read('nba-upcoming-schedule.json');
  const earned = read('nba-elo-shadow-2026-27.json');
  const result = reconcileSchedule(schedule, earned);
  if (process.argv.includes('--check')) {
    assert.equal(result.updated, 0, 'NBA schedule has unpropagated verified finals');
  } else if (result.updated) {
    writeFileSync(new URL('../data/nba-upcoming-schedule.json', import.meta.url),
      JSON.stringify(result.schedule, null, 2) + '\n');
  }
  console.log('NBA final / schedule sync: ' + result.matched +
    ' verified matches; ' + result.updated + ' scorecards updated');
}
