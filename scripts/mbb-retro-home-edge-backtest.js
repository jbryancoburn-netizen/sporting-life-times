#!/usr/bin/env node
/* Leakage-free RETRO home-court calibration.  All ratings reset each season.
   Predictions use ONLY games completed on earlier calendar dates. The current
   season never chooses its own edge; earlier seasons select its candidate.
*/
const fs=require('node:fs');
require('../mbb-retro.js');
const years=[2022,2023,2024,2025,2026],edges=[0,65,75,80,85,90,95,100,105,110,115,120];
const prob=(a,b,e)=>1/(1+10**((b-a-e)/400));
const loaded=years.map(year=>{
 const d=JSON.parse(fs.readFileSync('data/mbb-'+(year-1)+'-'+year+'-results.json','utf8'));
 if(!d.audit?.complete||d.games.length<4000)throw Error('Incomplete season '+year);
 return {year,games:d.games.slice().sort((a,b)=>a.date.localeCompare(b.date)||String(a.id).localeCompare(String(b.id)))};
});
function evaluate(season,edge){
 const games=season.games;
 const score={n:0,homeN:0,neutralN:0,brierSum:0,logSum:0,homeBrierSum:0,neutralBrierSum:0};
 let index=0;
 while(index<games.length){
  const date=games[index].date.slice(0,10);let stop=index;
  while(stop<games.length&&games[stop].date.slice(0,10)===date)stop++;
  const past=games.slice(0,index);
  const ratings=globalThis.MBB_RETRO.calculate(past,{homeEdge:edge}).ratings;
  if(past.length>=100){
   for(let i=index;i<stop;i++){
    const g=games[i],a=ratings[g.home_id],b=ratings[g.away_id];
    if(!Number.isFinite(a)||!Number.isFinite(b))continue;
    const y=g.home_score>g.away_score?1:0;
    const p=Math.max(1e-9,Math.min(1-1e-9,prob(a,b,g.site==='neutral'?0:edge)));
    const brier=(p-y)**2;
    score.n++;score.brierSum+=brier;score.logSum+=-y*Math.log(p)-(1-y)*Math.log(1-p);
    if(g.site==='neutral'){score.neutralN++;score.neutralBrierSum+=brier;}
    else{score.homeN++;score.homeBrierSum+=brier;}
   }
  }
  index=stop;
 }
 return {n:score.n,brier:score.brierSum/score.n,logloss:score.logSum/score.n,homeN:score.homeN,homeBrier:score.homeBrierSum/score.homeN,neutralN:score.neutralN,neutralBrier:score.neutralBrierSum/score.neutralN};
}
const reports=[];
for(const season of loaded){
 const candidates={};
 for(const edge of edges){
  candidates[edge]=evaluate(season,edge);
  console.log(season.year,edge,JSON.stringify(candidates[edge]));
 }
 reports.push({season:(season.year-1)+'-'+String(season.year).slice(-2),candidates});
}
const holdouts=[];
for(let i=1;i<reports.length;i++){
 const training=reports.slice(0,i);
 const ranked=edges.map(edge=>{
  const n=training.reduce((s,r)=>s+r.candidates[edge].n,0);
  const brier=training.reduce((s,r)=>s+r.candidates[edge].brier*r.candidates[edge].n,0)/n;
  return {edge,brier};
 }).sort((a,b)=>a.brier-b.brier||a.edge-b.edge);
 const selected=ranked[0].edge;
 holdouts.push({season:reports[i].season,selected_edge:selected,training_scores:ranked,holdout:reports[i].candidates[selected],zero_edge:reports[i].candidates[0],original_65_edge:reports[i].candidates[65]});
}
const combine=(key,metric='brier')=>{let n=0,sum=0;for(const h of holdouts){const x=h[key];n+=x.n;sum+=x[metric]*x.n;}return sum/n;};
const out={model:'RETRO rolling-date network ratings',seasons:years,edges,method:'All games on earlier calendar dates are used to recompute RETRO for each edge; 1500 fresh each season; no same-day or future results; candidate selected only on earlier seasons by weighted Brier; tested on subsequent season.',limitations:['Source home/neutral venue flags are not independently venue-audited','Zero edge and original 65 Elo settings are included as baselines','Early games lacking prior team ratings are excluded equally for all edges','This evaluates home-court adjustment for RETRO, not travel, conference effects, or roster priors'],season_reports:reports,holdout_reports:holdouts,holdout_combined:{games:holdouts.reduce((n,h)=>n+h.holdout.n,0),calibrated_brier:combine('holdout'),zero_edge_brier:combine('zero_edge'),original_65_brier:combine('original_65_edge'),calibrated_logloss:combine('holdout','logloss'),zero_edge_logloss:combine('zero_edge','logloss'),original_65_logloss:combine('original_65_edge','logloss')}};
fs.writeFileSync('data/mbb-retro-home-edge-2022-2026.json',JSON.stringify(out,null,2)+'\n');
console.log('HOLDOUT',JSON.stringify(out.holdout_combined));
