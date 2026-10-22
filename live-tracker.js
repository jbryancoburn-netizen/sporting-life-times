/* Optional browser-side live scores. Existing verified newspaper scoreboards remain intact. */
(()=>{'use strict';
const feeds={NFL:'football/nfl',MLB:'baseball/mlb',NBA:'basketball/nba',NHL:'hockey/nhl'};
const root=document.getElementById('live-tracker-games'),status=document.getElementById('live-tracker-status'),tabs=document.getElementById('live-tracker-tabs');
if(!root||!status||!tabs)return;
let league='NFL',timer=null,lastGood={},busy=false,stopped=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function isLive(e){return e?.status?.type?.state==='in'}
function render(data){
const events=(data?.events||[]).slice().sort((a,b)=>Number(isLive(b))-Number(isLive(a)));
root.innerHTML=events.length?events.map(e=>{
const c=e.competitions?.[0]||{},teams=c.competitors||[],state=e.status?.type?.state||'pre',live=state==='in',post=state==='post';
const label=live?(e.status?.type?.shortDetail||e.status?.type?.detail||'LIVE'):post?'FINAL':(e.status?.type?.shortDetail||'UPCOMING');
const names=teams.map(t=>({name:t.team?.shortDisplayName||t.team?.displayName||'Team',abbr:t.team?.abbreviation||'',score:t.score,record:t.records?.[0]?.summary||''}));
return '<article class="register-game live-tracker-card"><div class="register-sport"><span>'+esc(league)+'</span><strong'+(live?' class="live-tracker-active"':'')+'>'+esc(label)+'</strong></div>'+names.map(t=>'<div class="live-tracker-team"><span>'+esc(t.name)+'</span><span>'+esc(t.record)+'</span><strong>'+esc(t.score??(state==='pre'?'–':'—'))+'</strong></div>').join('')+(e.links?.[0]?.href?'<a class="register-link" href="'+esc(e.links[0].href)+'" target="_blank" rel="noopener noreferrer">GAME DETAILS ↗</a>':'')+'</article>'}).join(''):'<p class="register-empty">No games reported for this league today.</p>';
}
async function refresh(){
if(busy||stopped||document.hidden)return;
busy=true;
try{
const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
let response;
try{response=await fetch('https://site.api.espn.com/apis/site/v2/sports/'+feeds[league]+'/scoreboard',{signal:controller.signal,cache:'no-store'})}finally{clearTimeout(timeout)}
if(!response.ok)throw Error('HTTP '+response.status);
const data=await response.json();if(!Array.isArray(data.events))throw Error('Unexpected feed');
lastGood[league]={data,time:Date.now()};render(data);
status.textContent='Latest check '+new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})+' · Public ESPN feed (unofficial) · Refreshes while this tab is open';
}catch(e){if(lastGood[league]){render(lastGood[league].data);status.textContent='Feed unavailable · Showing last known scores from '+new Date(lastGood[league].time).toLocaleTimeString()+' (not live)'}else{root.innerHTML='<p class="register-empty">Live feed unavailable. See the verified newspaper scoreboard below.</p>';status.textContent='Live feed unavailable · No scores invented'}}
finally{busy=false;schedule()}
}
function schedule(){clearTimeout(timer);if(!stopped&&!document.hidden)timer=setTimeout(refresh,(lastGood[league]?.data?.events||[]).some(isLive)?30000:120000)}
tabs.addEventListener('click',e=>{const button=e.target.closest('button[data-league]');if(!button||!feeds[button.dataset.league])return;league=button.dataset.league;tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));clearTimeout(timer);if(lastGood[league])render(lastGood[league].data);else root.innerHTML='<p>Loading live scores…</p>';refresh()});
document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)refresh()});
window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer)});
refresh();
})();
