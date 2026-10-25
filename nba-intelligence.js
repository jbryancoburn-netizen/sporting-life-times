(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const links=[
 ['OFFICIAL INJURY REPORT','https://official.nba.com/nba-injury-report-2026-27-season/','Continuously updated player availability and game status'],
 ['TRANSACTIONS','https://www.nba.com/players/transactions','NBA player movement and roster changes'],
 ['PLAYER LEADERS','https://www.nba.com/stats/leaders','Scoring, rebounding, assists and shooting'],
 ['TEAM STATISTICS','https://www.nba.com/stats/teams/traditional','League-wide offensive and defensive team totals'],
 ['ADVANCED METRICS','https://www.nba.com/stats/teams/advanced','Efficiency, pace and net rating'],
 ['SHOT TRACKING','https://www.nba.com/stats/players/shooting','Shot profiles and shooting splits']
];
if($('nba-data-directory'))$('nba-data-directory').innerHTML=links.map(([title,url,description])=>'<article class="nba-directory-item"><h3><a target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">'+esc(title)+' ↗</a></h3><p>'+esc(description)+'</p></article>').join('');
async function load(){
 const box=$('nba-boxscore-ledger');if(!box)return;
 try{
 const r=await fetch('data/nba-game-center.json',{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);
 const data=await r.json();const games=Array.isArray(data.games)?data.games:[];
 let elo=null;
 try{const response=await fetch('data/nba-2026-27-current-provisional.json',{cache:'no-store'});if(response.ok)elo=await response.json()}catch(_error){}
 const currentRatings=Object.fromEntries((elo?.rankings||[]).map(t=>[t.team,Number(t.elo)]));
 const completedWl={};const recordsByEvent=new Map();
 for(const e of elo?.events||[]){
  if(!Number.isFinite(Number(e.home_score))||!Number.isFinite(Number(e.away_score))||Number(e.home_score)===Number(e.away_score))continue;
  for(const t of [e.home,e.away])completedWl[t]??={w:0,l:0};
  const winner=Number(e.home_score)>Number(e.away_score)?e.home:e.away,loser=winner===e.home?e.away:e.home;
  completedWl[winner].w++;completedWl[loser].l++;
  recordsByEvent.set(String(e.id),{[e.home]:completedWl[e.home].w+'–'+completedWl[e.home].l,[e.away]:completedWl[e.away].w+'–'+completedWl[e.away].l});
 }

 const events=elo?.events||[];
 const rankOf=(scores,code)=>Object.entries(scores).filter(([,v])=>Number.isFinite(v)).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).findIndex(([t])=>t===code)+1;
 const perGame=new Map();
 if(Object.keys(currentRatings).length===30){
  const rolling={...currentRatings};
  for(let i=events.length-1;i>=0;i--){
   const e=events[i];const key=e.id;
   const delta=Number(e.home_elo_change);
   if(!Number.isFinite(delta)||!Number.isFinite(rolling[e.home])||!Number.isFinite(rolling[e.away]))continue;
   const afterHome=rankOf(rolling,e.home),afterAway=rankOf(rolling,e.away);
   const homeAfter=rolling[e.home],awayAfter=rolling[e.away];
   rolling[e.home]-=delta;rolling[e.away]+=delta;
   const beforeHome=rankOf(rolling,e.home),beforeAway=rankOf(rolling,e.away);
   perGame.set(key,{home:{elo:homeAfter,delta,rank:afterHome,rankChange:beforeHome-afterHome},away:{elo:awayAfter,delta:-delta,rank:afterAway,rankChange:beforeAway-afterAway}});
  }
 }
 const rankLabel=info=>{const d=info.rankChange;return '#'+info.rank+(d>0?' ▲'+d:d<0?' ▼'+Math.abs(d):'');};
 const eloDetail=(label,info)=>info?'<div class="nba-elo-teamline"><b>'+esc(label)+'</b><span class="nba-elo-rating">'+info.elo.toFixed(1)+'</span><span class="nba-elo-delta '+(info.delta>=0?'nba-elo-positive':'nba-elo-negative')+'">'+(info.delta>0?'+':'')+info.delta.toFixed(1)+'</span><span class="nba-elo-rank">'+rankLabel(info)+'</span></div>':'';

 $('nba-boxscore-status').textContent='NBA official game feed · Updated '+(data.updated_at?new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(data.updated_at))+' ET':'unknown')+' · Captured archive (not yet full-season verified)';
 const completed=games.filter(g=>g.state==='post'&&Array.isArray(g.players)&&g.players.length);
 const players=new Map();
 for(const g of completed)for(const p of g.players){if(!p.id||!p.name)continue;const key=p.id;const r=players.get(key)||{name:p.name,team:p.team,gp:0,pts:0,reb:0,ast:0,stl:0,blk:0,tov:0};r.gp++;for(const k of ['pts','reb','ast','stl','blk','tov'])r[k]+=Number(p[k]||0);players.set(key,r)}
 const leaders=[...players.values()].filter(p=>p.gp>0).sort((a,b)=>b.pts/b.gp-a.pts/a.gp).slice(0,18);
 if($('nba-leaders-coverage'))$('nba-leaders-coverage').textContent=completed.length+' captured completed box scores · '+players.size+' distinct players · Not a full-season league leaderboard until coverage is complete';
 if($('nba-player-leaders'))$('nba-player-leaders').innerHTML=leaders.length?'<table class="nba-mini-table"><thead><tr><th>PLAYER</th><th>GP</th><th>PPG</th><th>RPG</th><th>APG</th></tr></thead><tbody>'+leaders.map(p=>'<tr><th>'+esc(p.name)+' <small>'+esc(p.team)+'</small></th><td>'+p.gp+'</td><td>'+(p.pts/p.gp).toFixed(1)+'</td><td>'+(p.reb/p.gp).toFixed(1)+'</td><td>'+(p.ast/p.gp).toFixed(1)+'</td></tr>').join('')+'</tbody></table>':'<p class="hub-small">Awaiting verified completed player box scores.</p>';
 if(!games.length){
  box.innerHTML='<p class="hub-small">The official game-by-game player archive has not populated. No unverified box scores are displayed.</p><p class="hub-small"><a href="https://www.nba.com/games" target="_blank" rel="noopener noreferrer">Browse official NBA game box scores ↗</a></p>';
  if($('nba-player-leaders'))$('nba-player-leaders').innerHTML='';
  if($('nba-leaders-coverage'))$('nba-leaders-coverage').textContent='No player games captured; the dated individual-leader snapshot is shown above.';
  return;
 }
 box.innerHTML=games.slice(0,20).map(g=>{
  const home=g.teams?.find(t=>t.home_away==='home'),away=g.teams?.find(t=>t.home_away==='away');
  const bug=window.SLTScorebug.render({mode:'final',subtitle:'VERIFIED BOX SCORE',away:{code:away?.code||'AWAY',name:away?.name||'Away',record:recordsByEvent.get(String(g.id))?.[away?.code]||''},home:{code:home?.code||'HOME',name:home?.name||'Home',record:recordsByEvent.get(String(g.id))?.[home?.code]||''},awayScore:away?.score,homeScore:home?.score,winner:Number(away?.score)>Number(home?.score)?away?.code:home?.code});
  const gameElo=perGame.get(g.id);const eloStrip=gameElo?'<div class="nba-boxscore-elo">'+eloDetail(away?.code,gameElo.away)+eloDetail(home?.code,gameElo.home)+'</div>':'';
  const spotlight=(g.leaders||[]).slice(0,3).map(p=>'<div class="nba-game-star"><span class="nba-star-team">'+esc(p.team)+'</span><b>'+esc(p.name)+'</b><strong>'+esc(p.pts)+' <small>PTS</small></strong><span>'+esc(p.reb)+' REB · '+esc(p.ast)+' AST</span></div>').join('');
  const playerCard=p=>'<div class="nba-player-stat-card"><div class="nba-player-stat-name"><b>'+esc(p.name)+'</b><small>'+esc(p.min)+' MIN</small></div><div class="nba-player-stat-main"><span><b>'+esc(p.pts)+'</b><small>PTS</small></span><span><b>'+esc(p.reb)+'</b><small>REB</small></span><span><b>'+esc(p.ast)+'</b><small>AST</small></span></div><div class="nba-player-stat-detail"><span>STL '+esc(p.stl)+'</span><span>BLK '+esc(p.blk)+'</span><span>FG '+esc(p.fgm)+'/'+esc(p.fga)+'</span><span>3PT '+esc(p.fg3m)+'/'+esc(p.fg3a)+'</span><span>FT '+esc(p.ftm)+'/'+esc(p.fta)+'</span></div></div>';
  const roster=team=>'<section class="nba-team-box" style="--team-color:'+window.SLTScorebug.color(team.code)+'"><h4><span>'+esc(team.name)+'</span><small>'+esc(team.code)+'</small></h4><div class="nba-team-player-list">'+g.players.filter(p=>p.team===team.code).sort((a,b)=>Number(b.pts)-Number(a.pts)).map(playerCard).join('')+'</div></section>';
  const full=g.players?.length?'<details class="nba-player-boxscore"><summary>Explore all '+g.players.length+' player performances</summary><div class="nba-game-rosters">'+roster(away)+roster(home)+'</div></details>':'';
  return '<article class="nba-boxscore-item">'+bug+eloStrip+'<div class="nba-boxscore-actions"><a href="nba-game-center.html?game='+encodeURIComponent(g.id)+'">GAME CENTER ↗</a> <a href="'+esc(g.url)+'" target="_blank" rel="noopener noreferrer">Official box score ↗</a></div>'+(spotlight?'<div class="nba-game-spotlights">'+spotlight+'</div>':'')+full+'</article>';
 }).join('');

 }catch(e){console.error('NBA official box scores',e);$('nba-boxscore-status').textContent='Official game-center snapshot unavailable';box.innerHTML='<p class="hub-small">Player box scores unavailable. <a href="https://www.nba.com/games" target="_blank" rel="noopener noreferrer">See NBA game center ↗</a></p>'}
}
async function rosterWireSnapshot(){
 const inj=$('nba-injury-wire'),txn=$('nba-transaction-wire');
 if(!inj&&!txn)return;
 try{
  const res=await fetch('data/nba-roster-wire-snapshot.json',{cache:'no-store'});
  if(!res.ok)throw Error('Wire HTTP '+res.status);
  const data=await res.json();
  const source=(url,label)=>'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+' ↗</a>';
  if(inj&&Array.isArray(data.injuries)&&data.injuries.length)inj.innerHTML='<p class="hub-small">Injury snapshot · '+esc(data.as_of)+' · '+source(data.injuries_source,'Full updated injury report')+'</p><table class="nba-mini-table"><thead><tr><th>Player</th><th>Team</th><th>Status</th><th>Injury</th></tr></thead><tbody>'+data.injuries.map(x=>'<tr><th>'+esc(x.player)+'</th><td>'+esc(x.team)+'</td><td>'+esc(x.status)+'</td><td>'+esc(x.detail)+'</td></tr>').join('')+'</tbody></table>';
  if(txn&&Array.isArray(data.transactions)&&data.transactions.length)txn.innerHTML='<p class="hub-small">Recent official-filed moves · through '+esc(data.as_of)+' · '+source(data.transactions_source,'Full transaction log')+'</p><table class="nba-mini-table"><thead><tr><th>Date</th><th>Team</th><th>Player</th><th>Move</th></tr></thead><tbody>'+data.transactions.map(x=>'<tr><td>'+esc(x.date.slice(5))+'</td><td>'+esc(x.team)+'</td><th>'+esc(x.player)+'</th><td>'+esc(x.action)+'</td></tr>').join('')+'</tbody></table>';
 }catch(e){console.error('NBA roster wire snapshot',e)}
}
async function reporting(){
 try{
 const r=await fetch('articles.json',{cache:'no-store'});if(!r.ok)throw Error('Headlines unavailable');
 const d=await r.json();const all=(d.articles||[]).filter(a=>a.category==='NBA'||/NBA/i.test(a.source||''));
 const sections=[
  ['nba-injury-wire',/\b(injur\w*|questionable|doubtful|ruled out|return to action|sidelined|out for|day.to.day|availability|concussion|sprain)\b/i],
  ['nba-transaction-wire',/\b(trad(e|ed|ing|es)|sign(s|ed|ing)?|waiv(e|ed)|contract|extension|roster|free agent|acquir(e|ed)|two.way|release(d)?)\b/i]
 ];
 for(const [id,re] of sections){const el=$(id);if(!el)continue;const selected=all.filter(a=>re.test(a.title||'')).slice(0,12);el.innerHTML=selected.length?selected.map(a=>'<div class="nba-wire-line"><a href="'+esc(a.url)+'" target="_blank" rel="noopener noreferrer">'+esc(a.title)+'</a><small>'+esc(a.source)+' · '+esc((a.published_at||'').slice(0,10))+'</small></div>').join(''):'<p class="hub-small">No recent attributed reports in the current feed. Consult the official source above for the latest status.</p>';}
 }catch(e){for(const id of ['nba-injury-wire','nba-transaction-wire'])if($(id))$(id).textContent='Recent reporting feed unavailable; use official source links above.'}
}
async function leagueLeaders(){
 const container=$('nba-league-leaders'),status=$('nba-league-leaders-status');if(!container)return;
 const groups=[['SCORING','ppg','PPG'],['REBOUNDING','rpg','RPG'],['ASSISTS','apg','APG'],['STEALS','spg','SPG'],['BLOCKS','bpg','BPG'],['FIELD GOAL %','fg_pct','FG%'],['THREE POINT %','fg3_pct','3P%'],['FREE THROW %','ft_pct','FT%']];
 try{
  const resp=await fetch('data/nba-player-leaders.json',{cache:'no-store'});
  if(!resp.ok)throw Error('Player statistics have not been published');
  let data=await resp.json();
  if(!Array.isArray(data.rows)||!data.rows.length||!data.coverage?.completed_boxscores){
    const backup=await fetch('data/nba-player-leaders-snapshot.json',{cache:'no-store'});
    if(!backup.ok)throw Error('No verified player leader snapshot');
    data=await backup.json();
  }
  if(data.season!=='2026-27'||!Array.isArray(data.rows)||!data.rows.length)throw Error('No verified player observations');
  const blocks=groups.map(([label,field,unit])=>{
   const rows=data.rows.filter(r=>r.stat===field&&Number.isFinite(r.value)&&r.player).sort((a,b)=>b.value-a.value).slice(0,10);
   return rows.length?'<section class="nba-player-leader-block"><h4>'+label+'</h4><table class="nba-mini-table"><thead><tr><th>Player</th><th>Team</th><th>GP</th><th>'+unit+'</th></tr></thead><tbody>'+rows.map(r=>'<tr><th>'+esc(r.player)+'</th><td>'+esc(r.team)+'</td><td>'+esc(r.gp??'—')+'</td><td>'+r.value.toFixed(1)+'</td></tr>').join('')+'</tbody></table></section>':'';
  }).filter(Boolean);
  if(!blocks.length)throw Error('No supported player categories');
  container.innerHTML='<div class="nba-league-leader-panels">'+blocks.join('')+'</div>';
  status.textContent=data.snapshot?'Individual leaders through '+data.as_of+' · '+data.source+' · Dated snapshot, not live statistics':(data.sample_only?'CAPTURED GAMES · INCOMPLETE SEASON':'2026–27 VERIFIED PLAYER LEADERS')+' · '+data.coverage.completed_boxscores+' player box scores · '+data.coverage.unique_players+' players';
 }catch(_err){
  // Keep the independently rendered dated snapshot if network requests fail.
  if(container.innerHTML.includes('nba-player-leader-block')){
   status.textContent='Individual player leaders · dated October 22 snapshot · live refresh unavailable';
   return;
  }
  // A team-score ledger cannot reconstruct player performances. Never
  // duplicate team scoring rankings under a misleading player heading.
  container.innerHTML='<div class="nba-player-source-index"><p>Individual player statistics are not yet available from our verified game archive. The independent Elo results do not contain player statistics.</p><div class="nba-player-source-grid"><a href="https://www.nba.com/stats/leaders" target="_blank" rel="noopener noreferrer"><strong>NBA official player leaders ↗</strong><small>Scoring · Rebounds · Assists · Steals · Blocks</small></a><a href="https://www.nba.com/stats/players/traditional" target="_blank" rel="noopener noreferrer"><strong>Traditional player statistics ↗</strong><small>Games · Minutes · Shooting · Turnovers</small></a><a href="https://www.nba.com/stats/players/advanced" target="_blank" rel="noopener noreferrer"><strong>Advanced player statistics ↗</strong><small>Offensive efficiency · Usage · Net rating</small></a><a href="https://www.nba.com/stats/players/shooting" target="_blank" rel="noopener noreferrer"><strong>Player shot profiles ↗</strong><small>Field-goal range · Shot distribution</small></a></div></div>';
  status.textContent='Awaiting verified individual-player records · No team leader duplicates';
 }
}
async function playerNotebook(){
 const el=$('nba-player-notebook'),status=$('nba-player-notebook-status');if(!el)return;
 try{
  const r=await fetch('data/nba-player-leaders.json',{cache:'no-store'});if(!r.ok)throw Error('stats unavailable');
  const d=await r.json(),rows=d.season_totals||[];
  if(!rows.length)throw Error('no captured players');
  rows.sort((a,b)=>b.pts/b.gp-a.pts/a.gp);
  const pct=x=>Number.isFinite(x)?x.toFixed(1):'—';
  el.innerHTML='<div class="nba-current-table-wrap"><table class="nba-mini-table"><thead><tr><th>Player</th><th>Team</th><th>GP</th><th>PPG</th><th>RPG</th><th>APG</th><th>FG%</th><th>3P%</th><th>FT%</th><th>TS%</th></tr></thead><tbody>'+rows.slice(0,45).map(p=>'<tr><th>'+esc(p.player)+'</th><td>'+esc(p.team)+'</td><td>'+p.gp+'</td><td>'+pct(p.ppg)+'</td><td>'+pct(p.rpg)+'</td><td>'+pct(p.apg)+'</td><td>'+pct(p.fg_pct)+'</td><td>'+pct(p.fg3_pct)+'</td><td>'+pct(p.ft_pct)+'</td><td>'+pct(p.ts_pct)+'</td></tr>').join('')+'</tbody></table></div>';
  status.textContent=rows.length+' players · '+d.coverage.completed_boxscores+' completed games captured · shooting and TS% independently calculated · not full-season until coverage reconciles';
 }catch(e){status.textContent='Verified player season totals are unavailable';el.innerHTML=''}
}
leagueLeaders();
playerNotebook();
load();reporting().then(rosterWireSnapshot);
// Refresh archived player results alongside every standings refresh.
setInterval(()=>{if(!document.hidden){leagueLeaders();playerNotebook();load()}},3*60*1000);
setInterval(()=>{if(!document.hidden)reporting().then(rosterWireSnapshot)},15*60*1000);
})();