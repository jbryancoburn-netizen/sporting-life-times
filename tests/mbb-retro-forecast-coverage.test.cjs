'use strict';
// Publishing gate: the Daily Ledger must not lose canonical MBB forecasts
// when the rolling fixture collector advances to the next UTC date.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const scores = read('data/mbb-live.json');
const slate = require('../ncaam-slate.js');
const forecast = read('data/ncaam-2026-27-upcoming-forecasts.json');
const crosswalk = read('data/ncaam-2026-27-espn-team-crosswalk.json');
const ratings = read('data/ncaam-2026-27-retro-primary.json');
const canonical = new Map(crosswalk.teams.map(t=>[String(t.espn_id),String(t.id)]));
const rated = new Set(ratings.rankings.map(t=>String(t.team_id)));
const eastern = date => new Intl.DateTimeFormat('sv-SE', {
  timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'
}).format(new Date(date));
const today = eastern(Date.now());
const byId = new Map();
for(const g of forecast.games){
  assert.ok(g.id && !byId.has(g.id), 'Duplicate MBB forecast event: '+g.id);
  byId.set(g.id,g);
  if(g.forecast_model==='UNAVAILABLE_MISSING_RATING')continue;
  assert.ok(Number.isFinite(g.home_win_probability) &&
            g.home_win_probability>=0 && g.home_win_probability<=1,
            'Missing/invalid win probability for '+g.id);
  assert.ok(Number.isFinite(g.projected_home_margin),
            'Missing projected margin for '+g.id);
  assert.ok(rated.has(String(g.away_id)) && rated.has(String(g.home_id)),
            'Forecast references an unknown RETRO team: '+g.id);
}
let checked=0;
for(const g of scores.games||[]){
  if(g.state!=='pre'||!Array.isArray(g.teams)||g.teams.length!==2)continue;
  const day=eastern(g.date);
  if(day<today)continue;
  const away=canonical.get(String(g.teams[0].id));
  const home=canonical.get(String(g.teams[1].id));
  if(!away||!home)continue; // no fabricated D-I predictions vs outside opponents
  const id='espn:'+g.id;
  const row=byId.get(id);
  assert.ok(row, 'Missing published RETRO forecast for '+id+' on '+day);
  assert.equal(row.date,day, 'Eastern game date mismatch for '+id);
  assert.equal(row.away_id,away, 'Away team mismatch for '+id);
  assert.equal(row.home_id,home, 'Home team mismatch for '+id);
  assert.ok(Number.isFinite(row.home_win_probability) &&
            Number.isFinite(row.projected_home_margin),
            'Unpublished probability/margin for '+id);
  checked++;
}
// Exercise the exact browser transform: a present JSON record must actually
// attach to the rendered scorebug game, not merely exist in the source file.
const ledger = slate.normalizeMen(scores,forecast,crosswalk);
for(const g of scores.games||[]){
  if(g.state!=='pre'||!Array.isArray(g.teams)||g.teams.length!==2)continue;
  const day=eastern(g.date);
  if(day<today)continue;
  if(!g.teams.every(t=>canonical.has(String(t.id))))continue;
  const row=ledger.find(x=>String(x.id)===String(g.id)&&x.day===day);
  assert.ok(row, 'Browser transform dropped the scheduled event '+g.id);
  assert.ok(row.phase==='upcoming'&&Number.isFinite(row.probability),
            'Scorebug will show NO FORECAST for event '+g.id);
  assert.ok(Number.isFinite(row.projectedHomeMargin),
            'Scorebug margin missing for event '+g.id);
}
assert.ok(forecast.games.length>0, 'Published RETRO forecast ledger is empty');
console.log('PASS MBB RETRO: '+checked+' current/upcoming canonical D-I games have one published probability and margin; '+forecast.games.length+' forecasts checked.');
