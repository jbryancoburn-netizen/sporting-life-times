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
const [registry,master,ratings,officialTV,scoreboardTV,palette,artwork,timeConflicts,verifiedFinals,tipoffQuarantine,siteConflictAudit,verifiedNeutralEvidence,verifiedHomeEvidence]=await Promise.all([load('data/ncaaw-2026-27-teams.json'),load('data/ncaaw-schedules-2026-27.json'),load('data/ncaaw-2026-27-retro-primary.json').catch(()=>null),load('data/ncaaw-2026-27-official-broadcast-overrides.json').catch(()=>null),load('data/ncaaw-2026-27-scoreboard-broadcast-overlays.json').catch(()=>null),load('data/dual-ring-team-palette.json').catch(()=>null),load('data/mbb-logo-registry.json').catch(()=>null),load('data/ncaaw-2026-27-cross-school-time-discrepancies-2026-10-30.json').catch(()=>null),load('data/ncaaw-2026-27-verified-games.json').catch(()=>null),load('data/ncaaw-2026-27-tipoff-quarantine.json').catch(()=>null),load('data/ncaaw-2026-27-official-site-conflicts.json').catch(()=>null),load('data/ncaaw-2026-27-verified-neutral-sites.json').catch(()=>null),load('data/ncaaw-2026-27-verified-home-courts.json').catch(()=>null)]);
const teams=registry.teams||[],lookup=new Map(teams.map(t=>[String(t.team_id),t]));
const t=lookup.get(id),entry=master.teams?.[id];
if(!t||!entry)throw Error('No published women’s schedule found for team '+id);
const homeProof=window.WBBSiteIntegrity?.verifiedHomeCourts(verifiedHomeEvidence)||new Map();
const baseGames=(entry.games||[]).map(g=>window.WBBSiteIntegrity?.correctedHome(g,homeProof,id)||g);
const reconciled=window.WBBGameResults.merge(baseGames,verifiedFinals,id),games=reconciled.games;
const rating=ratings?.gender==='women'&&ratings?.season==='2026-27'?ratings.rankings?.find(x=>String(x.team_id)===id):null;
const sorted=games.slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
const rmap=new Map((ratings?.gender==='women'?ratings.rankings||[]:[]).map(x=>[String(x.team_id),x]));
// Share the same women-only published ratings with the canonical team scorebugs.
window.WBBRetroSnapshot=ratings?.model==='retro-clean-slate'&&ratings?.gender==='women'&&ratings?.season==='2026-27'&&ratings?.rankings?.length===363?ratings:null;
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
const record=rating?String(rating.wins||0)+'–'+String(rating.losses||0):'—';
const logo=window.MBBLogos.byESPN(id,'hero',t.team);
const rows=sorted.map(g=>{
  const opp=lookup.get(String(g.opponent_id||''));
  const badge=opp?window.MBBLogos.byESPN(String(opp.team_id),'schedule',opp.team):'';
  const conferenceTag=opp&&t.conference&&opp.conference&&t.conference===opp.conference?'<span class="wbb-conference-game" title="Conference matchup">'+esc(leagueLabel(t.conference))+'</span>':'';
  const d=new Date(g.date);
  const date=Number.isNaN(d.getTime())?esc(g.date||'TBA'):esc(d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'America/New_York'}));
  const other=rmap.get(String(g.opponent_id||''));
  const opponent='<div class="wbb-matchup">'+badge+'<div class="wbb-match-copy"><div class="wbb-opponent-line">'+
    (other?.rank?'<span class="wbb-opponent-rank" title="Women’s RETRO rank">#'+esc(other.rank)+'</span>':'')+
    '<span class="wbb-opponent-name">'+(opp?'<a href="ncaaw-team.html?team='+encodeURIComponent(opp.team_id)+'">'+esc(g.opponent||opp.team)+'</a>':esc(g.opponent||'Opponent TBA'))+'</span>'+
    conferenceTag+'</div><span class="wbb-site-label">'+esc(site(g))+'</span>'+
    '<span class="wbb-win-probability">'+(g.completed?'Final':winChance(rating,other,g))+'</span></div></div>';
  const tv=tvmap.get(String(g.id)),tvName=tv?.broadcast||g.broadcast||'Network TBA',tvUrl=tv?.source_url||g.broadcast_source_url||'';
  const television=tvUrl.startsWith('https://')?'<a href="'+esc(tvUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(tvName)+' ↗</a>':esc(tvName);const neutral=window.WBBSiteIntegrity?.certifiedNeutral(g,neutralProof);
  const officialHome=window.WBBSiteIntegrity?.officialHome(g,homeProof);
  const siteClaims=officialHome?[]:window.WBBSiteIntegrity?.claims(g,siteDisputes,neutralProof)||[];
  const probability=g.completed?'Final':siteClaims.length?'Venue review':winChance(rating,other,neutral?{...g,site:'neutral'}:g);const delta=other&&Number.isFinite(other.daily_change)?(other.daily_change>0?'+':'')+other.daily_change.toFixed(1):'—';
  const city=String(g.city||g.city_state||g.official_location_as_printed||'').trim();
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
  const location=esc(g.venue||'Arena TBA')+(city?'<span class="wbb-location-note">'+esc(city)+'</span>':'')+siteLabel;
  const officialTip=g.official_tipoff_local||g.official_tipoff_as_printed||g.official_time_as_printed||g.official_school_time||g.official_time||g.verified_tipoff||'';
  const dispute=!g.completed?timeDisputes.get(String(g.id)):null;
  const disputed=!!dispute;
  const hasOfficial=!!officialTip&&!/TBA|TBD/i.test(officialTip);
  const tentative=(!disputed&&!hasOfficial&&!g.completed)?listedTipoff(g):'';
  const tip=disputed?'Disputed — verify':hasOfficial?esc(officialTip):tentative?esc(tentative):'TBA';
  const disagreement=dispute?.cross_school_disagreement?
    'Universities report different tipoffs; organizer confirmation required.':
    'Official university and published calendar times differ; confirmation pending.';
  const officialSource=disputed?(dispute.source_claims||[]).find(x=>typeof x.source_url==='string'&&x.source_url.startsWith('https://'))?.source_url:'';
  const tipNote=disputed?'<small class="wbb-tipoff-dispute">'+esc(disagreement)+
    (officialSource?' <a href="'+esc(officialSource)+'" target="_blank" rel="noopener noreferrer">School source ↗</a>':'')+'</small>':
    tentative?'<small class="wbb-tipoff-tentative">Feed-listed start; unverified by school.</small>':
    hasOfficial?'<small class="wbb-tipoff-verified">University-sourced listing</small>':'';
  const result=window.WBBGameResults.scoreFor(g,id);
  const statAvailable=g.completed&&!g.result_conflict&&/^\d+$/.test(String(g.id));
  const state=g.completed?'final':new Date(g.date)<new Date()?'past':'upcoming';
  const court=siteClaims.length?'disputed':neutral||g.site==='neutral'?'neutral':officialHome||g.site_verified===true?'verified-home':'unverified';
  const main='<tr class="wbb-game-entry" data-site="'+esc(g.site||'unknown')+'" data-team-id="'+esc(id)+'" data-opponent-id="'+esc(g.opponent_id||'')+'" data-home-id="'+esc(g.home_id||'')+'" data-away-id="'+esc(g.away_id||'')+'" data-forecast-venue="'+court+'" data-calendar-state="'+state+'" data-opponent="'+esc((g.opponent||opp?.team||'').toLowerCase())+'" data-game-id="'+esc(g.id)+'">'+
    '<td data-label="Date"><time>'+date+'</time></td>'+
    '<td data-label="Opponent">'+opponent+'</td>'+
    '<td data-label="Arena / City">'+location+'</td>'+
    '<td data-label="Tipoff">'+tip+tipNote+'</td>'+
    '<td class="wbb-broadcast" data-label="TV / Stream">'+television+'</td>'+
    '<td class="wbb-opp-elo" data-label="Opp. RETRO"><span class="wbb-opp-elo-value">'+fmtElo(other)+'</span><small class="wbb-opp-change" title="Opponent daily RETRO change">'+delta+'</small></td>'+
    '<td class="wbb-result-cell" data-label="Result" title="'+esc(result.detail)+'"><strong>'+esc(result.value)+'</strong><small class="wbb-result-source">'+esc(result.detail)+'</small>'+
    (statAvailable?'<button type="button" class="wbb-stat-toggle" data-event="'+esc(g.id)+'" aria-expanded="false" aria-controls="wbb-detail-'+esc(g.id)+'">Game Stats ▾</button>':'')+'</td></tr>';
  return main+(statAvailable?'<tr class="wbb-game-detail" id="wbb-detail-'+esc(g.id)+'" hidden><td colspan="7"><div class="wbb-game-stats">Open to view verified game statistics.</div></td></tr>':'');
}).join('');
host.innerHTML='<section class="wbb-mast"><div class="wbb-identity">'+logo+'<div><div class="eyebrow"><a href="ncaam.html?gender=women">Women’s Division I</a> / '+esc(t.conference||'Team Desk')+'</div><h1>'+(rating?.rank?'<span class="wbb-rank-tag">RETRO #'+esc(rating.rank)+'</span>':'')+esc(t.team)+'</h1><p>'+esc(t.conference||'Conference unverified')+' · 2026–2027 Season</p></div></div>'+
'<nav class="wbb-nav" aria-label="Team page sections"><a href="#schedule">Schedule</a><a href="#wbb-stats">Team & Player Stats</a><a href="#roster">Roster</a><a href="ncaaw-rankings.html?poll=retro">Women’s Rankings</a><a href="ncaam.html?gender=women#wbb-teams">All 363 Teams</a></nav></section>'+
'<section class="wbb-kpis"><div class="wbb-kpi"><small>RETRO Elo</small><strong id="wbb-team-elo">'+esc(rating&&Number.isFinite(Number(rating.elo))?Number(rating.elo).toFixed(0):'—')+'</strong></div>'+
'<div class="wbb-kpi"><small>Overall</small><strong id="wbb-team-record">'+esc(record)+'</strong></div>'+
'<div class="wbb-kpi"><small>Conference Record</small><strong>'+esc((rating?.conference_wins||0)+'–'+(rating?.conference_losses||0))+'</strong></div>'+
'<div class="wbb-kpi"><small>Scheduled Games</small><strong>'+games.length+'</strong></div></section>'+
'<section class="wbb-panel" id="schedule"><div class="eyebrow">The season’s complete fixture register</div><h2>2026–2027 Schedule</h2>'+
'<div class="wbb-controls"><label>Opponent<input id="wbb-calendar-search" type="search" placeholder="Search opponents…" autocomplete="off"></label>'+
'<label>Show<select id="wbb-calendar-view"><option value="all">All games</option><option value="upcoming">Upcoming</option><option value="final">Finals</option></select></label>'+
'<span class="wbb-calendar-count" id="wbb-calendar-count" aria-live="polite"></span></div>'+
'<p class="wbb-result-refresh" id="wbb-result-refresh" role="status">'+reconciled.matched+' published finals matched'+(reconciled.conflicts.length?' · '+reconciled.conflicts.length+' identity conflicts withheld':'')+'</p>'+
'<div class="wbb-table-wrap"><table class="wbb-schedule-table" aria-label="'+esc(t.team)+' 2026–2027 game schedule"><thead><tr><th>Date</th><th>Opponent</th><th>Arena / City</th><th>Tipoff (school listing)</th><th>TV / Stream</th><th>Opp. RETRO</th><th>Result</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
'<p class="wbb-muted">Times and venues show the published school evidence where verified. Conflicting reports remain labeled for review; no unverified result enters RETRO.</p></section>'+
'<div class="wbb-secondary"><section class="wbb-panel" id="wbb-reporting"><div class="eyebrow">The National Conversation</div><h2>Latest Women’s Basketball Reporting</h2><div id="wbb-team-news">Checking the women’s national newswire…</div></section>'+
'<section class="wbb-panel" id="wbb-march-file"><div class="eyebrow">The Selection Ledger</div><h2>The March File</h2><div class="wbb-march-register"><div><small>Women’s RETRO</small><strong>'+(rating?.rank?'#'+esc(rating.rank):'—')+'</strong></div><div><small>Season Record</small><strong>'+esc(record)+'</strong></div><div><small>Conference</small><strong>'+esc((rating?.conference_wins||0)+'–'+(rating?.conference_losses||0))+'</strong></div><div><small>Change from 1500</small><strong>'+(rating&&Number.isFinite(Number(rating.elo))?esc(((Number(rating.elo)-1500)>=0?'+':'')+(Number(rating.elo)-1500).toFixed(1)):'—')+'</strong></div></div>'+
'<p class="wbb-muted">The women’s RETRO résumé uses women-only verified finals. NCAA NET and tournament quadrant records are not inferred from Elo. <a href="ncaaw-rankings.html?poll=retro">National RETRO register →</a></p><h3>Recent Verified Results</h3><div id="wbb-recent-finals"></div></section>'+
'<section class="wbb-panel" id="wbb-stats"><div class="eyebrow">The Statistical Notebook · 2026–27</div><h2>Player Production & Team Statistics</h2><div id="wbb-team-stats">Checking verified women’s statistics…</div></section>'+
'<section class="wbb-panel wbb-roster-full" id="roster"><div class="eyebrow">The Team Register · 2026–27</div><h2>Current Roster</h2><div id="wbb-roster-host"><p class="wbb-muted">Loading women’s roster…</p></div></section></div>';
const filterSchedule=()=>{
 const input=host.querySelector('#wbb-calendar-search'),sel=host.querySelector('#wbb-calendar-view'),counter=host.querySelector('#wbb-calendar-count');
 if(!input||!sel)return;
 let shown=0;
 for(const row of host.querySelectorAll('tr.wbb-game-entry')){
   const matchesName=row.dataset.opponent?.includes(input.value.trim().toLowerCase());
   const matchesStatus=sel.value==='all'||row.dataset.calendarState===sel.value;
   row.hidden=!(matchesName&&matchesStatus);
   const detail=row.nextElementSibling;
   if(detail?.classList.contains('wbb-game-detail')&&row.hidden)detail.hidden=true;
   if(!row.hidden)shown++;
 }
 if(counter)counter.textContent=shown+' of '+games.length+' games';
};
host.querySelector('#wbb-calendar-search')?.addEventListener('input',filterSchedule);
host.querySelector('#wbb-calendar-view')?.addEventListener('change',filterSchedule);
filterSchedule();
const finals=games.filter(g=>g.completed&&!g.result_conflict)
 .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,5);
const resultsNode=host.querySelector('#wbb-recent-finals');
if(resultsNode)resultsNode.innerHTML=finals.length?finals.map(g=>{
 const result=window.WBBGameResults.scoreFor(g,id);
 return '<div class="wbb-recent-result"><time>'+esc(String(g.date||'').slice(0,10))+'</time><span>'+esc(g.opponent||'Opponent')+'</span><strong>'+esc(result.value)+'</strong></div>';
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
window.WBBRosterDesk?.render(id);
window.WBBTeamStats?.render(id);
window.WBBTeamLive?.start(id,baseGames,siteDisputes,neutralProof);
}catch(e){host.innerHTML='<section class="wbb-panel wbb-error"><h2>Women’s team desk unavailable</h2><p>'+esc(e.message)+'</p><p><a href="ncaam.html?gender=women#wbb-teams">Browse women’s teams</a></p></section>'}
})();
