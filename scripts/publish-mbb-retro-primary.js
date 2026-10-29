#!/usr/bin/env node
/* Published 2026-27 MBB RETRO: one clean-slate 1500 Elo for all 365 D-I programs.
   Use only verified, uniquely identified completed 2026-27 games; never seed old ratings.
   Offline and deterministic: safe for cheap, frequent GitHub Actions runs.
*/
'use strict';
const fs=require('node:fs');
require('../mbb-retro.js');
const path='data/';
const read=name=>JSON.parse(fs.readFileSync(path+name,'utf8'));
const preseason=read('ncaam-2026-27-preseason-player-quality-live.json');
if(preseason.rankings?.length!==365)throw Error('Expected exactly 365 D-I programs');
const teams=preseason.rankings.map(x=>({team_id:String(x.team_id),team:String(x.team),conference:String(x.conference||'')}));
const ids=new Set(teams.map(x=>x.team_id));
if(ids.size!==365)throw Error('Duplicate D-I team identities');
const dataSets=[
  ['NCAA verified final-game ledger',read('ncaam-2026-27-game-ledger.json').games||[]],
  ['verified MBB season results',read('mbb-2026-2027-results.json').games||[]]
];
const finals=new Map();
const issue=[];
const inSeason=x=>{const d=String(x||'').slice(0,10);return /^20\d\d-\d\d-\d\d$/.test(d)&&d>='2026-11-01'&&d<='2027-04-30';};
for(const [source,rows] of dataSets){
 for(const g of rows){
  if(g.status&& !['final','post','completed'].includes(String(g.status).toLowerCase()))continue;
  const id=String(g.id??g.game_id??g.contest_id??'').trim();
  const home=String(g.home_id??g.home_team_id??g.home??'');
  const away=String(g.away_id??g.away_team_id??g.away??'');
  const hs=Number(g.home_score),as=Number(g.away_score);
  const date=String(g.date??g.game_date??'');
  if(!id||!ids.has(home)||!ids.has(away)||home===away||!inSeason(date)||g.home_score===''||g.away_score===''||!Number.isInteger(hs)||!Number.isInteger(as)||hs<1||as<1||hs===as){
   issue.push({id:id||null,source,reason:'unverified identity/date/final score'});
   continue;
  }
  const neutral=(g.neutral===true||g.neutral_site===true||g.neutralSite===true||String(g.site||'').toLowerCase()==='neutral');
  const siteVerified=(g.site_verified===true||g.venue_verified===true||neutral);
  const result={id,home_id:home,away_id:away,home_score:hs,away_score:as,date:date.slice(0,10),neutral:neutral||!siteVerified,site_verified:siteVerified,source};
  const prior=finals.get(id);
  if(prior){for(const k of ['home_id','away_id','home_score','away_score','date']){if(prior[k]!==result[k])throw Error('Conflicting verified finals '+id+': '+k);}}
  else finals.set(id,result);
 }
}
const games=[...finals.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
const calculated=globalThis.MBB_RETRO.calculate(games,{baseline:1500,homeEdge:100,passes:160});
if(calculated.games!==games.length)throw Error('RETRO game coverage regression');
const rating=calculated.ratings;
const lastDate=games.at(-1)?.date||null;
const previousGames=lastDate?games.filter(g=>g.date<lastDate):[];
const previous=lastDate?globalThis.MBB_RETRO.calculate(previousGames,{baseline:1500,homeEdge:100,passes:160}).ratings:{};
const record=new Map(teams.map(x=>[x.team_id,{wins:0,losses:0,conference_wins:0,conference_losses:0,games_played:0}]));
const byId=new Map(teams.map(x=>[x.team_id,x]));
for(const game of games){
 const a=record.get(game.home_id),b=record.get(game.away_id);
 a.games_played++;b.games_played++;
 const winner=game.home_score>game.away_score?a:b,loser=winner===a?b:a;
 winner.wins++;loser.losses++;
 if(byId.get(game.home_id).conference===byId.get(game.away_id).conference){
  winner.conference_wins++;loser.conference_losses++;
 }
}
const ranks=teams.map(t=>{
 const r=record.get(t.team_id);
 return {...t,base_elo:1500,elo:Number((rating[t.team_id]??1500).toFixed(3)),
  daily_change:lastDate?Number(((rating[t.team_id]??1500)-(previous[t.team_id]??1500)).toFixed(3)):0,
  ...r,retro_coverage:games.length?'completed_verified_2026_27_games':'clean-slate'};
}).sort((a,b)=>b.elo-a.elo||a.team.localeCompare(b.team));
let lastElo=null;
ranks.forEach((t,i)=>{t.rank=(lastElo===t.elo&&i>0)?ranks[i-1].rank:i+1;lastElo=t.elo;});
const out={model:'retro-clean-slate',season:'2026-27',
 status:games.length?'verified-inseason':'preseason-all-tied',
 games_played:games.length,starting_elo:1500,as_of:games.at(-1)?.date||null,
 source_season:null,roster_adjustment_source:null,
 parameters:{baseline:1500,home_edge:100,passes:160,method:'all-games independent network RETRO',unverified_venue_policy:'neutral home edge until separately verified'},
 sources:dataSets.map(([name,rows])=>({name,rows:rows.length})),
 excluded_unverified_rows:issue.length,
 note:'RETRO is the sole published MBB rating. All 365 programs begin every season at 1500. No last-season or roster adjustment. Only verified final scores move ratings. Incomplete site classification does not earn home advantage.',
 rankings:ranks,events:games};
if(out.rankings.length!==365||out.events.length!==out.games_played||out.rankings.some(x=>x.base_elo!==1500||!Number.isFinite(x.elo)))throw Error('Published RETRO integrity check failed');
const target=path+'ncaam-2026-27-retro-primary.json';
const content=JSON.stringify(out,null,2)+'\n';
if(fs.existsSync(target)&&fs.readFileSync(target,'utf8')===content)console.log('MBB RETRO already current:',games.length,'verified finals');
else {fs.writeFileSync(target,content);console.log('Published current MBB RETRO:',games.length,'finals, 365 teams, 1500 baseline, '+issue.length+' unverified excluded');}
