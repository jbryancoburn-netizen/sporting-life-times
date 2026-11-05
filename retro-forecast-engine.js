/* Sporting Life & Times — ONE men's Division I RETRO forecast calculation.
   All 365 teams: independent in-season 1500-start RETRO ratings only.
   Preliminary scoring/venue constants are not historically holdout calibrated. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.RETROForecast=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const version='retro-men-2026-27-v2';
 const homeCourtElo=100,meanTeamPoints=72,eloMarginSlope=1/25;
 const cache=new Map();
 let revision='unversioned';
 function setRevision(next){
  const id=String(next||'unversioned');
  if(revision!==id){revision=id;cache.clear();}
  return revision;
 }
 function predict(a,b,options={}){
  if(!Number.isFinite(Number(a?.elo))||!Number.isFinite(Number(b?.elo)))return null;
  const site=options.site||'neutral';
  if(!['neutral','home','away'].includes(site))throw Error('Invalid RETRO court: '+site);
  const adjusted=site==='home'?homeCourtElo:site==='away'?-homeCourtElo:0;
  const published=globalThis.RETROForecastPublication;
  if(options.gameId&&published?.model===version&&published.team_count===365){
   const requested=String(options.gameId),id=requested.startsWith('espn:')?requested:'espn:'+requested;
   const row=published.games?.find(g=>g.id===id&&
     String(g.home_id)===String(a.team_id)&&String(g.away_id)===String(b.team_id)&&
     Number(g.home_elo)===Number(a.elo)&&Number(g.away_elo)===Number(b.elo));
   if(row)return Object.freeze({model:version,revision:published.rating_revision,
     gameId:row.id,site:row.site,homeProbability:row.homeProbability,
     awayProbability:row.awayProbability,homeScore:row.homeScore,
     awayScore:row.awayScore,expectedMargin:row.homeScore-row.awayScore,
     difference:row.home_elo-row.away_elo+(row.site==='home'?homeCourtElo:0),
     venueAdjustment:row.site==='home'?homeCourtElo:0,
     status:published.calibration,publication:'central'});
  }
  const difference=Number(a.elo)-Number(b.elo)+adjusted;
  const key=[version,revision,String(options.gameId||''),String(a.team_id||a.id||''),
   String(b.team_id||b.id||''),Number(a.elo),Number(b.elo),site].join('|');
  if(cache.has(key))return cache.get(key);
  const homeProbability=1/(1+Math.pow(10,-difference/400));
  const margin=eloMarginSlope*difference;
  const homeScore=Math.max(1,Math.round(meanTeamPoints+margin/2));
  const awayScore=Math.max(1,Math.round(meanTeamPoints-margin/2));
  const forecast=Object.freeze({model:version,revision,gameId:options.gameId||null,
   homeProbability,awayProbability:1-homeProbability,
   homeScore,awayScore,expectedMargin:margin,difference,
   venueAdjustment:adjusted,site,status:'PROVISIONAL_NOT_HOLDOUT_CALIBRATED'});
  cache.set(key,forecast);
  return forecast;
 }
 function forecastGame(game,ratings,options={}){
  const get=id=>ratings instanceof Map?ratings.get(String(id)):ratings?.[String(id)];
  const home=get(game.home_id),away=get(game.away_id);
  return home&&away?predict(home,away,{site:game.site||'neutral',gameId:game.id,...options}):null;
 }
 return Object.freeze({version,homeCourtElo,setRevision,predict,forecastGame,
  probability:(a,b,site='neutral')=>predict(a,b,{site})?.homeProbability??null});
});
