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
 const [data,branding,logos,arenas]=await Promise.all([load(path),load('data/mbb-branding.json').catch(()=>({teams:{}})),load('data/mbb-logo-registry.json').catch(()=>({teams:{}})),load('data/mbb-arena-registry.json').catch(()=>({teams:{}}))]);
 const valid=(data.events||[]).filter(e=>e.date&&e.competitions?.[0]?.competitors?.length>=2);
 const quality=e=>{const c=e.competitions[0],v=c.venue?.fullName||'';return (/Choose A Location|All Games Home|Select Location/i.test(v)?0:v?4:0)+(e.official_time?2:0)+(c.broadcasts?.length?1:0);};
 const distinct=new Map();
 for(const e of valid){const opponent=e.competitions[0].competitors.find(p=>String(p.team?.id)!==String(team.espn_id));const key=e.date.slice(0,10)+'|'+String(opponent?.team?.id||opponent?.team?.displayName||e.name||'').toLowerCase().trim();const old=distinct.get(key);if(!old||quality(e)>quality(old))distinct.set(key,e);}
 const games=[...distinct.values()].sort((a,b)=>a.date.localeCompare(b.date));
 if(!games.length)throw Error('No games in '+path);
 const norm=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const matches=new Map();
 for(const entry of cross.teams||[]){for(const n of [entry.name,entry.espn_name]){const k=norm(n);if(!k)continue;if(!matches.has(k))matches.set(k,new Set());matches.get(k).add(String(entry.espn_id));}}
 const exactId=n=>{const ids=matches.get(norm(n));return ids?.size===1?[...ids][0]:'';};
 const cells=games.map(e=>{
  const c=e.competitions[0],contestants=c.competitors||[];
  const self=contestants.find(x=>String(x.team?.id)===String(team.espn_id));
  const opponent=contestants.find(x=>x!==self)||{};
  const opponentName=opponent.team?.displayName||opponent.team?.name||e.name||'Opponent TBD';
  const knownId=String(opponent.team?.id||'').trim();
  const opponentId=knownId||exactId(opponentName);
  const registered=logos?.teams?.[opponentId]||{};
  const primaryLogo=registered.official_logo_url||registered.logo_url||(opponentId&&/^[0-9]+$/.test(opponentId)?'https://a.espncdn.com/i/teamlogos/ncaa/500/'+opponentId+'.png':'');
  const logo=primaryLogo||opponent.team?.logo||'';
  const color=registered.primary_color||branding?.teams?.[opponentId]?.color||'193f52';
  const ring=/^[0-9a-f]{6}$/i.test(color)?'#'+color:'#193f52';
  const initials=opponentName.trim().split(' ').filter(Boolean).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
  const alternate=opponent.team?.logo&&opponent.team.logo!==logo&&opponent.team.logo.startsWith('https://')?opponent.team.logo:'';
  const safeLogo=logo.startsWith('https://')?logo:'';
  const emblem='<span class="sched-logo-fallback" aria-hidden="true">'+escape(initials)+'</span>'+(safeLogo?'<img class="sched-logo-image" src="'+escape(safeLogo)+'" alt="" loading="lazy" data-alternate="'+escape(alternate)+'" onerror="if(this.dataset.alternate){this.src=this.dataset.alternate;this.dataset.alternate=\'\'}else{this.remove()}">':'');
  const date=new Date(e.date);
  const day=Number.isFinite(+date)?date.toLocaleDateString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric'}):e.date.slice(0,10);
  const confirmed=e.official_time&&!/TBA/i.test(e.official_time);
  const tip=confirmed?e.official_time:'TBA'; // Imported event dates may contain placeholder noon times.
  const vs=self?.homeAway==='away'?'AWAY':self?.homeAway==='home'?'HOME':e.site_verified===true&&e.neutralSite===true?'NEUTRAL':'SITE TBA';
  const network=[...(c.broadcasts||[]),...(e.broadcasts||[])].flatMap(x=>[...(x.names||[]),x.name,x.media?.shortName].filter(Boolean)).join(' / ')||'TBA';
  const rawVenue=(c.venue?.fullName||'').trim();
  const cleanVenue=/Choose A Location|All Games Home|Select Location/i.test(rawVenue)?'':rawVenue;
  const address=c.venue?.address||{};
  const venueCity=[address.city,address.state].filter(Boolean).join(', ');
  const cityOnly=/^[A-Za-z .'-]+,\s*[A-Z]{2}(?:\s.*)?$/.test(cleanVenue)||/^[A-Za-z .'-]+,\s*(?:Ohio|Florida|California|Texas|New York|Pennsylvania|Virginia|Georgia|Indiana|Kentucky|Tennessee|Illinois|Michigan|Wisconsin|Alabama|Arkansas|Missouri|Oklahoma|Iowa|Utah|Colorado|Arizona|Nevada|Oregon|Washington|Louisiana|Mississippi|Idaho|Kansas|Nebraska|Minnesota|Maryland|Connecticut|Montana|Maine|Vermont|Hawaii|Alaska|Wyoming|Delaware|Carolina|Dakota|Jersey|Mexico)(?:\s.*)?$/i.test(cleanVenue);
  const embedded=cleanVenue.match(/^(.+?)\s*\(([^()]+)\)\s*$/);
  const embeddedArena=embedded&&/Arena|Center|Centre|Coliseum|Gymnasium|Fieldhouse|Pavilion|Forum|Convocation|Stadium|Dome|Auditorium/i.test(embedded[2])?embedded[2].trim():'';
  const locationLabel=/^[A-Za-z .'-]+,\s*(?:[A-Z]{2}|Fla\.|Calif\.|N\.Y\.|N\.C\.|S\.C\.|Ga\.|Tenn\.|Tex\.|Pa\.|Ill\.|Mich\.|Mass\.|Ariz\.|Nev\.|Ore\.|Wash\.)\s*$/i.test(cleanVenue);
  const officialLocation=(c.venue?.official_school_location||'').trim();
  const verifiedSide=e.site_verified===true?self?.homeAway:null;
  const hostId=verifiedSide==='home'?String(team.espn_id):verifiedSide==='away'?opponentId:'';
  const candidate=hostId?arenas?.teams?.[hostId]:null;
  const officialFacility=officialLocation.match(/\(([^()]+)\)/);
  const officialArena=officialFacility&&/Arena|Center|Centre|Coliseum|Gymnasium|Fieldhouse|Pavilion|Forum|Convocation|Stadium|Dome|Auditorium/i.test(officialFacility[1])?officialFacility[1].trim():'';
  const arena=c.venue?.arenaName||officialArena||embeddedArena||(candidate?.home_arena&&verifiedSide!=='neutral'&&!/arena|center|centre|coliseum|pavilion|gym|fieldhouse|stadium|dome/i.test(cleanVenue)?candidate.home_arena:'')||((cityOnly||locationLabel)?'Arena TBA':cleanVenue||'Arena TBA');
  const city=venueCity||(embedded&&embeddedArena?embedded[1].trim():((cityOnly||locationLabel)?cleanVenue:'City TBA'));
  return '<tr><td>'+escape(day)+'</td><td><div class="sched-matchup"><span class="sched-logo" style="--logo-ring:'+ring+'">'+emblem+'</span><span class="sched-opponent"><strong>'+escape(opponent.team?.displayName||opponent.team?.name||e.name||'Opponent TBD')+'</strong><small>'+vs+'</small></span></div></td><td><strong>'+escape(arena)+'</strong><br><small>'+escape(city)+'</small>'+'</td><td>'+escape(tip)+'</td><td>'+escape(network)+'</td></tr>';
 }).join('');
 const method=data.verified_from_school?'Official university athletics calendar':data.verified_by_opponents?'Opponent universities confirmed these games; partial coverage':'Published schedule feed; official verification pending';
 const source=data.verified_from_school&&data.source_url?'<a href="'+escape(data.source_url)+'" target="_blank" rel="noopener">School athletics source ↗</a>':'';
 host.innerHTML='<section class="panel" id="full-season-schedule"><div class="panel-head"><div class="eyebrow">'+escape(team.name)+' · 2026–27</div><h2>Full Season Schedule — '+games.length+' Games</h2></div><p class="note">'+escape(method)+' · Tipoff times shown in Eastern Time where available. '+source+'</p><div class="table-wrap"><table class="mbb-schedule-table"><thead><tr><th>Date</th><th>Opponent</th><th>Arena / City</th><th>ET</th><th>TV / Stream</th></tr></thead><tbody>'+cells+'</tbody></table></div></section>';
 host.dataset.scheduleLoaded=selected;
}catch(err){
 console.error('Standalone team calendar load failed',err);
 host.hidden=false;
 host.innerHTML='<section class="panel" id="full-season-schedule"><h2>Team Calendar Unavailable</h2><p class="note">Schedule could not be loaded. Please refresh this page.</p></section>';
}
})();