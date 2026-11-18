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
async function loadRoster(teamId){
 const [data,supplement]=await Promise.all([
  fetch('data/ncaaw-rosters-2026-27.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null),
  fetch('data/ncaaw-rosters-official-supplement-2026-27.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null)
 ]);
 const valid=source=>source?.gender==='women'&&source.season==='2026-27';
 const official=valid(supplement)?supplement.teams?.[String(teamId)]:null;
 const group=official||(valid(data)?data.teams?.[String(teamId)]:null);
 return {official,source:safe(group?.source_url||data?.source_url),players:(group?.players||[]).filter(p=>p?.name)};
}
async function render(teamId,production){
 const host=document.getElementById('wbb-roster-host');
 if(!host)return;
 host.innerHTML='<p class="wbb-muted">Loading 2026–27 roster and player statistics…</p>';
 const {official,source,players}=await loadRoster(teamId);
 if(!host.isConnected)return;
 host.innerHTML='<div class="wbb-roster-intro"><span class="wbb-roster-count">'+players.length+' rostered players</span>'+
  (source?'<a href="'+esc(source)+'" target="_blank" rel="noopener noreferrer">'+
   (official?'Official university roster ↗':'Roster data &amp; attribution ↗')+'</a>':'')+'</div>'+
  '<div class="wbb-roster-controls"><label>Find a player<input id="wbb-roster-search" type="search" placeholder="Search by name or hometown" autocomplete="off"></label><label>Position<select id="wbb-roster-filter"><option value="">All positions</option><option value="Guard">Guards</option><option value="Forward">Forwards</option><option value="Center">Centers</option></select></label></div>'+
  '<div id="wbb-roster-grid" class="wbb-roster-grid"></div>'+
  '<p class="wbb-roster-source" data-production-note></p>';
 const grid=host.querySelector('#wbb-roster-grid');
 const note=host.querySelector('[data-production-note]');
 let photos=new Map(),statRows=[];
 const draw=()=>{
  const query=host.querySelector('#wbb-roster-search').value.toLowerCase().trim();
  const position=host.querySelector('#wbb-roster-filter').value;
  const rows=window.SLTCBBRosterProduction.join(players,statRows).filter(({player,stats})=>{
   const name=player?.name||stats.name;
   return [name,player?.hometown,player?.number].join(' ').toLowerCase().includes(query)&&
    (!position||(player&&prettyPos(player.position).includes(position)));
  });
  grid.innerHTML=rows.length?rows.map(({player,stats})=>{
   const name=player?.name||stats.name;
   const profile=safe(player?.profile_url);
   const number=player?.number!=null&&player.number!==''?'#'+esc(player.number):'';
   const meta=player?[prettyPos(player.position),prettyClass(player.class),player.height].filter(Boolean).map(esc).join(' · '):'Roster unconfirmed';
   const photo=player?photos.get(normalName(name)+'|'+jersey(player.number)):'';
   const box=(stats?.stats||[['GP','—'],['PPG','—'],['RPG','—'],['APG','—'],['SPG','—'],['BPG','—'],['FG%','—']])
    .map(([label,value])=>esc(label)+' <strong>'+esc(value)+'</strong>').join(' · ');
   const title=profile?'<a class="wbb-player-name" href="'+esc(profile)+'" target="_blank" rel="noopener noreferrer">'+esc(name)+' ↗</a>':
    '<strong class="wbb-player-name">'+esc(name)+'</strong>';
   return '<article class="wbb-player-card"><div class="wbb-player-avatar'+(photo?' has-photo':'')+'" aria-hidden="true">'+
    '<span class="wbb-avatar-fallback">'+esc(nameInitials(name))+'</span>'+(photo?'<img src="'+esc(photo)+'" alt="" loading="lazy">':'')+
    '</div><div class="wbb-player-body">'+(number?'<span class="wbb-player-number">'+number+'</span>':'')+title+
    '<span class="wbb-player-meta">'+meta+'</span><span class="wbb-player-hometown">'+esc(player?.hometown||'')+
    '</span><span class="wbb-player-meta">'+box+'</span></div></article>';
  }).join(''):'<p class="wbb-roster-empty">'+(players.length||statRows.length?'No players match this filter.':'Current-season roster and player statistics are unavailable.')+'</p>';
  grid.querySelectorAll('.wbb-player-avatar img').forEach(img=>img.addEventListener('error',()=>img.remove()));
 };
 host.querySelector('#wbb-roster-search').addEventListener('input',draw);
 host.querySelector('#wbb-roster-filter').addEventListener('change',draw);
 note.textContent='Loading current-season player statistics…';
 draw();
 Promise.resolve(production).then(data=>{
  if(!host.isConnected)return;
  statRows=data?.players||[];
  note.innerHTML=(players.length?'':'Verified roster unavailable. ')+
   (statRows.length?'2026–27 season averages. Dashes indicate unavailable statistics. <a href="'+esc(safe(data.url))+
   '" target="_blank" rel="noopener noreferrer">Statistics source ↗</a>':'Current-season player statistics are unavailable.');
  draw();
 });
 if(!players.length)return;
 try{
  const response=await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/teams/'+
    encodeURIComponent(teamId)+'/roster',{signal:AbortSignal.timeout(8000)});
  if(!response.ok||!host.isConnected)return;
  photos=verifiedPortraits(await response.json(),players,teamId);
  if(photos.size)draw();
 }catch{} // Unmatched or unavailable photos use initials.
}
w.WBBRosterDesk={render,verifiedPortraits};
})(window);
