#!/usr/bin/env node
/* Immutable pretipoff capture of the public spread, independently of legacy probability archive.
   Never recompute a forecast from a later RETRO rating or infer a venue advantage. */
'use strict';
const fs = require('node:fs');
const load = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const save = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
const verified = load('data/mbb-retro-verified-upcoming-2026-27.json');
const published = load('data/ncaam-2026-27-upcoming-forecasts.json');
const oldFile = 'data/mbb-retro-prospective-predictions-2026-27.json';
const spreadFile = 'data/mbb-retro-pregame-spreads-2026-27.json';
const legacy = fs.existsSync(oldFile) ? load(oldFile) : {season:'2026-27', predictions:[]};
const archive = fs.existsSync(spreadFile) ? load(spreadFile) : {season:'2026-27', model:'retro-central-elo-uncapped-v2', forecasts:[]};
if(!Array.isArray(legacy.predictions) || !Array.isArray(archive.forecasts) || !Array.isArray(verified.games) || !Array.isArray(published.games)) throw Error('Malformed forecast input');
const publishedById = new Map(published.games.map(g => [String(g.id),g]));
const oldSeen = new Set(legacy.predictions.map(g => String(g.game_id)));
const spreadSeen = new Set(archive.forecasts.map(g => String(g.game_id)));
const now = new Date(), eastern = new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
let captured=0, skipped=0, legacyCaptured=0;
for(const g of verified.games){
  const id=String(g.id||''), f=publishedById.get(id), tip=Date.parse(g.tipoff_at);
  if(!id || !f || !g.home_id || !g.away_id || !Number.isFinite(tip) || tip<=now.getTime() ||
     !['home','neutral'].includes(g.site) || g.home_score!=null || g.away_score!=null ||
     f.home_score!=null || f.away_score!=null || f.home_id!==g.home_id || f.away_id!==g.away_id ||
     f.date!==g.date || f.forecast_model!=='retro-central-elo-uncapped-v2' ||
     !f.ratings_as_of || f.ratings_as_of>=f.date ||
     !Number.isFinite(f.projected_home_margin) ||
     !Number.isFinite(f.home_win_probability) || f.home_win_probability<=0 || f.home_win_probability>=1 ||
     eastern.format(new Date(tip))==='23:59'){
     skipped++; continue;
  }
  if(!spreadSeen.has(id)){
    archive.forecasts.push({
      game_id:id, game_date:g.date, home_id:g.home_id, away_id:g.away_id,
      recorded_at:now.toISOString(), tipoff_at:new Date(tip).toISOString(),
      projected_home_margin:f.projected_home_margin, home_win_probability:f.home_win_probability,
      ratings_as_of:f.ratings_as_of, venue_verification:f.venue_verification||'unverified',
      forecast_model:f.forecast_model, venue_schedule_flag:g.site,
      note:'Exact published unified forecast. Unverified venues receive no home-edge bonus.'
    });
    spreadSeen.add(id); captured++;
  }
  if(!oldSeen.has(id)){
    legacy.predictions.push({
      game_id:id, home_id:g.home_id, away_id:g.away_id, game_date:g.date,
      recorded_at:now.toISOString(), tipoff_at:new Date(tip).toISOString(),
      venue:g.site, completed_games_used:null,
      p_home_100:f.home_win_probability,
      note:'Recorded published unified model probability; not an independent 65-versus-100 comparison.'
    });
    oldSeen.add(id); legacyCaptured++;
  }
}
if(captured) save(spreadFile,archive);
if(legacyCaptured) save(oldFile,legacy);
console.log(JSON.stringify({captured, legacyCaptured, skipped, total_spreads:archive.forecasts.length}));
