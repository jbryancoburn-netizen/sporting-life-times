/* Independent college basketball schedule renderer.
   Runs even when rankings, article feeds, or MBB newsroom bootstrap fail. */
(async function refreshCalendar(){
'use strict';
const host=document.getElementById('mbb-calendar-host');
if(!host)return;
const selected=new URLSearchParams(location.search).get('team');
if(!selected)return;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
await window.MBBLogos.ready;
const load=async url=>{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error(url+' HTTP '+r.status);return r.json();};
try{
 const cross=await load('data/ncaam-2026-27-espn-team-crosswalk.json');
 const team=(cross.teams||[]).find(t=>t.id===selected||String(t.espn_id)===selected);
 if(!team)throw Error('Unknown basketball team '+selected);
 // Shared page identity must follow the selected program, never a fixed school.
 document.title=team.name+' Basketball | The Sporting Life & Times';
 const icon=document.querySelector('link[rel="icon"]')||document.createElement('link');
 icon.rel='icon';icon.type='image/png';icon.href='https://a.espncdn.com/i/teamlogos/ncaa/500/'+encodeURIComponent(team.espn_id)+'.png';
 if(!icon.parentNode)document.head.appendChild(icon);
 const path='data/mbb-schedules-2026-27/'+encodeURIComponent(team.espn_id)+'.json';
 host.hidden=false;
 if(!host.dataset.scheduleLoaded)host.innerHTML='<section class="panel" id="full-season-schedule"><h2>'+escape(team.name)+' · 2026–27 Schedule</h2><p class="note">Loading published games…</p></section>';
 const data=await load(path);
 const valid=(data.events||[]).filter(e=>e.date&&e.competitions?.[0]?.competitors?.length>=2);
 const officialClock=s=>/^(?:(?:[01]?\d|2[0-3]):[0-5]\d(?:\s*(?:a\.?m\.?|p\.?m\.?))?|\d{1,2}\s*(?:a\.?m\.?|p\.?m\.?)|noon|midnight)(?:\s*(?:ET|CT|MT|PT|EST|EDT|CST|CDT|MST|MDT|PST|PDT))?$/i.test(String(s||'').trim());
 const dateLabel=s=>/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}$/i.test(String(s||'').trim());
 const quality=e=>{const c=e.competitions[0],v=c.venue?.fullName||'';
  const schoolTime=e.official_school_time||e.official_time||'';
  const validTime=officialClock(schoolTime);
  const networks=[...(c.broadcasts||[]),...(e.broadcasts||[])];
  return (/Choose A Location|All Games Home|Select Location/i.test(v)||dateLabel(v)?0:v?4:0)
    +(validTime?8:0)+(networks.length?3:0)+(e.site_verified===true?2:0);
 };
 const distinct=new Map();
 for(const e of valid){const opponent=e.competitions[0].competitors.find(p=>String(p.team?.id)!==String(team.espn_id));const key=e.date.slice(0,10)+'|'+String(opponent?.team?.id||opponent?.team?.displayName||e.name||'').toLowerCase().trim();const old=distinct.get(key);if(!old||quality(e)>quality(old))distinct.set(key,e);}
 const games=[...distinct.values()].sort((a,b)=>a.date.localeCompare(b.date));
 if(!games.length)throw Error('No games in '+path);
 const norm=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const matches=new Map();
 for(const entry of cross.teams||[]){for(const n of [entry.name,entry.espn_name]){const k=norm(n);if(!k)continue;if(!matches.has(k))matches.set(k,new Set());matches.get(k).add(String(entry.espn_id));}}
 const exactId=n=>{const ids=matches.get(norm(n));return ids?.size===1?[...ids][0]:'';};
 const ratings=await load('data/ncaam-2026-27-retro-primary.json').catch(()=>null);
 const ratingBySchool=new Map((ratings?.rankings||[]).map(x=>[String(x.team_id),x.elo]));
 const ncaaByEspn=new Map((cross.teams||[]).map(x=>[String(x.espn_id),String(x.id)]));
 const schoolByEspn=new Map((cross.teams||[]).map(x=>[String(x.espn_id),x]));
 const opponentElo=id=>{const n=ratingBySchool.get(ncaaByEspn.get(String(id)));return Number.isFinite(Number(n))?Math.round(Number(n)).toString():'—';};
 const cells=games.map(e=>{
  const c=e.competitions[0],contestants=c.competitors||[];
  const self=contestants.find(x=>String(x.team?.id)===String(team.espn_id));
  const opponent=contestants.find(x=>x!==self)||{};
  const opponentName=opponent.team?.displayName||opponent.team?.name||e.name||'Opponent TBD';
  const knownId=String(opponent.team?.id||'').trim();
  const opponentId=knownId||exactId(opponentName);
  // Recover exact Division I identities when an imported opponent has no ID.
  // Non-Division I opponents retain initials instead of a guessed crest.
  const emblem=window.MBBLogos.byESPN(opponentId,'schedule',opponentName);
  const date=new Date(e.date);
  const day=Number.isFinite(+date)?date.toLocaleDateString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric'}):e.date.slice(0,10);
  const verifiedTip=[e.official_school_time,e.official_time].find(officialClock)||'';
  const confirmed=Boolean(verifiedTip);
  const tip=confirmed?verifiedTip:'TBA'; // Never present placeholder imported noon as an official tip.
  const vs=e.site_verified===true?(self?.homeAway==='away'?'AWAY':self?.homeAway==='home'?'HOME':e.neutralSite===true?'NEUTRAL':'SITE TBA'):'SITE UNVERIFIED';
  const broadcastLabels=[...(c.broadcasts||[]),...(e.broadcasts||[])].flatMap(x=>{
   if(typeof x==='string')return [x];
   return [...(Array.isArray(x?.names)?x.names:x?.names?[x.names]:[]),x?.name,x?.media?.shortName,x?.media?.name].filter(Boolean);
  });
  // Published school sources may also carry a direct broadcast label.
  if(typeof e.broadcast==='string')broadcastLabels.push(e.broadcast);
  const namedNetwork=[...new Set(broadcastLabels.map(x=>String(x).trim()).filter(x=>x&&!/^(?:TBA|TBD|unknown|network tba)$/i.test(x)))].join(' / ');
  const watchURL=/^https:\/\/[^\s"'<>]+$/i.test(e.official_watch_url||'')?e.official_watch_url:'';
  const watchLink=watchURL?'<a href="'+escape(watchURL)+'" target="_blank" rel="noopener noreferrer">Watch live ↗</a>':'';
  const network=(namedNetwork?escape(namedNetwork):'Network TBA')+(watchLink?' · '+watchLink:'');
  const rawVenue=(c.venue?.fullName||'').trim();
  const cleanVenue=/Choose A Location|All Games Home|Select Location/i.test(rawVenue)||dateLabel(rawVenue)?'':rawVenue;
  const address=c.venue?.address||{};
  const venueCity=[address.city,address.state].filter(Boolean).join(', ');
  const cityOnly=/^[A-Za-z .'-]+,\s*[A-Z]{2}(?:\s.*)?$/.test(cleanVenue)||/^[A-Za-z .'-]+,\s*(?:Ohio|Florida|California|Texas|New York|Pennsylvania|Virginia|Georgia|Indiana|Kentucky|Tennessee|Illinois|Michigan|Wisconsin|Alabama|Arkansas|Missouri|Oklahoma|Iowa|Utah|Colorado|Arizona|Nevada|Oregon|Washington|Louisiana|Mississippi|Idaho|Kansas|Nebraska|Minnesota|Maryland|Connecticut|Montana|Maine|Vermont|Hawaii|Alaska|Wyoming|Delaware|Carolina|Dakota|Jersey|Mexico)(?:\s.*)?$/i.test(cleanVenue);
  const embedded=cleanVenue.match(/^(.+?)\s*\(([^()]+)\)\s*$/);
  const embeddedArena=embedded&&/Arena|Center|Centre|Coliseum|Gymnasium|Fieldhouse|Pavilion|Forum|Convocation|Stadium|Dome|Auditorium/i.test(embedded[2])?embedded[2].trim():'';
  const locationLabel=/^[A-Za-z .'-]+,\s*(?:[A-Z]{2}|Fla\.|Calif\.|N\.Y\.|N\.C\.|S\.C\.|Ga\.|Tenn\.|Tex\.|Pa\.|Ill\.|Mich\.|Mass\.|Ariz\.|Nev\.|Ore\.|Wash\.)\s*$/i.test(cleanVenue);
  const officialLocation=(c.venue?.official_school_location||'').trim();
  const officialFacility=officialLocation.match(/\(([^()]+)\)/);
  const officialArena=officialFacility&&/Arena|Center|Centre|Coliseum|Gymnasium|Fieldhouse|Pavilion|Forum|Convocation|Stadium|Dome|Auditorium/i.test(officialFacility[1])?officialFacility[1].trim():'';
  const arenaFromOfficialLine=cleanVenue.match(/(?:^|\s)((?:[A-Za-z0-9'.&-]+\s+){0,6}(?:Arena|Center|Centre|Coliseum|Gymnasium|Fieldhouse|Pavilion|Forum|Convocation Center|Indoor Stadium|Dome|Auditorium))\s*$/i)?.[1]||'';
  let arena=(dateLabel(c.venue?.arenaName)?'':c.venue?.arenaName)||officialArena||embeddedArena||arenaFromOfficialLine||((cityOnly||locationLabel)?'Arena TBA':cleanVenue||'Arena TBA');
  const schoolCity=dateLabel(c.venue?.official_school_city)?'':c.venue?.official_school_city;
  const rawCity=schoolCity||venueCity||(embedded&&embeddedArena?embedded[1].trim():((cityOnly||locationLabel)?cleanVenue:'City TBA'));
  const cityState=(address.state||'').trim();
   const city=cityState&&rawCity!=='City TBA'&&!rawCity.includes(',')?rawCity+', '+cityState:rawCity;
  if(rawCity&&rawCity!=='City TBA'&&arena.startsWith(rawCity))arena=arena.slice(rawCity.length).replace(/^[\s/|,]+/,'')||arena;
  const completed=e.status?.type?.completed===true||e.status?.type?.state==='post';
  const result=completed&&self?.score!=null&&opponent?.score!=null?(Number(self.score)>Number(opponent.score)?'W ':'L ')+escape(self.score)+'–'+escape(opponent.score):'—';
  const school=schoolByEspn.get(opponentId);
  const label=escape(school?.name||opponentName);
  const title=school?'<a href="ncaam-team.html?team='+encodeURIComponent(school.id)+'">'+label+'</a>':label;
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/New_York'});
  return '<tr data-calendar-state="'+(completed?'final':e.date.slice(0,10)>=today?'upcoming':'past')+'" data-opponent="'+escape((school?.name||opponentName).toLowerCase())+'"><td>'+escape(day)+'</td><td><div class="sched-matchup">'+emblem+'<span class="sched-opponent"><strong>'+title+'</strong><small>'+vs+'</small></span></div></td><td><strong>'+escape(arena)+'</strong><br><small>'+escape(city)+'</small>'+'</td><td>'+escape(tip)+'</td><td>'+network+'</td><td>'+escape(opponentElo(opponentId))+'</td><td>'+result+'</td></tr>';
 }).join('');
 const method=data.verified_from_school?'Official university athletics calendar':data.verified_by_opponents?'Opponent universities confirmed these games; partial coverage':'Published schedule feed; official verification pending';
 const source=/^https:\/\/[^\s"'<>]+$/.test(data.source_url||'')&&!/espn\.com|realgm\.com|wikipedia\.org/i.test(data.source_url)?'<a href="'+escape(data.source_url)+'" target="_blank" rel="noopener">School athletics source ↗</a>':'';
 const savedSearch=host.querySelector('#calendar-opponent')?.value||'';
 const savedView=host.querySelector('#calendar-view')?.value||'all';
 host.innerHTML='<section class="panel" id="full-season-schedule"><div class="panel-head"><div class="eyebrow">'+escape(team.name)+' · 2026–27</div><h2>Full Season Schedule — '+games.length+' Games</h2></div><p class="note">'+escape(method)+' · Times follow the school listing and its published time zone. '+source+'</p><div class="calendar-controls"><label>Opponent <input id="calendar-opponent" class="input" type="search" placeholder="Find an opponent…"></label><label>Show <select id="calendar-view"><option value="all">All games</option><option value="upcoming">Upcoming games</option><option value="final">Finals</option></select></label><span id="calendar-count" class="note" aria-live="polite"></span></div><div class="table-wrap"><table class="mbb-schedule-table"><thead><tr><th>Date</th><th>Opponent</th><th>Arena / City</th><th>Tipoff (school listing)</th><th>TV / Stream</th><th>Opp. RETRO</th><th>Result</th></tr></thead><tbody>'+cells+'</tbody></table></div></section>';
 const search=host.querySelector('#calendar-opponent'),view=host.querySelector('#calendar-view');
 search.value=savedSearch;view.value=savedView;
 const filter=()=>{let shown=0;for(const row of host.querySelectorAll('tbody tr')){row.hidden=!(row.dataset.opponent.includes(search.value.toLowerCase().trim())&&(view.value==='all'||row.dataset.calendarState===view.value));if(!row.hidden)shown++;}host.querySelector('#calendar-count').textContent=shown+' of '+games.length+' games';};
 search.addEventListener('input',filter);view.addEventListener('change',filter);filter();
 host.dataset.scheduleLoaded=selected;
 if(!host.dataset.calendarPolling){host.dataset.calendarPolling='true';setInterval(()=>{if(!document.hidden)refreshCalendar();},60000);}
}catch(err){
 console.error('Standalone team calendar load failed',err);
 if(host.dataset.scheduleLoaded)return; // Retain the last successful calendar during a refresh outage.
 host.hidden=false;
 host.innerHTML='<section class="panel" id="full-season-schedule"><h2>Team Calendar Unavailable</h2><p class="note">Schedule could not be loaded. Please refresh this page.</p></section>';
}
})();
