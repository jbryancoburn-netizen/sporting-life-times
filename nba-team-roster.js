/* Current 30-team NBA rosters, independent of game-box participants. */
(()=>{
'use strict';
if(document.body?.dataset.page!=='team')return;
const code=(new URLSearchParams(location.search).get('team')||'IND').toUpperCase();
const enc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const photo=x=>{try{const u=new URL(x);return u.protocol==='https:'?enc(u.href):''}catch{return ''}};
let dataset=null, lastError='', production=new Map(), productionUpdated='';
const time=raw=>{if(!raw)return 'not verified';const d=new Date(raw);return Number.isNaN(+d)?'not verified':d.toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET'};
const cols=[['#','jersey'],['Position','position'],['Height','height'],['Weight','weight'],['Age','age'],['Status','status']];
function draw(){
 const app=document.getElementById('app'),slot=app?.querySelector('#nba-team-roster-slot');
 if(!slot)return;
 let panel=document.getElementById('nba-team-roster');
 if(!panel){panel=document.createElement('section');panel.id='nba-team-roster';panel.className='nba-team-roster panel victorian-player-production';}
 if(panel.parentElement!==slot)slot.appendChild(panel);
 const team=dataset?.teams?.[code],players=team?.players||[];
 const stale=dataset?.stale_teams?.includes(code);
 const signature=JSON.stringify([code,team?.updated_at,players.length,stale,lastError,productionUpdated]);
 if(panel.dataset.signature===signature)return;
 panel.dataset.signature=signature;
 const source=team?.source||'https://www.espn.com/nba/teams';
 const options=[...new Set(players.map(p=>p.position).filter(Boolean))].sort().map(x=>'<option value="'+enc(x)+'">'+enc(x)+'</option>').join('');
 const rows=players.map(p=>{
   const src=photo(p.headshot),image=src?'<img src="'+src+'" loading="lazy" alt="" onerror="this.hidden=true">':'';
   const totals=production.get(String(p.id));
   const stats=[['GP',totals?.gp],['PPG',totals?.ppg],['RPG',totals?.rpg],['APG',totals?.apg]].map(([label,value])=>
    '<td data-label="'+label+'">'+(Number.isFinite(value)?label==='GP'?value:value.toFixed(1):'—')+'</td>').join('');
   const status=enc(p.status||'—'),injury=p.injury?'<small>'+enc(String(p.injury))+'</small>':'';
   return '<tr data-name="'+enc(String(p.name||'').toLowerCase())+'" data-position="'+enc(String(p.position||'').toUpperCase())+'"><td class="nba-roster-name"><span class="nba-roster-photo">'+image+'</span><strong>'+enc(p.name)+'</strong></td>'+
   cols.map(([label,key])=>'<td data-label="'+label+'">'+(key==='status'?status+injury:enc(p[key]??'—'))+'</td>').join('')+stats+'</tr>';
 }).join('');
 const wasOpen=panel.querySelector('details')?.open??true;
 panel.innerHTML='<details class="nba-roster-fold"'+(wasOpen?' open':'')+'><summary class="nba-roster-heading"><span class="nba-roster-summary-title">Team Roster &amp; Player Production <b>'+players.length+' players</b></span><span class="nba-roster-expand-cue">View / Hide Roster ▾</span></summary><div class="nba-roster-body"><div class="nba-roster-source">Last verified: '+enc(time(team?.updated_at))+' · <a target="_blank" rel="noopener" href="'+enc(source)+'">Roster source ↗</a></div>'+
 (stale?'<p class="nba-roster-alert">Source temporarily unavailable: last successfully verified roster retained.</p>':'')+
 (players.length?'<div class="nba-roster-controls"><label>Search players <input id="nba-roster-search" type="search" placeholder="Player name" autocomplete="off"></label><label>Filter by position <select id="nba-roster-position"><option value="">All positions</option>'+options+'</select></label></div>'+
 '<div class="nba-roster-scroll" id="team-player-production-table"><table class="slt-sortable-production"><thead><tr><th>Player</th>'+cols.map(x=>x[0]).concat(['GP','PPG','RPG','APG']).map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div>':
 '<p class="nba-roster-alert">The current roster feed has not produced a validated team list yet. Previous box-score participants are deliberately not displayed as current roster members.</p>')+
 '<p class="nba-roster-caption">Membership comes from the published roster. Per-game production covers captured verified box scores.</p></div></details>';
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
document.addEventListener('nba:team-production',event=>{
 const detail=event.detail;
 if(detail?.team!==code)return;
 production=new Map(detail.rows.filter(row=>row.id!=null).map(row=>[String(row.id),row]));
 productionUpdated=detail.updated||'available';
 draw();
});
const app=document.getElementById('app');
if(app)new MutationObserver(draw).observe(app,{childList:true});
refresh();
setInterval(()=>{if(!document.hidden)refresh();},60000);
})();