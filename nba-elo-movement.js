// Single source of truth for NBA daily Elo movement across power rankings and division standings.
// Daily = change from finals played on the most recent verified Eastern calendar day.
// Last week = Elo at the end of the same calendar day seven days earlier.
(function(root){
  'use strict';
  const dayET=value=>{
    const t=Date.parse(value);
    if(!Number.isFinite(t))return null;
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(t);
    const get=k=>parts.find(p=>p.type===k)?.value;
    return get('year')+'-'+get('month')+'-'+get('day');
  };
  const offsetDay=(day,days)=>{
    const date=new Date(day+'T12:00:00Z');
    date.setUTCDate(date.getUTCDate()+days);
    return date.toISOString().slice(0,10);
  };
  const compute=data=>{
    const rankings=data?.rankings,events=data?.events;
    if(!Array.isArray(rankings)||rankings.length!==30||!Array.isArray(events)||events.length!==data.games_played)
      return {available:false,reason:'Incomplete NBA rating ledger'};
    const ratings=Object.fromEntries(rankings.map(r=>[r.team,r.elo]));
    const ids=new Set(),dated=[];
    for(const e of events){
      const d=dayET(e.date);
      if(!d||!Object.hasOwn(ratings,e.home)||!Object.hasOwn(ratings,e.away)||e.home===e.away||
          !Number.isFinite(e.home_elo_change)||!e.id||ids.has(e.id))
        return {available:false,reason:'One or more game timestamps or Elo deltas are invalid'};
      ids.add(e.id);
      dated.push({day:d,home:e.home,away:e.away,delta:e.home_elo_change});
    }
    if(!dated.length)return {available:false,reason:'No completed NBA games yet'};
    const latest=dated.reduce((max,g)=>g.day>max?g.day:max,dated[0].day);
    const weekStart=offsetDay(latest,-7);
    const daily=Object.fromEntries(rankings.map(r=>[r.team,0]));
    const weekly=Object.fromEntries(rankings.map(r=>[r.team,0]));
    for(const g of dated){
      if(g.day===latest){daily[g.home]+=g.delta;daily[g.away]-=g.delta;}
      if(g.day>weekStart){weekly[g.home]+=g.delta;weekly[g.away]-=g.delta;}
    }
    const lastWeek=Object.fromEntries(rankings.map(r=>[r.team,r.elo-weekly[r.team]]));
    return {available:true,day:latest,weekDate:weekStart,daily,lastWeek};
  };
  const format=n=>{
    if(n===null||!Number.isFinite(n))return '<span class="nba-elo-flat">N/A</span>';
    if(n>.0005)return '<span class="nba-elo-positive" aria-label="Elo increased">▲ +'+n.toFixed(3)+'</span>';
    if(n<-.0005)return '<span class="nba-elo-negative" aria-label="Elo decreased">▼ '+n.toFixed(3)+'</span>';
    return '<span class="nba-elo-flat" aria-label="No Elo change">—</span>';
  };
  const api=Object.freeze({compute,format});
  root.NBAEloMovement=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
