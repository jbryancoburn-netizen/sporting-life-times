#!/usr/bin/env node
/* Men's D-I RETRO official forecast publication; no other sport inputs. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const ratings=read('data/ncaam-2026-27-retro-primary.json');
const fixtures=read('data/ncaam-2026-27-upcoming-forecasts.json');
if(ratings.model!=='retro-clean-slate'||ratings.starting_elo!==1500||
 ratings.rankings?.length!==365||new Set(ratings.rankings.map(t=>t.team_id)).size!==365)throw Error('RETRO ratings integrity failure');
const map=new Map(ratings.rankings.map(t=>[String(t.team_id),t]));
const records=[],seen=new Set();
for(const g of fixtures.games||[]){
 const id=String(g.id||''),home=map.get(String(g.home_id)),away=map.get(String(g.away_id));
 if(!id||seen.has(id)||!home||!away||home.team_id===away.team_id)continue;
 seen.add(id);
 // Published fixture feed does not certify venue: default neutral, never invent home edge.
 const site=g.neutral===true?'neutral':g.venue_verified===true?'home':'neutral';
 const gap=home.elo-away.elo+(site==='home'?100:0);
 const probability=1/(1+10**(-gap/400)),margin=gap/25;
 records.push({id,date:g.date,home_id:home.team_id,away_id:away.team_id,site,
  home_elo:home.elo,away_elo:away.elo,
  homeProbability:Number(probability.toFixed(9)),awayProbability:Number((1-probability).toFixed(9)),
  homeScore:Math.max(1,Math.round(72+margin/2)),awayScore:Math.max(1,Math.round(72-margin/2))});
}
records.sort((a,b)=>String(a.date).localeCompare(String(b.date))||a.id.localeCompare(b.id));
const result={model:'retro-men-2026-27-v2',season:'2026-27',rating_revision:
 String(ratings.as_of||'preseason')+'|'+ratings.games_played,
 fixture_as_of:fixtures.as_of||null,team_count:365,forecast_count:records.length,
 calibration:'PROVISIONAL_NOT_HOLDOUT_CALIBRATED',games:records};
if(!records.length)throw Error('Refusing to publish empty RETRO forecast ledger');
const js='/* Generated single-source MBB RETRO pregame forecasts. Do not edit by hand. */\n'+
 'window.RETROForecastPublication='+JSON.stringify(result)+';\n';
fs.writeFileSync(path.join(root,'data/ncaam-2026-27-retro-forecasts.js'),js);
fs.writeFileSync(path.join(root,'data/ncaam-2026-27-retro-forecasts.json'),JSON.stringify(result,null,2)+'\n');
console.log('RETRO forecast publication',records.length,'games, rating revision',result.rating_revision);
