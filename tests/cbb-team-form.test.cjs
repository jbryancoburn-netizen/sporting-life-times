'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {normalizeMen, normalizeWomen, calculate} = require('../cbb-team-form.js');
const roster = {season: '2026-27', teams: [
  {team_id: '1', team: 'Alpha Wildcats'}, {team_id: '2', team: 'Bravo Bears'}
]};
const crosswalk = {season: '2026-27', teams: [
  {id: 'ncaa:1', name: 'Alpha', espn_id: '1'},
  {id: 'ncaa:2', name: 'Bravo', espn_id: '2'}
]};
const retro = () => ({season: '2026-27', model: 'retro-clean-slate',
  starting_elo: 1500, rankings: Array.from({length:365}, (_,i)=>({team_id:'ncaa:'+i})),
  games_played: 2, events: [
    {id:'espn:100', date:'2026-11-02', home_id:'ncaa:1', away_id:'ncaa:2',
      home_score:80,away_score:70,neutral:false,site_verified:true},
    {id:'espn:101', date:'2026-11-06', home_id:'ncaa:2', away_id:'ncaa:1',
      home_score:90,away_score:65,neutral:false,site_verified:true}
  ]});
test('men: calculated record, scoring averages, streak and chronological last five', () => {
  const form=calculate('ncaa:1',normalizeMen(retro(),null,crosswalk));
  assert.deepEqual([form.wins,form.losses,form.ppg,form.allowed,form.streak],
    [1,1,'72.5','80.0','L1']);
  assert.deepEqual(form.lastFive,['W','L']);
  assert.deepEqual(form.recent.map(x=>x.opponent),['Bravo','Bravo']);
});
test('men: independently verified non-D-I finals count once without entering RETRO', () => {
  const outside={season:'2026-27',counts_for_retro:false,games:[
    {id:'102',date:'2026-11-09',division_i_espn_id:'1',division_i_ncaa_id:'ncaa:1',
      home_espn_id:'1',away_espn_id:'999',team_score:98,opponent_score:55,
      opponent_name:'Outside College',source_url:'https://example.edu/score',
      verified:true,classification:'regular-season',counts_for_retro:false},
    {id:'103',date:'2026-11-10',division_i_espn_id:'1',division_i_ncaa_id:'ncaa:1',
      home_espn_id:'1',away_espn_id:'999',team_score:77,opponent_score:55,
      opponent_name:'Exhibition College',source_url:'https://example.edu/score',
      verified:true,classification:'exhibition',counts_for_retro:false}
  ]};
  const r=normalizeMen(retro(),outside,crosswalk);
  const form=calculate('ncaa:1',r);
  assert.equal(r.games.length,3);
  assert.deepEqual([form.wins,form.losses,form.streak],[2,1,'W1']);
  assert.equal(form.recent[0].opponent,'Outside College');
});
test('women: invalid finals and duplicate game IDs are withheld', () => {
  const sample={season:'2026-27', games:[
    {id:'200',date:'2026-11-02T19:00:00Z',home_id:'1',away_id:'2',
      home_score:75,away_score:60,status:'final',site_verified:true},
    {id:'201',date:'2026-11-05T19:00:00Z',home_id:'2',away_id:'1',
      home_score:40,away_score:68,status:'final',site_verified:true},
    {id:'201',date:'2026-11-05T19:00:00Z',home_id:'2',away_id:'1',
      home_score:51,away_score:68,status:'final',site_verified:true},
    {id:'202',date:'2026-11-08T19:00:00Z',home_id:'1',away_id:'2',
      home_score:88,away_score:63,status:'in'},
    {id:'203',date:'2026-10-25T19:00:00Z',home_id:'1',away_id:'2',
      home_score:88,away_score:63,status:'final'},
    {id:'204',date:'2026-11-08T19:00:00Z',home_id:'1',away_id:'2',
      home_score:64,away_score:64,status:'final'}
  ]};
  const f=calculate('1',normalizeWomen(sample,roster));
  assert.deepEqual([f.played,f.wins,f.losses,f.streak],[1,1,0,'W1']);
});
test('women: no fictitious results when no verified finals are published', () => {
  const f=calculate('1',normalizeWomen({season:'2026-27',games:[]},roster));
  assert.equal(f.ppg,'—');
  assert.equal(f.streak,'—');
  assert.equal(f.recent.length,0);
});
test('men: refuse malformed publication rather than inferring records', () => {
  const broken=retro();broken.games_played=1000;
  assert.throws(()=>normalizeMen(broken,null,crosswalk),/unavailable/);
});

test('men: unverified neutral flags do not appear as confirmed neutral locations', () => {
  const source = retro();
  source.events[0].neutral = true;
  source.events[0].site_verified = false;
  source.events[1].neutral = true;
  source.events[1].site_verified = true;
  const form = calculate('ncaa:1',normalizeMen(source,null,crosswalk));
  assert.deepEqual(form.recent.map(game => game.location), ['neutral','unverified']);
});

test('women: neutral designation requires verified site evidence as well', () => {
  const finals = {season:'2026-27',games:[
    {id:'302',date:'2026-11-08',home_id:'1',away_id:'2',home_score:71,away_score:62,status:'final',neutral:true,site_verified:false},
    {id:'301',date:'2026-11-04',home_id:'1',away_id:'2',home_score:67,away_score:60,status:'final',neutral:true,site_verified:true}
  ]};
  const form = calculate('1',normalizeWomen(finals,roster));
  assert.deepEqual(form.recent.map(game => game.location), ['unverified','neutral']);
});
