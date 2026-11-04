(()=>{'use strict';
const $=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const gender=document.body.dataset.gender,own=gender==='women'?'d3-womens-basketball.html':'d3-mens-basketball.html';
const state={data:null,teams:new Map(),fixtureData:null,fixtureFetchedAt:0,logoOverlay:null,logoFetchedAt:0,logoRequest:null},pct=t=>(t.w||0)+(t.l||0)?Math.round(1000*t.w/(t.w+t.l))/10:0;
const teamLink=t=>own+'?team='+encodeURIComponent(t.id);
const source=g=>/^https:\/\//.test(g.source_url||'')?'<a href="'+esc(g.source_url)+'" target="_blank" rel="noopener noreferrer">'+(g.schedule_only?(g.source_kind==='official_conference'?'OFFICIAL CONFERENCE SCHEDULE ↗':g.source_kind==='official_conference_and_school'?'UNIVERSITY / CONFERENCE SOURCE ↗':'OFFICIAL UNIVERSITY SCHEDULE ↗'):'NCAA SCOREBOARD SOURCE ↗')+'</a>':'Source link unavailable';
// Reuse the verified NCAA schools index, keyed by the NCAA organization ID.
// Never derive a logo slug from a school name or substitute another team's mark.
async function loadLogoOverlay(){
 if(state.logoOverlay&&Date.now()-state.logoFetchedAt<15*60000)return state.logoOverlay;
 if(state.logoRequest)return state.logoRequest;
 state.logoRequest=(async()=>{
  try{
   const response=await fetch('data/d3-verified-logo-slugs-2026-27.json?v=20261104-slugs1',
    {cache:'no-store'});
   if(!response.ok)throw Error('NCAA logo registry unavailable');
   const source=await response.json();
   if(source.matching!=='exact_normalized_school_name_only'||!source.schools||
      typeof source.schools!=='object')throw Error('Logo identity registry not certified');
   const approved=new Map();
   for(const [id,record] of Object.entries(source.schools)){
    if(!/^\d+$/.test(id)||record?.match!=='exact_normalized_name'||
      record?.source!==source.source||source.source!=='https://www.ncaa.com/json/schools'||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record?.slug||''))continue;
    approved.set(id,record.slug);
   }
   if(approved.size!==source.verified_logo_slugs||approved.size<250)
    throw Error('Logo mapping count mismatch');
   state.logoOverlay=approved;state.logoFetchedAt=Date.now();
  }catch(err){
   // Keep previously confirmed logo IDs through a temporary source outage.
   state.logoFetchedAt=Date.now();
  }finally{state.logoRequest=null;}
  return state.logoOverlay;
 })();
 return state.logoRequest;
}
function mergeVerifiedLogos(teams,approved){
 let recovered=0;
 for(const school of teams){
  const org=school?.ncaa_org_id;
  const official=Number.isInteger(org)?approved?.get(String(org)):null;
  if(!official||(school.slug&&school.slug!==official))continue;
  school.slug=official;
  school.logo_source='NCAA school index · verified organization ID';
  recovered++;
 }
 return recovered;
}
const emblem=t=>{
 const title=t.d3_confirmed?'Official NCAA 2026–27 Division III sport sponsor':'Division membership unconfirmed';
 const slug=String(t.slug||'').replace(/[^a-z0-9-]/g,'');
 const primary=/^#[0-9a-f]{6}$/i.test(t.primary||'')?t.primary:'';
 const secondary=/^#[0-9a-f]{6}$/i.test(t.secondary||'')?t.secondary:'';
 const verified=!!(primary&&secondary&&primary!==secondary&&t.color_source);
 const initials=String(t.name||'?').replace(/\b(university|college|the|of|at)\b/gi,'').trim().split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase();
 const ncaaURL=slug?'https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/'+encodeURIComponent(slug)+'.svg':'';
 const safeCDN=/^https:\/\/a\.espncdn\.com\/i\/teamlogos\//.test(t.logo_url||'')?t.logo_url:'';
 const imgSrc=ncaaURL||safeCDN;
 const fallback=slug?'https://ncaa-api.henrygd.me/logo/'+encodeURIComponent(slug)+'.svg':'';

 return '<span class="logo-shell '+(verified?'branded':'unbranded')+'" title="'+esc(title)+'" '+(verified?'style="--c1:'+primary+';--c2:'+secondary+'"':'')+'>'+
   (imgSrc?'<img loading="lazy" alt="" src="'+esc(imgSrc)+'" '+
  (fallback?'data-logo-fallback="'+esc(fallback)+'" ':'')+
  'onerror="if(this.dataset.logoFallback){this.src=this.dataset.logoFallback;delete this.dataset.logoFallback}else this.remove()">':'')+
 '<small class="logo-initials">'+esc(initials)+'</small></span>';
};
const team=id=>state.teams.get(id)||{id,name:id};
const row=(t,i)=>'<div class="board-row"><span>'+esc(i==null?'':i+1)+'</span>'+emblem(t)+'<a class="school-link" href="'+teamLink(t)+'">'+esc(t.name)+'</a><span>'+esc(t.w||0)+'–'+esc(t.l||0)+'</span><span>'+pct(t)+'%</span><span class="elo">'+Math.round(t.elo||1500)+'</span></div>';
function card(g){
 const unresolved=Boolean(g.home_away_unresolved);
 const a=g.away_external_label?{name:g.away_external_label}:team(g.away);
 const h=g.home_external_label?{name:g.home_external_label}:team(g.home);
 const final=!unresolved&&g.status==='final',live=!unresolved&&g.status==='live';
 const mode=final?'final':live?'live':'upcoming',scoreShown=final||live;
 const line=(t,points)=>({name:t.name||'Unverified opponent',score:scoreShown?points:null,
  crest:emblem(t),color:/^#[0-9a-f]{6}$/i.test(t.primary||'')?t.primary:'#655239',
  record:(t.w||0)+'–'+(t.l||0),
  retro:t.d3_confirmed&&Number.isFinite(Number(t.elo))?'RETRO '+Math.round(Number(t.elo)):'RETRO —'});
 const scorebug=window.SLTSportsScorebug?.render({
  phase:mode,status:live?'LIVE · SOURCE SNAPSHOT':'',
  ariaLabel:unresolved?'Teams listed alphabetically; home and away unverified':
   (a.name||'Away')+' at '+(h.name||'Home')+' scoreboard',
  away:line(a,g.away_score),home:line(h,g.home_score)
 })||'<p class="note">Scorebug unavailable.</p>';
 const unresolvedNote=unresolved?
  '<p class="ledger26-detail-note"><strong>HOME / AWAY AND SITE DISPUTED.</strong> Teams listed alphabetically, not as verified away/home; no score or Elo is inferred.</p>':'';
 const eligibility=g.schedule_only?'No final result reported':
  g.elo_eligible?'NCAA-verified DIII result':'Opponent eligibility unverified; excluded from Elo';
 const citations=(g.conflict_sources||[]).filter(v=>/^https:\/\//.test(v)).map((v,i)=>
  '<a href="'+esc(v)+'" target="_blank" rel="noopener noreferrer">OFFICIAL SOURCE '+(i+1)+' ↗</a>').join(' · ');
 const links=(g.away_external_label?'':'<a href="'+teamLink(a)+'">'+esc(a.name)+'</a>')+
  (g.home_external_label?'':' · <a href="'+teamLink(h)+'">'+esc(h.name)+'</a>');
 return '<article class="game-card ledger26-card'+(unresolved?' d3-site-dispute':'')+'">'+
  '<div class="ledger26-meta"><span>'+esc(g.venue||(unresolved?'SITE UNVERIFIED':'Arena not verified'))+
  '</span><span>'+esc(g.network||'Broadcast unconfirmed')+'</span></div>'+
  '<details class="ledger26-expand"><summary class="ledger26-summary">'+scorebug+
  '<span class="ledger26-instruction">OPEN GAME DETAILS +</span></summary>'+
  '<div class="ledger26-expanded">'+unresolvedNote+
  '<p class="ledger26-detail-note">'+esc(g.date+' · '+(g.start_time||g.tipoff_as_posted||'Time not verified')+
   (g.neutral?' · NEUTRAL SITE':''))+'</p>'+
  '<p class="ledger26-detail-note">'+esc(eligibility)+'</p>'+
  (g.venue_location?'<p class="ledger26-detail-note">Location: '+esc(g.venue_location)+'</p>':'')+
  '<p>'+links+'</p><p>'+source(g)+(citations?' · '+citations:'')+'</p>'+
  '</div></details></article>';
}
function renderTeam(d){
 const id=new URLSearchParams(location.search).get('team'),t=team(id),host=$('team-detail');
 if(!state.teams.has(id)){host.innerHTML='<p class="note">School not found in the published DIII source ledger.</p>';return;}
 const games=d.games.filter(g=>g.away===id||g.home===id).sort((a,b)=>a.date.localeCompare(b.date));
 const audit=state.fixtureData?.source_audit?.find(a=>a.owner_org_id===t.ncaa_org_id);
 const calendarStatus=audit?.status==='parsed'?'OFFICIAL 2026–27 SCHOOL CALENDAR VERIFIED':audit?.status==='parsed_conference'?'OFFICIAL 2026–27 CONFERENCE CALENDAR VERIFIED · SCHOOL SITE UNAVAILABLE':games.length?'SCHEDULE ENTRIES FROM OTHER OFFICIAL PROGRAMS':'SCHOOL CALENDAR NOT YET VERIFIED';
 host.innerHTML='<div class="back"><a href="'+own+'">← BACK TO THE '+esc(gender.toUpperCase())+' DIII PAPER</a></div>'+
 '<div class="team-hero">'+emblem(t)+'<div><span class="eyebrow">DIVISION III · '+esc(gender.toUpperCase())+' · SCHOOL DESK</span><h1>'+esc(t.name)+'</h1>'+
 '<p>'+esc(t.conference||'Conference not verified')+' · '+esc(t.state||'State not verified')+'</p>'+
 (t.athletics_site&&/^https:\/\//.test(t.athletics_site)?'<p><a href="'+esc(t.athletics_site)+'" rel="noopener noreferrer" target="_blank">OFFICIAL ATHLETICS ↗</a></p>':'')+'</div></div>'+
 '<p class="d3-calendar-status">'+esc(calendarStatus)+(audit?.status==='parsed'?' · '+esc(audit.verified_member_opponents)+' NCAA-MATCHED OPPONENTS':'')+'</p>'+
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
 '<b>Other official school games:</b> '+esc(d.coverage.unresolved_opponent_fixture_count??0)+' published with their posted opponent labels, but without confirmed DIII opponent identity; entirely excluded from Elo.<br>'+
 '<b>University schedule crawl:</b> '+esc(d.coverage.school_calendars_checked??0)+' NCAA programs audited, '+esc(d.coverage.school_calendars_verified??0)+' school calendars verified, '+esc(d.coverage.official_conference_calendar_fallbacks??0)+' additional official conference calendars, '+esc(d.coverage.school_calendars_missing??0)+' school sites not independently verified, including '+esc(d.coverage.school_calendars_unresolved??0)+' unresolved source checks; '+esc(d.coverage.official_fixture_count??0)+' additional fixtures; '+esc(d.coverage.official_fixture_overlaps??0)+' corroborated scoreboard entries; '+esc(d.coverage.reciprocal_fixtures??0)+' cross-school corroborations; '+esc(d.coverage.source_conflicts??0)+' official source site disagreements (including <b>'+esc(d.coverage.disputed_matchups_displayed??0)+'</b> matchup-only cards; no home/away assigned).<br>'+
 '<b>Program directory:</b> '+esc(d.coverage.directory_status||'Published NCAA-scoreboard identities only')+'<br>Calendar availability is tracked school by school; no readable page does not mean no games. Complete calendars, official conference standings, player statistics and historical Elo calibration remain <b>outstanding</b>.';
}
async function start(){
 try{
  const r=await fetch('data/d3-'+gender+'-2026-27.json?v='+Date.now(),{cache:'no-store'});
  if(!r.ok)throw Error('DIII game publisher has not delivered a dataset.');
  const d=await r.json();
  if(d.gender!==gender||d.division!=='d3'||d.season!=='2026-27'||d.starting_elo!==1500||!Array.isArray(d.games)||!Array.isArray(d.teams))
    throw Error('Wrong division, gender, or Elo dataset refused.');
  const logoCrosswalk=await loadLogoOverlay();
  const verifiedLogoCount=mergeVerifiedLogos(d.teams,logoCrosswalk);
  let fixtureData=state.fixtureData;
  // Revalidate full national schedule ledger every 15 minutes, not every minute.
  if(!state.fixtureFetchedAt||Date.now()-state.fixtureFetchedAt>15*60*1000){
    state.fixtureFetchedAt=Date.now();
    try{
      const scheduled=await fetch('data/d3-'+gender+'-official-fixtures-2026-27.json',{cache:'no-cache'});
      if(scheduled.ok){
        const candidate=await scheduled.json();
        if(candidate.division==='d3'&&candidate.gender===gender&&candidate.season==='2026-27'&&Array.isArray(candidate.fixtures)){
          state.fixtureData=candidate;fixtureData=candidate;
        }
      }
    }catch(e){/* Preserve last verified university fixture snapshot. */}
  }
  // NCAA school-name crosswalk: only exact official matches are displayed.
  // Color rings remain unbranded until school palettes are sourced.
  try{
    const logos=await fetch('data/d3-verified-logo-slugs-2026-27.json',{cache:'no-cache'});
    if(logos.ok){
      const manifest=await logos.json();
      if(manifest.matching==='exact_normalized_school_name_only'){
        for(const t of d.teams){
          const match=manifest.schools?.[String(t.ncaa_org_id)];
          if(match?.slug&&/^[a-z0-9-]+$/.test(match.slug)&&match.match==='exact_normalized_name')
            t.slug=match.slug;
        }
      }
    }
  }catch(e){/* Keep explicit logo fallbacks on network failure. */}
  const orgIds=new Map(d.teams.filter(t=>t.d3_confirmed&&t.membership_year===2027&&Number.isInteger(t.ncaa_org_id))
    .map(t=>[t.ncaa_org_id,t]));
  const merged=new Map(d.games.map(g=>[g.date+'|'+[g.away,g.home].sort().join('|'),{...g}]));
  let added=0,enhanced=0,disputed=0;
  // A source-ledger publishing race can repeat a deterministic fixture ID.
  // Collapse duplicates before merging into the game desk. Keep all sources
  // and prefer the record with a verified venue and tipoff when available.
  const distinctFixtures=new Map();
  for(const f of fixtureData?.fixtures||[]){
    if(!f||!f.id)continue;
    const old=distinctFixtures.get(f.id);
    if(!old){distinctFixtures.set(f.id,{...f});continue;}
    const sources=[...new Set([...(old.official_schedule_sources||[]),...(f.official_schedule_sources||[])])];
    const better=(Number(!!f.venue)+Number(!!f.tipoff_as_posted))>
      (Number(!!old.venue)+Number(!!old.tipoff_as_posted))?f:old;
    distinctFixtures.set(f.id,{...better,official_schedule_sources:sources});
  }
  if(fixtureData)for(const f of distinctFixtures.values()){
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
  // Official school schedules also contain legitimate opponents outside
  // the NCAA DIII membership crosswalk. Show them without a fake team ID,
  // score, predicted winner, or Elo eligibility.
  let unresolvedOpponentGames=0;
  for(const f of fixtureData?.unresolved_opponent_fixtures||[]){
    const school=orgIds.get(f.source_owner_org_id),other=String(f.external_opponent_label||'').trim();
    if(!school||!other||!/^202[67]-\d{2}-\d{2}$/.test(f.date)||
      !['away','home','neutral'].includes(f.placement)||!/^https:\/\//.test(f.source_url||''))continue;
    const fixture={...f,away:f.placement==='away'?school.id:null,home:f.placement!=='away'?school.id:null,
      away_external_label:f.placement==='away'?null:other,
      home_external_label:f.placement==='away'?other:null,
      status:'scheduled',schedule_only:true,elo_eligible:false,start_time:''};
    merged.set('unresolved|'+f.id,fixture);unresolvedOpponentGames++;
  }
  // Date/team matchup exists in two official schedules despite incompatible
  // site designations. Keep these conflicts out of the verified fixture
  // ledger and show matchup-only cards (never pretend to know away/home).
  if(fixtureData)for(const conflict of fixtureData.conflicts||[]){
    if(!Array.isArray(conflict.members)||conflict.members.length!==2||
       !Array.isArray(conflict.source_urls)||conflict.source_urls.length<2||
       !/^202[67]-\d{2}-\d{2}$/.test(conflict.date))continue;
    const participants=conflict.members.map(id=>orgIds.get(id));
    if(participants.some(t=>!t)||participants[0].id===participants[1].id)continue;
    const [first,second]=participants.sort((a,b)=>a.name.localeCompare(b.name));
    const k=conflict.date+'|'+[first.id,second.id].sort().join('|');
    if(merged.has(k))continue; // NCAA scoreboard or an official verified game wins.
    merged.set(k,{id:'d3-'+gender+'-disputed-site-'+conflict.date+'-'+
      [first.ncaa_org_id,second.ncaa_org_id].sort((a,b)=>a-b).join('-'),
      date:conflict.date,away:first.id,home:second.id,status:'scheduled',
      home_away_unresolved:true,conflict_sources:conflict.source_urls.slice(),
      schedule_only:true,elo_eligible:false,neutral:false});
    disputed++;
  }
  d.games=[...merged.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  d.coverage.unresolved_opponent_fixture_count=unresolvedOpponentGames;
  d.coverage.official_fixture_count=added;
  d.coverage.official_fixture_overlaps=enhanced;
  d.coverage.school_calendars_verified=fixtureData?.verified_source_calendars??0;
  d.coverage.official_conference_calendar_fallbacks=fixtureData?.official_conference_calendar_fallbacks??0;
  d.coverage.school_calendars_checked=fixtureData?.school_calendars_checked??0;
  d.coverage.school_calendars_missing=fixtureData?.school_calendars_missing??0;
  d.coverage.school_calendars_unresolved=fixtureData?.school_calendars_unresolved??d.coverage.school_calendars_missing;
  d.coverage.reciprocal_fixtures=fixtureData?.reciprocal_fixtures??0;
  d.coverage.source_conflicts=fixtureData?.conflicts?.length??0;
  d.coverage.disputed_matchups_displayed=disputed;
  const version=d.as_of+'|'+(fixtureData?.generated_utc||'')+'|'+verifiedLogoCount;
  if(state.version===version)return;
  state.version=version;
  state.data=d;state.teams=new Map(d.teams.map(t=>[t.id,t]));
  for(const id of ['game-date','prev-date','next-date','team-search','conference-select']){const node=$(id);if(node)node.replaceWith(node.cloneNode(true));}
  $('status').textContent='NCAA DIII game-source edition · '+(d.as_of?new Date(d.as_of).toLocaleString():'Source refresh pending')+' · '+verifiedLogoCount+' mapped school logos';
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