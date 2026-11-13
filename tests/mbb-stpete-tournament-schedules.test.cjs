'use strict';
// Officially confirmed 2026 Showdown in St. Pete men's fixtures must appear
// on both programs' full-season team schedules, not merely the daily ledger.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = id => JSON.parse(fs.readFileSync(path.join(root, 'data/mbb-schedules-2026-27', id + '.json'), 'utf8'));
const fixtures = [
  {day:'2026-11-11', a:'50', b:'140'},    // Florida A&M / Kansas City
  {day:'2026-11-12', a:'140', b:'2244'},  // Kansas City / George Mason
  {day:'2026-11-12', a:'2154', b:'71'},  // Coppin State / Bradley
  {day:'2026-11-14', a:'71', b:'2244'}   // Bradley / George Mason
];
const source = 'https://www.showdowninstpete.com/schedule';
test('Showdown in St. Pete: every officially announced contest is on both team calendars', () => {
  for (const {day,a,b} of fixtures) {
    for (const owner of [a,b]) {
      const games = read(owner).events.filter(event => {
        if (String(event.date || '').slice(0,10) !== day) return false;
        const ids = (event.competitions?.[0]?.competitors || [])
          .map(side => String(side.team?.id));
        return ids.length === 2 && ids.includes(a) && ids.includes(b);
      });
      assert.equal(games.length, 1,
        `Expected exactly one ${a} vs ${b} on ${day} for team ${owner} (source: ${source})`);
      assert.equal(games[0].neutralSite, true,
        `Neutral-site MTE must not be mistaken for a home game: ${owner}, ${day}`);
    }
  }
});
test('Bradley–George Mason fixture carries verified site, tipoff and both official sources', () => {
  for (const owner of ['71','2244']) {
    const e = read(owner).events.find(x => String(x.id) === 'official-mte-2026-11-14-71-2244');
    assert.ok(e, `Missing certified tournament event for ${owner}`);
    assert.equal(e.site_verified, true);
    assert.equal(e.official_school_time, '1:00 PM ET');
    assert.equal(e.competitions[0].venue.arenaName, 'McArthur Center');
    assert.match(e.school_source_url, /^https:\/\/(?:gomason\.com|bradleybraves\.com)\//);
    assert.match(e.opponent_official_source, /^https:\/\/(?:gomason\.com|bradleybraves\.com)\//);
  }
});

test('future source-backed event-organizer fixtures are present on both school schedules', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'data/mbb-organizer-game-evidence.json'), 'utf8'));
  assert.equal(registry.season, '2026-27');
  const future = registry.games.filter(g => g.date >= '2026-11-13' && Array.isArray(g.team_ids) && g.team_ids.length === 2);
  assert.ok(future.length >= 11, 'Unexpectedly missing organizer evidence register');
  for (const g of future) {
    for (const owner of g.team_ids) {
      const matches = read(owner).events.filter(e => {
        const ids = (e.competitions?.[0]?.competitors || []).map(c => String(c.team?.id));
        return e.date.slice(0, 10) === g.date &&
          ids.length === 2 && g.team_ids.every(id => ids.includes(String(id)));
      });
      assert.equal(matches.length, 1,
        `Organizer-backed game ${g.team_ids.join(' vs ')} on ${g.date} absent/duplicated on ${owner}: ${g.source_url}`);
    }
  }
});
