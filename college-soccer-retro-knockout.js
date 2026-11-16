/* RETRO soccer knockout probabilities. Pure, testable module; no page mutations. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SoccerRetroKnockout=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
function poisson(lambda,max=14){
 if(!Number.isFinite(lambda)||lambda<=0)throw Error('Expected goals must be positive');
 const p=[Math.exp(-lambda)];
 for(let k=1;k<=max;k++)p.push(p[k-1]*lambda/k);
 // Fold numerical tail into last bin to conserve probability.
 const sum=p.reduce((a,b)=>a+b,0);p[max]+=Math.max(0,1-sum);
 return p;
}
function expectedGoals(eloHome,eloAway,options={}){
 if(!Number.isFinite(eloHome)||!Number.isFinite(eloAway))throw Error('Finite RETRO ratings required');
 const base=clamp(options.baseGoals??1.35,0.3,3.5);
 const homeAdv=options.neutral?0:clamp(options.homeAdvantageElo??55,0,150);
 const delta=clamp(eloHome-eloAway+homeAdv,-800,800);
 const multiplier=Math.exp(delta/650);
 return {home:clamp(base*multiplier,0.15,5),away:clamp(base/multiplier,0.15,5)};
}
function regulation(homeXg,awayXg){
 const a=poisson(homeXg),b=poisson(awayXg);
 let home=0,draw=0,away=0;
 for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){
  const p=a[i]*b[j];
  if(i>j)home+=p;else if(i<j)away+=p;else draw+=p;
 }
 return {home,draw,away};
}
function match(eloHome,eloAway,options={}){
 const xg=expectedGoals(eloHome,eloAway,options);
 const reg=regulation(xg.home,xg.away);
 // Extra time uses one third of 90-minute expected goals.
 const et=regulation(xg.home/3,xg.away/3);
 const penalties=clamp(0.5+(eloHome-eloAway)/3000,0.35,0.65);
 const advanceHome=reg.home+reg.draw*(et.home+et.draw*penalties);
 const advanceAway=1-advanceHome;
 return {expectedGoals:xg,regulation:reg,extraTime:et,penaltyHomeProbability:penalties,advanceHome,advanceAway,
  methodology:'Independent Poisson goals model; illustrative until back-tested on college soccer results'};
}
return Object.freeze({poisson,expectedGoals,regulation,match});
});
