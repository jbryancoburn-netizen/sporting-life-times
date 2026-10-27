/* Independent college basketball schedule renderer.
   Runs even when rankings, article feeds, or MBB newsroom bootstrap fail. */
(async function(){
'use strict';
const host=document.getElementById('mbb-calendar-host');
if(!host)return;
const selected=new URLSearchParams(location.search).get('team');
if(!selected||selected==='ncaa:609574')return;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const load=async url=>{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error(url+' HTTP '+r.status);return r.json();};
try{
 const cross=await load('data/ncaam-2026-27-espn-team-crosswalk.json');
 const team=(cross.teams||[]).find(t=>t.id===selected);
 if(!team)throw Error('Unknown basketball team '+selected);
 const path='data/mbb-schedules-2026-27/'+encodeURIComponent(team.espn_id)+'.json';
 host.hidden=false;
 host.innerHTML='<section class="panel" id="full-season-schedule"><h2>'+escape(team.name)+' · 2026–27 Schedule</h2><p class="note">Loading published games…</p></section>';
 const data=await load(path),games=(data.events||[]).filter(e=>e.date&&e.competitions?.[0]?.competitors?.length>=2).sort((a,b)=>a.date.localeCompare(b.date));
 if(!games.length)throw Error('No games in '+path);
 const cells=games.map(e=>{
  const c=e.competitions[0],contestants=c.competitors||[];
  const self=contestants.find(x=>String(x.team?.id)===String(team.espn_id));
  const opponent=contestants.find(x=>x!==self)||{};
  const logo=opponent.team?.logo;
  const emblem=logo&&/^https:\/\//.test(logo)?'<img class="sched-logo-image" src="'+escape(logo)+'" alt="" loading="lazy">':'';
  const date=new Date(e.date);
  const day=Number.isFinite(+date)?date.toLocaleDateString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric'}):e.date.slice(0,10);
  const confirmed=e.official_time&&!/TBA/i.test(e.official_time);
  const tip=confirmed?e.official_time:(e.official_time_tba?'TBA':Number.isFinite(+date)?date.toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'}):'TBA');
  const vs=self?.homeAway==='away'?'@':self?.homeAway==='home'?'vs':'N';
  const network=[...(c.broadcasts||[]),...(e.broadcasts||[])].flatMap(x=>[...(x.names||[]),x.name,x.media?.shortName].filter(Boolean)).join(' / ')||'TBA';
  return '<tr><td>'+escape(day)+'</td><td><div class="sched-matchup"><span class="sched-logo">'+emblem+'</span><span class="sched-opponent"><strong>'+escape(opponent.team?.displayName||opponent.team?.name||e.name||'Opponent TBD')+'</strong><small>'+vs+'</small></span></div></td><td>'+escape(c.venue?.fullName||'TBA')+'</td><td>'+escape(tip)+'</td><td>'+escape(network)+'</td></tr>';
 }).join('');
 const method=data.verified_from_school?'Official university athletics calendar':data.verified_by_opponents?'Opponent universities confirmed these games; partial coverage':'Published schedule feed; official verification pending';
 const source=data.verified_from_school&&data.source_url?'<a href="'+escape(data.source_url)+'" target="_blank" rel="noopener">School athletics source ↗</a>':'';
 host.innerHTML='<section class="panel" id="full-season-schedule"><div class="panel-head"><div class="eyebrow">'+escape(team.name)+' · 2026–27</div><h2>Full Season Schedule — '+games.length+' Games</h2></div><p class="note">'+escape(method)+' · Tipoff times shown in Eastern Time where available. '+source+'</p><div class="table-wrap"><table class="mbb-schedule-table"><thead><tr><th>Date</th><th>Opponent</th><th>Venue</th><th>ET</th><th>TV / Stream</th></tr></thead><tbody>'+cells+'</tbody></table></div></section>';
 host.dataset.scheduleLoaded=selected;
}catch(err){
 console.error('Standalone team calendar load failed',err);
 host.hidden=false;
 host.innerHTML='<section class="panel" id="full-season-schedule"><h2>Team Calendar Unavailable</h2><p class="note">Schedule could not be loaded. Please refresh this page.</p></section>';
}
})();