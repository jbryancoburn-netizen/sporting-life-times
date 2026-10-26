#!/usr/bin/env node
/* Leakage-free chronological Elo vs RETRO rolling-date basketball backtest. */
const fs=require('node:fs'),retro=require('../mbb-retro.js');
const year=process.argv[2]||'2026';
const input=JSON.parse(fs.readFileSync('data/mbb-'+(Number(year)-1)+'-'+year+'-results.json','utf8'));
if(!input.audit?.complete||input.games.length<4000)throw Error('Incomplete historical data');
const games=input.games.sort((a,b)=>a.date.localeCompare(b.date));
const p=(a,b,e)=>1/(1+10**((b-a-e)/400));
const mov=g=>Math.min(2.5,1+Math.log1p(Math.abs(g.home_score-g.away_score))/3);
const prior=new Map();let count=0;
const scores={chrono:{brier:0,log:0,n:0},retro:{brier:0,log:0,n:0}};
let index=0;
while(index<games.length){
 const date=games[index].date.slice(0,10);let stop=index;
 while(stop<games.length&&games[stop].date.slice(0,10)===date)stop++;
 const past=games.slice(0,index),net=globalThis.MBB_RETRO.calculate(past).ratings;
 if(past.length>=100){
  for(const g of games.slice(index,stop)){
   if(!prior.has(g.home_id)||!prior.has(g.away_id)||!net[g.home_id]||!net[g.away_id])continue;
   const outcome=g.home_score>g.away_score?1:g.home_score===g.away_score?.5:0;
   const edge=g.site==='neutral'?0:65;
   for(const [key,a,b] of [['chrono',prior.get(g.home_id),prior.get(g.away_id)],['retro',net[g.home_id],net[g.away_id]]]){
    const prob=Math.max(1e-8,Math.min(1-1e-8,p(a,b,edge)));
    scores[key].brier+=(prob-outcome)**2;
    scores[key].log+=-outcome*Math.log(prob)-(1-outcome)*Math.log(1-prob);
    scores[key].n++;
   }
  }
 }
 for(const g of games.slice(index,stop)){
  const a=prior.get(g.home_id)??1500,b=prior.get(g.away_id)??1500;
  const outcome=g.home_score>g.away_score?1:g.home_score===g.away_score?.5:0;
  const change=28*mov(g)*(outcome-p(a,b,g.site==='neutral'?0:65));
  prior.set(g.home_id,a+change);prior.set(g.away_id,b-change);
 }
 index=stop;
}
for(const [key,s] of Object.entries(scores))console.log(year,key,'games',s.n,'Brier',(s.brier/s.n).toFixed(5),'LogLoss',(s.log/s.n).toFixed(5));
