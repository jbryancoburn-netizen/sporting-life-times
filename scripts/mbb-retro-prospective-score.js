#!/usr/bin/env node
/* Scores only predictions saved BEFORE a game's date. No retroactive forecasts. */
const fs=require('node:fs');
const predictionPath='data/mbb-retro-prospective-predictions-2026-27.json';
const resultsPath='data/mbb-2026-2027-results.json';
if(!fs.existsSync(predictionPath)){console.log('No pregame predictions yet; nothing to score.');process.exit(0);}
if(!fs.existsSync(resultsPath)){console.log('No completed-game feed yet; nothing to score.');process.exit(0);}
const pred=JSON.parse(fs.readFileSync(predictionPath,'utf8'));
const result=JSON.parse(fs.readFileSync(resultsPath,'utf8'));
if(!Array.isArray(pred.predictions)||!Array.isArray(result.games))throw Error('Malformed predictions/results');
const games=new Map(result.games.map(g=>[String(g.id),g]));
const sums={65:{n:0,brier:0,logloss:0},100:{n:0,brier:0,logloss:0}};
const seen=new Set();
for(const p of pred.predictions){
 const id=String(p.game_id),g=games.get(id);
 if(seen.has(id))throw Error('Duplicate forecast '+id);
 seen.add(id);
 if(!g)continue;
 const recorded=Date.parse(p.recorded_at),tip=p.tipoff_at?Date.parse(p.tipoff_at):NaN;
 if(!Number.isFinite(recorded)||!Number.isFinite(tip)||recorded>=tip)throw Error('Missing or late forecast '+id);
 // Exclude ESPN's 11:59 PM Eastern placeholder tipoffs, including archived captures.
 const eastern=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(tip));
 if(eastern==='23:59')continue;
 if(!Number.isFinite(Number(g.home_score))||!Number.isFinite(Number(g.away_score))||g.home_score===''||g.away_score==='')continue;
 if(String(p.home_id)!==String(g.home_id)||String(p.away_id)!==String(g.away_id))throw Error('Team mismatch '+id);
 const y=Number(g.home_score)>Number(g.away_score)?1:0;
 for(const edge of [65,100]){
  const probability=Number(p['p_home_'+edge]);
  if(!(probability>0&&probability<1))throw Error('Invalid probability '+id+' edge '+edge);
  const s=sums[edge];s.n++;s.brier+=(probability-y)**2;s.logloss+=-(y*Math.log(probability)+(1-y)*Math.log(1-probability));
 }
}
const out={season:'2026-27',method:'Only forecasts timestamped before tipoff, paired by game id; same games for 65 and 100',evaluated_at:new Date().toISOString(),models:Object.fromEntries(Object.entries(sums).map(([edge,s])=>[edge,{games:s.n,brier:s.n?s.brier/s.n:null,logloss:s.n?s.logloss/s.n:null}]))};
fs.writeFileSync('data/mbb-retro-prospective-score-2026-27.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out));
