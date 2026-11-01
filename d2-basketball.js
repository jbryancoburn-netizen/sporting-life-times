(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const gender=document.body.dataset.gender||new URLSearchParams(location.search).get('gender')||'men';
const path=gender==='women'?'d2-womens-basketball.html':'d2-mens-basketball.html';
const state={data:null,teams:new Map()};
const link=t=>'d2-team.html?gender='+encodeURIComponent(gender)+'&team='+encodeURIComponent(t.id);
const name=t=>esc(t?.name||t?.id||'Unknown school');
const pct=t=>((t.w||0)+(t.l||0))?((t.w||0)/((t.w||0)+(t.l||0))):0;
const label=t=>t?.conference||'Conference unverified';
const color=v=>/^#[0-9a-f]{6}$/i.test(v||'')?v:'#274c5e';
function logo(t){
 const slug=String(t?.slug||'').replace(/[^a-z0-9-]/gi,'');
 const branded=/^#[0-9a-f]{6}$/i.test(t?.primary||'')&&/^#[0-9a-f]{6}$/i.test(t?.secondary||'');
 const initials=String(t?.name||'?').replace(/\b(?:university|college|of|at|the)\b/gi,'').trim().split(/\s+/).slice(0,2).map(v=>v[0]||'').join('').toUpperCase();
 const colors='style="--c1:'+color(t?.primary)+';--c2:'+color(t?.secondary)+'"';
 return '<span class="logo-shell '+(branded?'branded':'unbranded')+'" '+colors+'>'+
 (slug?'<img loading="lazy" alt="" src="https://ncaa-api.henrygd.me/logo/'+encodeURIComponent(slug)+'.svg" onerror="this.remove()">':'')+
 '<small class="logo-initials">'+esc(initials)+'</small></span>';
}
function school(id){return state.teams.get(String(id))||{id:String(id),name:id,slug:''}}
function row(t,i,withRank=true){return '<div class="board-row"><span>'+(withRank?i+1:'')+'</span>'+logo(t)+'<a class="school-link" href="'+link(t)+'">'+name(t)+'</a><span>'+(t.w||0)+'–'+(t.l||0)+'</span><span>'+Math.round(pct(t)*1000)/10+'%</span><span class="elo">'+Number(t.elo||1500).toFixed(0)+'</span></div>'}
function game(g){
 const away=school(g.away),home=school(g.home),final=g.status==='final',live=g.status==='live';
 const complete=final||live,ra=Number(away.elo||1500),rh=Number(home.elo||1500);
 const homeEdge=g.neutral?0:Number(state.data?.model?.home_elo_edge||0);
 const pHome=1/(1+Math.pow(10,(ra-rh-homeEdge)/400));
 const forecast=!complete&&g.elo_eligible&&(ra!==1500||rh!==1500)?
  '<div class="forecast-strip"><b>PRELIMINARY ELO</b><span>'+name(away)+' '+Math.round((1-pHome)*100)+'% · '+name(home)+' '+Math.round(pHome*100)+'%</span></div>':'';
 const scoreA=complete?esc(g.away_score??'—'):'—',scoreH=complete?esc(g.home_score??'—'):'—';
 const winnerA=complete&&Number(g.away_score)>Number(g.home_score),winnerH=complete&&Number(g.home_score)>Number(g.away_score);
 return '<article class="game-card"><div class="game-head"><span class="game-state '+(final?'final':live?'live':'scheduled')+'">'+(final?'FINAL':live?'LIVE':'SCHEDULED')+'</span><span>'+esc(g.date)+' · '+esc(g.start_time||'Tipoff TBA')+(g.neutral?' · NEUTRAL SITE':'')+'</span></div>'+
 '<div class="game-row '+(winnerA?'winner':'')+'">'+logo(away)+'<a class="school-link" href="'+link(away)+'">'+name(away)+'</a><span class="elo-mini">ELO '+ra.toFixed(0)+'</span><b>'+scoreA+'</b></div>'+
 '<div class="game-row '+(winnerH?'winner':'')+'">'+logo(home)+'<a class="school-link" href="'+link(home)+'">'+name(home)+'</a><span class="elo-mini">ELO '+rh.toFixed(0)+'</span><b>'+scoreH+'</b></div>'+
 forecast+'<div class="game-footer">'+esc(g.venue||'Venue not yet verified')+(g.tournament?' · '+esc(g.tournament):'')+(g.neutral?' · Organizer listing order':'')+(g.source_url?' · <a target="_blank" rel="noopener noreferrer" href="'+esc(g.source_url)+'">OFFICIAL SOURCE ↗</a>':'')+'</div></article>';
}
function renderHome(d){const teams=(d.teams||[]).slice().sort((a,b)=>a.name.localeCompare(b.name));const games=d.games||[];const finals=games.filter(g=>g.status==='final'&&g.elo_eligible);
$('teams-covered').textContent=teams.length;$('finals-covered').textContent=finals.length;
$('directory-count').textContent=teams.length+' identified of '+d.team_target+' projected'+(teams.length!==d.team_target?' · membership reconciliation needed':' · independently verified against published directory');
const gameDates=[...new Set(games.map(g=>g.date))].sort();
const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/New_York'}),date=$('game-date');
date.value=gameDates.find(v=>v>=today)||gameDates.at(-1)||today;
function showDate(){const selected=games.filter(g=>g.date===date.value);$('game-grid').innerHTML=selected.length?selected.sort((a,b)=>String(a.start_time||'').localeCompare(String(b.start_time||''))).map(game).join(''):'<div class="note">No verified NCAA Division II games published for this date.</div>'}
date.addEventListener('change',showDate);showDate();
const nav=document.createElement('div');nav.className='game-day-navigation';
nav.innerHTML='<button type="button" data-step="-1" aria-label="Previous game date">‹ PREVIOUS</button><span aria-live="polite"></span><button type="button" data-step="1" aria-label="Next game date">NEXT ›</button>';
date.parentElement.insertAdjacentElement('afterend',nav);
function updateNav(){const i=gameDates.indexOf(date.value);const span=nav.querySelector('span');
span.textContent=i>=0?'VERIFIED DAY '+(i+1)+' / '+gameDates.length:'SELECT DATE';
for(const b of nav.querySelectorAll('button'))b.disabled=i<0||i+Number(b.dataset.step)<0||i+Number(b.dataset.step)>=gameDates.length;}
nav.addEventListener('click',event=>{const b=event.target.closest('button[data-step]');if(!b)return;const i=gameDates.indexOf(date.value)+Number(b.dataset.step);
if(i<0||i>=gameDates.length)return;date.value=gameDates[i];showDate();updateNav();});
date.addEventListener('change',updateNav);updateNav();
const ranked=teams.filter(t=>(t.w||0)+(t.l||0)>0).sort((a,b)=>b.elo-a.elo||b.w-a.w||a.name.localeCompare(b.name));
const hasGames=finals.length>0;
$('elo-note').textContent=(hasGames?'Early-season ratings from verified Division II finals; provisional model calibration.':'Every program began at Elo 1500; no artificial carryover or rankings before verified games.')+' · Home edge '+(d.model?.home_elo_edge??'TBA')+' · K '+(d.model?.k??'TBA')+' · '+(d.model?.status||'Calibration pending')+'.';
$('elo-board').innerHTML=(hasGames?'<div class="board-row board-header"><span>#</span><span></span><span>SCHOOL</span><span>W–L</span><span>PCT</span><span>ELO</span></div>'+ranked.slice(0,30).map((t,i)=>row(t,i)).join(''):'<div class="note">No power order until eligible games are completed.</div>');
function directory(q){const found=teams.filter(t=>(t.name+' '+label(t)).toLowerCase().includes(q));$('team-directory').innerHTML=found.length?found.map((t,i)=>row(t,i,false)).join(''):'<div class="note">No teams match the search or the registry has not yet been verified.</div>'}
$('team-search').addEventListener('input',e=>directory(e.target.value.trim().toLowerCase()));directory('');
const confs=[...new Set(teams.map(t=>t.conference).filter(Boolean))].sort();const sel=$('conference-select');
sel.innerHTML='<option value="">Select a verified conference</option>'+confs.map(c=>'<option>'+esc(c)+'</option>').join('');
function conference(){const list=teams.filter(t=>t.conference&&t.conference===sel.value).sort((a,b)=>pct(b)-pct(a)||b.elo-a.elo);$('conference-board').innerHTML=list.length?'<p class="muted">Overall records only until official conference games/tiebreakers are verified.</p>'+list.map((t,i)=>row(t,i)).join(''):'<div class="note">Conference memberships and official standings are not yet verified for this edition.</div>'}
sel.addEventListener('change',conference);conference();
$('coverage').innerHTML='NCAA projects <b>298</b> programs in this gender for 2026–27. This desk currently lists <b>'+teams.length+'</b> identified programs and <b>'+games.length+'</b> published fixtures or finals.<br>School-specific conference, venue, television, roster and color fields appear only when the sources support them. A discovered team is not automatically a certified 2026–27 member.<br><b>Feed:</b> '+esc(d.source||'NCAA')+'<br><b>Quality:</b> '+esc(d.quality?.status||'Refresh pending')+'<br><b>Important:</b> Independent Elo changes require confirmed Division II opponents; exhibitions and cross-division games are excluded.';
}
function renderTeam(d){const id=new URLSearchParams(location.search).get('team');const t=state.teams.get(id);$('back-link').href=path;const el=$('team-profile');
const back=$('back-link');if(back)back.textContent='← BACK TO '+(gender==='women'?'WOMEN’S':'MEN’S')+' DII NEWSPAPER';
for(const a of document.querySelectorAll('.switches a'))a.classList.toggle('selected',gender==='women'?a.href.includes('womens'):a.href.includes('mens'));
if(!t){el.innerHTML='<div class="note">School not found in the verified team index. <a href="'+path+'">Browse the newspaper</a>.</div>';return}
const gs=(d.games||[]).filter(g=>g.away===t.id||g.home===t.id).sort((a,b)=>a.date.localeCompare(b.date));el.innerHTML='<div class="team-hero">'+logo(t)+'<div><span class="eyebrow">DII '+esc(gender.toUpperCase())+' · SCHOOL DESK</span><h1>'+name(t)+'</h1><p>'+esc(label(t))+' · '+esc(t.city||'Location not yet verified')+'</p></div></div><div class="team-stats"><div class="team-stat"><strong>'+(t.w||0)+'–'+(t.l||0)+'</strong><span>VERIFIED DII RECORD</span></div><div class="team-stat"><strong>'+Number(t.elo||1500).toFixed(0)+'</strong><span>INDEPENDENT ELO</span></div><div class="team-stat"><strong>'+gs.length+'</strong><span>PUBLISHED SCHEDULE ENTRIES</span></div></div><div class="section-head"><h2>COMPLETE AVAILABLE SCHEDULE</h2><span>AWAY FIRST · HOME SECOND</span></div><div class="team-schedule">'+(gs.length?gs.map(game).join(''):'<div class="note">The NCAA feed has not published verified games for this school yet.</div>')+'</div><p class="note">Team-page fields will expand as official rosters, venues, broadcasts, and conference classifications are verified. No placeholders are presented as facts.</p>'}
async function init(){try{const res=await fetch('data/d2-'+gender+'-2026-27.json?v='+Date.now(),{cache:'no-store'});if(!res.ok)throw Error('Published data unavailable');const d=await res.json();if(d.gender!==gender||d.season!=='2026-27'||d.starting_elo!==1500||d.team_target!==298)throw Error('Failed women/men data-isolation contract');state.data=d;state.teams=new Map((d.teams||[]).map(t=>[String(t.id),t]));$('status').textContent='NCAA scoreboard / published program directory · '+(d.as_of?new Date(d.as_of).toLocaleString():'Awaiting verified first refresh')+' · '+(d.quality?.status||'provisional coverage');if(document.body.dataset.page==='team')renderTeam(d);else renderHome(d)}catch(e){$('status').textContent='Source feed unavailable; existing standings were not replaced with invented values.';const target=$('team-profile')||$('game-grid');if(target)target.innerHTML='<div class="note">'+esc(e.message)+'</div>';}}
init();
})();