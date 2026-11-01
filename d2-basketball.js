(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const gender=document.body.dataset.gender||new URLSearchParams(location.search).get('gender')||'men';
const path=gender==='women'?'d2-womens-basketball.html':'d2-mens-basketball.html';
const state={data:null,teams:new Map()};
const link=t=>'d2-team.html?gender='+encodeURIComponent(gender)+'&team='+encodeURIComponent(t.id);
const name=t=>esc(t?.name||t?.id||'Unknown school');
const gameLink=g=>'d2-game.html?gender='+encodeURIComponent(gender)+'&game='+encodeURIComponent(g.id);
const tipMinute=v=>{const m=/^(1[0-2]|0?[1-9]):([0-5][0-9])\s*(AM|PM)\s*ET$/i.exec(String(v||'').trim());return m?(Number(m[1])%12)*60+Number(m[2])+(m[3].toUpperCase()==='PM'?720:0):1440;};
const chronological=(a,b)=>String(a.date).localeCompare(String(b.date))||tipMinute(a.start_time)-tipMinute(b.start_time)||String(a.id).localeCompare(String(b.id));
const pct=t=>((t.w||0)+(t.l||0))?((t.w||0)/((t.w||0)+(t.l||0))):0;
const label=t=>t?.conference||'Conference unverified';
const memberBadge=t=>t?.not_eligible_for_dii_elo?'<small class="member-tag" title="'+esc(t.membership_note||'DII membership pending')+'">2026–27 NCAA DII MEMBERSHIP PENDING</small>':'';
const color=v=>/^#[0-9a-f]{6}$/i.test(v||'')?v:'#274c5e';
function logo(t){
 const slug=String(t?.slug||'').replace(/[^a-z0-9-]/gi,'');
 const branded=/^#[0-9a-f]{6}$/i.test(t?.primary||'')&&/^#[0-9a-f]{6}$/i.test(t?.secondary||'');
 const initials=String(t?.name||'?').replace(/\b(?:university|college|of|at|the)\b/gi,'').trim().split(/\s+/).slice(0,2).map(v=>v[0]||'').join('').toUpperCase();
 const colors='style="--c1:'+color(t?.primary)+';--c2:'+color(t?.secondary)+'"';
 const description=branded?(t?.color_provenance||'School colors from source provider'):'Brand colors unavailable; neutral rings used';
 return '<span class="logo-shell '+(branded?'branded':'unbranded')+'" title="'+esc(description)+'" '+colors+'>'+
 (slug?'<img loading="lazy" alt="" src="https://ncaa-api.henrygd.me/logo/'+encodeURIComponent(slug)+'.svg" onerror="this.remove()">':'')+
 '<small class="logo-initials">'+esc(initials)+'</small></span>';
}
function school(id){return state.teams.get(String(id))||{id:String(id),name:id,slug:''}}
function row(t,i,withRank=true){return '<div class="board-row"><span>'+(withRank?i+1:'')+'</span>'+logo(t)+'<a class="school-link" href="'+link(t)+'">'+name(t)+memberBadge(t)+'</a><span>'+(t.w||0)+'–'+(t.l||0)+'</span><span>'+Math.round(pct(t)*1000)/10+'%</span><span class="elo">'+Number(t.elo||1500).toFixed(0)+'</span></div>'}
function game(g,includeLink=true){
 const away=school(g.away),home=school(g.home),final=g.status==='final';
 const time=g.start_time||(g.tipoff_as_posted?g.tipoff_as_posted+' · GLIAC TIME ZONE UNCONFIRMED':'Tipoff not announced');
 const broadcast=g.network?(g.stream_url&&/^https:\/\//.test(g.stream_url)?'<a target="_blank" rel="noopener noreferrer" href="'+esc(g.stream_url)+'">'+esc(g.network)+' ↗</a>':esc(g.network)):'TV / STREAM UNCONFIRMED';
 const broadcastType=g.network&&g.broadcast_type?'<small>'+esc(g.broadcast_type)+'</small>':'';
 const winA=final&&Number(g.away_score)>Number(g.home_score);
 const winH=final&&Number(g.home_score)>Number(g.away_score);
 const probability=(g.pred_home_pct===null||g.pred_home_pct===undefined)?null:Number(g.pred_home_pct);
 const hasProbability=Number.isFinite(probability)&&probability>=0&&probability<=100;
 const formatChange=v=>(Number(v)>0?'+':'')+Number(v).toFixed(1);
 const odds=hasProbability?'<div class="forecast-strip" aria-label="Experimental USRS projected win probabilities">'+
 '<div class="forecast-label"><span>USRS MATCHUP · EXPERIMENTAL</span><small>Uncalibrated DII coefficients</small></div>'+
 '<div class="forecast-values"><strong>'+esc((100-probability).toFixed(1))+'% <small>'+esc(away.name)+'</small></strong>'+
 '<strong>'+esc(probability.toFixed(1))+'% <small>'+esc(home.name)+'</small></strong></div>'+
 '<div class="forecast-meter" aria-hidden="true"><span style="width:'+esc(probability.toFixed(1))+'%"></span></div>'+
 (final&&Number.isFinite(Number(g.elo_change_home))?'<p>FINAL ELO MOVEMENT · '+esc(away.name)+' '+esc(formatChange(g.elo_change_away))+
 ' / '+esc(home.name)+' '+esc(formatChange(g.elo_change_home))+'</p>':'')+'</div>':'';
 return '<article class="game-card"><div class="game-head"><span>'+esc(g.date)+' · '+
 esc(final?'FINAL'+(g.start_time?' · '+g.start_time:''):g.status==='live'?'LIVE · '+time:time)+(g.neutral?' · NEUTRAL SITE':'')+'</span><span class="game-broadcast">'+broadcast+broadcastType+'</span></div>'+
 '<div class="game-row '+(winA?'winner':'')+'">'+logo(away)+'<a class="school-link" href="'+link(away)+'">'+name(away)+'</a><b>'+
 (final||g.status==='live'?esc(g.away_score??'—'):'')+'</b></div>'+
 '<div class="game-row '+(winH?'winner':'')+'">'+logo(home)+'<a class="school-link" href="'+link(home)+'">'+name(home)+'</a><b>'+
 (final||g.status==='live'?esc(g.home_score??'—'):'')+'</b></div>'+odds+
 '<div class="game-footer">'+esc(g.venue||(g.venue_city?g.venue_city+' · Arena not confirmed':'Venue awaiting official confirmation'))+
 (g.tournament?' · '+esc(g.tournament):'')+
 (g.source_url?' · <a target="_blank" rel="noopener noreferrer" href="'+esc(g.source_url)+'">SOURCE ↗</a>':'')+
 (includeLink?' · <a class="gamefile-link" href="'+gameLink(g)+'">OPEN GAMEFILE ↗</a>':'')+
 '</div></article>';
}
function renderHome(d){const teams=(d.teams||[]).slice().sort((a,b)=>Number(!!a.not_eligible_for_dii_elo)-Number(!!b.not_eligible_for_dii_elo)||a.name.localeCompare(b.name));const games=d.games||[];const finals=games.filter(g=>g.status==='final'&&g.elo_eligible);
$('teams-covered').textContent=teams.length;$('finals-covered').textContent=finals.length;
const transitionCount=teams.filter(t=>t.not_eligible_for_dii_elo).length;
$('directory-count').textContent=teams.length+' preliminary programs · '+transitionCount+' documented future or conference-transition entries excluded from DII Elo';
const gameDates=[...new Set(games.map(g=>g.date))].sort();
const dateParts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
const today=dateParts.year+'-'+dateParts.month+'-'+dateParts.day,date=$('game-date');
date.value=gameDates.find(v=>v>=today)||gameDates.at(-1)||today;
function showDate(){const selected=games.filter(g=>g.date===date.value);$('game-grid').innerHTML=selected.length?selected.sort(chronological).map(game).join(''):'<div class="note">No verified NCAA Division II games published for this date.</div>'}
date.addEventListener('change',showDate);showDate();
const nav=document.createElement('div');nav.className='game-day-navigation';
nav.innerHTML='<button type="button" data-step="-1" aria-label="Previous game date">‹ PREVIOUS</button><span aria-live="polite"></span><button type="button" data-step="1" aria-label="Next game date">NEXT ›</button>';
date.parentElement.insertAdjacentElement('afterend',nav);
function updateNav(){const i=gameDates.indexOf(date.value);
nav.querySelector('span').textContent=i>=0?'VERIFIED DAY '+(i+1)+' / '+gameDates.length:'SELECT DATE';
for(const b of nav.querySelectorAll('button'))b.disabled=i<0||i+Number(b.dataset.step)<0||i+Number(b.dataset.step)>=gameDates.length;}
nav.addEventListener('click',event=>{const b=event.target.closest('button[data-step]');if(!b)return;
const i=gameDates.indexOf(date.value)+Number(b.dataset.step);if(i<0||i>=gameDates.length)return;
date.value=gameDates[i];showDate();updateNav();});
date.addEventListener('change',updateNav);updateNav();
const ranked=teams.filter(t=>!t.not_eligible_for_dii_elo&&(t.w||0)+(t.l||0)>0).sort((a,b)=>b.elo-a.elo||b.w-a.w||a.name.localeCompare(b.name));
const hasGames=finals.length>0;
$('elo-note').textContent=(hasGames?'Early-season ratings from verified Division II finals; provisional model calibration.':'Every program began at Elo 1500; no artificial carryover or rankings before verified games.')+' · Home edge '+(d.model?.home_elo_edge??'TBA')+' · K '+(d.model?.k??'TBA')+' · '+(d.model?.status||'Calibration pending')+'.';
$('elo-board').innerHTML=(hasGames?'<div class="board-row board-header"><span>#</span><span></span><span>SCHOOL</span><span>W–L</span><span>PCT</span><span>ELO</span></div>'+ranked.slice(0,30).map((t,i)=>row(t,i)).join(''):'<div class="note">No power order until eligible games are completed.</div>');
function directory(q){const found=teams.filter(t=>(t.name+' '+label(t)).toLowerCase().includes(q));$('team-directory').innerHTML=found.length?found.map((t,i)=>row(t,i,false)).join(''):'<div class="note">No teams match the search or the registry has not yet been verified.</div>'}
$('team-search').addEventListener('input',e=>directory(e.target.value.trim().toLowerCase()));directory('');
const confs=[...new Set(teams.map(t=>t.conference).filter(Boolean))].sort();const sel=$('conference-select');
sel.innerHTML='<option value="">Select a verified conference</option>'+confs.map(c=>'<option>'+esc(c)+'</option>').join('');
function conference(){const list=teams.filter(t=>t.conference&&t.conference===sel.value).sort((a,b)=>pct(b)-pct(a)||b.elo-a.elo);$('conference-board').innerHTML=list.length?'<p class="muted">Overall records only until official conference games/tiebreakers are verified.</p>'+list.map((t,i)=>row(t,i)).join(''):'<div class="note">Conference memberships and official standings are not yet verified for this edition.</div>'}
sel.addEventListener('change',conference);conference();
$('coverage').innerHTML='Preliminary Division II edition: <b>'+teams.length+'</b> listed programs, including <b>'+transitionCount+'</b> documented future or conference-transition entries not counted as certified DII opponents. NCAA membership has not yet been fully reconciled. This desk currently lists <b>'+teams.length+'</b> identified programs and <b>'+games.length+'</b> published fixtures or finals.<br>Institutional primary and secondary colors are taken from matched provider records where available. Any generated second-ring tonal accent is a visual treatment, <b>not</b> a verified school secondary color. School-specific conference, venue, television and roster fields appear only when the sources support them. A discovered team is not automatically a certified 2026–27 member.<br><b>Feed:</b> '+esc(d.source||'NCAA')+'<br><b>Quality:</b> '+esc(d.quality?.status||'Refresh pending')+'<br><b>Important:</b> Independent Elo changes require confirmed Division II opponents; exhibitions and cross-division games are excluded.';

const coverageStats=d.quality?.field_coverage;
if(coverageStats){
 const total=Number(coverageStats.fixture_records||0);
 $('coverage').innerHTML+='<br><b>Schedule coverage audit:</b> '+esc(coverageStats.schools_with_at_least_one_fixture)+
 ' schools have at least one published fixture; '+esc(coverageStats.schools_with_no_published_fixtures)+
 ' have none. '+esc(coverageStats.games_with_named_venue)+' / '+total+
 ' games include a named venue; '+esc(coverageStats.games_with_network)+' / '+total+
 ' include a broadcast network; '+esc(coverageStats.games_with_verified_tipoff??'—')+' have posted tipoff times and '+esc(coverageStats.games_with_stream_link??'—')+' have verified stream links. <b>Full schedule certification remains pending.</b>';
}
const brandedSchools=teams.filter(t=>/^#[0-9a-f]{6}$/i.test(t.primary||'')&&/^#[0-9a-f]{6}$/i.test(t.secondary||''));
const officialPairs=brandedSchools.filter(t=>t.color_provenance&&t.color_provenance.includes('ESPN-published primary and secondary')).length;
$('coverage').innerHTML+='<br><b>Logo rings:</b> '+brandedSchools.length+' of '+teams.length+
 ' teams currently have institution-matched palette data ('+officialPairs+' ESPN-published two-color pairs).'+
 ' When a university lists white as its secondary, a nonwhite <em>editorial tonal accent</em> is used and marked in the source data; it is not represented as an official second school color.'+
 ' Schools without a verified primary remain in neutral paper styling.';
}
function renderTeam(d){const id=new URLSearchParams(location.search).get('team');const t=state.teams.get(id);$('back-link').href=path;const el=$('team-profile');
const back=$('back-link');if(back)back.textContent='← BACK TO '+(gender==='women'?'WOMEN’S':'MEN’S')+' DII NEWSPAPER';
for(const a of document.querySelectorAll('.switches a'))a.classList.toggle('selected',gender==='women'?a.href.includes('womens'):a.href.includes('mens'));
if(!t){el.innerHTML='<div class="note">School not found in the verified team index. <a href="'+path+'">Browse the newspaper</a>.</div>';return}
const membership=t.membership_status?'<div class="note member-alert"><b>MEMBERSHIP:</b> '+esc(t.membership_status)+'. '+esc(t.membership_note||'')+(t.membership_source?' <a href="'+esc(t.membership_source)+'" target="_blank" rel="noopener noreferrer">OFFICIAL SOURCE ↗</a>':'')+'</div>':'';
const gs=(d.games||[]).filter(g=>g.away===t.id||g.home===t.id).sort(chronological);el.innerHTML=membership+'<div class="team-hero">'+logo(t)+'<div><span class="eyebrow">DII '+esc(gender.toUpperCase())+' · SCHOOL DESK</span><h1>'+name(t)+'</h1><p>'+esc(label(t))+' · '+esc(t.city||'Location not yet verified')+'</p></div></div><div class="team-stats"><div class="team-stat"><strong>'+(t.w||0)+'–'+(t.l||0)+'</strong><span>VERIFIED DII RECORD</span></div><div class="team-stat"><strong>'+Number(t.elo||1500).toFixed(0)+'</strong><span>INDEPENDENT ELO</span></div><div class="team-stat"><strong>'+gs.length+'</strong><span>PUBLISHED SCHEDULE ENTRIES</span></div></div><div class="section-head"><h2>COMPLETE AVAILABLE SCHEDULE</h2><span>AWAY FIRST · HOME SECOND</span></div><div class="team-schedule">'+(gs.length?gs.map(game).join(''):'<div class="note">The NCAA feed has not published verified games for this school yet.</div>')+'</div><p class="note">Team-page fields will expand as official rosters, venues, broadcasts, and conference classifications are verified. No placeholders are presented as facts.</p>'}
function renderGame(d){
 const id=new URLSearchParams(location.search).get('game');
 const g=(d.games||[]).find(x=>String(x.id)===id);
 const el=$('gamefile-profile'),back=$('back-link');
 back.href=path;back.textContent='← BACK TO '+(gender==='women'?'WOMEN’S':'MEN’S')+' DII NEWSPAPER';
 for(const a of document.querySelectorAll('.switches a'))a.classList.toggle('selected',gender==='women'?a.href.includes('womens'):a.href.includes('mens'));
 if(!g){el.innerHTML='<div class="note">Game not found in published '+esc(gender)+' Division II records. <a href="'+path+'">Back to the newspaper</a>.</div>';return;}
 const away=school(g.away),home=school(g.home);
 const src=[],seen=new Set();
 function add(url,txt){if(!/^https:\/\//.test(String(url||''))||seen.has(url))return;seen.add(url);src.push('<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(txt)+' ↗</a>');}
 add(g.source_url,'Game result or fixture source');
 for(const u of (Array.isArray(g.official_schedule_sources)?g.official_schedule_sources:[]))add(u,'University or conference schedule');
 add(g.tipoff_source_url,'Tipoff verification');add(g.venue_source_url,'Venue verification');
 add(g.broadcast_source_url,'Broadcast verification');add(g.stream_url,'Watch stream');
 const fmt=v=>typeof v==='number'&&Number.isFinite(v)?v.toFixed(1):'Not available';
 const live=g.status==='live',final=g.status==='final';
 const pregame=(typeof g.pred_home_pct==='number'&&Number.isFinite(g.pred_home_pct));
 el.innerHTML='<div class="gamefile-title"><span>DII '+esc(gender.toUpperCase())+' · '+esc(g.date)+' · '+esc(final?'FINAL':live?'LIVE (published feed)':'SCHEDULED')+'</span><h1>'+name(away)+' <em>AT</em> '+name(home)+'</h1><p>'+esc(g.neutral?'Neutral site: team order is the published designation, not home court.':'Away first · home second')+'</p></div>'+
 '<div class="gamefile-score">'+game(g,false)+'</div><div class="gamefile-grid">'+
 '<section class="gamefile-box"><h2>THE USRS MODEL</h2><div class="gamefile-facts"><div><small>AWAY PREGAME ELO</small><strong>'+esc(fmt(g.pregame_elo_away))+'</strong></div><div><small>HOME PREGAME ELO</small><strong>'+esc(fmt(g.pregame_elo_home))+'</strong></div></div>'+
 '<p>'+(pregame?'Pre-game win chances: <b>'+esc((100-g.pred_home_pct).toFixed(1))+'%</b> '+name(away)+'; <b>'+esc(g.pred_home_pct.toFixed(1))+'%</b> '+name(home)+'.':'No evidence-backed win estimate.')+'</p>'+
 '<p class="muted">Independent 1500-start Elo. Home edge: '+esc(g.neutral?'none (neutral site)':d.model?.home_elo_edge??'unavailable')+' · K: '+esc(d.model?.k??'unavailable')+'. <b>Division II parameters are provisional, not historically calibrated.</b></p></section>'+
 '<section class="gamefile-box"><h2>GAME INTELLIGENCE</h2><p><b>Tipoff:</b> '+esc(g.start_time||'Unconfirmed')+'<br><b>Arena:</b> '+esc(g.venue||'Unconfirmed')+
 (g.venue_city?'<br><b>Published location:</b> '+esc(g.venue_city):'')+
 '<br><b>Network / stream:</b> '+esc(g.network||'Not verified')+
 (g.tournament?'<br><b>Tournament:</b> '+esc(g.tournament):'')+'</p><p class="muted">Player-by-player box scores are not included until verified player data exists. No statistics are invented.</p></section></div>'+
 '<section class="gamefile-box gamefile-source-box"><h2>VERIFY THE REPORTING</h2><div class="gamefile-source-links">'+(src.length?src.join(''):'<span class="muted">No game-specific source link is currently stored.</span>')+'</div>'+
 '<p class="muted">Published ledger updated '+esc(d.as_of?new Date(d.as_of).toLocaleString():'at an unknown time')+'. Refresh to check for newly published results. This page does not represent real-time play-by-play.</p></section>';
}
async function init(){try{const res=await fetch('data/d2-'+gender+'-2026-27.json?v='+Date.now(),{cache:'no-store'});if(!res.ok)throw Error('Published data unavailable');const d=await res.json();if(d.gender!==gender||d.season!=='2026-27'||d.starting_elo!==1500||d.team_target!==298)throw Error('Failed women/men data-isolation contract');state.data=d;state.teams=new Map((d.teams||[]).map(t=>[String(t.id),t]));$('status').textContent='NCAA scoreboard / published program directory · '+(d.as_of?new Date(d.as_of).toLocaleString():'Awaiting verified first refresh')+' · '+(d.quality?.status||'provisional coverage');if(document.body.dataset.page==='team')renderTeam(d);else if(document.body.dataset.page==='game')renderGame(d);else renderHome(d)}catch(e){$('status').textContent='Source feed unavailable; existing standings were not replaced with invented values.';const target=$('team-profile')||$('gamefile-profile')||$('game-grid');if(target)target.innerHTML='<div class="note">'+esc(e.message)+'</div>';}}
init();
if(document.body.dataset.page==='game'){
 $('gamefile-refresh').addEventListener('click',init);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)init();});
}
})();