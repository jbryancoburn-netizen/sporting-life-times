/* SLT women's Division I roster desk. 2026–27 women-only, source-attributed. */
(function(w){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safe=v=>{try{const u=new URL(String(v));return u.protocol==='https:'?u.href:''}catch{return ''}};
const nameInitials=n=>String(n||'').trim().split(/\s+/).map(p=>p[0]).filter(Boolean).slice(0,2).join('').toUpperCase();
const prettyClass=v=>({'Fr.':'Freshman','So.':'Sophomore','Jr.':'Junior','Sr.':'Senior','Gr.':'Graduate'}[v]||v||'Year TBA');
const prettyPos=v=>({'GUARD':'Guard','FORWARD':'Forward','CENTER':'Center','G':'Guard','F':'Forward','C':'Center'}[v]||v||'Position TBA');
async function render(teamId){
 const host=document.getElementById('wbb-roster-host');if(!host)return;
 host.innerHTML='<p class="wbb-muted">Loading 2026–27 women’s roster…</p>';
 try{
  const res=await fetch('data/ncaaw-rosters-2026-27.json',{cache:'no-cache'});
  if(!res.ok)throw Error('Roster file unavailable ('+res.status+')');
  const data=await res.json();
  if(data.gender!=='women'||data.season!=='2026-27')throw Error('Women’s season validation failed');
  const group=data.teams?.[String(teamId)];
  if(!group?.players?.length){
   host.innerHTML='<p class="wbb-roster-empty">This school’s 2026–27 women’s roster is not yet present in the published verified-source dataset. We will not display an earlier season or the men’s roster in its place.</p>';
   return;
  }
  const players=group.players.filter(p=>p.name&&safe(p.profile_url));
  if(!players.length)throw Error('No school-linked roster profiles');
  const source=safe(data.source_url);
  host.innerHTML='<div class="wbb-roster-intro"><span class="wbb-roster-count">'+players.length+' players</span><span>2026–27 women’s basketball</span><a href="'+esc(source)+'" target="_blank" rel="noopener noreferrer">Roster data &amp; attribution ↗</a></div>'+
   '<div class="wbb-roster-controls"><label>Find a player<input id="wbb-roster-search" type="search" placeholder="Search by name or hometown" autocomplete="off"></label><label>Position<select id="wbb-roster-filter"><option value="">All positions</option><option value="Guard">Guards</option><option value="Forward">Forwards</option><option value="Center">Centers</option></select></label></div>'+
   '<div id="wbb-roster-grid" class="wbb-roster-grid"></div><p class="wbb-roster-source">Names and details come from the 2026–27 school-site roster compilation by the University of Maryland’s Sports Roster Data project. Click a player for their university profile. School rosters may change; independent school-by-school certification is ongoing.</p>'+
   '<div class="wbb-leaders-note"><strong>2026–27 Player Leaders</strong><p>Points, rebounds, assists and shooting leaders will appear when verified women’s season statistics are published. No men’s or prior-season numbers are substituted.</p></div>';
  const grid=host.querySelector('#wbb-roster-grid');
  const draw=()=>{
   const q=(host.querySelector('#wbb-roster-search').value||'').toLowerCase().trim(),f=host.querySelector('#wbb-roster-filter').value;
   const subset=players.filter(p=>(!q||(p.name+' '+p.hometown+' '+p.number).toLowerCase().includes(q))&&(!f||prettyPos(p.position).includes(f)));
   grid.innerHTML=subset.length?subset.map(p=>{
    const url=safe(p.profile_url),n=p.number?('#'+esc(p.number)):'No. —',meta=[prettyPos(p.position),prettyClass(p.class),p.height].filter(Boolean).map(esc).join(' · ');
    return '<article class="wbb-player-card"><div class="wbb-player-avatar" aria-hidden="true">'+esc(nameInitials(p.name))+'</div><div class="wbb-player-body"><span class="wbb-player-number">'+n+'</span><a class="wbb-player-name" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(p.name)+' ↗</a><span class="wbb-player-meta">'+meta+'</span><span class="wbb-player-hometown">'+esc(p.hometown||'')+'</span></div></article>';
   }).join(''):'<p class="wbb-roster-empty">No players match this filter.</p>';
  };
  host.querySelector('#wbb-roster-search').addEventListener('input',draw);
  host.querySelector('#wbb-roster-filter').addEventListener('change',draw);
  draw();
 }catch(e){host.innerHTML='<p class="wbb-roster-empty">Roster data could not load. '+esc(e.message)+'. Other team information remains available.</p>';}
}
w.WBBRosterDesk={render};
})(window);
