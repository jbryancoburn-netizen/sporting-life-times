(()=>{'use strict';
const $=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const gender=document.body.dataset.gender,own=gender==='women'?'d3-womens-basketball.html':'d3-mens-basketball.html';
const state={data:null,teams:new Map()},pct=t=>(t.w||0)+(t.l||0)?Math.round(1000*t.w/(t.w+t.l))/10:0;
const teamLink=t=>own+'?team='+encodeURIComponent(t.id);
const source=g=>/^https:\/\//.test(g.source_url||'')?'<a href="'+esc(g.source_url)+'" target="_blank" rel="noopener noreferrer">'+(g.schedule_only?'OFFICIAL SCHOOL SCHEDULE ↗':'NCAA SCOREBOARD SOURCE ↗')+'</a>':'Source link unavailable';
const emblem=t=>{
 const title=t.d3_confirmed?'DIII program confirmed in NCAA scoreboard record':'Division membership unconfirmed';
 const slug=String(t.slug||'').replace(/[^a-z0-9-]/g,'');
 const primary=/^#[0-9a-f]{6}$/i.test(t.primary||'')?t.primary:'';
 const secondary=/^#[0-9a-f]{6}$/i.test(t.secondary||'')?t.secondary:'';
 const verified=!!(primary&&secondary&&primary!==secondary&&t.color_source);
 const initials=String(t.name||'?').replace(/\b(university|college|the|of|at)\b/gi,'').trim().split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase();
 const imgSrc=slug?'https://ncaa-api.henrygd.me/logo/'+encodeURIComponent(slug)+'.svg':/^https:\/\/a\.espncdn\.com\/i\/teamlogos\//.test(t.logo_url||'')?t.logo_url:'';
 return '<span class="logo-shell '+(verified?'branded':'unbranded')+'" title="'+esc(title)+'" '+(verified?'style="--c1:'+primary+';--c2:'+secondary+'"':'')+'>'+
   (imgSrc?'<img loading="lazy" alt="" src="'+esc(imgSrc)+'" onerror="this.remove()">':'')+
   '<small class="logo-initials">'+esc(initials)+'</small></span>';
};
const team=id=>state.teams.get(id)||{id,name:id};
const row=(t,i)=>'<div class="board-row"><span>'+esc(i==null?'':i+1)+'</span>'+emblem(t)+'<a class="school-link" href="'+teamLink(t)+'">'+esc(t.name)+'</a><span>'+esc(t.w||0)+'–'+esc(t.l||0)+'</span><span>'+pct(t)+'%</span><span class="elo">'+Math.round(t.elo||1500)+'</span></div>';
function card(g){
 const a=team(g.away),h=team(g.home),final=g.status==='final',live=g.status==='live';
 const showScore=final||live,winA=final&&g.away_score>g.home_score,winH=final&&g.home_score>g.away_score;
 const time=final?'FINAL':live?'LIVE · SOURCE SNAPSHOT':g.start_time||'TIPOFF UNCONFIRMED';
 const p=typeof g.pred_home_pct==='number'&&g.elo_eligible?'<p class="muted">Pregame home win chance: '+esc(g.pred_home_pct)+'% · provisional DIII Elo</p>':'';
 return '<article class="game-card"><div class="game-head"><span>'+esc(g.date)+' · '+esc(time)+(g.neutral?' · NEUTRAL SITE':'')+'</span><span>'+esc(g.network||'')+'</span></div>'+
 '<div class="game-row '+(winA?'winner':'')+'">'+emblem(a)+'<a class="school-link" href="'+teamLink(a)+'">'+esc(a.name)+'</a><b>'+(showScore?esc(g.away_score??'—'):'')+'</b></div>'+
 '<div class="game-row '+(winH?'winner':'')+'">'+emblem(h)+'<a class="school-link" href="'+teamLink(h)+'">'+esc(h.name)+'</a><b>'+(showScore?esc(g.home_score??'—'):'')+'</b></div>'+p+
 '<div class="game-footer">'+(g.schedule_only?(g.source_verification==='reciprocal'?'RECIPROCALLY VERIFIED UNIVERSITY FIXTURE':'SCHOOL-PUBLISHED UNIVERSITY FIXTURE')+' · NO GAME RESULT YET':g.elo_eligible?'NCAA-VERIFIED DIII RESULT':'OPPONENT ELIGIBILITY NOT VERIFIED · EXCLUDED FROM ELO')+' · '+source(g)+(g.tipoff_as_posted?' · Posted time: '+esc(g.tipoff_as_posted)+' (time zone not verified)':'')+(g.venue?' · '+esc(g.venue):'')+'</div></article>';
}
function renderTeam(d){
 const id=new URLSearchParams(location.search).get('team'),t=team(id),host=$('team-detail');
 if(!state.teams.has(id)){host.innerHTML='<p class="note">School not found in the published DIII source ledger.</p>';return;}
 const games=d.games.filter(g=>g.away===id||g.home===id).sort((a,b)=>a.date.localeCompare(b.date));
 host.innerHTML='<div class="back"><a href="'+own+'">← BACK TO THE '+esc(gender.toUpperCase())+' DIII PAPER</a></div>'+
 '<div class="team-hero">'+emblem(t)+'<div><span class="eyebrow">DIVISION III · '+esc(gender.toUpperCase())+' · SCHOOL DESK</span><h1>'+esc(t.name)+'</h1>'+
 '<p>'+esc(t.conference||'Conference not verified')+' · '+esc(t.state||'State not verified')+'</p>'+
 (t.athletics_site&&/^https:\/\//.test(t.athletics_site)?'<p><a href="'+esc(t.athletics_site)+'" rel="noopener noreferrer" target="_blank">OFFICIAL ATHLETICS ↗</a></p>':'')+'</div></div>'+
 '<div class="team-stats"><div class="team-stat"><strong>'+esc(t.w||0)+'–'+esc(t.l||0)+'</strong><span>RATED DIII RECORD</span></div>'+
 '<div class="team-stat"><strong>'+Math.round(t.elo||1500)+'</strong><span>2026–27 ELO</span></div>'+
 '<div class="team-stat"><strong>'+games.length+'</strong><span>PUBLISHED GAME ENTRIES</span></div></div>'+
 (!t.d3_confirmed?'<p class="note">The published source has not explicitly confirmed DIII division membership for this school. Its games do not count toward independent Elo.</p>':'')+
 '<section class="panel"><div class="section-head"><h2>THE SCHOOL GAMEFILE</h2><span>AWAY FIRST · HOME SECOND</span></div>'+
 (games.length?games.map(card).join(''):'<p class="note">No school fixtures found in the published NCAA source window. This is not a certified full-season calendar.</p>')+
 '</section>';
}
function renderHome(d){
 const teams=d.teams.slice().sort((a,b)=>a.name.localeCompare(b.name)),games=d.games.slice();
 const finals=games.filter(g=>g.status==='final'&&g.elo_eligible);
 $('teams-covered').textContent=teams.length;$('finals-covered').textContent=finals.length;
 $('directory-count').textContent=String(d.coverage.official_directory_count??teams.length)+' NCAA-listed 2026–27 programs · '+(d.coverage.ncaa_projected_programs??'—')+' projected';
 $('elo-note').textContent='All schools start at 1500 each season; K='+d.model.k+', home edge='+d.model.home_elo_edge+
 ' points. Parameters are provisional, not historically calibrated. Cross-division games and unverified results are excluded.';
 const ranked=teams.filter(t=>t.d3_confirmed&&t.games_rated>0).sort((a,b)=>b.elo-a.elo||a.name.localeCompare(b.name));
 $('elo-board').innerHTML=ranked.length?'<div class="board-row board-header"><span>#</span><span></span><span>PROGRAM</span><span>W–L</span><span>PCT</span><span>ELO</span></div>'+ranked.slice(0,35).map((t,i)=>row(t,i)).join(''):'<p class="note">No eligible finals are published yet. Rankings will begin only after confirmed DIII results.</p>';
 const dates=[...new Set(games.map(g=>g.date))].sort(),parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value])),today=parts.year+'-'+parts.month+'-'+parts.day;
 const input=$('game-date');input.value=dates.find(x=>x>=today)||dates.at(-1)||today;
 function draw(){const selected=games.filter(g=>g.date===input.value);
 $('game-grid').innerHTML=selected.length?selected.map(card).join(''):'<p class="note">No NCAA-scoreboard or verified university-calendar games available for this date.</p>';
 const i=dates.indexOf(input.value);$('game-pos').textContent=i<0?'SELECT DATE':(i+1)+' / '+dates.length;
 $('prev-date').disabled=i<=0;$('next-date').disabled=i<0||i>=dates.length-1;}
 input.addEventListener('change',draw);draw();
 for(const [id,n] of [['prev-date',-1],['next-date',1]])$(id).addEventListener('click',()=>{const i=dates.indexOf(input.value)+n;if(i>=0&&i<dates.length){input.value=dates[i];draw();}});
 const dir=q=>{$('team-directory').innerHTML=teams.filter(t=>(t.name+' '+t.conference).toLowerCase().includes(q)).map(t=>row(t,null)).join('')||'<p class="note">No matching programs found in the published source window.</p>';};
 $('team-search').addEventListener('input',e=>dir(e.target.value.trim().toLowerCase()));dir('');
 const confs=[...new Set(teams.map(t=>t.conference).filter(Boolean))].sort(),sel=$('conference-select');
 sel.innerHTML='<option value="">Select a source-labeled conference</option>'+confs.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('');
 function conf(){const a=teams.filter(t=>t.conference===sel.value).sort((a,b)=>pct(b)-pct(a)||b.elo-a.elo);
 $('conference-board').innerHTML=a.length?'<p class="muted">Overall rated-game records; NOT official conference standings or tiebreakers.</p>'+a.map((t,i)=>row(t,i)).join(''):'<p class="note">Conference standings pending verified membership and league-only game reconciliation.</p>';}
 sel.addEventListener('change',conf);conf();
 $('coverage').innerHTML='<b>'+games.length+'</b> published games, <b>'+d.coverage.eligible_finals+'</b> Elo-eligible finals, and <b>'+d.coverage.scanned_days+'</b> recently checked NCAA dates.<br>'+
 '<b>'+esc(d.coverage.official_directory_count??0)+'</b> schools recorded in the NCAA’s official 2026–27 sport-sponsor directory. The July projection was <b>'+esc(d.coverage.ncaa_projected_programs??'—')+'</b>; difference <b>'+esc(d.coverage.official_vs_projection_gap??'—')+'</b> remains to reconcile.<br>'+
 '<b>'+d.coverage.failed_days.length+'</b> checked dates failed their primary and fallback reads; prior published games were retained.<br>'+
 '<b>University schedules:</b> '+esc(d.coverage.school_calendars_verified??0)+' official calendars parsed; '+esc(d.coverage.official_fixture_count??0)+' additional fixtures; '+esc(d.coverage.official_fixture_overlaps??0)+' corroborated scoreboard entries; '+esc(d.coverage.reciprocal_fixtures??0)+' cross-school corroborations; '+esc(d.coverage.source_conflicts??0)+' conflicting source matches quarantined.<br>'+
 '<b>Program directory:</b> '+esc(d.coverage.directory_status||'Published NCAA-scoreboard identities only')+'<br>Calendar coverage remains a limited pilot; full school schedules, official conference standings, venue details, player statistics and historical K/home-edge calibration are <b>not yet certified</b>.';
}
async function start(){
 try{
  const r=await fetch('data/d3-'+gender+'-2026-27.json?v='+Date.now(),{cache:'no-store'});
  if(!r.ok)throw Error('DIII game publisher has not delivered a dataset.');
  const d=await r.json();
  if(d.gender!==gender||d.division!=='d3'||d.season!=='2026-27'||d.starting_elo!==1500||!Array.isArray(d.games)||!Array.isArray(d.teams))
    throw Error('Wrong division, gender, or Elo dataset refused.');
  let fixtureData=null;
  try{
    const scheduled=await fetch('data/d3-'+gender+'-official-fixtures-2026-27.json?v='+Date.now(),{cache:'no-store'});
    if(scheduled.ok)fixtureData=await scheduled.json();
    if(fixtureData && (fixtureData.division!=='d3'||fixtureData.gender!==gender||fixtureData.season!=='2026-27'||!Array.isArray(fixtureData.fixtures)))
      throw Error('Rejected wrong-division official fixtures');
  }catch(e){fixtureData=null;}
  const orgIds=new Map(d.teams.filter(t=>t.d3_confirmed&&t.membership_year===2027&&Number.isInteger(t.ncaa_org_id))
    .map(t=>[t.ncaa_org_id,t]));
  const merged=new Map(d.games.map(g=>[g.date+'|'+[g.away,g.home].sort().join('|'),{...g}]));
  let added=0,enhanced=0;
  if(fixtureData)for(const f of fixtureData.fixtures){
    const away=orgIds.get(f.away_org_id),home=orgIds.get(f.home_org_id);
    if(!away||!home||away.id===home.id||!/^202[67]-\d{2}-\d{2}$/.test(f.date))continue;
    const k=f.date+'|'+[away.id,home.id].sort().join('|');
    const prior=merged.get(k);
    if(prior){
      if(!prior.venue&&f.venue)prior.venue=f.venue;
      if(!prior.tipoff_as_posted&&f.tipoff_as_posted)prior.tipoff_as_posted=f.tipoff_as_posted;
      prior.official_schedule_sources=f.official_schedule_sources;enhanced++;
    }else{
      merged.set(k,{...f,away:away.id,home:home.id,status:'scheduled',elo_eligible:false,
        start_time:'',schedule_only:true});added++;
    }
  }
  d.games=[...merged.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  d.coverage.official_fixture_count=added;
  d.coverage.official_fixture_overlaps=enhanced;
  d.coverage.school_calendars_verified=fixtureData?.verified_source_calendars??0;
  d.coverage.reciprocal_fixtures=fixtureData?.reciprocal_fixtures??0;
  d.coverage.source_conflicts=fixtureData?.conflicts?.length??0;
  const version=d.as_of+'|'+(fixtureData?.generated_utc||'');
  if(state.version===version)return;
  state.version=version;
  state.data=d;state.teams=new Map(d.teams.map(t=>[t.id,t]));
  for(const id of ['game-date','prev-date','next-date','team-search','conference-select']){const node=$(id);if(node)node.replaceWith(node.cloneNode(true));}
  $('status').textContent='NCAA DIII game-source edition · '+(d.as_of?new Date(d.as_of).toLocaleString():'Source refresh pending');
  if(new URLSearchParams(location.search).has('team')){
   $('home-content').hidden=true;$('team-detail').hidden=false;renderTeam(d);
  }else renderHome(d);
 }catch(e){
  $('status').textContent='DIII verified feed unavailable; no fabricated statistics shown.';
  $('home-content').innerHTML='<div class="note">'+esc(e.message)+'</div>';
 }
}
start();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)start();});
setInterval(()=>{if(!document.hidden)start();},60000);
})();