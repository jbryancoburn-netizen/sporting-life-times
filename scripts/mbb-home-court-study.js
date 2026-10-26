#!/usr/bin/env node
/* Five-season home court audit and out-of-sample calibration.
   Every season resets chronological Elo to 1500. Estimate the best home-court
   Elo advantage from earlier seasons, then evaluate on the NEXT season.
   No roster or prior-season team ratings carried forward.
*/
const fs=require('node:fs');
const years=[2022,2023,2024,2025,2026];
const edges=[0,15,30,45,60,75,90,105,120];
const k=28;
const probability=(a,b,edge)=>1/(1+10**((b-a-edge)/400));
const clamp=p=>Math.max(1e-9,Math.min(1-1e-9,p));
const seasons=[];
for(const year of years){
 const path='data/mbb-'+(year-1)+'-'+year+'-results.json';
 const d=JSON.parse(fs.readFileSync(path,'utf8'));
 if(!d.audit?.complete||d.games.length<4000)throw Error('Incomplete season: '+path);
 const games=d.games.slice().sort((a,b)=>a.date.localeCompare(b.date)||String(a.id).localeCompare(String(b.id)));
 const ids=new Set(),count={home:0,neutral:0,invalid:0,homeWins:0,homeMargin:0,neutralFirstWins:0};
 for(const g of games){
  ids.add(g.id);
  if(g.site==='neutral'){count.neutral++;if(g.home_score>g.away_score)count.neutralFirstWins++;}
  else if(g.site==='home'){count.home++;if(g.home_score>g.away_score)count.homeWins++;count.homeMargin+=g.home_score-g.away_score;}
  else count.invalid++;
 }
 if(ids.size!==games.length||count.invalid)throw Error('Invalid/duplicate game identities or site types '+year);
 seasons.push({year,games,count});
}
function evaluate(season,edge,onlyHome=false){
 const ratings=new Map(),seen=new Set(),s={n:0,brier:0,logloss:0,homeN:0,homeBrier:0,neutralN:0,neutralBrier:0};
 let i=0;
 while(i<season.games.length){
  const day=season.games[i].date.slice(0,10);let j=i;
  while(j<season.games.length&&season.games[j].date.slice(0,10)===day)j++;
  for(const g of season.games.slice(i,j)){
   if(!seen.has(g.home_id)||!seen.has(g.away_id))continue;
   if(onlyHome&&g.site!=='home')continue;
   const y=g.home_score>g.away_score?1:0;
   const p=clamp(probability(ratings.get(g.home_id),ratings.get(g.away_id),g.site==='home'?edge:0));
   const error=(p-y)**2;
   s.n++;s.brier+=error;s.logloss+=-y*Math.log(p)-(1-y)*Math.log(1-p);
   if(g.site==='home'){s.homeN++;s.homeBrier+=error;}else{s.neutralN++;s.neutralBrier+=error;}
  }
  for(const g of season.games.slice(i,j)){
   const a=ratings.get(g.home_id)??1500,b=ratings.get(g.away_id)??1500;
   const y=g.home_score>g.away_score?1:0;
   const margin=Math.min(2.5,1+Math.log1p(Math.abs(g.home_score-g.away_score))/3);
   const delta=k*margin*(y-probability(a,b,g.site==='home'?edge:0));
   ratings.set(g.home_id,a+delta);ratings.set(g.away_id,b-delta);
   seen.add(g.home_id);seen.add(g.away_id);
  }
  i=j;
 }
 return {n:s.n,brier:s.brier/s.n,logloss:s.logloss/s.n,homeN:s.homeN,homeBrier:s.homeBrier/s.homeN,neutralN:s.neutralN,neutralBrier:s.neutralBrier/s.neutralN};
}
const reports=[];
for(let i=0;i<seasons.length;i++){
 const season=seasons[i],c=season.count;
 const row={season:(season.year-1)+'-'+String(season.year).slice(-2),games:season.games.length,home_games:c.home,neutral_games:c.neutral,home_win_pct:c.homeWins/c.home,home_margin:c.homeMargin/c.home,neutral_designated_home_win_pct:c.neutralFirstWins/c.neutral};
 if(i>0){
  const training=seasons.slice(0,i);
  const scores=edges.map(edge=>({edge,brier:training.reduce((s,t)=>{const r=evaluate(t,edge,true);return s+r.brier*r.n},0)/training.reduce((s,t)=>s+evaluate(t,edge,true).n,0)}));
  scores.sort((a,b)=>a.brier-b.brier);
  row.trained_home_edge=scores[0].edge;
  row.holdout_baseline=evaluate(season,0);
  row.holdout_calibrated=evaluate(season,row.trained_home_edge);
 }
 reports.push(row);
}
const weighted=(rows,key)=>{let n=0,sum=0;for(const r of rows){const a=r[key];if(!a)continue;n+=a.n;sum+=a.brier*a.n;}return sum/n;};
const holdouts=reports.slice(1);
const result={study:'2021-22 through 2025-26 home court, strength-adjusted',method:'Prior seasons select Elo home advantage by rolling-day Brier score; next season is untouched holdout; all teams reset to 1500 each season.',limitations:['Home vs neutral classification comes from source feed and is not independently venue-audited','Schedule and team strength can still confound raw home-win and margin statistics','The tuning model is chronological Elo; a RETRO-specific edge requires a separate rolling RETRO evaluation','Conference status, travel and rest cannot be evaluated from this dataset without additional verified metadata'],candidate_home_edges:edges,season_reports:reports,holdout_combined:{games:holdouts.reduce((n,r)=>n+r.holdout_baseline.n,0),zero_edge_brier:weighted(holdouts,'holdout_baseline'),calibrated_brier:weighted(holdouts,'holdout_calibrated')}};
fs.writeFileSync('data/mbb-home-court-study-2022-2026.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
