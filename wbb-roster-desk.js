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
function verifiedPortraits(data,players,teamId,identities){
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
  keyed.set(key,{photo:safe(a?.headshot?.href),id:a?.id});
 }
 const sourceCounts=new Map();
 for(const key of rosterKeys)sourceCounts.set(key,(sourceCounts.get(key)||0)+1);
 for(let i=0;i<players.length;i++){
  const key=rosterKeys[i];
  if(count.get(key)!==1||sourceCounts.get(key)!==1||!keyed.get(key))continue;
  const {photo,id}=keyed.get(key);
  if(photo)answer.set(key,photo);
  if(/^\d+$/.test(String(id||'')))identities?.set(key,id);
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
 const options=values=>[...new Set(values.filter(Boolean))].sort().map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('');
 host.innerHTML='<div class="wbb-roster-intro"><span class="wbb-roster-count">'+players.length+' rostered players</span>'+
  (source?'<a href="'+esc(source)+'" target="_blank" rel="noopener noreferrer">'+(official?'Official university roster ↗':'Roster source ↗')+'</a>':'')+'</div>'+
  '<div class="mbb-production-filters"><label>Find a player <input type="search" class="input" data-roster-search placeholder="Search by name or hometown"></label>'+
  '<label>Position <select data-roster-position><option value="">All positions</option>'+options(players.map(p=>prettyPos(p.position)))+'</select></label>'+
  '<label>Class <select data-roster-year><option value="">All classes</option>'+options(players.map(p=>prettyClass(p.class)))+'</select></label></div>'+
  '<div id="team-player-production-table"></div><p class="wbb-roster-source victorian-production-source" data-production-note></p>';
 const tableHost=host.querySelector('#team-player-production-table');
 const note=host.querySelector('[data-production-note]');
 const search=host.querySelector('[data-roster-search]');
 const position=host.querySelector('[data-roster-position]');
 const year=host.querySelector('[data-roster-year]');
 let photos=new Map(),statRows=[];
 const identities=new Map();
 const columns=[['Player','name'],['GP','games'],['PPG','pts'],['RPG','reb'],['APG','ast'],['SPG','stl'],['BPG','blk'],['FG%','fg'],['TS%','ts']];
 const value=(stats,key)=>{
  const pairs=stats?.stats||[];
  const names={games:['GP'],pts:['PPG','PTS'],reb:['RPG','REB'],ast:['APG','AST'],stl:['SPG','STL'],blk:['BPG','BLK'],fg:['FG%'],ts:['TS%']};
  const item=pairs.find(([label])=>(names[key]||[]).includes(label));
  return item?.[1]??'—';
 };
 const draw=()=>{
  const query=search.value.trim().toLowerCase();
  const rows=w.SLTCBBRosterProduction.join(players,statRows).filter(({player,stats})=>{
   const name=player?.name||stats?.name||'';
   return [name,player?.hometown,player?.number].join(' ').toLowerCase().includes(query)&&
    (!position.value||(player&&prettyPos(player.position)===position.value))&&
    (!year.value||(player&&prettyClass(player.class)===year.value));
  });
  const previous=tableHost.querySelector('table');
  const sortKey=previous?.dataset.sortKey||'pts',sortDir=previous?.dataset.sortDir||'desc';
  const records=rows.map(({player,stats})=>{
   const name=player?.name||stats?.name||'';
   const key=normalName(name)+'|'+jersey(player?.number);
   const rosterId=player?identities.get(key):null,statsId=stats?.athleteId;
   const athleteId=rosterId&&statsId&&String(rosterId)!==String(statsId)?null:rosterId||statsId;
   const profile=w.SLTCBBRosterProduction.profileHref(athleteId,name,'women',teamId);
   const photo=player?photos.get(key):'';
   const initials=nameInitials(name);
   const details=player?[player.number!=null&&player.number!==''?'#'+player.number:'',prettyPos(player.position),prettyClass(player.class)].filter(Boolean).join(' · '):'Roster unconfirmed';
   const link=profile?'<a class="slt-player-profile-link" href="'+esc(profile)+'">'+esc(name)+'</a>':esc(name);
   const playerHTML='<div class="mbb-production-player"><span class="mbb-player-image-wrap">'+
    (photo?'<img class="mbb-player-photo" loading="lazy" decoding="async" src="'+esc(photo)+'" alt="">':'')+
    '<span class="mbb-photo-missing" aria-hidden="true">'+esc(initials)+'</span></span>'+
    '<span><strong>'+link+'</strong><small>'+esc(details)+'</small></span></div>';
   return {name,playerHTML,values:columns.slice(1).map(([,k])=>value(stats,k))};
  });
  const index=columns.findIndex(([,k])=>k===sortKey);
  records.sort((a,b)=>{
   if(index===0)return (sortDir==='asc'?1:-1)*a.name.localeCompare(b.name);
   const va=Number(a.values[index-1]),vb=Number(b.values[index-1]);
   const fa=a.values[index-1]!=='—'&&Number.isFinite(va),fb=b.values[index-1]!=='—'&&Number.isFinite(vb);
   if(!fa&&!fb)return a.name.localeCompare(b.name);
   if(!fa)return 1;if(!fb)return -1;
   return (sortDir==='asc'?1:-1)*(va-vb)||a.name.localeCompare(b.name);
  });
  const mobile='<label class="slt-mobile-production-tools">Sort players <select class="slt-mobile-production-sort" aria-label="Sort player production">'+columns.map(([label,k])=>'<option value="'+k+'"'+(k===sortKey?' selected':'')+'>'+esc(label)+'</option>').join('')+'</select></label>';
  tableHost.innerHTML=records.length?mobile+'<div class="table-wrap roster-table-wrap"><table class="slt-sortable-production" data-sort-key="'+sortKey+'" data-sort-dir="'+sortDir+'"><thead><tr>'+
   columns.map(([label,k])=>'<th scope="col" aria-sort="'+(k===sortKey?(sortDir==='asc'?'ascending':'descending'):'none')+'"><button type="button" class="slt-sort-heading" data-sort="'+k+'">'+label+' <span class="slt-sort-arrow" aria-hidden="true">'+(k===sortKey?(sortDir==='asc'?'↑':'↓'):'↕')+'</span></button></th>').join('')+
   '</tr></thead><tbody>'+records.map(r=>'<tr><td data-label="Player">'+r.playerHTML+'</td>'+r.values.map((v,i)=>'<td data-label="'+columns[i+1][0]+'">'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':
   '<p class="wbb-roster-empty">'+(players.length||statRows.length?'No players match this filter.':'Current-season roster and player statistics are unavailable.')+'</p>';
  tableHost.querySelectorAll('.mbb-player-photo').forEach(img=>img.addEventListener('error',()=>img.remove()));
 };
 for(const field of [search,position,year])field.addEventListener(field===search?'input':'change',draw);
 tableHost.addEventListener('click',event=>{
  const button=event.target.closest('.slt-sort-heading');if(!button)return;
  const table=tableHost.querySelector('table'),key=button.dataset.sort;
  table.dataset.sortDir=table.dataset.sortKey===key&&table.dataset.sortDir==='desc'?'asc':'desc';
  table.dataset.sortKey=key;draw();
 });
 tableHost.addEventListener('change',event=>{
  if(!event.target.matches('.slt-mobile-production-sort'))return;
  const table=tableHost.querySelector('table');table.dataset.sortKey=event.target.value;table.dataset.sortDir=event.target.value==='name'?'asc':'desc';draw();
 });
 note.textContent='Loading current-season player statistics…';draw();
 Promise.resolve(production).then(data=>{
  if(!host.isConnected)return;
  statRows=data?.players||[];
  note.innerHTML=(players.length?'':'Verified roster unavailable. ')+
   (statRows.length?'2026–27 season averages · Dashes indicate unavailable statistics. '+(safe(data.url)?'<a href="'+esc(safe(data.url))+'" target="_blank" rel="noopener noreferrer">Statistics source ↗</a>':''):'Current-season player statistics are unavailable.');
  draw();
 });
 if(!players.length)return;
 try{
  const response=await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/teams/'+encodeURIComponent(teamId)+'/roster',{signal:AbortSignal.timeout(8000)});
  if(!response.ok||!host.isConnected)return;
  photos=verifiedPortraits(await response.json(),players,teamId,identities);
  if(photos.size||identities.size)draw();
 }catch{}
}
w.WBBRosterDesk={render,verifiedPortraits};
})(window);
