/* Certified final impact for both NCAA basketball editions.
   Never derive per-game Elo or ranking moves from daily aggregate changes. */
(function(root){
 'use strict';
 const cleanId=id=>String(id??'').replace(/^espn:/,'');
 const countValid=n=>Number.isSafeInteger(n)&&n>=0;
 const intScore=v=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=500?v:null;
 function summarize(game,snapshot){
   if(game?.phase!=='final')return null;
   if(game.kind==='exhibition')return {state:'not-rated',reason:'Exhibition does not affect RETRO'};
   const id=cleanId(game.id),day=String(game.day||'').slice(0,10),
    away=game.away||{},home=game.home||{};
   if(!/^\d+$/.test(id)||!/^202[67]-\d\d-\d\d$/.test(day)||
      intScore(away.score)===null||intScore(home.score)===null||
      away.score===home.score)return {state:'pending'};
   if(!away.canonical||!home.canonical||String(away.canonical)===String(home.canonical))
     return {state:'not-rated',reason:'Outside Division I RETRO'};
   if(!snapshot||snapshot.season!=='2026-27'||!Array.isArray(snapshot.events)||
      !Array.isArray(snapshot.rankings))return {state:'pending'};
   const rowById=new Map(snapshot.rankings.map(r=>[String(r.team_id),r]));
   if(!rowById.has(String(away.canonical))||!rowById.has(String(home.canonical)))
     return {state:'not-rated',reason:'Outside Division I RETRO'};
   const matches=snapshot.events.filter(e=>
     cleanId(e.id)===id&&e.date===day&&String(e.away_id)===String(away.canonical)&&
     String(e.home_id)===String(home.canonical)&&e.away_score===away.score&&
     e.home_score===home.score);
   if(matches.length!==1||typeof snapshot.as_of!=='string'||snapshot.as_of<day)
     return {state:'pending'};
   const isOnPublicationDate=snapshot.as_of===day;
   const sameConference=String(rowById.get(String(away.canonical)).conference||'')!==''
     &&rowById.get(String(away.canonical)).conference===rowById.get(String(home.canonical)).conference;
   const make=(team,won)=>{
     const row=rowById.get(String(team.canonical)),w=Number(row.wins),l=Number(row.losses),
       cw=Number(row.conference_wins),cl=Number(row.conference_losses);
     if(!countValid(w)||!countValid(l))return null;
     const change=Number(row.daily_change);
     const dayChange=isOnPublicationDate&&typeof row.daily_change==='number'&&Number.isFinite(change)
       &&Math.abs(change)<=500?Math.round(change*10)/10:null;
     const rank=countValid(row.rank)&&row.rank>0?row.rank:null;
     const conf=sameConference&&countValid(cw)&&countValid(cl)?cw+'–'+cl:null;
     return {won,record:w+'–'+l,conferenceRecord:conf,
       dayChange,rank,asOf:snapshot.as_of};
   };
   const awaySide=make(away,away.score>home.score),
    homeSide=make(home,home.score>away.score);
   if(!awaySide||!homeSide)return {state:'pending'};
   return {state:'published',asOf:snapshot.as_of,away:awaySide,home:homeSide};
 }
 root.SLTCBBFinalImpact={summarize};
 if(typeof module!=='undefined'&&module.exports)module.exports={summarize};
})(typeof window!=='undefined'?window:globalThis);
