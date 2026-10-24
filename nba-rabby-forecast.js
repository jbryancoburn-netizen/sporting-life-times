// Rabby NBA Forecast v0.1: empirical 2026-27 Elo-only baseline.
// Winner probability: independently owned USRS Elo +45 home advantage.
// Spread/score: current completed-game mean absolute margin and mean total.
// Not a validated point-spread model; no roster, injury or market adjustments.
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const aliases={NY:'NYK',GS:'GSW',SA:'SAS',NO:'NOP',WSH:'WAS',UTAH:'UTA'};
const norm=s=>aliases[s]||s;
const today=()=>{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const get=k=>parts.find(x=>x.type===k)?.value;
 return get('year')+'-'+get('month')+'-'+get('day');
};
const day=s=>{
 const date=new Date(s);if(!Number.isFinite(date.getTime()))return null;
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const get=k=>parts.find(x=>x.type===k)?.value;return get('year')+'-'+get('month')+'-'+get('day');
};
const fmt=s=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'}).format(new Date(s))+' ET';
async function get(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error(path+' is not published');return r.json();}
async function show(){
 const elo=await get('data/nba-2026-27-current-provisional.json');
 let official;
 try{official=await get('data/nba-upcoming-schedule.json');}
 catch(error){
  // The archived game-center file contains completed games, not the full
  // upcoming schedule. Use static backup only on its exact stamped day.
  const fallback=await get('data/nba-official-schedule-snapshot.json');
  if(fallback.date!==today()||!Array.isArray(fallback.games))
   throw Error('Dated NBA schedule unavailable; awaiting verified collector');
  official=fallback;
 }
 const ratings=Object.fromEntries(elo.rankings.map(r=>[r.team,r.elo]));
 const played=elo.events||[];
 let possession=null;
 try{possession=window.RabbyPossessionModel.build(await get('data/nba-possession-inputs.json'));}catch(_e){}
 const early=!possession&&window.RabbyEarlyScore?window.RabbyEarlyScore.build(played):null;
 if(Object.keys(ratings).length!==30||played.length<5)throw Error('Not enough verified NBA Elo data for provisional forecasts');
 const date=today();
 const games=(official.games||[]).filter(g=>day(g.date)===date&&g.state!=='post'&&(g.state==='in'||Date.parse(g.date)>=Date.now()-15*60000)).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 const entries=games.map(g=>{
   const h=g.teams?.find(t=>t.home_away==='home'),a=g.teams?.find(t=>t.home_away==='away');
   const hc=norm(h?.code),ac=norm(a?.code);if(!Number.isFinite(ratings[hc])||!Number.isFinite(ratings[ac]))return '';
   const hp=1/(1+Math.pow(10,-(ratings[hc]+45-ratings[ac])/400));
   const p=possession?window.RabbyPossessionModel.project(hc,ac,possession,ratings):(early?window.RabbyEarlyScore.project(hc,ac,early,ratings):null);
   const favorite=hp>=.5?hc:ac;
   const names={home:h?.name||hc,away:a?.name||ac};
   const bug=window.SLTScorebug.render({mode:g.state==='in'?'live':'upcoming',subtitle:fmt(g.date),away:{code:ac,name:names.away},home:{code:hc,name:names.home},awayScore:p?Math.round(p.awayPoints):undefined,homeScore:p?Math.round(p.homePoints):undefined,footer:'MODEL FORECAST · AWAY FIRST / HOME SECOND'});
   return '<article class="rabby-game">'+bug+'<div class="rabby-model"><span><strong>Elo favorite</strong> '+esc(favorite===hc?names.home:names.away)+'</span><span><strong>Win probability</strong> '+(100*Math.max(hp,1-hp)).toFixed(1)+'%</span>'+(p?'<span><strong>Experimental model spread</strong> '+esc(p.margin>=0?hc:ac)+' -'+Math.abs(p.margin).toFixed(1)+'</span><span><strong>Projected total</strong> '+p.total.toFixed(1)+'</span>':'<span>Scoring projection awaiting qualifying data</span>')+'</div></article>';

 }).filter(Boolean);
 $('nba-rabby-games').innerHTML=entries.length?entries.join(''):'<p class="hub-small">No pending NBA games in today’s published official NBA schedule. No unverified matchups will be shown.</p>';
 $('nba-rabby-status').textContent=date+' · '+entries.length+' pending games · Current Elo: '+elo.games_played+' completed games · Official NBA schedule · '+(possession?'Possession model based on '+possession.coverage.games+' NBA official box scores':early?'Experimental scores based on '+early.games+' captured finals; no validated betting edge':'Elo win probabilities available; scoring model awaiting verified results');
}
show().catch(e=>{$('nba-rabby-status').textContent='Official NBA schedule or model unavailable: '+e.message;$('nba-rabby-games').innerHTML='<p class="hub-small">Rabby will not invent scheduled games or projected scores when verified inputs are missing.</p>';});
setInterval(()=>{if(!document.hidden)show().catch(e=>console.error('NBA forecast refresh',e))},3*60*1000);
})();