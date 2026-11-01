/* SLT women's Division I roster desk. 2026–27 women-only, source-attributed. */
(function(w){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safe=v=>{try{const u=new URL(String(v));return u.protocol==='https:'?u.href:''}catch{return ''}};
const nameInitials=n=>String(n||'').trim().split(/\s+/).map(p=>p[0]).filter(Boolean).slice(0,2).join('').toUpperCase();
const prettyClass=v=>({'Fr.':'Freshman','Fy':'First-year','1st':'First-year','So.':'Sophomore','2nd':'Sophomore','Jr.':'Junior','3rd':'Junior','Sr.':'Senior','4th':'Senior','Gr.':'Graduate','5th':'Fifth-year','R-So.':'Redshirt Sophomore','R-Sr.':'Redshirt Senior'}[v]||v||'Year TBA');
const prettyPos=v=>({'GUARD':'Guard','FORWARD':'Forward','CENTER':'Center','G':'Guard','F':'Forward','C':'Center','G/F':'Guard / Forward','F/G':'Forward / Guard','F/C':'Forward / Center'}[v]||v||'Position TBA');
/* ESPN roster is a current-only source; it may ignore a season parameter. Images are
 * decorations ONLY, and must match a published 2026–27 women's roster by name AND jersey. */
const normalName=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
const jersey=v=>String(v??'').trim().replace(/^#/,'');
function verifiedPortraits(data,players,teamId){
 const answer=new Map();
 if(data?.status!=='success'||Number(data.season?.year)!==2027||
    (data.team?.id!=null&&String(data.team.id)!==String(teamId)))return answer;
 const raw=Array.isArray(data.athletes)?data.athletes.flatMap(a=>Array.isArray(a.items)?a.items:[a]):[];
 const rosterKeys=players.map(p=>normalName(p.name)+'|'+jersey(p.number));
 const keyed=new Map(),count=new Map();
 for(const a of raw){
  const key=normalName(a?.fullName||a?.displayName)+'|'+jersey(a?.jersey);
  if(!key.split('|')[0]||!key.split('|')[1])continue;
  count.set(key,(count.get(key)||0)+1);
  keyed.set(key,safe(a?.headshot?.href));
 }
 const sourceCounts=new Map();
 for(const key of rosterKeys)sourceCounts.set(key,(sourceCounts.get(key)||0)+1);
 for(let i=0;i<players.length;i++){
  const key=rosterKeys[i];
  if(count.get(key)!==1||sourceCounts.get(key)!==1||!keyed.get(key))continue;
  answer.set(key,keyed.get(key));
 }
 return answer;
}
async function render(teamId){
 const host=document.getElementById('wbb-roster-host');if(!host)return;
 host.innerHTML='<p class="wbb-muted">Loading 2026–27 women’s roster…</p>';
 try{
  const res=await fetch('data/ncaaw-rosters-2026-27.json',{cache:'no-cache'});
  if(!res.ok)throw Error('Roster file unavailable ('+res.status+')');
  const data=await res.json();
  if(data.gender!=='women'||data.season!=='2026-27')throw Error('Women’s season validation failed');
  const supplement=await fetch('data/ncaaw-rosters-official-supplement-2026-27.json',{cache:'no-cache'}).then(x=>x.ok?x.json():null).catch(()=>null);
  const official=supplement?.gender==='women'&&supplement?.season==='2026-27'?supplement?.teams?.[String(teamId)]:null;
  const group=official||data.teams?.[String(teamId)];
  if(!group?.players?.length){
   host.innerHTML='<p class="wbb-roster-empty">This school’s 2026–27 women’s roster is not yet present in the published verified-source dataset. We will not display an earlier season or the men’s roster in its place.</p>';
   return;
  }
  const players=group.players.filter(p=>p.name&&safe(p.profile_url));
  if(!players.length)throw Error('No school-linked roster profiles');
  const source=safe(group.source_url||data.source_url);
  host.innerHTML='<div class="wbb-roster-intro"><span class="wbb-roster-count">'+players.length+' players</span><span>2026–27 women’s basketball</span><a href="'+esc(source)+'" target="_blank" rel="noopener noreferrer">'+(official?'Official university roster ↗':'Roster data &amp; attribution ↗')+'</a></div>'+
   '<div class="wbb-roster-controls"><label>Find a player<input id="wbb-roster-search" type="search" placeholder="Search by name or hometown" autocomplete="off"></label><label>Position<select id="wbb-roster-filter"><option value="">All positions</option><option value="Guard">Guards</option><option value="Forward">Forwards</option><option value="Center">Centers</option></select></label></div>'+
   '<div id="wbb-roster-grid" class="wbb-roster-grid"></div><p class="wbb-roster-source">'+(official?'Names and details were checked against the university’s published 2026–27 women’s roster. Player links open its official roster page.':'Names and details come from the 2026–27 school-site roster compilation by the University of Maryland’s Sports Roster Data project. Player links open school profiles. Independent school-by-school certification is ongoing.')+' Rosters may change during the season.</p>'+
   '<div class="wbb-leaders-note"><strong>2026–27 Player Leaders</strong><p>Points, rebounds, assists and shooting leaders will appear when verified women’s season statistics are published. No men’s or prior-season numbers are substituted.</p></div>';
  const grid=host.querySelector('#wbb-roster-grid');
  let photos=new Map();
  const draw=()=>{
   const q=(host.querySelector('#wbb-roster-search').value||'').toLowerCase().trim(),f=host.querySelector('#wbb-roster-filter').value;
   const subset=players.filter(p=>(!q||(p.name+' '+p.hometown+' '+p.number).toLowerCase().includes(q))&&(!f||prettyPos(p.position).includes(f)));
   grid.innerHTML=subset.length?subset.map(p=>{
    const url=safe(p.profile_url),n=p.number?('#'+esc(p.number)):'No. —',meta=[prettyPos(p.position),prettyClass(p.class),p.height].filter(Boolean).map(esc).join(' · ');
    const key=normalName(p.name)+'|'+jersey(p.number),photo=photos.get(key);
    return '<article class="wbb-player-card"><div class="wbb-player-avatar'+(photo?' has-photo':'')+'" aria-hidden="true"><span class="wbb-avatar-fallback">'+esc(nameInitials(p.name))+'</span>'+(photo?'<img src="'+esc(photo)+'" alt="" loading="lazy">':'')+'</div><div class="wbb-player-body"><span class="wbb-player-number">'+n+'</span><a class="wbb-player-name" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(p.name)+' ↗</a><span class="wbb-player-meta">'+meta+'</span><span class="wbb-player-hometown">'+esc(p.hometown||'')+'</span></div></article>';
   }).join(''):'<p class="wbb-roster-empty">No players match this filter.</p>';
   grid.querySelectorAll('.wbb-player-avatar img').forEach(img=>img.addEventListener('error',()=>img.remove()));
  };
  host.querySelector('#wbb-roster-search').addEventListener('input',draw);
  host.querySelector('#wbb-roster-filter').addEventListener('change',draw);
  draw();
  // Do not delay the roster while a separate provider fetches optional photographs.
  try{
   const response=await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/teams/'+
     encodeURIComponent(teamId)+'/roster',{signal:AbortSignal.timeout(8000)});
   if(!response.ok)return;
   photos=verifiedPortraits(await response.json(),players,teamId);
   if(photos.size){
    draw();
    const note=host.querySelector('.wbb-roster-source');
    if(note)note.appendChild(document.createTextNode(' '+photos.size+
     ' portraits matched by full name and jersey to the current ESPN women’s roster. Player names and biographies retain their published roster source.'));
   }
  }catch{} // All unmatched or inaccessible photos stay as initials avatars.
 }catch(e){host.innerHTML='<p class="wbb-roster-empty">Roster data could not load. '+esc(e.message)+'. Other team information remains available.</p>';}
}
w.WBBRosterDesk={render,verifiedPortraits};
})(window);
