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
function predict(home,away,ratings,metrics){
 const ph=1/(1+10**(-(ratings[home]+45-ratings[away])/400));
 const margin=(ph*2-1)*metrics.meanAbsoluteMargin;
 const homePts=Math.round((metrics.meanTotal+margin)/2),awayPts=Math.round((metrics.meanTotal-margin)/2);
 return {ph,homePts,awayPts,winner:margin>=0?home:away,spread:Math.abs(margin)};
}
async function show(){
 const [elo,official]=await Promise.all([get('data/nba-2026-27-current-provisional.json'),get('data/nba-game-center.json')]);
 const ratings=Object.fromEntries(elo.rankings.map(r=>[r.team,r.elo]));
 const played=elo.events||[];
 if(Object.keys(ratings).length!==30||played.length<5)throw Error('Not enough verified NBA Elo data for provisional forecasts');
 const metrics={meanTotal:played.reduce((s,g)=>s+g.home_score+g.away_score,0)/played.length,
 meanAbsoluteMargin:played.reduce((s,g)=>s+Math.abs(g.home_score-g.away_score),0)/played.length};
 const date=today();
 const games=(official.games||[]).filter(g=>day(g.date)===date&&g.state!=='post').sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 const entries=games.map(g=>{
   const h=g.teams?.find(t=>t.home_away==='home'),a=g.teams?.find(t=>t.home_away==='away');
   const hc=norm(h?.code),ac=norm(a?.code);if(!Number.isFinite(ratings[hc])||!Number.isFinite(ratings[ac]))return '';
   const p=predict(hc,ac,ratings,metrics);
   const names={home:h?.name||hc,away:a?.name||ac};
   return '<article class="rabby-game"><p class="rabby-time">'+esc(fmt(g.date))+' · '+esc(g.status||'Scheduled')+'</p><div class="rabby-teams"><div><b>'+esc(names.away)+'</b><small>Elo '+ratings[ac].toFixed(1)+'</small></div><span>@</span><div><b>'+esc(names.home)+'</b><small>Elo '+ratings[hc].toFixed(1)+'</small></div></div><div class="rabby-model"><span><strong>Rabby winner</strong> '+esc(p.winner===hc?names.home:names.away)+'</span><span><strong>Projected spread</strong> '+esc(p.winner)+' by '+p.spread.toFixed(1)+'</span><span><strong>Predicted score</strong> '+esc(ac)+' '+p.awayPts+' – '+esc(hc)+' '+p.homePts+'</span><span><strong>Win probability</strong> '+Math.max(p.ph,1-p.ph).toLocaleString('en-US',{style:'percent',maximumFractionDigits:1})+'</span></div></article>';
 }).filter(Boolean);
 $('nba-rabby-games').innerHTML=entries.length?entries.join(''):'<p class="hub-small">No pending NBA games in today’s published official NBA schedule. No unverified matchups will be shown.</p>';
 $('nba-rabby-status').textContent=date+' · '+entries.length+' pending games · Current Elo: '+elo.games_played+' completed games · Official NBA schedule · Provisional score model calibrated only on '+played.length+' completed current-season games.';
}
show().catch(e=>{$('nba-rabby-status').textContent='Official NBA schedule or model unavailable: '+e.message;$('nba-rabby-games').innerHTML='<p class="hub-small">Rabby will not invent scheduled games or projected scores when verified inputs are missing.</p>';});
})();