(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>Number.isFinite(Number(n))?Number(n):0;
const nbaPrimaryIds={"ATL":1610612737,"BOS":1610612738,"BKN":1610612751,"CHA":1610612766,"CHI":1610612741,"CLE":1610612739,"DAL":1610612742,"DEN":1610612743,"DET":1610612765,"GSW":1610612744,"HOU":1610612745,"IND":1610612754,"LAC":1610612746,"LAL":1610612747,"MEM":1610612763,"MIA":1610612748,"MIL":1610612749,"MIN":1610612750,"NOP":1610612740,"NYK":1610612752,"OKC":1610612760,"ORL":1610612753,"PHI":1610612755,"PHX":1610612756,"POR":1610612757,"SAC":1610612758,"SAS":1610612759,"TOR":1610612761,"UTA":1610612762,"WAS":1610612764};
const logo=c=>'assets/nba-logos/'+String(c||'').toUpperCase()+'.png';
const fmt=d=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'medium'}).format(new Date(d));
async function fetchData(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error('Could not load '+path);return r.json()}
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
 const newspaperTeam=t=>{
  const current=gameElo?.[t.code],logoUrl=logo(t.code);
  return {name:t.name||t.code,score:t.score,color:window.SLTScorebug.color(t.code),
    crest:'<img src="'+esc(logoUrl)+'" alt="" loading="lazy">',
    record:recordFor(t),
    retro:current&&Number.isFinite(current.elo)?
      'RETRO '+Math.round(current.elo)+' (#'+current.rank+')':'RETRO —'};
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
   const awayLead=m.advantage==='away'?' is-advantage':'';
   const homeLead=m.advantage==='home'?' is-advantage':'';
   return '<div class="compare-row meaningful-compare"><div class="compare-value'+awayLead+'">'+fmt(m.away)+(m.unit||'')+'</div><div class="compare-bars"><span style="width:'+m.awayWidth.toFixed(1)+'%;background:'+window.SLTScorebug.color(away.code)+'"></span></div><div class="compare-name"><b>'+esc(m.name)+'</b></div><div class="compare-bars compare-home"><span style="width:'+m.homeWidth.toFixed(1)+'%;background:'+window.SLTScorebug.color(home.code)+'"></span></div><div class="compare-value'+homeLead+'">'+fmt(m.home)+(m.unit||'')+'</div></div>';
  }).join('');
  return '<section class="section"><h3>Team Comparison</h3><div class="comparison"><div class="compare-header"><span>'+esc(away.code)+'</span><span>'+esc(home.code)+'</span></div>'+rows+'</div></section>';
 })();
 const highlight=(g.leaders||[]).slice(0,4).map(p=>'<div class="star"><small>'+esc(p.team)+'</small><b>'+esc(p.name)+'</b><strong>'+esc(p.pts)+' <small>PTS</small></strong><small>'+esc(p.reb)+' REB · '+esc(p.ast)+' AST</small></div>').join('');
 const roster=t=>'<section class="roster" style="--team-color:'+window.SLTScorebug.color(t.code)+'"><h4>'+esc(t.name)+'</h4>'+g.players.filter(p=>p.team===t.code).sort((a,b)=>num(b.pts)-num(a.pts)).map(player).join('')+'</section>';
 const scorebug=window.SLTSportsScorebug?.render({
  phase:'final',status:'FINAL',away:newspaperTeam(away),home:newspaperTeam(home)
 })||'<p>Scorebug temporarily unavailable.</p>';
 $('game').innerHTML='<article class="ledger26-card">'+
  '<div class="ledger26-meta"><span>'+esc(g.venue||'NBA')+'</span><span>'+esc(fmt(g.date))+'</span></div>'+
  '<details class="ledger26-expand"><summary class="ledger26-summary">'+scorebug+
  '<span class="ledger26-instruction">OPEN GAME DETAILS +</span></summary>'+
  '<div class="ledger26-expanded">'+quarterScores+teamComparison+
  '<section class="section"><h3>Top Performers</h3><div class="star-grid">'+highlight+'</div></section>'+
  '<section class="section"><h3>Complete Player Box Score</h3><div class="rosters">'+roster(away)+roster(home)+'</div></section>'+
  '<section class="section"><h3>Game Sources</h3><div class="links"><a target="_blank" rel="noopener noreferrer" href="'+esc(g.url)+'">Official box score ↗</a><a href="nba.html#page-3">Standings &amp; RETRO ↗</a></div></section>'+
  '</div></details></article>';
}
async function boot(){
 try{
  const [archive,elo]=await Promise.all([fetchData('data/nba-game-center.json'),fetchData('data/nba-2026-27-current-provisional.json')]);
  const games=(archive.games||[]).filter(g=>g.state==='post'&&g.teams?.length>=2).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const selector=$('games');selector.innerHTML='';
  for(const g of games){const a=g.teams.find(t=>t.home_away==='away'),h=g.teams.find(t=>t.home_away==='home');const option=document.createElement('option');option.value=g.id;option.textContent=(a?.code||'Away')+' '+a?.score+' at '+(h?.code||'Home')+' '+h?.score+' · '+fmt(g.date);selector.appendChild(option)}
  function select(id){const g=games.find(x=>x.id===id)||games[0];if(!g)return;selector.value=g.id;render(g,elo.events||[],elo.rankings||[]);const url=new URL(location.href);url.searchParams.set('game',g.id);history.replaceState(null,'',url.pathname+url.search+url.hash)}
  selector.addEventListener('change',()=>select(selector.value));
  select(new URLSearchParams(location.search).get('game'));
 }catch(e){$('game').textContent='Game information unavailable: '+e.message}
}
boot();
})();