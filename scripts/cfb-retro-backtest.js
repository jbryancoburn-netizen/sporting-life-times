#!/usr/bin/env node
// Leakage-free, rolling-origin evaluation of chronological Elo versus RETRO.
// Usage: node scripts/cfb-retro-backtest.js
const fs=require('node:fs');
const payload=JSON.parse(fs.readFileSync('data/cfb-2026-results.json','utf8'));
const games=payload.games.filter(g=>g.teams?.length===2&&g.teams.every(t=>Number.isFinite(Number(t.score)))).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||String(a.id).localeCompare(String(b.id)));
const p=(a,b,e=0)=>1/(1+10**((b+e-a)/400));
const edge=g=>g.neutral?0:g.teams[0].homeAway==='home'?65:g.teams[1].homeAway==='home'?-65:0;
const mov=g=>Math.min(2.5,1+Math.log1p(Math.abs(g.teams[0].score-g.teams[1].score))/3);
const actual=g=>g.teams[0].score>g.teams[1].score?1:g.teams[0].score<g.teams[1].score?0:0.5;
function chronological(past){const r=new Map();for(const g of past){const [a,b]=g.teams.map(t=>String(t.id)),ra=r.get(a)||1500,rb=r.get(b)||1500;const d=28*mov(g)*(actual(g)-p(ra,rb,edge(g)));r.set(a,ra+d);r.set(b,rb-d);}return r;}
function retro(past){const ids=new Set(past.flatMap(g=>g.teams.map(t=>String(t.id))));const r=new Map([...ids].map(id=>[id,1500]));const n=new Map([...ids].map(id=>[id,0]));for(const g of past)for(const t of g.teams)n.set(String(t.id),n.get(String(t.id))+1);for(let pass=0;pass<160;pass++){const grad=new Map([...ids].map(id=>[id,0]));for(const g of past){const [a,b]=g.teams.map(t=>String(t.id));const residual=mov(g)*(actual(g)-p(r.get(a),r.get(b),edge(g)));grad.set(a,grad.get(a)+residual);grad.set(b,grad.get(b)-residual);}let max=0;for(const id of ids){const old=r.get(id);const next=Math.max(1100,Math.min(1900,old+18*(grad.get(id)-.006*(old-1500))/(3+n.get(id))));max=Math.max(max,Math.abs(next-old));r.set(id,next);}if(max<.0001)break;}return r;}
const dates=[...new Set(games.map(g=>g.date.slice(0,10)))].sort();
const scores={chronological:{n:0,brier:0,logLoss:0},retro:{n:0,brier:0,logLoss:0}};
for(let i=0;i<dates.length;i++){const day=dates[i],past=games.filter(g=>g.date.slice(0,10)<day),today=games.filter(g=>g.date.slice(0,10)===day);if(past.length<40)continue;const models={chronological:chronological(past),retro:retro(past)};for(const [name,r] of Object.entries(models))for(const g of today){const [a,b]=g.teams.map(t=>String(t.id));if(!r.has(a)||!r.has(b))continue;const prob=Math.max(.000001,Math.min(.999999,p(r.get(a),r.get(b),edge(g))));const y=actual(g),s=scores[name];s.n++;s.brier+=(prob-y)**2;s.logLoss+=-(y*Math.log(prob)+(1-y)*Math.log(1-prob));}}
for(const [name,s] of Object.entries(scores))console.log(name,JSON.stringify({games:s.n,brier:s.n?s.brier/s.n:null,logLoss:s.n?s.logLoss/s.n:null}));
console.log('Evaluation uses only games dated strictly before each prediction day; same-day results are excluded. Models must be compared on identical eligible games.');
