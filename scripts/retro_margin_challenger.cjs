#!/usr/bin/env node
'use strict';
/* Offline, shadow-only walk-forward margin challenger. Does not write live RETRO. */
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const output=path.join(root,'data/ncaam-retro-margin-challenger-2026-27.json');
const half=x=>Math.round(x*2)/2;
const options=[
 {name:'published',scale:1,tail:1,home:0},
 {name:'shrink-10',scale:.9,tail:1,home:0},
 {name:'shrink-20',scale:.8,tail:1,home:0},
 {name:'expand-10',scale:1.1,tail:1,home:0},
 {name:'expand-20',scale:1.2,tail:1,home:0},
 {name:'large-shrink-20',scale:1,tail:.8,home:0},
 {name:'large-expand-20',scale:1,tail:1.2,home:0},
 {name:'verified-home-plus-2',scale:1,tail:1,home:2},
 {name:'verified-home-minus-2',scale:1,tail:1,home:-2}
];
function predict(row,v){
 let p=row.raw*v.scale;
 if(Math.abs(p)>10)p=Math.sign(p)*(10+(Math.abs(p)-10)*v.tail);
 return half(p+(row.verifiedHome?v.home:0));
}
function mae(rows,v){
 return rows.reduce((a,r)=>a+Math.abs(predict(r,v)-r.actual),0)/Math.max(1,rows.length);
}
function choose(past){
 if(past.length<100||new Set(past.map(x=>x.date)).size<3)return options[0];
 return options.reduce((best,v)=>mae(past,v)<mae(past,best)-1e-8?v:best,options[0]);
}
function main(){
 const archive=read('data/retro-pregame-archive-2026-27.json'),report=read('data/retro-spread-accuracy-2026-27.json');
 if(archive.season!=='2026-27'||report.season!=='2026-27')throw Error('Wrong season');
 const lookup=new Map();
 for(const p of archive.predictions){const k=p.date+'|'+p.id;if(lookup.has(k))throw Error('duplicate pregame '+k);lookup.set(k,p)}
 const rows=[];const excluded={unmatched:0,invalid:0,identity:0};
 for(const g of report.games){
  const p=lookup.get(g.date+'|'+g.id);
  if(!p){excluded.unmatched++;continue}
  if(p.home_id!==g.home_id||p.away_id!==g.away_id){excluded.identity++;continue}
  if(p.forecast_model!=='retro-central-elo-uncapped-v2'||!Number.isFinite(p.raw_model_home_margin)||!Number.isFinite(g.actual_home_margin)||
    (p.captured_at_utc&&p.tipoff_at_utc&&Date.parse(p.captured_at_utc)>=Date.parse(p.tipoff_at_utc))){excluded.invalid++;continue}
  rows.push({date:g.date,id:g.id,raw:p.raw_model_home_margin,published:g.predicted_home_margin,
    actual:g.actual_home_margin,verifiedHome:p.venue_verification==='verified_home'});
 }
 rows.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 const days=[...new Set(rows.map(x=>x.date))];const trained=[];const byDate=[];let totalBase=0,totalShadow=0,postBase=0,postShadow=0,postN=0;
 for(const date of days){
  const today=rows.filter(x=>x.date===date),selected=choose(trained);let base=0,shadow=0;
  for(const r of today){base+=Math.abs(r.published-r.actual);shadow+=Math.abs(predict(r,selected)-r.actual)}
  byDate.push({date,train_games:trained.length,test_games:today.length,selected:selected.name,
    baseline_mae:+(base/today.length).toFixed(4),shadow_mae:+(shadow/today.length).toFixed(4)});
  totalBase+=base;totalShadow+=shadow;
  if(trained.length>=100){postBase+=base;postShadow+=shadow;postN+=today.length}
  // Crucial: training on each date happens AFTER its predictions are assessed.
  trained.push(...today);
 }
 const next=choose(rows);
 const result={model:'retro-margin-challenger-v1',status:'SHADOW_ONLY_NOT_PROMOTED',
  data_as_of:report.updated_at_utc,source_scored_games:report.games.length,eligible_games:rows.length,excluded,
  method:'Daily walk-forward calibration on immutable original forecasts; selection uses strictly earlier dates, requires 100 training games across >=3 dates.',
  versions:options,all_games:{count:rows.length,baseline_mae:+(totalBase/Math.max(1,rows.length)).toFixed(4),
   shadow_mae:+(totalShadow/Math.max(1,rows.length)).toFixed(4)},
  post_warmup:{games:postN,baseline_mae:postN?+(postBase/postN).toFixed(4):null,
   shadow_mae:postN?+(postShadow/postN).toFixed(4):null},
  by_date:byDate,next_shadow_candidate:{...next,fit_mae:+mae(rows,next).toFixed(4),through:days.at(-1)||null},
  promotion_allowed:false,
  caveats:['Existing snapshot archive includes some historical captures without exact tipoff time; all source records are immutable and dated before game day.',
   'Ten November game dates are too few to establish broad generalization.',
   'No change to RETRO ratings, calibration, win probabilities, or published spreads.']};
 const content=JSON.stringify(result,null,2)+'\n';
 if(!fs.existsSync(output)||fs.readFileSync(output,'utf8')!==content)fs.writeFileSync(output,content);
 console.log(JSON.stringify({status:result.status,days:days.length,all:result.all_games,post_warmup:result.post_warmup,next:next.name}));
 return result;
}
if(require.main===module)main();
module.exports={predict,mae,choose,main,options};
