(()=>{'use strict';
const panel=document.getElementById('match-center'),title=document.getElementById('match-center-title'),status=document.getElementById('match-center-status'),body=document.getElementById('match-center-content'),close=document.getElementById('match-center-close');
if(!panel)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','&#39;':'&#39;'}[c]||'&#39;'));
let id='',timer,request=0,fixture=null;
function items(data){let list=data.keyEvents||data.commentary||data.plays||[];if(!Array.isArray(list))list=list.items||list.events||[];return list.filter(x=>x&&typeof x==='object').slice(-90).reverse()}
function eventText(x){return x.text||x.description||x.shortText||x.type?.text||x.type?.displayName||x.type?.name||'Event'}
function eventMinute(x){return x.clock?.displayValue||x.clock?.value||x.minute||x.displayClock||x.time?.displayValue||''}
function stats(data){const teams=data.boxscore?.teams||[];return teams.map(t=>{const name=t.team?.displayName||t.team?.name||'Team';const values=(t.statistics||[]).map(v=>{const label=v.label||v.displayName||v.name||'';const value=v.displayValue??v.value??'';return label?'<div class="match-stat"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>':''}).join('');return '<div class="match-stat-team"><h4>'+esc(name)+'</h4>'+(values||'<p>Detailed statistics not provided.</p>')+'</div>'}).join('')}
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
async function update(){
const current=id,token=++request;
try{
const day=fixture.date||new Date().toISOString().slice(0,10);
const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),12000);let response;
try{response=await fetch('https://sportscore.com/api/v1/fixtures/?sport=football&date='+encodeURIComponent(day)+'&limit=200',{signal:ctrl.signal,cache:'no-store'})}finally{clearTimeout(timeout)}
if(!response.ok)throw Error('SportScore fixture list HTTP '+response.status);
const list=await response.json(),games=Array.isArray(list)?list:(list.fixtures||list.matches||list.data||[]);
if(!Array.isArray(games))throw Error('Invalid fixture list');
const found=games.find(g=>{const a=norm(g.home||g.home_team?.name),b=norm(g.away||g.away_team?.name);return (a===norm(fixture.home)&&b===norm(fixture.away))||(a===norm(fixture.away)&&b===norm(fixture.home))});
if(!found)throw Error('No matching independent fixture');
const slug=found.slug||found.match_slug;if(!slug)throw Error('Fixture has no detail slug');
const detailResponse=await fetch('https://sportscore.com/api/widget/match/?sport=football&slug='+encodeURIComponent(slug),{cache:'no-store'});if(!detailResponse.ok)throw Error('SportScore match detail HTTP '+detailResponse.status);
const envelope=await detailResponse.json(),data=envelope.match||envelope.data||envelope;
if(token!==request||current!==id)return;
title.textContent=fixture.home+' vs '+fixture.away;
const raw=data.timeline||data.events||data.incidents||[];const events=Array.isArray(raw)?raw:(raw.events||raw.items||[]);
const statRaw=data.statistics||data.stats||[];const statRows=Array.isArray(statRaw)?statRaw:Object.entries(statRaw).map(([name,value])=>({name,value}));
const statistics=statRows.map(x=>'<div class="match-stat"><span>'+esc(x.name||x.label||x.type||'Statistic')+'</span><strong>'+esc(x.value??x.home??'')+(x.away!=null?' / '+esc(x.away):'')+'</strong></div>').join('');
status.textContent='SportScore match matched · '+esc(data.status_text||found.status_text||data.status||found.status||'Status unavailable')+' · Checked '+new Date().toLocaleTimeString()+' · Feed may lag by 60+ seconds';
body.innerHTML='<div class="match-center-grid"><section><h3>Match timeline</h3>'+(events.length?'<ol class="match-events">'+events.map(x=>'<li><strong>'+esc(x.minute||x.time||x.clock||'')+'</strong> '+esc(x.text||x.description||x.label||x.type?.name||x.type||'Match event')+'</li>').join('')+'</ol>':'<p>No play-by-play events supplied by this provider for this match.</p>')+'</section><section><h3>Match statistics</h3>'+(statistics||'<p>Detailed statistics not supplied for this match.</p>')+'</section></div><p>Data: <a href="https://sportscore.com/" target="_blank" rel="noopener noreferrer">Powered by SportScore</a> · Not an official UEFA feed. Missing data is never invented.</p>';
}catch(e){if(token===request&&current===id)status.textContent='Independent match details unavailable. '+(body.textContent?'Last available information remains below.':'Try again shortly.')}
finally{if(token===request&&current===id){clearTimeout(timer);timer=setTimeout(update,30000)}}
}
function open(btn){const card=btn.closest('.register-game');if(!card)return;const names=[...card.querySelectorAll('.register-team')].map(x=>(x.querySelector('.team-with-logo')||x).textContent.trim().replace(/^#\\d+\\s*/, '')).filter(Boolean);if(names.length!==2)return;id=btn.dataset.matchId;fixture={home:names[0],away:names[1],date:card.dataset.gameDate};panel.hidden=false;panel.scrollIntoView({behavior:'smooth',block:'start'});body.textContent='';title.textContent=names.join(' vs ');status.textContent='Validating independent match source…';clearTimeout(timer);update()}
document.addEventListener('click',e=>{const btn=e.target.closest('.match-center-open');if(btn)open(btn)});
close.addEventListener('click',()=>{id='';fixture=null;request++;clearTimeout(timer);panel.hidden=true;document.getElementById('scores')?.scrollIntoView({behavior:'smooth'})});
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer);else if(id)update()});
window.addEventListener('pagehide',()=>clearTimeout(timer));
})();