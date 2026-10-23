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
 $('nba-boxscore-status').textContent='NBA official game feed · Updated '+(data.updated_at?new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(data.updated_at))+' ET':'unknown')+' · Captured archive (not yet full-season verified)';
 const completed=games.filter(g=>g.state==='post'&&Array.isArray(g.players)&&g.players.length);
 const players=new Map();
 for(const g of completed)for(const p of g.players){if(!p.id||!p.name)continue;const key=p.id;const r=players.get(key)||{name:p.name,team:p.team,gp:0,pts:0,reb:0,ast:0,stl:0,blk:0,tov:0};r.gp++;for(const k of ['pts','reb','ast','stl','blk','tov'])r[k]+=Number(p[k]||0);players.set(key,r)}
 const leaders=[...players.values()].filter(p=>p.gp>0).sort((a,b)=>b.pts/b.gp-a.pts/a.gp).slice(0,18);
 if($('nba-leaders-coverage'))$('nba-leaders-coverage').textContent=completed.length+' captured completed box scores · '+players.size+' distinct players · Not a full-season league leaderboard until coverage is complete';
 if($('nba-player-leaders'))$('nba-player-leaders').innerHTML=leaders.length?'<table class="nba-mini-table"><thead><tr><th>PLAYER</th><th>GP</th><th>PPG</th><th>RPG</th><th>APG</th></tr></thead><tbody>'+leaders.map(p=>'<tr><th>'+esc(p.name)+' <small>'+esc(p.team)+'</small></th><td>'+p.gp+'</td><td>'+(p.pts/p.gp).toFixed(1)+'</td><td>'+(p.reb/p.gp).toFixed(1)+'</td><td>'+(p.ast/p.gp).toFixed(1)+'</td></tr>').join('')+'</tbody></table>':'<p class="hub-small">Awaiting verified completed player box scores.</p>';
 if(!games.length){box.innerHTML='<p class="hub-small">No current-day NBA box scores in the official feed. Full game archives are available at NBA.com.</p>';return}
 box.innerHTML=games.slice(0,20).map(g=>'<article class="nba-boxscore-item"><div class="nba-boxscore-head"><strong>'+esc((g.teams||[]).map(t=>t.name+' '+(t.score??'')).join(' · '))+'</strong><a href="'+esc(g.url)+'" target="_blank" rel="noopener noreferrer">BOX SCORE ↗</a></div>'+(g.leaders?.length?'<div class="nba-boxscore-players">'+g.leaders.slice(0,3).map(p=>'<span>'+esc(p.name)+' <b>'+p.pts+'</b> PTS · '+p.reb+' REB · '+p.ast+' AST</span>').join('')+'</div>':'<p class="hub-small">Player box-score details not yet verified for this game.</p>')+(g.players?.length?'<details class="nba-player-boxscore"><summary>Full captured player box score · '+g.players.length+' players</summary><div class="nba-current-table-wrap"><table class="nba-mini-table"><thead><tr><th>Player</th><th>Team</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>FG</th><th>3PT</th><th>FT</th></tr></thead><tbody>'+g.players.map(p=>'<tr><th>'+esc(p.name)+'</th><td>'+esc(p.team)+'</td><td>'+esc(p.min)+'</td><td>'+esc(p.pts)+'</td><td>'+esc(p.reb)+'</td><td>'+esc(p.ast)+'</td><td>'+esc(p.stl)+'</td><td>'+esc(p.blk)+'</td><td>'+esc(p.fgm)+'/'+esc(p.fga)+'</td><td>'+esc(p.fg3m)+'/'+esc(p.fg3a)+'</td><td>'+esc(p.ftm)+'/'+esc(p.fta)+'</td></tr>').join('')+'</tbody></table></div></details>':'')+'</article>').join('');
 }catch(e){console.error('NBA official box scores',e);$('nba-boxscore-status').textContent='Official game-center snapshot unavailable';box.innerHTML='<p class="hub-small">Player box scores unavailable. <a href="https://www.nba.com/games" target="_blank" rel="noopener noreferrer">See NBA game center ↗</a></p>'}
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
load();reporting();
})();