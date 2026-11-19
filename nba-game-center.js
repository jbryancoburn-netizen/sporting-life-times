(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=d=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'medium'}).format(new Date(d));
async function fetchData(path){const r=await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Could not load '+path);return r.json()}
const boxColumns=[
 ['MIN',p=>p.min],['PTS',p=>p.pts],['REB',p=>p.reb],['AST',p=>p.ast],
 ['STL',p=>p.stl],['BLK',p=>p.blk],['TO',p=>p.tov],
 ['FG',p=>p.fgm==null||p.fga==null?null:p.fgm+'/'+p.fga],
 ['3PT',p=>p.fg3m==null||p.fg3a==null?null:p.fg3m+'/'+p.fg3a],
 ['FT',p=>p.ftm==null||p.fta==null?null:p.ftm+'/'+p.fta]
];
function render(g,events,rankings){
 const away=g.teams.find(t=>t.home_away==='away'),home=g.teams.find(t=>t.home_away==='home');
 if(!away||!home){$('game').textContent='Verified teams unavailable';return}
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
  const current=gameElo?.[t.code];
  return window.SLTScorebug.ledgerTeam({...t,
    record:recordFor(t),
    retro:current&&Number.isFinite(current.elo)?
      'RETRO '+Math.round(current.elo)+' (#'+current.rank+')':'RETRO —'});
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
 const roster=t=>{
  const players=(g.players||[]).filter(p=>p.team===t.code);
  const teamName=esc(t.name||t.code);
  const rows=players.map(p=>'<tr><th scope="row">'+esc(p.name)+'</th>'+boxColumns.map(([label,read])=>
   '<td'+(label==='PTS'?' class="key-stat"':'')+'>'+esc(read(p)??'—')+'</td>').join('')+'</tr>').join('');
  return '<section class="roster" style="--team-color:'+window.SLTScorebug.color(t.code)+'"><h4>'+teamName+'</h4>'+
   (rows?'<div class="box-scroll" tabindex="0" role="region" aria-label="'+teamName+' player statistics"><table class="box-table">'+
   '<thead><tr><th scope="col">Player</th>'+boxColumns.map(([label])=>'<th scope="col">'+label+'</th>').join('')+'</tr></thead>'+
   '<tbody>'+rows+'</tbody></table></div>':'<p>Player statistics unavailable.</p>')+'</section>';
 };
 const scorebug=window.SLTSportsScorebug?.render({
  phase:'final',status:'FINAL',periodFormat:'quarters',compactFinal:true,suppressMonogram:true,away:newspaperTeam(away),home:newspaperTeam(home)
 })||'<p>Scorebug temporarily unavailable.</p>';
 const indexId=String(g.id).replace(/^espn-nba-/,'');
 const impact=window.SLTBoxImpact?.slot({source:'nba',id:indexId,
  away:{key:away.code,name:away.name,points:Number(away.score)},home:{key:home.code,name:home.name,points:Number(home.score)}})||'';
 const matchup=(away.name||away.code)+' at '+(home.name||home.code);
 document.title=matchup+' | NBA Game Center';
 $('game').innerHTML='<h1 class="game-heading">'+esc(matchup)+'</h1><article class="ledger26-card">'+
  '<div class="ledger26-meta">'+(g.venue?'<span>'+esc(g.venue)+'</span>':'')+'<span>'+esc(fmt(g.date))+'</span></div>'+
  scorebug+'<div class="ledger26-expanded">'+quarterScores+
  (highlight?'<section class="section"><h3>Top Performers</h3><div class="star-grid">'+highlight+'</div></section>':'')+
  '<section class="section"><h3>Player Box Score</h3>'+roster(away)+roster(home)+'</section>'+teamComparison+impact+
  '<div class="links">'+(g.url?'<a target="_blank" rel="noopener noreferrer" href="'+esc(g.url)+'">Source box score ↗</a>':'')+
  '<a href="nba.html#page-3">Standings &amp; RETRO</a></div></div></article>';
 const box=$('game').querySelector('[data-verified-impact]');
 if(box)void window.SLTBoxImpact.fill(box);
}
async function boot(){
 const selector=$('games');
 const params=new URLSearchParams(location.search);
 const requested=params.get('game');
 try{
  const archive=await fetchData('data/nba-game-center.json');
  const games=(archive.games||[]).filter(g=>g.state==='post'&&g.teams?.some(t=>t.home_away==='away')&&g.teams.some(t=>t.home_away==='home'))
   .sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  selector.replaceChildren(new Option('Choose a completed game',''));
  for(const g of games){
   const away=g.teams.find(t=>t.home_away==='away'),home=g.teams.find(t=>t.home_away==='home');
   selector.add(new Option(away.code+' '+away.score+' at '+home.code+' '+home.score+' · '+fmt(g.date),g.id));
  }
  selector.disabled=!games.length;
  selector.addEventListener('change',()=>{
   const g=games.find(item=>item.id===selector.value);
   if(!g)return;
   const url=new URL(location.href);
   url.searchParams.set('game',g.id);
   location.href=url.href;
  });
  if(requested===null)return;
  const game=games.find(g=>g.id===requested||g.id==='espn-nba-'+requested);
  if(!game){
   $('game').textContent='This game is unavailable in the completed-game archive.';
   return;
  }
  selector.value=game.id;
  if(params.has('date'))document.querySelector('.game-back').href='nba-game-center.html?date='+encodeURIComponent(params.get('date'));
  const elo=await fetchData('data/nba-2026-27-current-provisional.json').catch(()=>({}));
  render(game,elo.events||[],elo.rankings||[]);
 }catch(error){
  if(selector.disabled)selector.replaceChildren(new Option('Completed games unavailable',''));
  if(requested!==null)$('game').textContent='Game information is temporarily unavailable.';
  console.warn('NBA Game Center:',error.message);
 }
}
boot();
})();
