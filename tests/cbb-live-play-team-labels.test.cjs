/* Regression: player team attribution in the shared CBB inline Gamefile.
 * Run: node tests/cbb-live-play-team-labels.test.cjs
 */
const assert = require('node:assert/strict');
global.SLTCourt = { parsePlays: raw => raw.plays || [] };
const { playLog } = require('../cbb-inline-gamefile.js');

const g = {
  away: { id: '1', name: 'South Dakota' },
  home: { id: '2', name: 'Drake' }
};
const raw = {
  boxscore: { players: [
    { team: { id: '1' }, statistics: [{ athletes: [
      { athlete: { displayName: 'Josiah Dotzler' } }
    ] }] },
    { team: { id: '2' }, statistics: [{ athletes: [
      { athlete: { displayName: 'Owen Larson' } },
      { athlete: { displayName: 'Jon Carroll' } },
      { athlete: { displayName: 'LJ Rush' } }
    ] }] }
  ] },
  plays: [
    { text: 'Owen Larson Steal.', teamId: '2', period: 2, clock: '11:34', awayScore: 46, homeScore: 45 },
    { text: 'Jon Carroll makes layup (Owen Larson assists)', teamId: '2', period: 2, clock: '12:04', awayScore: 46, homeScore: 44 },
    { text: 'Josiah Dotzler bad pass turnover', teamId: '1', period: 2, clock: '11:34', awayScore: 46, homeScore: 45 },
    { text: 'Foul on LJ Rush.', teamId: '2', period: 2, clock: '11:42', awayScore: 46, homeScore: 45 },
    { text: 'Official TV Timeout', teamId: null, period: 2, clock: '11:41', awayScore: 46, homeScore: 45 }
  ]
};
const html = playLog(raw, g);
for(const phrase of [
  'Owen Larson (Drake) Steal.',
  'Jon Carroll (Drake) makes layup (Owen Larson (Drake) assists)',
  'Josiah Dotzler (South Dakota) bad pass turnover',
  'Foul on LJ Rush (Drake).',
  'Official TV Timeout',
  '46–45',
  'live play log</p>'
]) assert.ok(html.includes(phrase), 'Missing expected play: ' + phrase);
assert.ok(!html.includes('Official ('), 'Timeout must not receive a team');

const fallback = playLog({ plays: [
  { text: 'Owen Larson Steal.', teamId: '2' },
  { text: 'Josiah Dotzler bad pass turnover', teamId: '1' },
  { text: 'Foul on LJ Rush.', teamId: '2' },
  { text: 'Official TV Timeout', teamId: '2' }
] }, g);
for(const phrase of [
  'Owen Larson (Drake) Steal.',
  'Josiah Dotzler (South Dakota) bad pass turnover',
  'Foul on LJ Rush (Drake).',
  'Official TV Timeout'
]) assert.ok(fallback.includes(phrase), 'Missing teamId fallback: ' + phrase);
assert.ok(!fallback.includes('Official ('), 'Do not assign teams to a timeout');
console.log('CBB player team labels: PASS');
