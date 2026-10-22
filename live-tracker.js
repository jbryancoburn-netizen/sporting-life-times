/* Live updates embedded in the newspaper's existing league scoreboards. */
(()=>{'use strict';
const feeds={NFL:'football/nfl',MLB:'baseball/mlb',NBA:'basketball/nba',NHL:'hockey/nhl'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let timer,working=false,stopped=false;
function render(league,data){
const register=[...document.querySelectorAll('.league-register')].find(x=>x.dataset.scoreLeague===league);
if(!register)return;
let section=register.querySelector('.inline-live-scores');
if(!section){section=document.createElement('section');section.className='inline-live-scores';register.querySelector('.league-register-title')?.after(section)}
const events=(data.events||[]).filter(e=>e.status?.type?.state==='in');
const activeIds=new Set(events.map(e=>String(e.id)));
register.querySelectorAll('.register-game[data-game-id]').forEach(el=>{el.hidden=activeIds.has(el.dataset.gameId)&&el.dataset.gameId!==''});
if(!events.length){section.replaceChildren();return}
section.innerHTML='<div class="register-heading"><h3>LIVE NOW <span class="live-tracker-active">●</span></h3><span>'+events.length+' GAMES · AUTO-UPDATING</span></div><div class="inline-live-grid">'+events.map(e=>{
const c=e.competitions?.[0]||{},teams=c.competitors||[];
const detail=e.status?.type?.shortDetail||e.status?.type?.detail||'LIVE';
const rows=teams.map(t=>{const name=t.team?.shortDisplayName||t.team?.displayName||'Team';const record=t.records?.[0]?.summary||'';return '<div class="inline-live-team"><span>'+esc(name)+'</span><small>'+esc(record)+'</small><strong>'+esc(t.score??'—')+'</strong></div>'}).join('');
const url=e.links?.[0]?.href||c?.links?.[0]?.href||'';
return '<article class="register-game inline-live-card"><div class="register-sport"><span>'+esc(league)+'</span><strong class="live-tracker-active">'+esc(detail)+'</strong></div>'+rows+(url?'<a class="register-link" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">GAME DETAILS ↗</a>':'')+'</article>'}).join('')+'</div>';
}
async function tick(){
if(working||stopped||document.hidden)return;working=true;
let live=false,failed=0;
await Promise.all(Object.entries(feeds).map(async ([league,path])=>{
try{
const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
let response;try{response=await fetch('https://site.api.espn.com/apis/site/v2/sports/'+path+'/scoreboard',{signal:controller.signal,cache:'no-store'})}finally{clearTimeout(timeout)}
if(!response.ok)throw Error('HTTP '+response.status);
const data=await response.json();if(!Array.isArray(data.events))throw Error('Invalid data');
render(league,data);if(data.events.some(e=>e.status?.type?.state==='in'))live=true;
}catch(_){failed++;}
}));
const status=document.getElementById('scores-status');
if(status){let note=status.querySelector('.live-update-note');if(!note){note=document.createElement('span');note.className='live-update-note';status.append(' · ',note)}
note.textContent=failed===4?'Live browser feeds unavailable; scheduled scores remain visible':failed?'Live check partial · '+(4-failed)+'/4 feeds available':live?'Live games checked '+new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):'Live game check complete'}
working=false;clearTimeout(timer);if(!stopped&&!document.hidden)timer=setTimeout(tick,live?30000:120000);
}
function start(){if(document.querySelector('.league-register'))tick();else setTimeout(start,500)}
document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)tick()});
window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer)});
start();
})();
