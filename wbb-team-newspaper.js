/* Women’s Division I shared team newspaper: one template for 363 teams. */
(async function(){
'use strict';
const id=new URLSearchParams(location.search).get('team')||new URLSearchParams(location.search).get('id');
const host=document.getElementById('desk');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const load=async p=>{const r=await fetch(p,{cache:'no-store'});if(!r.ok)throw Error(p+' HTTP '+r.status);return r.json()};
if(!id||!/^[0-9]+$/.test(id)){host.innerHTML='<div class="wbb-panel"><h2>Choose a team</h2><a href="ncaam.html?gender=women#wbb-teams">Women’s team directory →</a></div>';return}
try{
await window.MBBLogos.ready;
const [registry,master,ratings,officialTV,scoreboardTV,palette,artwork,timeConflicts,verifiedFinals,tipoffQuarantine,siteConflictAudit,verifiedNeutralEvidence,verifiedHomeEvidence,publicGames]=await Promise.all([load('data/ncaaw-2026-27-teams.json'),load('data/ncaaw-schedules-2026-27.json'),load('data/ncaaw-2026-27-retro-primary.json').catch(()=>null),load('data/ncaaw-2026-27-official-broadcast-overrides.json').catch(()=>null),load('data/ncaaw-2026-27-scoreboard-broadcast-overlays.json').catch(()=>null),load('data/dual-ring-team-palette.json').catch(()=>null),load('data/mbb-logo-registry.json').catch(()=>null),load('data/ncaaw-2026-27-cross-school-time-discrepancies-2026-10-30.json').catch(()=>null),load('data/ncaaw-2026-27-verified-games.json').catch(()=>null),load('data/ncaaw-2026-27-tipoff-quarantine.json').catch(()=>null),load('data/ncaaw-2026-27-official-site-conflicts.json').catch(()=>null),load('data/ncaaw-2026-27-verified-neutral-sites.json').catch(()=>null),load('data/ncaaw-2026-27-verified-home-courts.json').catch(()=>null),load('data/ncaaw-2026-27-games.json').catch(()=>null)]);
const teams=registry.teams||[],lookup=new Map(teams.map(t=>[String(t.team_id),t]));
const t=lookup.get(id),entry=master.teams?.[id];
if(!t||!entry)throw Error('No published women’s schedule found for team '+id);
const homeProof=window.WBBSiteIntegrity?.verifiedHomeCourts(verifiedHomeEvidence)||new Map();
const baseGames=(entry.games||[]).map(g=>window.WBBSiteIntegrity?.correctedHome(g,homeProof,id)||g);
const divisionIds=new Set(lookup.keys());
const teamLedger=(verified,scoreboard)=>window.WBBGameResults.includeCrossDivision(verified,scoreboard,id,divisionIds);
const reconciled=window.WBBGameResults.merge(baseGames,teamLedger(verifiedFinals,publicGames),id),games=reconciled.games;
const rating=ratings?.gender==='women'&&ratings?.season==='2026-27'?ratings.rankings?.find(x=>String(x.team_id)===id):null;
const sorted=games.slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
const rmap=new Map((ratings?.gender==='women'?ratings.rankings||[]:[]).map(x=>[String(x.team_id),x]));
// Share the same women-only published ratings with the canonical team scorebugs.
window.WBBRetroSnapshot=ratings?.model==='retro-clean-slate'&&ratings?.gender==='women'&&ratings?.season==='2026-27'&&ratings?.rankings?.length===363?ratings:null;
// Load the holdout-gated women-only forecast coefficients without blocking team data.
window.WBBForecastCalibration=null;
void load('data/ncaaw-score-calibration.json').then(doc=>{
  window.WBBForecastCalibration=doc;
  window.dispatchEvent(new Event('wbb-retro-forecast-ready'));
}).catch(()=>{/* Keep the provisional women-only probability when calibration is unavailable. */});
const tvmap=new Map();
for(const row of scoreboardTV?.gender==='women'&&scoreboardTV?.season==='2026-27'?(scoreboardTV.rows||[]):[]){if(row.game_id&&row.broadcast)tvmap.set(String(row.game_id),row);}
for(const row of officialTV?.gender==='women'&&officialTV?.season==='2026-27'?(officialTV.rows||[]):[]){if(row.game_id&&row.broadcast&&row.source_url)tvmap.set(String(row.game_id),row);}
const siteDisputes=window.WBBSiteIntegrity?.index(siteConflictAudit)||new Map();
const neutralProof=window.WBBSiteIntegrity?.neutrals(verifiedNeutralEvidence)||new Map();
const timeDisputes=new Map(timeConflicts?.season==='2026-27'?(timeConflicts.games||[]).map(x=>[String(x.game_id),x]):[]);
if(tipoffQuarantine?.season==='2026-27'&&tipoffQuarantine?.gender==='women'&&
   tipoffQuarantine?.status==='unresolved-source-conflicts'&&Array.isArray(tipoffQuarantine.games)){
  for(const item of tipoffQuarantine.games){
    if(/^\d+$/.test(String(item.game_id))&&Array.isArray(item.source_claims))
      timeDisputes.set(String(item.game_id),item);
  }
}
const listedTipoff=g=>{
  // ESPN uses midnight Eastern placeholders when schools have not announced a time.
  const date=new Date(g.date||'');
  if(!Number.isFinite(date.getTime()))return '';
  const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',
    hourCycle:'h23'}).format(date));
  if(!Number.isFinite(hour)||hour===0)return '';
  return date.toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'})+' ET';
};
const fmtElo=x=>x&&Number.isFinite(Number(x.elo))?Math.round(Number(x.elo)).toString():'—';
const homeEdge=Number(ratings?.parameters?.home_edge)||75;
const winChance=(ours,theirs,g)=>{if(!ours||!theirs||!Number.isFinite(Number(ours.elo))||!Number.isFinite(Number(theirs.elo)))return '—';const edge=g.site==='home'?homeEdge:g.site==='away'?-homeEdge:0;return (100/(1+Math.pow(10,-((Number(ours.elo)-Number(theirs.elo)+edge)/400)))).toFixed(0)+'%';};
const site=g=>g.site==='home'?'HOME':g.site==='away'?'AWAY':g.site==='neutral'?'NEUTRAL':'TBA';
const leagueLabel=c=>({'Big Ten Conference':'Big Ten','Big East Conference':'Big East','Big 12 Conference':'Big 12','Atlantic Coast Conference':'ACC','Southeastern Conference':'SEC','American Athletic Conference':'AAC','Mountain West Conference':'Mountain West','West Coast Conference':'WCC','Atlantic 10 Conference':'Atlantic 10','Missouri Valley Conference':'MVC','Big West Conference':'Big West','United Athletic Conference':'UAC'}[c]||String(c||'').replace(/ Conference$/,''));
const count=s=>games.filter(g=>g.site===s).length;
const color=/^[0-9a-fA-F]{6}$/.test(t.color||'')?'#'+t.color:'#7b2429';
host.style.setProperty('--accent',color);
document.title=t.team+' · Women’s Basketball | The Sporting Life & Times';
const record=rating?window.WBBGameResults.overallRecord(rating,games,id):'—';
const logo=window.MBBLogos.byESPN(id,'hero',t.team);
const easternDay=date=>date.toLocaleDateString('sv-SE',{timeZone:'America/New_York'});
const today=easternDay(new Date());
const month=new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'America/New_York'});
const formGames=(ratings?.gender==='women'?ratings.events||[]:[]).filter(g=>g.status==='final').map(g=>({...g,home_id:String(g.home_id),away_id:String(g.away_id)}));
const formNames=new Map([...rmap].map(([id,t])=>[id,t.team]));
for(const game of games){
 if(!game.crossDivision||game.exhibition||game.is_exhibition)continue;
 const result=window.WBBGameResults.scoreFor(game,id).value.match(/^[WL]\s+(\d+)\s*[–-]\s*(\d+)/);
 const date=new Date(game.date);
 if(!result||!Number.isFinite(+date))continue;
 const opponent=String(game.opponent_id||'');
 if(opponent)formNames.set(opponent,game.opponent||'Opponent');
 formGames.push({id:game.id,date:easternDay(date),home_id:id,away_id:opponent,home_score:+result[1],away_score:+result[2]});
}
const rows=sorted.map(g=>{
  const opponentId=String(g.opponent_id||'');
  const opp=lookup.get(opponentId);
  const registeredName=window.MBBLogos.schoolNameForESPN(opponentId);
  const opponentName=opp?.team||registeredName||g.opponent||'Opponent TBA';
  const badge=opponentId&&opponentName!=='Opponent TBA'
    ? window.MBBLogos.byESPN(opponentId,'schedule',opponentName) : '';
  const conferenceTag=opp&&t.conference&&opp.conference&&t.conference===opp.conference?'<span class="wbb-conference-game" title="Conference matchup">'+esc(leagueLabel(t.conference))+'</span>':'';
  const d=new Date(g.date);
   const archiveDay=Number.isFinite(d.getTime())?easternDay(d):'';
  const date=Number.isNaN(d.getTime())?esc(g.date||'TBA'):esc(d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'America/New_York'}));
  const other=rmap.get(String(g.opponent_id||''));
  const accent=window.MBBLogos.colorForESPN?.(opponentId)?.primary;
  const accentStyle=/^#[0-9a-f]{6}$/i.test(accent||'')?' style="--schedule-team-color:'+accent+'"':'';
  const form=window.SLTScheduleLights.form(formGames,[[id,t.team],[opp?.team_id,opp?.team]],archiveDay,rmap,esc,archiveDay>=today&&!g.completed&&!g.cancelled,true,formNames);
  const opponent='<div class="sched-matchup"'+accentStyle+'>'+badge+'<span class="sched-opponent"><strong class="wbb-opponent-line">'+
    (other?.rank?'<span class="wbb-opponent-rank" title="Women’s RETRO rank">#'+esc(other.rank)+'</span>':'')+
    '<span class="wbb-opponent-name">'+(opp?'<a href="ncaaw-team.html?team='+encodeURIComponent(opp.team_id)+'">'+esc(opponentName)+'</a>':esc(opponentName))+'</span>'+
    '</strong><span class="wbb-match-meta"><small class="wbb-site-label">'+esc(site(g))+'</small>'+conferenceTag+
    '<span class="wbb-win-probability">'+(g.cancelled?'Canceled':g.completed?'Final':winChance(rating,other,g))+'</span></span>'+(form?'<span class="sched-form">'+form+'</span>':'')+'</span></div>';
  const tv=tvmap.get(String(g.id)),tvName=tv?.broadcast||g.broadcast||'Network TBA',tvUrl=tv?.source_url||g.broadcast_source_url||'';
  const television=tvUrl.startsWith('https://')?'<a href="'+esc(tvUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(tvName)+' ↗</a>':esc(tvName);const neutral=window.WBBSiteIntegrity?.certifiedNeutral(g,neutralProof);
  const officialHome=window.WBBSiteIntegrity?.officialHome(g,homeProof);
  const siteClaims=officialHome?[]:window.WBBSiteIntegrity?.claims(g,siteDisputes,neutralProof)||[];
  const delta=other&&Number.isFinite(other.daily_change)?(other.daily_change>0?'+':'')+other.daily_change.toFixed(1):'—';
  const arena=g.venue||'Arena TBA';
  const city=String(g.city||g.city_state||g.official_location_as_printed||'').trim();
  const arenaSuffix=' ('+arena+')';
  const locality=city.endsWith(arenaSuffix)?city.slice(0,-arenaSuffix.length):city;
  const source=(siteClaims.find(x=>window.WBBSiteIntegrity.safeURL(x.source_url))||{}).source_url;
  const siteLabel=officialHome?
   '<small class="wbb-venue-verified">Host and venue verified by both universities · '+esc(officialHome.venue)+
   ' <a href="'+esc(officialHome.sources[0])+'" target="_blank" rel="noopener noreferrer">School source ↗</a></small>':
   neutral?
   '<small class="wbb-venue-verified">Verified neutral-site game · '+esc(neutral.verified_venue)+
   ' <a href="'+esc(neutral.source_url)+'" target="_blank" rel="noopener noreferrer">University source ↗</a></small>':
   siteClaims.length?'<small class="wbb-venue-dispute">'+
   esc(window.WBBSiteIntegrity.note(siteClaims))+
   (source?' <a href="'+esc(source)+'" target="_blank" rel="noopener noreferrer">School schedule ↗</a>':'')+
   '</small>':'';
  const location='<strong>'+esc(arena)+'</strong>'+(locality?'<span class="wbb-location-note">'+esc(locality)+'</span>':'')+siteLabel;
  const officialTip=g.official_tipoff_local||g.official_tipoff_as_printed||g.official_time_as_printed||g.official_school_time||g.official_time||g.verified_tipoff||'';
  const dispute=!g.completed?timeDisputes.get(String(g.id)):null;
  const disputed=!!dispute;
  const hasOfficial=!!officialTip&&!/TBA|TBD/i.test(officialTip);
  const tentative=(!disputed&&!hasOfficial&&!g.completed)?listedTipoff(g):'';
  const tip=g.cancelled?'Canceled':disputed?'Disputed — verify':hasOfficial?esc(officialTip):tentative?esc(tentative):'TBA';
  const disagreement=dispute?.cross_school_disagreement?
    'Universities report different tipoffs; organizer confirmation required.':
    'Official university and published calendar times differ; confirmation pending.';
  const officialSource=disputed?(dispute.source_claims||[]).find(x=>typeof x.source_url==='string'&&x.source_url.startsWith('https://'))?.source_url:'';
  const tipNote=disputed?'<small class="wbb-tipoff-dispute">'+esc(disagreement)+
    (officialSource?' <a href="'+esc(officialSource)+'" target="_blank" rel="noopener noreferrer">School source ↗</a>':'')+'</small>':
    tentative?'<small class="wbb-tipoff-tentative">Feed-listed start; unverified by school.</small>':
    '';
  const result=window.WBBGameResults.scoreFor(g,id);
  const statAvailable=g.completed&&!g.cancelled&&!g.result_conflict&&/^\d+$/.test(String(g.id));
  const state=g.cancelled?'canceled':g.result_conflict?'review':g.completed?'final':archiveDay&&archiveDay<today?'past':'upcoming';
  const press=state==='upcoming'&&g.home_id&&g.away_id
    ?'<button type="button" class="slt-team-press-btn" data-press-home="'+esc(String(g.home_id)===id?t.team:g.opponent)+'" data-press-away="'+esc(String(g.away_id)===id?t.team:g.opponent)+'">Pregame Press ›</button>':'';
  const statusLabel={canceled:'Canceled',review:'Result review',final:'Final',past:'Awaiting result',upcoming:'Upcoming'}[state];
  const court=siteClaims.length?'disputed':neutral||g.site==='neutral'?'neutral':officialHome||g.site_verified===true?'verified-home':'unverified';
  const main='<tr class="wbb-game-entry"'+accentStyle+' data-sched-team="'+esc(id)+'" data-sched-opponent="'+esc(String(opp?.team_id||''))+'" data-game-site="'+esc(neutral?'neutral':g.site||'unknown')+'" data-site="'+esc(g.site||'unknown')+'" data-exhibition="'+(g.exhibition===true||g.classification==='exhibition'?'true':'false')+'" data-team-id="'+esc(id)+'" data-opponent-id="'+esc(g.opponent_id||'')+'" data-home-id="'+esc(g.home_id||'')+'" data-away-id="'+esc(g.away_id||'')+'" data-forecast-venue="'+court+'" data-initial-state="'+state+'" data-calendar-state="'+state+'" data-opponent="'+esc((g.opponent||opp?.team||'').toLowerCase())+'" data-game-id="'+esc(g.id)+'" data-game-day="'+esc(archiveDay)+'">'+
    '<td class="sched-date-cell" data-label="Date"><span class="sched-month" hidden>'+esc(Number.isFinite(+d)?month.format(d):'')+'</span><time datetime="'+esc(archiveDay)+'">'+date+'</time><span class="sched-site-stamp">'+esc(site(g)==='TBA'?'Site TBA':site(g))+'</span><span class="sched-game-status sched-status--'+state+'">'+statusLabel+'</span></td>'+
    '<td class="sched-matchup-cell" data-label="Opponent">'+opponent+'</td>'+
    '<td class="sched-venue-cell" data-label="Arena / City">'+location+'</td>'+
    '<td class="sched-time-cell" data-label="Tipoff"'+(hasOfficial&&!disputed?' title="University-sourced listing"':'')+'><span class="sched-tip-value">'+tip+'</span>'+tipNote+'</td>'+
    '<td class="sched-network-cell wbb-broadcast" data-label="TV / Stream">'+television+'</td>'+
    '<td class="sched-elo-cell wbb-opp-elo" data-label="Opp. RETRO"><span class="wbb-opp-elo-value">'+fmtElo(other)+'</span><small class="wbb-opp-change" title="Opponent daily RETRO change">'+delta+'</small></td>'+
    '<td class="sched-result-cell wbb-result-cell" data-label="Result" title="'+esc(result.detail)+'"><strong class="'+(result.value.startsWith('W ')?'wbb-result-win':result.value.startsWith('L ')?'wbb-result-loss':'')+'">'+esc(result.value)+'</strong><small class="wbb-result-source">'+esc(result.detail)+'</small>'+(press?'<div class="wbb-schedule-projection"></div>':'')+'<div class="wbb-result-actions">'+press+(statAvailable?'<a class="mbb-schedule-gamefile" href="'+esc('ncaam-slate.html?gender=women&date='+encodeURIComponent(archiveDay)+'&game='+encodeURIComponent(g.id))+'">Ledger ↗</a>':'')+
    (statAvailable?'<button type="button" class="victorian-stat-toggle wbb-stat-toggle" data-event="'+esc(g.id)+'" aria-expanded="false" aria-controls="wbb-detail-'+esc(g.id)+'">Game Stats ▾</button>':'')+'</div>'+window.SLTScheduleLights.corner(formGames,id,opp?.team_id,archiveDay,true,esc)+'</td></tr>';
  return main+(statAvailable?'<tr class="victorian-stat-detail wbb-game-detail" id="wbb-detail-'+esc(g.id)+'" hidden><td colspan="7"><div class="wbb-game-stats">Open to view verified game statistics.</div></td></tr>':'');
}).join('');
host.innerHTML='<section class="wbb-mast"><div class="wbb-identity">'+logo+'<div><div class="eyebrow"><a href="ncaam.html?gender=women">Women’s Division I</a> / '+'<a href="ncaaw-conference.html?conference='+encodeURIComponent(t.conference||'')+'">'+esc(t.conference||'Team Desk')+'</a></div><h1>'+(rating?.rank?'<span class="wbb-rank-tag">RETRO #'+esc(rating.rank)+'</span>':'')+esc(t.team)+'</h1><p>'+esc(t.conference||'Conference unverified')+' · 2026–2027 Season</p></div></div>'+
'<nav class="wbb-nav" aria-label="Team page sections"><a href="ncaaw-conference.html?conference='+encodeURIComponent(t.conference||'')+'">Conference</a><a href="#full-season-schedule">Schedule</a><a href="#wbb-stats">Team & Player Stats</a><a href="#roster">Roster</a><a href="ncaaw-rankings.html?poll=retro">Women’s Rankings</a><a href="ncaam.html?gender=women#wbb-teams">All 363 Teams</a></nav></section>'+
'<section class="wbb-kpis"><div class="wbb-kpi"><small>RETRO Elo</small><strong id="wbb-team-elo">'+esc(rating&&Number.isFinite(Number(rating.elo))?Number(rating.elo).toFixed(0):'—')+'</strong></div>'+
'<div class="wbb-kpi"><small>Overall</small><strong id="wbb-team-record">'+esc(record)+'</strong></div>'+
'<div class="wbb-kpi"><small>Conference Record</small><strong>'+esc((rating?.conference_wins||0)+'–'+(rating?.conference_losses||0))+'</strong></div>'+
'<div class="wbb-kpi"><small>Scheduled Games</small><strong>'+games.length+'</strong></div></section>'+
'<section class="panel victorian-team-calendar" id="full-season-schedule"><div id="schedule" class="panel-head"><h2>2026–2027 Schedule</h2></div>'+
'<div class="calendar-controls"><label>Opponent<input class="input" id="wbb-calendar-search" type="search" placeholder="Search opponents…" autocomplete="off"></label>'+
'<label>Show<select id="wbb-calendar-view"><option value="all">All games</option><option value="upcoming">Upcoming</option><option value="final">Finals</option></select></label>'+
'<span class="note" id="wbb-calendar-count" aria-live="polite"></span></div>'+
'<p class="wbb-result-refresh" id="wbb-result-refresh" role="status">'+reconciled.matched+' published finals matched'+(reconciled.conflicts.length?' · '+reconciled.conflicts.length+' identity conflicts withheld':'')+'</p>'+
'<div class="table-wrap"><table class="mbb-schedule-table" aria-label="'+esc(t.team)+' 2026–2027 game schedule"><thead><tr><th>Date</th><th>Opponent</th><th>Arena / City</th><th>Tipoff</th><th>TV / Stream</th><th>Opp. RETRO</th><th>Result</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
'<p class="wbb-muted">Times and venues show the published school evidence where verified. Conflicting reports remain labeled for review; no unverified result enters RETRO.</p></section>'+
'<div class="wbb-secondary"><section class="wbb-panel" id="wbb-reporting"><div class="eyebrow">The National Conversation</div><h2>Latest Women’s Basketball Reporting</h2><div id="wbb-team-news">Checking the women’s national newswire…</div></section>'+
'<section class="wbb-panel" id="wbb-march-file"><div class="eyebrow">The Selection Ledger</div><h2>The March File</h2><div class="wbb-march-register"><div><small>Women’s RETRO</small><strong>'+(rating?.rank?'#'+esc(rating.rank):'—')+'</strong></div><div><small>Season Record</small><strong>'+esc(record)+'</strong></div><div><small>Conference</small><strong>'+esc((rating?.conference_wins||0)+'–'+(rating?.conference_losses||0))+'</strong></div><div><small>Change from 1500</small><strong>'+(rating&&Number.isFinite(Number(rating.elo))?esc(((Number(rating.elo)-1500)>=0?'+':'')+(Number(rating.elo)-1500).toFixed(1)):'—')+'</strong></div></div>'+
'<p class="wbb-muted">The women’s RETRO résumé uses women-only verified finals. NCAA NET and tournament quadrant records are not inferred from Elo. <a href="ncaaw-rankings.html?poll=retro">National RETRO register →</a></p><h3>Recent Verified Results</h3><div id="wbb-recent-finals"></div></section>'+
'<section class="wbb-panel" id="wbb-stats"><div class="eyebrow">The Statistical Notebook · 2026–27</div><h2>Team Statistics</h2><div id="wbb-team-stats">Checking verified women’s statistics…</div></section>'+
'<section class="wbb-panel wbb-roster-full" id="roster"><div class="eyebrow">The Team Register · 2026–27</div><h2>Team Roster & Player Production</h2><div id="wbb-roster-host"><p class="wbb-muted">Loading women’s roster…</p></div></section></div>';
const filterSchedule=()=>{
 const input=host.querySelector('#wbb-calendar-search'),sel=host.querySelector('#wbb-calendar-view'),counter=host.querySelector('#wbb-calendar-count');
 if(!input||!sel)return;
 let shown=0,lastMonth='';
 for(const row of host.querySelectorAll('tr.wbb-game-entry')){
   const matchesName=row.dataset.opponent?.includes(input.value.trim().toLowerCase());
   const matchesStatus=sel.value==='all'||row.dataset.calendarState===sel.value;
   row.hidden=!(matchesName&&matchesStatus);
   const detail=row.nextElementSibling;
   if(detail?.classList.contains('wbb-game-detail')&&row.hidden)detail.hidden=true;
   const shadow=detail?.classList.contains('wbb-game-detail')?detail.nextElementSibling:detail;
   if(shadow?.classList.contains('cbb-season-shadow-row'))shadow.hidden=row.hidden;
   if(!row.hidden){shown++;const heading=row.querySelector('.sched-month');if(heading){heading.hidden=heading.textContent===lastMonth;lastMonth=heading.textContent;}}
 }
 if(counter)counter.textContent=shown+' of '+games.length+' games';
};
host.querySelector('#wbb-calendar-search')?.addEventListener('input',filterSchedule);
host.querySelector('#wbb-calendar-view')?.addEventListener('change',filterSchedule);
function refreshSchedule(){
 const snapshot=window.WBBRetroSnapshot;
 const ratingsByTeam=new Map((snapshot?.rankings||[]).map(r=>[String(r.team_id),r]));
 for(const row of host.querySelectorAll('.wbb-game-entry')){
   const result=row.querySelector('.wbb-result-cell strong').textContent;
   const note=row.querySelector('.wbb-result-source').textContent;
   const state=/^[WL]\s+\d/.test(result)&&!note.includes('certification pending')?'final':
     note.includes('certification pending')?'reported':
     /^\d+\s*[–-]\s*\d+/.test(result)&&note?'live':row.dataset.initialState;
   row.dataset.calendarState=state;
   row.querySelector('.wbb-win-probability').hidden=state!=='upcoming';
   row.querySelector('.wbb-result-source').hidden=!note||state==='final'&&!note.includes('disputed');
   const badge=row.querySelector('.sched-game-status');
   badge.textContent={final:'Final',live:'Live',reported:'Reported final',upcoming:'Upcoming',past:'Awaiting result',review:'Result review',canceled:'Canceled'}[state];
   badge.className='sched-game-status sched-status--'+state;
   const press=row.querySelector('.slt-team-press-btn');
   if(press)press.hidden=state!=='upcoming';
   const projection=row.querySelector('.wbb-schedule-projection');
   if(!projection)continue;
   const {homeId,awayId,forecastVenue}=row.dataset;
   const home=ratingsByTeam.get(homeId),away=ratingsByTeam.get(awayId);
   const forecast=state==='upcoming'&&forecastVenue!=='disputed'&&home&&away&&
     window.WBBRetroForecast?.forecast(home,away,forecastVenue,window.WBBForecastCalibration,snapshot);
   const projectedScore=(team,score)=>'<div><dt>'+esc(team)+'</dt><dd>'+Math.round(score)+'</dd></div>';
   projection.innerHTML=forecast?.calibrated&&Number.isFinite(forecast.projected_away_score)&&Number.isFinite(forecast.projected_home_score)
     ?'<span class="wbb-projection-label">RETRO projection</span><dl>'+
       projectedScore(press.dataset.pressAway,forecast.projected_away_score)+
       projectedScore(press.dataset.pressHome,forecast.projected_home_score)+'</dl>'
     :'';
 }
 filterSchedule();
}
refreshSchedule();
const resultsObserver=new MutationObserver(refreshSchedule);
for(const cell of host.querySelectorAll('.wbb-result-cell')){
 for(const target of [cell.querySelector('strong'),cell.querySelector('.wbb-result-source')]){
   resultsObserver.observe(target,{subtree:true,childList:true,characterData:true});
 }
}
window.addEventListener('wbb-retro-refreshed',refreshSchedule);
window.addEventListener('wbb-retro-forecast-ready',refreshSchedule);
host.addEventListener('click',event=>{
 const button=event.target.closest('.slt-team-press-btn');
 if(button)window.SLTSportsScorebug?.openPress({gender:'women',home:{name:button.dataset.pressHome},away:{name:button.dataset.pressAway}});
});
const finals=games.filter(g=>g.completed&&!g.result_conflict)
 .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,5);
