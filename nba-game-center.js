(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>Number.isFinite(Number(n))?Number(n):0;
const logo=code=>'https://a.espncdn.com/i/teamlogos/nba/500/'+({NYK:'ny',UTA:'utah',WAS:'wsh',NOP:'no',GSW:'gs',SAS:'sa'}[code]||String(code).toLowerCase())+'.png';
const fmt=d=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'medium'}).format(new Date(d));
async function fetchData(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error('Could not load '+path);return r.json()}
const panel=(t,record)=>'<div class="game-team" style="--team-color:'+window.SLTScorebug.color(t.code)+'"><img src="'+logo(t.code)+'" alt="" onerror="this.hidden=true"><b>'+esc(t.name)+'</b><strong>'+esc(t.score)+'</strong><small>'+esc(record)+'</small></div>';
const player=p=>'<div class="player"><div class="player-head"><b>'+esc(p.name)+'</b><small>'+esc(p.min)+' MIN</small></div><div class="big-stats"><span><b>'+esc(p.pts)+'</b><small>PTS</small></span><span><b>'+esc(p.reb)+'</b><small>REB</small></span><span><b>'+esc(p.ast)+'</b><small>AST</small></span></div><div class="fine-stats">STL '+esc(p.stl)+' · BLK '+esc(p.blk)+' · FG '+esc(p.fgm)+'/'+esc(p.fga)+' · 3PT '+esc(p.fg3m)+'/'+esc(p.fg3a)+' · FT '+esc(p.ftm)+'/'+esc(p.fta)+'</div></div>';
function render(g,events,rankings){
 const away=g.teams.find(t=>t.home_away==='away'),home=g.teams.find(t=>t.home_away==='home');
 if(!away||!home){$('game').textContent='Verified teams unavailable';return}
 const event=events.find(e=>e.id===g.id);
 const latest=Object.fromEntries(rankings.map(x=>[x.team,Number(x.elo)]));
 const rolling={...latest}, postgame=new Map();
 for(let i=events.length-1;i>=0;i--){
  const e=events[i],d=Number(e.home_elo_change);
  if(!Number.isFinite(d)||!Number.isFinite(rolling[e.home])||!Number.isFinite(rolling[e.away]))continue;
  const ranks=Object.entries(rolling).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  const place=t=>ranks.findIndex(x=>x[0]===t)+1;
  const afterH=place(e.home),afterA=place(e.away);
  const hElo=rolling[e.home],aElo=rolling[e.away];
  rolling[e.home]-=d;rolling[e.away]+=d;
  const before=Object.entries(rolling).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  const previous=t=>before.findIndex(x=>x[0]===t)+1;
  postgame.set(e.id,{[e.home]:{elo:hElo,delta:d,rank:afterH,movement:previous(e.home)-afterH},[e.away]:{elo:aElo,delta:-d,rank:afterA,movement:previous(e.away)-afterA}});
 }
 // Records are reconstructed chronologically through each final, not taken from today's standings.
 const gameRecords=new Map(), tally={};
 for(const e of events){
  if(!Number.isFinite(Number(e.home_score))||!Number.isFinite(Number(e.away_score))||Number(e.home_score)===Number(e.away_score))continue;
  for(const code of [e.away,e.home])tally[code]??={w:0,l:0};
  const homeWon=Number(e.home_score)>Number(e.away_score);
  tally[e.home][homeWon?'w':'l']++;
  tally[e.away][homeWon?'l':'w']++;
  gameRecords.set(e.id,{[e.away]:{...tally[e.away]},[e.home]:{...tally[e.home]}});
 }
 const selectedRecords=gameRecords.get(g.id);
 const recordFor=t=>{const rec=selectedRecords?.[t.code];return rec?rec.w+'–'+rec.l:'Record unavailable'};
 const gameElo=postgame.get(g.id);
 const eloStat=t=>{const v=gameElo?.[t.code];if(!v)return '<small>Elo unavailable</small>';
  return '<b>'+v.elo.toFixed(1)+'</b><small>ELO '+(v.delta>0?'+':'')+v.delta.toFixed(1)+' · RANK #'+v.rank+(v.movement>0?' ▲'+v.movement:v.movement<0?' ▼'+Math.abs(v.movement):'')+'</small>';
 };
 const quarterScores=(()=>{
  const periods=g.period_scores;
  if(!periods?.away?.length||!periods?.home?.length||periods.away.length!==periods.home.length)return '';
  const labels=periods.away.map((_,i)=>i<4?'Q'+(i+1):'OT'+(i-3));
  const row=(t,values)=>'<div class="quarter-row"><b>'+esc(t.code)+'</b>'+values.map(v=>'<span>'+esc(v)+'</span>').join('')+'<strong>'+esc(t.score)+'</strong></div>';
  return '<section class="section"><h3>Quarter by Quarter</h3><div class="quarter-scroller"><div class="quarter-table" style="--periods:'+labels.length+'"><div class="quarter-row quarter-head"><b></b>'+labels.map(v=>'<span>'+v+'</span>').join('')+'<strong>FINAL</strong></div>'+row(away,periods.away)+row(home,periods.home)+'</div></div></section>';
 })();
 const teamComparison=(()=>{
  const values=window.SLTGameComparison?.analyze(g)||[];
  if(!values.length)return '';
  const fmt=n=>Number.isInteger(n)?String(n):n.toFixed(1);
  const rows=values.map(m=>{
   const difference=Math.abs(m.gap).toFixed(m.unit==='%'?1:0);
   const delta=m.advantage==='even'?'Even':(m.advantage==='away'?esc(away.code):esc(home.code))+' +'+difference+(m.unit==='%'?' pp':'');
   return '<div class="compare-row meaningful-compare"><div class="compare-value">'+fmt(m.away)+(m.unit||'')+'</div><div class="compare-bars"><span style="width:'+m.awayWidth.toFixed(1)+'%;background:'+window.SLTScorebug.color(away.code)+'"></span></div><div class="compare-name"><b>'+esc(m.name)+'</b><small>'+delta+'</small></div><div class="compare-bars compare-home"><span style="width:'+m.homeWidth.toFixed(1)+'%;background:'+window.SLTScorebug.color(home.code)+'"></span></div><div class="compare-value">'+fmt(m.home)+(m.unit||'')+'</div></div>';
  }).join('');
  const notes=values.filter(m=>m.advantage!=='even').sort((a,b)=>Math.abs(b.gap)-Math.abs(a.gap)).slice(0,2).map(m=>'<span>'+esc(m.name)+': '+esc(m.advantage==='away'?away.code:home.code)+' '+Math.abs(m.gap).toFixed(m.unit==='%'?1:0)+(m.unit==='%'?' percentage points':'')+' '+(m.direction<0?'fewer':'more')+'</span>').join('');
  return '<section class="section"><h3>Team Comparison</h3><p class="notice">Shooting differences are percentage points. Turnover advantage goes to the team with fewer turnovers. Each pair of bars shares the same scale.</p><div class="comparison"><div class="compare-header"><span>'+esc(away.code)+'</span><span>'+esc(home.code)+'</span></div>'+rows+'</div>'+(notes?'<div class="game-observations"><b>Notable differences</b>'+notes+'</div>':'')+'</section>';
 })();
 const highlight=(g.leaders||[]).slice(0,4).map(p=>'<div class="star"><small>'+esc(p.team)+'</small><b>'+esc(p.name)+'</b><strong>'+esc(p.pts)+' <small>PTS</small></strong><small>'+esc(p.reb)+' REB · '+esc(p.ast)+' AST</small></div>').join('');
 const roster=t=>'<section class="roster" style="--team-color:'+window.SLTScorebug.color(t.code)+'"><h4>'+esc(t.name)+'</h4>'+g.players.filter(p=>p.team===t.code).sort((a,b)=>num(b.pts)-num(a.pts)).map(player).join('')+'</section>';
 $('game').innerHTML='<div class="game-hero"><div class="game-label"><span>'+esc(g.status||'FINAL')+'</span><span>'+esc(fmt(g.date))+'</span></div><div class="game-teams">'+panel(away,recordFor(away))+panel(home,recordFor(home))+'</div><div class="game-summary"><div>'+eloStat(away)+'</div><div>'+eloStat(home)+'</div></div></div>'+quarterScores+teamComparison+'<section class="section"><h3>Top Performers</h3><div class="star-grid">'+highlight+'</div></section><section class="section"><h3>Complete Player Box Score</h3><div class="rosters">'+roster(away)+roster(home)+'</div></section><section class="section"><h3>Game Sources</h3><div class="links"><a target="_blank" rel="noopener noreferrer" href="'+esc(g.url)+'">Official game box score ↗</a><a href="nba.html#page-3">Standings & Elo ↗</a></div><p class="notice">Player statistics are sourced from captured completed-game box scores. Possession timelines and quarter scoring are not included until verified data is available.</p></section>';
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