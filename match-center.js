(()=>{'use strict';
const panel=document.getElementById('match-center'),title=document.getElementById('match-center-title'),status=document.getElementById('match-center-status'),body=document.getElementById('match-center-content'),close=document.getElementById('match-center-close');
if(!panel)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','&#39;':'&#39;'}[c]||'&#39;'));
let id='',timer,request=0;
function items(data){let list=data.keyEvents||data.commentary||data.plays||[];if(!Array.isArray(list))list=list.items||list.events||[];return list.filter(x=>x&&typeof x==='object').slice(-90).reverse()}
function eventText(x){return x.text||x.description||x.shortText||x.type?.text||x.type?.displayName||x.type?.name||'Event'}
function eventMinute(x){return x.clock?.displayValue||x.clock?.value||x.minute||x.displayClock||x.time?.displayValue||''}
function stats(data){const teams=data.boxscore?.teams||[];return teams.map(t=>{const name=t.team?.displayName||t.team?.name||'Team';const values=(t.statistics||[]).map(v=>{const label=v.label||v.displayName||v.name||'';const value=v.displayValue??v.value??'';return label?'<div class="match-stat"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>':''}).join('');return '<div class="match-stat-team"><h4>'+esc(name)+'</h4>'+(values||'<p>Detailed statistics not provided.</p>')+'</div>'}).join('')}
async function update(){
const current=id,token=++request;
try{
const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);let response;try{response=await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.europa/summary?event='+encodeURIComponent(current),{signal:controller.signal,cache:'no-store'})}finally{clearTimeout(timeout)}
if(!response.ok)throw Error('Match feed unavailable ('+response.status+')');const data=await response.json();if(token!==request||current!==id)return;
const teams=data.header?.competitions?.[0]?.competitors||[];const name=teams.map(t=>t.team?.displayName||t.team?.name||'Team').join(' vs ');title.textContent=name||'Europa League Match Center';
const events=items(data),statistics=stats(data);
const matchStatus=data.header?.competitions?.[0]?.status?.type?.shortDetail||data.header?.competitions?.[0]?.status?.type?.description||'';
status.textContent=(matchStatus?matchStatus+' · ':'')+'Checked '+new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit'})+' · Unofficial ESPN feed';
body.innerHTML='<div class="match-center-grid"><section><h3>Match timeline</h3>'+(events.length?'<ol class="match-events">'+events.map(x=>'<li><strong>'+esc(eventMinute(x))+'</strong> '+esc(eventText(x))+'</li>').join('')+'</ol>':'<p>Event-by-event coverage has not been supplied for this match.</p>')+'</section><section><h3>Match statistics</h3>'+(statistics||'<p>Detailed match statistics are not available from this feed.</p>')+'</section></div><p class="small">Coverage varies by fixture. Missing events or statistics are never invented. Source: ESPN unofficial match summary.</p>';
}catch(e){if(token===request&&current===id)status.textContent='Live match details could not be refreshed. '+(body.textContent?'Last available information remains below.':'Try again shortly.')}
finally{if(token===request&&current===id){clearTimeout(timer);timer=setTimeout(update,30000)}}
}
function open(matchId){if(!/^\d+$/.test(matchId))return;id=matchId;panel.hidden=false;panel.scrollIntoView({behavior:'smooth',block:'start'});body.textContent='';title.textContent='Europa League Match Center';status.textContent='Connecting to match feed…';clearTimeout(timer);update()}
document.addEventListener('click',e=>{const btn=e.target.closest('.match-center-open');if(btn)open(btn.dataset.matchId)});
close.addEventListener('click',()=>{id='';request++;clearTimeout(timer);panel.hidden=true;document.getElementById('scores')?.scrollIntoView({behavior:'smooth'})});
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer);else if(id)update()});
window.addEventListener('pagehide',()=>clearTimeout(timer));
})();