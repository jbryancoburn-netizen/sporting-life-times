/* NBA-standard team roster for every Division I men's basketball team.
   The per-school 2026-27 file is the only membership source; historical box scores
   cannot silently add old players to today's roster. */
(function(){
'use strict';
if(document.body.dataset.page!=='team')return;
const params=new URLSearchParams(location.search);
const selected=params.get('team');
if(!selected)return;
const root=document.getElementById('app');
if(!root)return;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validPhoto=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:''}catch{return ''}};
const when=v=>{const d=new Date(v);return Number.isFinite(+d)?new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(d):'not yet verified'};
const norm=v=>String(v||'').toLowerCase().trim();
let espnId='',last='',snapshot=null,lastFetchError='';
const get=async p=>{const response=await fetch(p+'?refresh='+Math.floor(Date.now()/300000),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('HTTP '+response.status);return response.json();};
function detectPanel(){
 return [...root.querySelectorAll('section.panel')].find(p=>p.querySelector('h2')?.textContent.trim()==='Current Roster'||p.id==='mbb-roster-live');
}
function photo(p){
 const src=validPhoto(p.headshot_url);
 const initials=(p.name||'?').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
 return '<span class="mbb-roster-portrait">'+(src?'<img loading="lazy" decoding="async" src="'+esc(src)+'" alt="" onerror="this.remove()">':'')+'<i>'+esc(initials)+'</i></span>';
}
function filter(panel){
 const q=norm(panel.querySelector('#mbb-roster-search')?.value);
 const position=norm(panel.querySelector('#mbb-roster-position')?.value);
 const year=norm(panel.querySelector('#mbb-roster-year')?.value);
 let shown=0;
 for(const tr of panel.querySelectorAll('tbody tr')){
  const match=(!q||tr.dataset.player.includes(q))&&(!position||tr.dataset.position===position)&&(!year||tr.dataset.year===year);
  tr.hidden=!match;if(match)shown++;
 }
 const meter=panel.querySelector('[data-roster-visible]');if(meter)meter.textContent=shown+' of '+snapshot.players.length+' players';
}
function draw(){
 if(!snapshot?.players?.length)return;
 const current=detectPanel();
 if(!current)return;
 const stamp=[snapshot.fetched_at||snapshot.verified_on||'',snapshot.players.map(x=>x.name+':'+x.jersey+':'+x.position).join('|')].join('|');
 if(current.id==='mbb-roster-live'&&current.dataset.rosterStamp===stamp)return;
 const panel=document.createElement('section');panel.id='mbb-roster-live';panel.className='panel teal mbb-roster-live';panel.dataset.rosterStamp=stamp;
 const players=snapshot.players.filter(p=>p?.name).sort((a,b)=>String(a.position||'').localeCompare(String(b.position||''))||String(a.name).localeCompare(String(b.name)));
 const positions=[...new Set(players.map(p=>p.position).filter(Boolean))].sort();
 const years=[...new Set(players.map(p=>p.year).filter(Boolean))].sort();
 const opts=(xs)=>xs.map(x=>'<option value="'+esc(norm(x))+'">'+esc(x)+'</option>').join('');
 const rows=players.map(p=>'<tr data-player="'+esc(norm(p.name))+'" data-position="'+esc(norm(p.position))+'" data-year="'+esc(norm(p.year))+'"><td><div class="mbb-roster-person">'+photo(p)+'<strong>'+esc(p.name)+'</strong></div></td><td>'+esc(p.jersey||'—')+'</td><td>'+esc(p.position||'—')+'</td><td>'+esc(p.year||'—')+'</td></tr>').join('');
 const official=/^(?!.*espn)[a-z]+:/i.test(snapshot.source||'')||snapshot.source_priority?.toLowerCase()?.includes('official athletics')||snapshot.roster_source_priority?.toLowerCase()?.includes('official');
 panel.innerHTML='<div class="mbb-roster-header"><div><div class="eyebrow">2026–27 · Current squad</div><h2>Team Roster <span class="mbb-roster-count">'+players.length+'</span></h2><p class="note">Verified source: '+(official?'University athletics':'Current team roster feed')+' · Updated '+esc(when(snapshot.fetched_at||snapshot.verified_on))+'</p></div>'+
 (validPhoto(snapshot.source)?'<a href="'+esc(snapshot.source)+'" target="_blank" rel="noopener noreferrer">See source ↗</a>':'')+'</div>'+
 '<div class="mbb-roster-controls"><label>Player search <input id="mbb-roster-search" type="search" placeholder="Find a player..." autocomplete="off"></label><label>Position <select id="mbb-roster-position"><option value="">All positions</option>'+opts(positions)+'</select></label><label>Class <select id="mbb-roster-year"><option value="">All years</option>'+opts(years)+'</select></label></div>'+
 '<div class="mbb-roster-table-scroll"><table class="mbb-roster-table"><thead><tr><th>Player</th><th>Number</th><th>Position</th><th>Class</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
 '<p class="note"><span data-roster-visible>'+players.length+' of '+players.length+' players</span> · Present-day membership only. Prior-season statistics belong in the historical player archive, not this roster.</p>';
 current.replaceWith(panel);
 for(const id of ['mbb-roster-search','mbb-roster-position','mbb-roster-year']){
  panel.querySelector('#'+id).addEventListener(id==='mbb-roster-search'?'input':'change',()=>filter(panel));
 }
}
async function refresh(){
 try{
  if(!espnId){
   const walk=await get('data/ncaam-2026-27-espn-team-crosswalk.json');
   const match=(walk.teams||[]).find(t=>t.id===selected||t.name===selected);
   if(!match)throw Error('Unknown program identity');
   espnId=String(match.espn_id);
  }
  const data=await get('data/mbb-rosters-2026-27/'+encodeURIComponent(espnId)+'.json');
  if(data.season!=='2026-27'||!Array.isArray(data.players)||data.players.length<5||data.team_id!==selected)throw Error('Roster missing or does not match selected program');
  const next=JSON.stringify([data.fetched_at,data.verified_on,data.players.map(p=>[p.name,p.jersey,p.position,p.year])]);
  if(next!==last){snapshot=data;last=next;draw();}
  lastFetchError='';
 }catch(err){lastFetchError=String(err?.message||err);if(!snapshot)console.warn('MBB roster: last verified team file unavailable',lastFetchError);}
}
const observer=new MutationObserver(()=>{if(snapshot)draw();});
observer.observe(root,{childList:true});
refresh();
setInterval(()=>{if(!document.hidden)refresh();},300000);
})();
