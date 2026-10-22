(()=>{'use strict';
const panel=document.getElementById('match-center'),title=document.getElementById('match-center-title'),status=document.getElementById('match-center-status'),body=document.getElementById('match-center-content'),close=document.getElementById('match-center-close');
if(!panel)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||'&#39;'));
let id='',timer,request=0,fixture=null;
function items(data){let list=data.keyEvents||data.commentary||data.plays||[];if(!Array.isArray(list))list=list.items||list.events||[];return list.filter(x=>x&&typeof x==='object').slice(-90).reverse()}
function eventText(x){return x.text||x.description||x.shortText||x.type?.text||x.type?.displayName||x.type?.name||'Event'}
function eventMinute(x){return x.clock?.displayValue||x.clock?.value||x.minute||x.displayClock||x.time?.displayValue||''}
function stats(data){const teams=data.boxscore?.teams||[];return teams.map(t=>{const name=t.team?.displayName||t.team?.name||'Team';const values=(t.statistics||[]).map(v=>{const label=v.label||v.displayName||v.name||'';const value=v.displayValue??v.value??'';return label?'<div class="match-stat"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>':''}).join('');return '<div class="match-stat-team"><h4>'+esc(name)+'</h4>'+(values||'<p>Detailed statistics not provided.</p>')+'</div>'}).join('')}
async function update(){
const current=id,token=++request;
try{
const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),12000);let response;
try{response=await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.europa/summary?event='+encodeURIComponent(current),{signal:ctrl.signal,cache:'no-store'})}finally{clearTimeout(timeout)}
if(!response.ok)throw Error('ESPN match summary HTTP '+response.status);
const data=await response.json();
if(!data.header?.competitions?.length&&!data.boxscore&&!data.keyEvents&&!data.plays)throw Error('Match summary not available');
const found=data.header?.competitions?.[0]||{};
if(token!==request||current!==id)return;
title.textContent=fixture.home+' vs '+fixture.away;
const events=items(data);
const statistics=stats(data);
status.textContent='ESPN Europa League match summary · '+esc(found.status?.type?.description||found.status?.type?.shortDetail||'Status unavailable')+' · Checked '+new Date().toLocaleTimeString();
body.innerHTML='<div class="match-center-grid"><section><h3>Match timeline</h3>'+(events.length?'<ol class="match-events">'+events.map(x=>'<li><strong>'+esc(eventMinute(x))+'</strong> '+esc(eventText(x))+'</li>').join('')+'</ol>':'<p>No play-by-play events supplied for this match.</p>')+'</section><section><h3>Match statistics</h3>'+(statistics||'<p>Detailed statistics not supplied for this match.</p>')+'</section></div><p>Data: <a href="https://www.espn.com/soccer/scoreboard/_/league/uefa.europa" target="_blank" rel="noopener noreferrer">ESPN Europa League</a>. Missing events and statistics are never invented.</p>';
}catch(e){if(token===request&&current===id)status.textContent='ESPN match summary unavailable ('+esc(e.message||'request failed')+'). '+(body.textContent?'Last available information remains below.':'Open the official game page for confirmed information.')}
finally{if(token===request&&current===id){clearTimeout(timer);timer=setTimeout(update,30000)}}
}
function open(btn){const card=btn.closest('.register-game');if(!card)return;const names=[...card.querySelectorAll('.register-team')].map(x=>(x.querySelector('.team-with-logo')||x).textContent.trim().replace(/^#\\d+\\s*/, '')).filter(Boolean);if(names.length!==2)return;id=btn.dataset.matchId;fixture={home:names[0],away:names[1],date:card.dataset.gameDate};panel.hidden=false;panel.scrollIntoView({behavior:'smooth',block:'start'});body.textContent='';title.textContent=names.join(' vs ');status.textContent='Requesting ESPN Europa League match summary…';clearTimeout(timer);update()}
document.addEventListener('click',e=>{const btn=e.target.closest('.match-center-open');if(btn)open(btn)});
close.addEventListener('click',()=>{id='';fixture=null;request++;clearTimeout(timer);panel.hidden=true;document.getElementById('scores')?.scrollIntoView({behavior:'smooth'})});
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer);else if(id)update()});
window.addEventListener('pagehide',()=>clearTimeout(timer));
})();