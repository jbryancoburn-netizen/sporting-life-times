(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>Number.isFinite(Number(n))?Number(n):0;
const logo=code=>'https://a.espncdn.com/i/teamlogos/nba/500/'+({NYK:'ny',UTA:'utah',WAS:'wsh',NOP:'no',GSW:'gs',SAS:'sa'}[code]||String(code).toLowerCase())+'.png';
const fmt=d=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'medium'}).format(new Date(d));
async function fetchData(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error('Could not load '+path);return r.json()}
const panel=(t)=>'<div class="game-team" style="--team-color:'+window.SLTScorebug.color(t.code)+'"><img src="'+logo(t.code)+'" alt="" onerror="this.hidden=true"><b>'+esc(t.name)+'</b><strong>'+esc(t.score)+'</strong><small>'+esc(t.home_away==='away'?'AWAY':'HOME')+'</small></div>';
const player=p=>'<div class="player"><div class="player-head"><b>'+esc(p.name)+'</b><small>'+esc(p.min)+' MIN</small></div><div class="big-stats"><span><b>'+esc(p.pts)+'</b><small>PTS</small></span><span><b>'+esc(p.reb)+'</b><small>REB</small></span><span><b>'+esc(p.ast)+'</b><small>AST</small></span></div><div class="fine-stats">STL '+esc(p.stl)+' · BLK '+esc(p.blk)+' · FG '+esc(p.fgm)+'/'+esc(p.fga)+' · 3PT '+esc(p.fg3m)+'/'+esc(p.fg3a)+' · FT '+esc(p.ftm)+'/'+esc(p.fta)+'</div></div>';
function render(g,events,rankings){
 const away=g.teams.find(t=>t.home_away==='away'),home=g.teams.find(t=>t.home_away==='home');
 if(!away||!home){$('game').textContent='Verified teams unavailable';return}
 const event=events.find(e=>e.id===g.id);
 const eloByTeam=Object.fromEntries(rankings.map(x=>[x.team,x.elo]));
 const index=events.findIndex(e=>e.id===g.id);
 const atEnd=index===events.length-1;
 const delta=Number(event?.home_elo_change);
 const eloStat=(team,homeTeam)=>{if(!event||!Number.isFinite(delta))return 'Elo unavailable';const d=homeTeam?delta:-delta;
   const after=atEnd?eloByTeam[team.code]:null;
   return '<b>'+(after!=null?Number(after).toFixed(1):'—')+'</b><small>GAME ELO CHANGE '+(d>0?'+':'')+d.toFixed(1)+(after==null?' · Historical postgame rating not displayed':'')+'</small>';
 };
 const highlight=(g.leaders||[]).slice(0,4).map(p=>'<div class="star"><small>'+esc(p.team)+'</small><b>'+esc(p.name)+'</b><strong>'+esc(p.pts)+' <small>PTS</small></strong><small>'+esc(p.reb)+' REB · '+esc(p.ast)+' AST</small></div>').join('');
 const roster=t=>'<section class="roster" style="--team-color:'+window.SLTScorebug.color(t.code)+'"><h4>'+esc(t.name)+'</h4>'+g.players.filter(p=>p.team===t.code).sort((a,b)=>num(b.pts)-num(a.pts)).map(player).join('')+'</section>';
 $('game').innerHTML='<div class="game-hero"><div class="game-label"><span>'+esc(g.status||'FINAL')+'</span><span>'+esc(fmt(g.date))+'</span></div><div class="game-teams">'+panel(away)+panel(home)+'</div><div class="game-summary"><div>'+eloStat(away,false)+'</div><div>'+eloStat(home,true)+'</div></div></div><section class="section"><h3>Top Performers</h3><div class="star-grid">'+highlight+'</div></section><section class="section"><h3>Complete Player Box Score</h3><div class="rosters">'+roster(away)+roster(home)+'</div></section><section class="section"><h3>Game Sources</h3><div class="links"><a target="_blank" rel="noopener noreferrer" href="'+esc(g.url)+'">Official game box score ↗</a><a href="nba.html#page-3">Standings & Elo ↗</a></div><p class="notice">Player statistics are sourced from captured completed-game box scores. Possession timelines and quarter scoring are not included until verified data is available.</p></section>';
}
async function boot(){
 try{
  const [archive,elo]=await Promise.all([fetchData('data/nba-game-center.json'),fetchData('data/nba-2026-27-current-provisional.json')]);
  const games=(archive.games||[]).filter(g=>g.state==='post'&&g.teams?.length>=2).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const selector=$('games');selector.innerHTML='';
  for(const g of games){const a=g.teams.find(t=>t.home_away==='away'),h=g.teams.find(t=>t.home_away==='home');const option=document.createElement('option');option.value=g.id;option.textContent=(a?.code||'Away')+' '+a?.score+' at '+(h?.code||'Home')+' '+h?.score+' · '+fmt(g.date);selector.appendChild(option)}
  function select(id){const g=games.find(x=>x.id===id)||games[0];if(!g)return;selector.value=g.id;render(g,elo.events||[],elo.rankings||[]);history.replaceState(null,'','?game='+encodeURIComponent(g.id))}
  selector.addEventListener('change',()=>select(selector.value));
  select(new URLSearchParams(location.search).get('game'));
 }catch(e){$('game').textContent='Game information unavailable: '+e.message}
}
boot();
})();