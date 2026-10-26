/* Basketball RETRO: all-games network rating, independent of game order. */
(function(root){'use strict';
function retro(games,opts={}){
 const base=opts.baseline??1500,edge=opts.homeEdge??65,passes=opts.passes??160;
 const events=[],counts=new Map(),ratings=new Map();
 for(const g of games){
  const a=String(g.home_id??g.home??''),b=String(g.away_id??g.away??'');
  const sa=Number(g.home_score),sb=Number(g.away_score);
  if(!a||!b||a===b||!Number.isFinite(sa)||!Number.isFinite(sb))continue;
  for(const id of [a,b]){if(!ratings.has(id))ratings.set(id,base);counts.set(id,(counts.get(id)||0)+1)}
  events.push({a,b,sa,sb,edge:g.site==='neutral'||g.neutral===true?0:edge});
 }
 const prob=(a,b,e)=>1/(1+10**((b-a-e)/400));
 for(let pass=0;pass<passes;pass++){
  const gradient=new Map([...ratings.keys()].map(id=>[id,0]));
  for(const g of events){
   const actual=g.sa===g.sb?.5:g.sa>g.sb?1:0;
   const margin=Math.abs(g.sa-g.sb);
   // Basketball MOV scales by possessions-like scoring environment, not football points.
   const scale=Math.min(2.5,1+Math.log1p(margin)/3);
   const residual=scale*(actual-prob(ratings.get(g.a),ratings.get(g.b),g.edge));
   gradient.set(g.a,gradient.get(g.a)+residual);
   gradient.set(g.b,gradient.get(g.b)-residual);
  }
  for(const [id,old] of ratings){
   const next=old+18*((gradient.get(id)||0)-.006*(old-base))/(3+counts.get(id));
   ratings.set(id,Math.max(1100,Math.min(1900,next)));
  }
 }
 return {games:events.length,ratings:Object.fromEntries(ratings)};
}
root.MBB_RETRO={calculate:retro,version:'basketball-retro-experimental-v1'};
})(typeof window!=='undefined'?window:globalThis);
