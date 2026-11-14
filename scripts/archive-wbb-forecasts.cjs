#!/usr/bin/env node
/* Archive women's RETRO predictions before tipoff, without changing the forecast model.
   Uses only the certified women-only ratings, calibration and published fixtures. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const forecastEngine=require('../wbb-retro-forecast.js');
const DATA=path.join(__dirname,'..','data');
const SEASON='2026-27';
const localDay=value=>{
 const date=new Date(value);
 return Number.isFinite(date.getTime())?
   new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(date):'';
};
const numeric=v=>typeof v==='number'&&Number.isFinite(v);
const normalizeId=id=>{
 const raw=String(id||'').replace(/^espn:/,'');
 return /^\d+$/.test(raw)?'espn:'+raw:'';
};
function freeze(existing,games,ratings,calibration,now,forecastFn=forecastEngine.forMatch){
 if(existing?.season!==SEASON||!Array.isArray(existing.predictions))throw Error('Women pregame archive schema/season invalid');
 if(games?.season!==SEASON||ratings?.season!==SEASON||ratings?.gender!=='women'||ratings?.rankings?.length!==363||
    !forecastEngine.modelOK(calibration))throw Error('Women-only inputs or validated forecast calibration unavailable');
 const today=localDay(now);
 if(!today)throw Error('Invalid archive clock');
 const keys=new Map(),items=[...existing.predictions];
 for(const item of items){
  const k=item.date+'|'+item.id;
  if(keys.has(k))throw Error('Duplicate archived event '+k);
  keys.set(k,item);
 }
 let added=0;
 for(const g of games.upcoming||[]){
  if(!g||g.cancelled===true||g.status==='final'||!/^\d+$/.test(String(g.home_id||''))||
     !/^\d+$/.test(String(g.away_id||'')))continue;
  const date=localDay(g.date),id=normalizeId(g.id);
  // A forecast is archived only for a later Eastern calendar day.
  // Uncertain same-day tipoffs are deliberately excluded.
  if(!id||!date||date<=today||!Number.isFinite(Date.parse(g.date)))continue;
  const key=date+'|'+id,home=String(g.home_id),away=String(g.away_id);
  if(keys.has(key)){
   const old=keys.get(key);
   if(String(old.home_id)!==home||String(old.away_id)!==away)throw Error('Conflicting identities for archived game '+key);
   continue;
  }
  const venue=g.neutral===true?'neutral':g.site_verified===true?'verified-home':'unverified';
  const prediction=forecastFn(g,ratings,calibration,venue);
  if(!prediction?.calibrated||!numeric(prediction.projected_home_margin)||
     !numeric(prediction.home_probability)||prediction.home_probability<0||prediction.home_probability>1)continue;
  const item={date,id,home_id:home,away_id:away,
   projected_home_margin:Math.round(prediction.projected_home_margin*2)/2,
   raw_model_home_margin:prediction.projected_home_margin,
   home_win_probability:prediction.home_probability,
   forecast_model:calibration.model,
   ratings_as_of:ratings.as_of||null,venue_verification:venue,
   captured_at_utc:new Date(now).toISOString(),tipoff_at_utc:new Date(g.date).toISOString()};
  items.push(item);keys.set(key,item);added++;
 }
 items.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 return {archive:{season:SEASON,gender:'women',method:'Append-only, future-day frozen women-only RETRO forecasts',predictions:items},added};
}
function main(){
 const read=file=>JSON.parse(fs.readFileSync(path.join(DATA,file),'utf8'));
 const archivePath=path.join(DATA,'ncaaw-retro-pregame-archive-2026-27.json');
 const old=fs.existsSync(archivePath)?JSON.parse(fs.readFileSync(archivePath,'utf8')):
  {season:SEASON,gender:'women',method:'Append-only, future-day frozen women-only RETRO forecasts',predictions:[]};
 const {archive,added}=freeze(old,read('ncaaw-2026-27-games.json'),read('ncaaw-2026-27-retro-primary.json'),
  read('ncaaw-score-calibration.json'),new Date().toISOString());
 if(added)fs.writeFileSync(archivePath,JSON.stringify(archive,null,2)+'\n');
 console.log('Women pretipoff forecasts newly archived:',added,'total:',archive.predictions.length);
}
if(require.main===module)main();
module.exports={freeze,localDay,normalizeId};
