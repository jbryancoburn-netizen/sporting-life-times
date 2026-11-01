/* Full-season NBL Game Center: permanent fixture plus sourced results. */
(function(){
'use strict';
const root=document.getElementById('nbl-season-desk');if(!root)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let games=[],chosenDay='',mode='all',initial=true;
const $=sel=>root.querySelector(sel);
const nowDay=()=>window.NBLFullSchedule.day(new Date().toISOString());
const dateLabel=d=>new Date(d+'T12:00:00Z').toLocaleDateString('en-AU',{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
const localTime=d=>new Date(d).toLocaleTimeString('en-AU',{timeZone:'Australia/Sydney',hour:'numeric',minute:'2-digit'});
const logo=name=>'assets/nbl-logos/'+name.toLowerCase().replace(/[^a-z0-9]/g,'')+'.png';
const team=name=>'<span class="nbl-sd-team"><img src="'+esc(logo(name))+'" loading="lazy" alt="" onerror="this.hidden=true"><span>'+esc(name)+'</span></span>';
const status=g=>g.state==='post'?'FINAL':g.state==='in'?'LIVE':localTime(g.date)+' AEDT/AEST';
const card=g=>'<article class="nbl-sd-game"><div class="nbl-sd-head">'+status(g)+'</div><div class="nbl-sd-row">'+team(g.away)+'<b>'+(g.away_score??'')+'</b></div><div class="nbl-sd-row">'+team(g.home)+'<b>'+(g.home_score??'')+'</b></div><div class="nbl-sd-meta">'+esc(g.venue||'Venue TBA')+' · '+esc(g.broadcasts.join(', ')||'Broadcast TBA')+'</div>'+(g.url?'<a href="'+esc(g.url)+'" target="_blank" rel="noopener noreferrer">Source box score ↗</a>':'')+'</article>';
root.innerHTML='<div class="nbl-sd-top"><h2>FULL-SEASON GAME CENTER</h2><p id="nbl-sd-count">Loading the published 165-game fixture…</p><div class="nbl-sd-controls"><button type="button" id="nbl-sd-prev">← Previous game day</button><label><span id="nbl-sd-day">Select game day</span> <input type="date" id="nbl-sd-date"></label><button type="button" id="nbl-sd-next">Next game day →</button><select id="nbl-sd-filter" aria-label="Game status"><option value="all">All games</option><option value="final">Finals</option><option value="live">Live</option><option value="upcoming">Upcoming</option></select></div></div><div class="nbl-sd-cards" id="nbl-sd-cards"></div><p class="nbl-sd-source" id="nbl-sd-source"></p>';
function draw(){
 const candidates=games.filter(g=>mode==='all'||(mode==='final'?g.state==='post':mode==='live'?g.state==='in':g.state==='pre'));
 const days=[...new Set(candidates.map(g=>g.day))].sort(),allDays=[...new Set(games.map(g=>g.day))].sort(),today=nowDay();
 if(!days.length){$('#nbl-sd-cards').innerHTML='<p>No '+esc(mode)+' games in the current fixture.</p>';$('#nbl-sd-prev').disabled=true;$('#nbl-sd-next').disabled=true;return;}
 if(!days.includes(chosenDay))chosenDay=days.find(d=>d>=today)||days[days.length-1];
 $('#nbl-sd-date').value=chosenDay;$('#nbl-sd-date').min=allDays[0];$('#nbl-sd-date').max=allDays[allDays.length-1];
 $('#nbl-sd-day').textContent=dateLabel(chosenDay);
 $('#nbl-sd-cards').innerHTML=candidates.filter(g=>g.day===chosenDay).map(card).join('');
 $('#nbl-sd-prev').disabled=!days.some(d=>d<chosenDay);$('#nbl-sd-next').disabled=!days.some(d=>d>chosenDay);
 $('#nbl-sd-prev').onclick=()=>{chosenDay=days.filter(d=>d<chosenDay).at(-1)||chosenDay;draw();};
 $('#nbl-sd-next').onclick=()=>{chosenDay=days.find(d=>d>chosenDay)||chosenDay;draw();};
}
$('#nbl-sd-date').addEventListener('change',e=>{chosenDay=e.target.value;draw();});
$('#nbl-sd-filter').addEventListener('change',e=>{mode=e.target.value;draw();});
async function load(){
 try{
   if(!window.NBLFullSchedule)throw Error('Shared schedule library missing');
   const data=await window.NBLFullSchedule.load();
   if(data.games.length<165)throw Error('Published fixture below 165 games; refusing to present partial season as complete');
   games=data.games;
   if(initial){const today=nowDay(),days=[...new Set(games.map(g=>g.day))].sort();chosenDay=days.find(d=>d>=today)||days.at(-1);initial=false;}
   const finalCount=games.filter(g=>g.state==='post').length;
   $('#nbl-sd-count').textContent=games.length+' fixtures · '+finalCount+' sourced finals · '+games.filter(g=>g.state==='in').length+' live · '+data.clubs+' clubs';
   $('#nbl-sd-source').textContent='Season fixtures persist even when live score feeds fail. '+data.notice+(data.failedDates?' Live ESPN checks unavailable for '+data.failedDates+' of 5 recent dates; some results may lag.':'');
   draw();
 }catch(e){$('#nbl-sd-count').textContent='Season fixture unavailable';$('#nbl-sd-cards').innerHTML='<p>The fixture file could not be loaded. <a href="https://schedule.nbl.com.au/nbl" target="_blank" rel="noopener noreferrer">Open the official NBL schedule ↗</a></p>';$('#nbl-sd-source').textContent=e.message;}
}
load();setInterval(load,5*60*1000);
})();