const resultsNode=host.querySelector('#wbb-recent-finals');
if(resultsNode)resultsNode.innerHTML=finals.length?finals.map(g=>{
 const result=window.WBBGameResults.scoreFor(g,id);
 return '<div class="wbb-recent-result"><time>'+esc(easternDay(new Date(g.date)))+'</time><span>'+esc(g.opponent||'Opponent')+'</span><strong>'+esc(result.value)+'</strong></div>';
}).join(''):'<p class="wbb-muted">No verified women’s final has been published for this team yet.</p>';
(async()=>{
 const node=host.querySelector('#wbb-team-news');if(!node)return;
 try{
  const edition=await load('data/cbb-national-news.json');
  const tokens=String(t.team||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(' ');
  const first=tokens[0],last=tokens.at(-1);
  const peers=teams.map(x=>String(x.team||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(' '));
  const uniqueFirst=first.length>=4&&peers.filter(xs=>xs[0]===first).length===1;
  const uniqueMascot=last.length>=5&&peers.filter(xs=>xs.at(-1)===last).length===1;
  const articles=(edition.articles||[]).filter(a=>{
   if(a.gender!=='women'||!String(a.url||'').startsWith('https://'))return false;
   const title=' '+String(a.title||'').toLowerCase().replace(/[^a-z0-9]+/g,' ')+' ';
   return title.includes(' '+tokens.join(' ')+' ')||
    (uniqueFirst&&title.includes(' '+first+' '))||
    (uniqueMascot&&title.includes(' '+last+' '));
  }).slice(0,6);
  node.innerHTML=articles.length?articles.map(a=>
   '<article class="wbb-story"><small>'+esc(a.source||'Basketball reporting')+' · '+esc(String(a.published_at||'').slice(0,10))+'</small><h3><a href="'+esc(a.url)+'" target="_blank" rel="noopener noreferrer">'+esc(a.title)+'</a></h3></article>').join(''):
   '<p class="wbb-muted">No current attributed women’s story is specifically matched to this program. <a href="ncaam.html?gender=women">Read the national women’s edition →</a></p>';
 }catch(e){node.innerHTML='<p class="wbb-muted">The women’s newswire is temporarily unavailable. <a href="ncaam.html?gender=women">Open the national edition →</a></p>';}
})();
const production = window.WBBTeamStats?.render(id);
window.WBBRosterDesk?.render(id, production);
window.WBBTeamLive?.start(id,baseGames,siteDisputes,neutralProof);
// Keep an already-open women's team page current without periodically wiping
// the reader's filters or scrolling position. Reload only when this team's
// published RETRO rating or verified final scores actually change.
const ownRating=doc=>doc?.rankings?.find(x=>String(x.team_id)===id);
const ownFinals=doc=>(doc?.games||[])
  .filter(g=>String(g.home_id)===id||String(g.away_id)===id)
  .map(g=>[String(g.id),g.status,g.home_score,g.away_score])
  .sort((a,b)=>a[0].localeCompare(b[0]));
const editionKey=(retro,finals)=>JSON.stringify([
  ownRating(retro)?.elo,ownRating(retro)?.wins,ownRating(retro)?.losses,
  ownFinals(finals)
]);
const initialEdition=editionKey(ratings,teamLedger(verifiedFinals,publicGames));
let checkingEdition=false;
async function checkTeamFinals(){
  if(document.hidden||checkingEdition)return;
  checkingEdition=true;
  try{
    const stamp=Math.floor(Date.now()/60000);
    const [nextRetro,nextFinals,nextPublicGames]=await Promise.all([
      load('data/ncaaw-2026-27-retro-primary.json?fresh='+stamp),
      load('data/ncaaw-2026-27-verified-games.json?fresh='+stamp),
      load('data/ncaaw-2026-27-games.json?fresh='+stamp).catch(()=>publicGames)
    ]);
    if(editionKey(nextRetro,teamLedger(nextFinals,nextPublicGames))!==initialEdition)location.reload();
  }catch(error){console.warn('Women team final refresh unavailable',error);}
  finally{checkingEdition=false;}
}
setInterval(checkTeamFinals,60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void checkTeamFinals();});
}catch(e){host.innerHTML='<section class="wbb-panel wbb-error"><h2>Women’s team desk unavailable</h2><p>'+esc(e.message)+'</p><p><a href="ncaam.html?gender=women#wbb-teams">Browse women’s teams</a></p></section>'}
})();
