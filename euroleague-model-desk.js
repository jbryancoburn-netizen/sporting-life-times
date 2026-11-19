(()=>{'use strict';if(document.body.dataset.league!=='euroleague')return;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=s=>{const x=new Date(s);return isNaN(x)?'Unscheduled':x.toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET'};
const logo=t=>{const code=String(t?.code||'').trim().toUpperCase();return /^[A-Z]{3}$/.test(code)?'<img class="el-official-logo club-logo" data-euroleague-code="'+esc(code)+'" src="assets/euroleague-logos/'+esc(code)+'.png" alt="'+esc(t?.name||code)+' crest" loading="lazy">':'';};
const clubColor=code=>window.SLTEuroLeaguePalette?.primary(code);
const clubUrl=code=>'?view=desks&club='+encodeURIComponent(code);
const selectedClub=new URLSearchParams(location.search).get('club');
const side=t=>logo(t)+'<span>'+esc(t?.name||t?.code||'Unknown')+'</span>';
let lastRendered=null;
function refreshModel(){return fetch('data/euroleague-model.json?cache='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('No model publication');return r.json()}).then(async d=>{
await window.SLTEuroLeaguePalette?.ready;
if(lastRendered===d.updated_at)return;
if(!Array.isArray(d.rankings)||d.rankings.length<18||!Array.isArray(d.standings)||d.standings.length!==d.rankings.length||!Number.isInteger(d.games_completed)||d.games_completed<1||!Number.isFinite(Date.parse(d.updated_at)))throw Error('Invalid EuroLeague season publication');
if(new Set(d.rankings.map(t=>t.code)).size!==d.rankings.length||d.standings.reduce((s,t)=>s+t.wins,0)!==d.games_completed||d.standings.reduce((s,t)=>s+t.losses,0)!==d.games_completed)throw Error('EuroLeague published totals do not reconcile');
$('el-model-status').textContent='Independent ratings · '+d.games_completed+' completed 2026–27 games · Updated '+when(d.updated_at)+' · Home +'+d.settings.home_elo+' Elo · K'+d.settings.K;
$('el-elo-table').innerHTML=window.SLTBasketballDeskLayout.rankingTable(d.rankings.map((t,i)=>({
 rank:i+1,name:t.name,badge:logo(t),href:clubUrl(t.code),color:clubColor(t.code),rating:Number(t.elo).toFixed(1),record:t.wins+'–'+t.losses
})));
if($('el-standings')&&Array.isArray(d.standings)){
$('el-standings').innerHTML=window.SLTBasketballDeskLayout.standingsTable(['Place','Club','W','L','PCT','Diff'],d.standings.map(t=>({
 name:t.name,badge:logo(t),href:clubUrl(t.code),values:[t.wins,t.losses,Number(t.win_pct).toFixed(3),t.point_diff]
})));
}
const predictedScores=(g)=>{if(!g.projection)return null;let home=Math.round(Number(g.projection.home)),away=Math.round(Number(g.projection.away));if(!Number.isFinite(home)||!Number.isFinite(away))return null;if(home===away){if(g.home_win_probability>=0.5)home++;else away++;}return {home,away,total:home+away,spread:away-home};};
$('el-forecasts').innerHTML=(d.fixtures||[]).slice(0,12).map(g=>'<article class="el-forecast"><small>'+esc(when(g.date))+'</small><div class="el-match"><div>'+side(g.away)+'</div><strong>at</strong><div>'+side(g.home)+'</div></div><div class="el-metrics"><div><span>ELO FAVORITE</span><b>'+esc(g.home_win_probability>=.5?g.home.name:g.away.name)+'</b></div><div><span>HOME WIN</span><b>'+(g.home_win_probability*100).toFixed(1)+'%</b></div><div><span>AWAY WIN</span><b>'+((1-g.home_win_probability)*100).toFixed(1)+'%</b></div>'+(g.projection?'<div><span>PROJECTED SCORE</span><b>'+predictedScores(g).away+' – '+predictedScores(g).home+'</b></div><div><span>TOTAL</span><b>'+predictedScores(g).total+'</b></div><div><span>HOME SPREAD</span><b>'+predictedScores(g).spread+'</b></div>':'<div><span>PROJECTED SCORE</span><b>Insufficient verified games</b></div>')+'</div><div class="el-odds-bar" aria-label="Home win probability '+(g.home_win_probability*100).toFixed(1)+' percent"><i style="width:'+(g.home_win_probability*100).toFixed(1)+'%"></i></div></article>').join('')||'<p class="hub-small">No future matchups verified in the current full-season schedule.</p>';
const clubDesk=$('el-club-desk');
if(clubDesk&&!clubDesk.hidden){
 const teams=new Map(d.rankings.map(t=>[t.code,t])),team=teams.get(selectedClub);
 if(!team){clubDesk.innerHTML='<p class="note">Club unavailable. <a href="?view=desks#el-ratings">Browse RETRO Rankings</a>.</p>';}
 else{
  const calendar=[];
  const standings=d.standings.find(t=>t.code===selectedClub);
  const et=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
  const add=(g,phase)=>{
   const away=typeof g.away==='object'?g.away.code:g.away,home=typeof g.home==='object'?g.home.code:g.home;
   if(away!==selectedClub&&home!==selectedClub)return;
   const atHome=home===selectedClub,opponent=teams.get(atHome?away:home);
   if(!opponent)return;
   const own=g.score?.[atHome?0:1],against=g.score?.[atHome?1:0];
   const outcome=phase==='final'&&Number.isInteger(own)&&Number.isInteger(against)&&own!==against?(own>against?'W':'L'):'';
   const date=new Date(g.date);
   calendar.push({date:g.date,phase,site:g.neutral?'neutral':atHome?'home':'away',opponent:opponent.name,teamHref:clubUrl(opponent.code),
    badge:logo(opponent),color:clubColor(opponent.code),venue:g.venue?.name||g.venue_name,tipoff:phase==='upcoming'?when(g.date):'',network:g.network,
    outcome,result:outcome?outcome+' '+own+'–'+against:phase==='final'?'Final':undefined,
    gameHref:Number.isFinite(+date)?'?view=desks&date='+encodeURIComponent(et.format(date))+'&game='+encodeURIComponent(g.id)+'#el-live-desk':''});
  };
  for(const game of d.completed_game_ledger||[])add(game,'final');
  for(const game of d.fixtures||[])add(game,'upcoming');
  calendar.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
  clubDesk.innerHTML='<div class="team-hero"><span class="el-club slt-standing-team">'+logo(team)+'</span><div>'+
   '<div class="eyebrow">EuroLeague · Club Desk</div><h1>'+esc(team.name)+'</h1><p>'+
   (standings?esc(standings.wins+'–'+standings.losses)+' · ':'')+'RETRO '+Number(team.elo).toFixed(1)+'</p></div></div>'+
   window.SLTBasketballDeskLayout.schedule(calendar,'No verified club fixtures in the published schedule.');
 }
}
lastRendered=d.updated_at;
}).catch(e=>{if(lastRendered){console.warn('EuroLeague model refresh:',e.message);return;}$('el-model-status').textContent='Ratings not yet published or source validation failed. No estimates shown.';$('el-elo-table').textContent='Awaiting a successful verified model run.';$('el-forecasts').textContent='Projections unavailable until verified game ingestion succeeds.';console.warn('EuroLeague model:',e.message)});}
refreshModel();
setInterval(()=>{if(!document.hidden)refreshModel()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshModel()});
window.addEventListener('focus',()=>{if(!document.hidden)refreshModel()});
})();