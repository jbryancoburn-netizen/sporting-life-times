/* Experimental in-game win probability. This never writes season ratings. */
(function(root){
 'use strict';
 function estimate({status,away,home,prior,possession,women}){
  if(!Number.isFinite(away)||!Number.isFinite(home)||away<0||home<0)return null;
  const text=String(status||'');
  const clock=text.match(/\b(\d{1,2}):(\d{2})(?:\.\d+)?\b/);
  const regulation=women?4:2, length=2400/regulation;
  const period=Number(text.match(/\b([1-4])(?:st|nd|rd|th)\b/i)?.[1]);
  const overtime=/\b(?:\d*OT|OVERTIME)\b/i.test(text);
  const clockSeconds=clock?Number(clock[1])*60+Number(clock[2]):null;
  const halftime=/\bHALFTIME\b/i.test(text);
  if(!halftime&&(clockSeconds===null||Number(clock[2])>=60||
     (overtime?clockSeconds>300:!period||period>regulation||clockSeconds>length)))return null;
  const remaining=halftime?1200:overtime?clockSeconds:(regulation-period)*length+clockSeconds;
  const p=Number.isFinite(prior)?Math.min(.995,Math.max(.005,prior)):.5;
  const fraction=remaining/2400;
  const margin=home-away+(possession==='home'?.55:possession==='away'?-.55:0);
  const logOdds=Math.log(p/(1-p))*Math.sqrt(fraction)+margin/Math.max(.9,7*Math.sqrt(fraction));
  return Math.min(.99,Math.max(.01,1/(1+Math.exp(-logOdds))));
 }
 function timeline(plays,g,women){
  const regulation=women?4:2;
  let previous=Number.isFinite(g.retroLivePrior)?g.retroLivePrior:.5;
  const changes=[];
  for(const play of plays){
   const period=Number(play.period);
   if(!Number.isInteger(period)||period<1||!play.clock||play.awayScore==null||play.homeScore==null)continue;
   const text=String(play.text||'');
   const teamId=String(play.teamId||'');
   const turnover=/\bturnover\b/i.test(text);
   const possession=turnover&&teamId===String(g.home.id)?'away':
     turnover&&teamId===String(g.away.id)?'home':null;
   const label=period>regulation?(period-regulation)+'OT':['','1st','2nd','3rd','4th'][period];
   const probability=estimate({status:play.clock+' '+label,away:Number(play.awayScore),home:Number(play.homeScore),
     prior:g.retroLivePrior,possession,women});
   if(probability===null)continue;
   changes.push({clock:play.clock,period:label,text,probability,change:probability-previous});
   previous=probability;
  }
  const major=new Set([...changes].sort((a,b)=>Math.abs(b.change)-Math.abs(a.change)).slice(0,5));
  return changes.filter((p,i)=>i===0||i===changes.length-1||major.has(p));
 }
 root.SLTRetroLive={estimate,timeline};
})(typeof window==='undefined'?globalThis:window);
