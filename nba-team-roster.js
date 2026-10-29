/* Current 30-team NBA rosters, independent of game-box participants. */
(()=>{
'use strict';
if(document.body?.dataset.page!=='team')return;
const code=(new URLSearchParams(location.search).get('team')||'IND').toUpperCase();
const enc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const photo=x=>{try{const u=new URL(x);return u.protocol==='https:'?enc(u.href):''}catch{return ''}};
let dataset=null, lastError='';
const time=raw=>{if(!raw)return 'not verified';const d=new Date(raw);return Number.isNaN(+d)?'not verified':d.toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET'};
const cols=[['#','jersey'],['Position','position'],['Height','height'],['Weight','weight'],['Age','age'],['Status','status']];
function draw(){
 const app=document.getElementById('app'),identity=app?.querySelector('.nba-team-identity');
 if(!identity)return;
 let panel=document.getElementById('nba-team-roster');
 if(!panel){panel=document.createElement('section');panel.id='nba-team-roster';panel.className='nba-team-roster panel';identity.insertAdjacentElement('afterend',panel);}
 const team=dataset?.teams?.[code],players=team?.players||[];
 const stale=dataset?.stale_teams?.includes(code);
 const signature=JSON.stringify([code,team?.updated_at,players.length,stale,lastError]);
 if(panel.dataset.signature===signature)return;
 panel.dataset.signature=signature;
 const source=team?.source||'https://www.espn.com/nba/teams';
 const options=[...new Set(players.map(p=>p.position).filter(Boolean))].sort().map(x=>'<option value="'+enc(x)+'">'+enc(x)+'</option>').join('');
 const rows=players.map(p=>{
   const src=photo(p.headshot),image=src?'<img src="'+src+'" loading="lazy" alt="" onerror="this.hidden=true">':'';
   const status=enc(p.status||'—'),injury=p.injury?'<small>'+enc(String(p.injury))+'</small>':'';
   return '<tr data-name="'+enc(String(p.name||'').toLowerCase())+'" data-position="'+enc(String(p.position||'').toUpperCase())+'"><td class="nba-roster-name"><span class="nba-roster-photo">'+image+'</span><strong>'+enc(p.name)+'</strong></td>'+
   '<td>'+enc(p.jersey||'—')+'</td><td>'+enc(p.position||'—')+'</td><td>'+enc(p.height||'—')+'</td><td>'+enc(p.weight||'—')+'</td><td>'+enc(p.age??'—')+'</td><td>'+status+injury+'</td></tr>';
 }).join('');
 panel.innerHTML='<div class="nba-roster-heading"><div><div class="eyebrow">Official lineup desk · 2026–27</div><h2>Current Team Roster <span>'+players.length+'</span></h2><p>Last verified: '+enc(time(team?.updated_at))+'</p></div><a target="_blank" rel="noopener" href="'+enc(source)+'">Roster source ↗</a></div>'+
 (stale?'<p class="nba-roster-alert">Source temporarily unavailable: last successfully verified roster retained.</p>':'')+
 (players.length?'<div class="nba-roster-controls"><label>Search players <input id="nba-roster-search" type="search" placeholder="Player name" autocomplete="off"></label><label>Filter by position <select id="nba-roster-position"><option value="">All positions</option>'+options+'</select></label></div>'+
 '<div class="nba-roster-scroll"><table><thead><tr><th>Player</th>'+cols.map(x=>'<th>'+x[0]+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div>':
 '<p class="nba-roster-alert">The current roster feed has not produced a validated team list yet. Previous box-score participants are deliberately not displayed as current roster members.</p>')+
 '<p class="nba-roster-caption">Current team membership is sourced from team roster data, not inferred from historical games or player-stat leaderboards.</p>';
 function filter(){const name=panel.querySelector('#nba-roster-search')?.value.trim().toLowerCase()||'';const pos=(panel.querySelector('#nba-roster-position')?.value||'').toUpperCase();panel.querySelectorAll('tbody tr').forEach(tr=>{tr.hidden=!(tr.dataset.name.includes(name)&&(!pos||tr.dataset.position===pos));});}
 panel.querySelector('#nba-roster-search')?.addEventListener('input',filter);
 panel.querySelector('#nba-roster-position')?.addEventListener('change',filter);
}
async function refresh(){
 try{
  const r=await fetch('data/nba-team-rosters-2026-27.json?edition='+Math.floor(Date.now()/60000),{cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('Roster data not available ('+r.status+')');
  const j=await r.json();
  if(Object.keys(j.teams||{}).length!==30)throw Error('Incomplete 30-team roster snapshot');
  dataset=j;lastError='';
 }catch(err){lastError=String(err.message||err);}
 draw();
}
const app=document.getElementById('app');
if(app)new MutationObserver(draw).observe(app,{childList:true});
refresh();
setInterval(()=>{if(!document.hidden)refresh();},60000);
})();