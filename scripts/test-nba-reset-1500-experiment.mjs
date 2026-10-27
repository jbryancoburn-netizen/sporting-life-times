#!/usr/bin/env node
// Exploratory 1500-start NBA Elo replay. Predictions use only earlier finals.
// This is NOT a trained or out-of-sample model selection.
import {readFileSync} from 'node:fs';
const data=JSON.parse(readFileSync(new URL('../data/nba-2026-27-current-provisional.json',import.meta.url)));
const teams=data.rankings.map(x=>x.team);
const events=[...data.events].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||String(a.id).localeCompare(String(b.id)));
const seen=new Set();
for(const e of events){if(!e.id||seen.has(e.id))throw Error('Missing or duplicate final ID: '+e.id);seen.add(e.id);if(!teams.includes(e.home)||!teams.includes(e.away)||!Number.isFinite(+e.home_score)||!Number.isFinite(+e.away_score)||+e.home_score===+e.away_score)throw Error('Invalid final '+e.id);}
const run=(k,home)=>{const rating=Object.fromEntries(teams.map(t=>[t,1500]));let n=0,correct=0,brier=0,logloss=0;for(const e of events){const p=1/(1+10**((rating[e.away]-rating[e.home]-home)/400));const y=+(+e.home_score>+e.away_score);correct+=+(+(p>=.5)===y);brier+=(p-y)**2;logloss-=y*Math.log(p)+(1-y)*Math.log(1-p);const d=k*(y-p);rating[e.home]+=d;rating[e.away]-=d;n++;}return {k,home,n,accuracy:correct/n,brier:brier/n,logloss:logloss/n,rankings:Object.entries(rating).sort((a,b)=>b[1]-a[1])};};
const grid=[];for(const home of [0,30,50,65,80,100])for(const k of [8,16,24,32,48])grid.push(run(k,home));
const sorted=grid.sort((a,b)=>a.brier-b.brier);
console.log(JSON.stringify({status:'EXPLORATORY ONLY: 47 games cannot validate parameters',sample:{games:events.length,first:events[0]?.date,last:events.at(-1)?.date},baseline:run(24,65),grid:sorted.map(({rankings,...rest})=>rest),bestInSample:sorted[0]},null,2));
