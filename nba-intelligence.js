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
 $('nba-boxscore-status').textContent='NBA official game feed · Updated '+(data.updated_at||'unknown')+' · Current-day coverage only';
 if(!games.length){box.innerHTML='<p class="hub-small">No current-day NBA box scores in the official feed. Full game archives are available at NBA.com.</p>';return}
 box.innerHTML=games.map(g=>'<article class="nba-boxscore-item"><div class="nba-boxscore-head"><strong>'+esc((g.teams||[]).map(t=>t.name+' '+(t.score??'')).join(' · '))+'</strong><a href="'+esc(g.url)+'" target="_blank" rel="noopener noreferrer">BOX SCORE ↗</a></div>'+(g.leaders?.length?'<div class="nba-boxscore-players">'+g.leaders.slice(0,3).map(p=>'<span>'+esc(p.name)+' <b>'+p.pts+'</b> PTS · '+p.reb+' REB · '+p.ast+' AST</span>').join('')+'</div>':'<p class="hub-small">Player box-score details not yet verified for this game.</p>')+'</article>').join('');
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