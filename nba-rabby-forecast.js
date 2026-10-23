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
 try{official=await get('data/nba-game-center.json');}
 catch(error){
  // Official NBA.com schedule backstop. Only render games for the snapshot's
  // exact date: never silently present yesterday's games as today's.
  const fallback=await get('data/nba-official-schedule-snapshot.json');
  if(fallback.date!==today()||!Array.isArray(fallback.games))throw Error('Official game-center unavailable and no verified schedule for today');
  official=fallback;
 }
 const ratings=Object.fromEntries(elo.rankings.map(r=>[r.team,r.elo]));
 const played=elo.events||[];
 let possession=null;
 try{possession=window.RabbyPossessionModel.build(await get('data/nba-possession-inputs.json'));}catch(_e){}
 if(Object.keys(ratings).length!==30||played.length<5)throw Error('Not enough verified NBA Elo data for provisional forecasts');
 const date=today();
 const games=(official.games||[]).filter(g=>day(g.date)===date&&g.state!=='post').sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 const entries=games.map(g=>{
   const h=g.teams?.find(t=>t.home_away==='home'),a=g.teams?.find(t=>t.home_away==='away');
   const hc=norm(h?.code),ac=norm(a?.code);if(!Number.isFinite(ratings[hc])||!Number.isFinite(ratings[ac]))return '';
   const hp=1/(1+Math.pow(10,-(ratings[hc]+45-ratings[ac])/400));
   const p=possession?window.RabbyPossessionModel.project(hc,ac,possession,ratings):null;
   const favorite=hp>=.5?hc:ac;
   const names={home:h?.name||hc,away:a?.name||ac};
   return '<article class="rabby-game"><p class="rabby-time">'+esc(fmt(g.date))+' · '+esc(g.status||'Scheduled')+'</p><div class="rabby-teams"><div><b>'+esc(names.away)+'</b><small>Elo '+ratings[ac].toFixed(1)+'</small></div><span>@</span><div><b>'+esc(names.home)+'</b><small>Elo '+ratings[hc].toFixed(1)+'</small></div></div><div class="rabby-model"><span><strong>Elo favorite</strong> '+esc(favorite===hc?names.home:names.away)+'</span><span><strong>Elo win probability</strong> '+(100*Math.max(hp,1-hp)).toFixed(1)+'%</span>'+(p?'<span><strong>Rabby scoring favorite</strong> '+esc(p.projectedWinner)+'</span><span><strong>Projected spread</strong> '+Math.abs(p.margin).toFixed(1)+'</span><span><strong>Predicted score</strong> '+esc(ac)+' '+Math.round(p.awayPoints)+' – '+esc(hc)+' '+Math.round(p.homePoints)+'</span>':'<span><strong>Spread and score</strong> Pending verified team possession data and historical calibration</span>')+'</div></article>';
 }).filter(Boolean);
 $('nba-rabby-games').innerHTML=entries.length?entries.join(''):'<p class="hub-small">No pending NBA games in today’s published official NBA schedule. No unverified matchups will be shown.</p>';
 $('nba-rabby-status').textContent=date+' · '+entries.length+' pending games · Current Elo: '+elo.games_played+' completed games · Official NBA schedule · '+(possession?'Possession model based on '+possession.coverage.games+' NBA official box scores':'Elo win probabilities available; scoring model awaiting sufficient official possessions');
}
show().catch(e=>{$('nba-rabby-status').textContent='Official NBA schedule or model unavailable: '+e.message;$('nba-rabby-games').innerHTML='<p class="hub-small">Rabby will not invent scheduled games or projected scores when verified inputs are missing.</p>';});
})();