/* The Sporting Life & Times | live, source-backed basketball slate.
   Retro remains 1500-reset, team-only, and never receives exhibition results.
   Pure transforms are exported for lightweight CI checks. */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof document!=='undefined')api.start();
})(typeof globalThis==='undefined'?this:globalThis,function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isoDate=v=>{const d=new Date(v);return Number.isFinite(+d)?new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(d):''};
const today=()=>isoDate(Date.now());
const dateLabel=s=>{const d=new Date(s+'T12:00:00Z');return Number.isFinite(+d)?new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(d):s};
const shift=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const cleanId=x=>String(x||'').replace(/^espn:/,'');
const validId=x=>/^\d{1,12}$/.test(String(x||''));
const shortName=(id,cross,full)=>{const canon=cross.get(String(id));if(canon)return canon.name;return String(full||'Team').trim()};
const gameKey=(id,day)=>String(id||'')+'|'+String(day||'');
function certifiedSite(g,sites){
  const proof=sites?.games?.[String(g.id)];
  if(!proof||proof.site_verified!==true||proof.neutral!==true||
     proof.date!==g.day||String(proof.away_id)!==String(g.away?.id)||
     String(proof.home_id)!==String(g.home?.id)||
     !/^https:\/\/[^\s"'<>]+$/.test(String(proof.source||''))||
     !String(proof.venue||'').trim())return g;
  return {...g,venue:String(proof.venue).trim(),
    venueCity:[proof.city,proof.state].filter(Boolean).join(', '),
    neutral:true,siteEvent:proof.event||'',siteSource:proof.source,
     probability:g.phase==='upcoming'?null:g.probability};
}
function normalizeMen(feed,forecasts,crossList,sites){
  const cross=new Map((crossList?.teams||[]).map(t=>[String(t.espn_id),t]));
  const canon=new Map((crossList?.teams||[]).map(t=>[String(t.id),t]));
  const result=new Map();
  for(const g of feed?.games||[]){
    const teams=g.teams||[];if(teams.length!==2)continue;
    const day=isoDate(g.date);if(!day||!validId(g.id))continue;
    const away=teams[0],home=teams[1];
    const phase=g.state==='in'?'live':g.state==='post'?'final':'upcoming';
    const score=n=>phase!=='upcoming'&&n!==''&&n!=null&&Number.isFinite(Number(n))?Number(n):null;
    result.set(cleanId(g.id),{id:cleanId(g.id),day,date:g.date,phase,
      away:{id:String(away.id),name:shortName(away.id,cross,away.name),full:away.name,canonical:cross.get(String(away.id))?.id||'',score:score(away.score)},
      home:{id:String(home.id),name:shortName(home.id,cross,home.name),full:home.name,canonical:cross.get(String(home.id))?.id||'',score:score(home.score)},
      status:g.status||'',venue:g.venue||'',broadcast:g.broadcast||'',neutral:g.neutral===true||g.neutralSite===true,
      source:g.score_source||'Current sourced scoreboard',evidence:g.score_source?'final-source':'reported',
      timed:true,kind:'regular',probability:null});
  }
  for(const g of forecasts?.games||[]){
    if(!/^2026-\d\d-\d\d$/.test(g.date||''))continue;
    const id=cleanId(g.id),away=canon.get(String(g.away_id)),home=canon.get(String(g.home_id));
    if(!away||!home||!validId(id))continue;
    let current=result.get(id);
    if(current){
      if(current.phase==='upcoming'&&current.away.id===String(away.espn_id)&&current.home.id===String(home.espn_id)&&
         current.day===g.date&&Number.isFinite(Number(g.home_win_probability)))
        current.probability=Math.max(0,Math.min(1,Number(g.home_win_probability)));
      continue;
    }
    result.set(id,{id,day:g.date,date:'',phase:'upcoming',timed:false,
      away:{id:String(away.espn_id),name:away.name,full:away.espn_name,canonical:away.id,score:null},
      home:{id:String(home.espn_id),name:home.name,full:home.espn_name,canonical:home.id,score:null},
      venue:'',broadcast:'',status:'Tipoff unconfirmed',source:'Independent 2026–27 fixture ledger',
      evidence:'fixture',kind:'regular',
      probability:Number.isFinite(Number(g.home_win_probability))?Math.max(0,Math.min(1,Number(g.home_win_probability))):null});
  }
  return dedupeFixtures([...result.values()]).map(g=>certifiedSite(g,sites));
}
// Merge provisional fixtures only when the same two canonical schools meet on the
// same Eastern date. Preserve distinct live/final event IDs and real doubleheaders.
function dedupeFixtures(games){
 const chosen=[],lookup=new Map();
 const pairKey=g=>{
  if(g.kind!=='regular'||!g.day||!g.away?.canonical||!g.home?.canonical)return '';
  return g.day+'|'+[String(g.away.canonical),String(g.home.canonical)].sort().join('|');
 };
 const quality=g=>(g.phase==='final'?100:g.phase==='live'?90:0)+
   (g.timed&&g.date?20:0)+(g.venue?4:0)+(g.broadcast?2:0)+(g.evidence==='final-source'?3:0);
 for(const g of games){
  const key=pairKey(g);
  if(!key){chosen.push(g);continue;}
  const indices=lookup.get(key)||[];
  const duplicate=indices.find(i=>{
   const old=chosen[i];
   // Never remove two independently reported played games.
   if(old.phase!=='upcoming'&&g.phase!=='upcoming')return false;
   // Distinct scheduled tipoffs can be legitimate doubleheaders.
   if(old.timed&&g.timed&&old.date&&g.date&&
      Math.abs(new Date(old.date)-new Date(g.date))>30*60*1000)return false;
   return true;
  });
  if(duplicate===undefined){lookup.set(key,[...indices,chosen.length]);chosen.push(g);}
  else if(quality(g)>quality(chosen[duplicate]))chosen[duplicate]=g;
 }
 return chosen;
}
function normalizeWomen(rows,rankings,crossList){
  const cross=new Map((crossList?.teams||[]).map(t=>[String(t.espn_id),t]));
  const rating=new Map((rankings?.rankings||[]).map(t=>[String(t.team_id),t]));
  return [...(rows?.finals||[]),...(rows?.upcoming||[])].flatMap(g=>{
    if(!g||!validId(g.away_id)||!validId(g.home_id))return[];
    const day=isoDate(g.date);if(!day)return[];
    const a=String(g.away_id),h=String(g.home_id),final=g.status==='final';
    const mk=(id,points)=>({id,name:cross.get(id)?.name||rating.get(id)?.team||'Team '+id,
       full:rating.get(id)?.team||cross.get(id)?.espn_name||'Team '+id,
       canonical:id,score:final&&Number.isFinite(Number(points))?Number(points):null});
    return[{id:cleanId(g.id),day,date:g.date,phase:final?'final':'upcoming',timed:true,
      away:mk(a,g.away_score),home:mk(h,g.home_score),venue:g.venue||'',broadcast:g.broadcast||'',
      status:final?'Final':'Scheduled',source:rows.source||'Women’s published game ledger',
      evidence:g.score_evidence||'reported',kind:'regular',probability:null}];
  });
}
function normalizeExhibitions(data,crossList){
  const cross=new Map((crossList?.teams||[]).map(t=>[String(t.espn_id),t]));
  if(data?.retro_included!==false)return[];
  return (data.games||[]).flatMap((g,i)=>{
    if(!g||g.verified!==true||g.counts_for_retro!==false||g.classification!=='exhibition')return[];
    const away=cross.get(String(g.away_espn_id)),home=cross.get(String(g.home_espn_id));
    if(!away||!home||!g.date)return[];
    return[{id:'exh-'+String(i)+'-'+g.date,day:g.date,date:'',timed:false,phase:'final',kind:'exhibition',
      away:{id:String(away.espn_id),canonical:away.id,name:away.name,full:away.espn_name,score:Number(g.away_score)},
      home:{id:String(home.espn_id),canonical:home.id,name:home.name,full:home.espn_name,score:Number(g.home_score)},
      venue:'',broadcast:'',status:'Exhibition final',
      source:g.verification_note||'Published exhibition result',sourceURL:g.source_url||'',
      evidence:g.source_tier==='independent_secondary'?'secondary':'official',
      probability:null}];
  });
}
function gameDetailsHref(g,women){
  if(g.kind==='exhibition')return g.sourceURL||'#';
  if(!validId(g.id))return '#';
  return 'cbb-gamefile.html?'+(women?'gender=women&':'')+
    'day='+encodeURIComponent(g.day)+'&game='+encodeURIComponent(g.id);
}
const formatClock=g=>{
  if(g.phase==='live')return String(g.status||'LIVE').replace(/^\d+\/\d+\s*-\s*/,'');
  if(g.phase==='final')return 'FINAL';
  if(!g.timed||!g.date)return 'TIPOFF TBA';
  const d=new Date(g.date);
  return Number.isFinite(+d)?new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(d):'TIPOFF TBA';
};
function rankingsMap(rows){return new Map((rows?.rankings||[]).map(t=>[String(t.team_id),t]))}
const rankOf=(side,ratings,women)=>{
  if(!side)return null;
  return ratings.get(String(side.canonical||side.id))||null;
};
function selectGames(all,day,view,query,followed){
  const q=String(query||'').toLowerCase().trim();
  return all.filter(g=>g.day===day&&(
    view==='all'||(view==='favorites'&&(followed?.has(g.away.id)||followed?.has(g.home.id)))||
    (view==='live'&&g.phase==='live')||(view==='final'&&g.phase==='final'&&g.kind!=='exhibition')||
    (view==='upcoming'&&g.phase==='upcoming')||(view==='exhibition'&&g.kind==='exhibition')
  )&&(!q||[g.away.name,g.away.full,g.home.name,g.home.full].some(t=>String(t||'').toLowerCase().includes(q))))
  .sort((a,b)=>{const p=g=>g.phase==='live'?0:g.phase==='upcoming'?1:g.phase==='final'?2:3;
    const certified=g=>Number(Boolean(g.away.canonical))+Number(Boolean(g.home.canonical));
    return p(a)-p(b)||certified(b)-certified(a)||
      (a.date||'').localeCompare(b.date||'')||a.away.name.localeCompare(b.away.name)});
}
function start(){
const root=document.getElementById('slate-root');if(!root)return;
const url=new URL(location.href),women=url.searchParams.get('gender')==='women';
let selected=/^\d{4}-\d\d-\d\d$/.test(url.searchParams.get('date')||'')?url.searchParams.get('date'):today();
let filter=['all','live','final','upcoming','exhibition','favorites'].includes(url.searchParams.get('view'))?url.searchParams.get('view'):'all';
let search='',loaded=[],ratings=new Map(),lastUpdate='',limit=18,loading=false,sourceError='';
let cross={teams:[]},palette={},arenaRegistry={},womenTeams=new Map(),sourceFeed=null,seasonStats=new Map(),liveChanges=new Map(),scoreCalibration=null;
const insight=window.SLTBasketballInsights;
const favoriteKey='slt-slate-favorites-'+(women?'women':'men');
let followed=new Set();
try{followed=new Set(JSON.parse(localStorage.getItem(favoriteKey)||'[]').map(String))}catch{}
// Large source-backed identity and arena references remain stable during a
// page session; do not re-download them on every 90-second scoreboard tick.
const staticData=new Map();
const staticPaths=new Set(['data/ncaam-2026-27-espn-team-crosswalk.json',
  'data/dual-ring-team-palette.json','data/mbb-arena-registry.json','data/mbb-verified-game-sites-2026-27.json']);
const fetchJSON=async path=>{
 if(staticPaths.has(path)&&staticData.has(path))return staticData.get(path);
 const c=new AbortController(),tm=setTimeout(()=>c.abort(),14000);
 try{const r=await fetch(path,{cache:staticPaths.has(path)?'default':'no-store',signal:c.signal});
  if(!r.ok)throw Error('HTTP '+r.status);
  const data=await r.json();
  if(staticPaths.has(path))staticData.set(path,data);
  return data;
 }finally{clearTimeout(tm)}
};
const saveURL=()=>{const u=new URL(location.href);u.searchParams.set('date',selected);if(filter==='all')u.searchParams.delete('view');else u.searchParams.set('view',filter);history.replaceState({},'',u.pathname+u.search+u.hash)};
const brand=t=>{if(!t)return '#133a48';const p=palette[String(t.id)];const c=p?.primary||'#234b62';return /^#[0-9a-f]{6}$/i.test(c)?c:'#234b62'};
const secondary=t=>{const c=palette[String(t?.id)]?.secondary||'#b49864';
  return /^#[0-9a-f]{6}$/i.test(c)&&c.toLowerCase()!=='#ffffff'?c:'#b49864'};
// Contrast-safe star ink: retain school color, brighten its tint only as needed.
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const hex=a=>'#'+a.map(n=>Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,'0')).join('');
const mix=(a,b,p)=>hex(rgb(a).map((v,i)=>v*(1-p)+rgb(b)[i]*p));
const luminance=h=>{const v=rgb(h).map(x=>{x/=255;return x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4});return .2126*v[0]+.7152*v[1]+.0722*v[2]};
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const starInk=t=>{
 const accent=secondary(t),base=brand(t),background=mix(base,'#152630',.32);
 // Mirror the darkest pennant gradient stop; account for the shadowed backdrop.
 const dark=mix(base,'#101f2a',.32);
 for(let tint=0;tint<=1.001;tint+=.05){
  const proposed=mix(accent,'#ffffff',tint);
  if(Math.min(contrast(proposed,background),contrast(proposed,dark))>=4.5)return proposed;
 }
 return mix(accent,'#ffffff',.95);
};
const mascot=t=>{const full=String(t?.full||'').trim(),school=String(t?.name||'').trim();
  if(!full||!school)return '';
  const canonical=cross?.teams?.find(x=>String(x.espn_id)===String(t?.id));
  const verified=String(canonical?.espn_name||full);
  const variants=[school,school.replace(/\s*\([^)]*\)/g,''),
    school.replace(/\bSt\.?(?=\s|$)/g,'State'),
    school.replace(/\bTenn\.?(?=\s|$)/g,'Tennessee')];
  let label='';
  for(const name of variants){
    if(verified.toLowerCase().startsWith(name.toLowerCase())){
      label=verified.slice(name.length).trim().replace(/^University\s+/i,'');
      if(label)break;
    }
  }
  // The full verified provider team display name is the fallback, not a
  // guessed first-letter code or an invented mascot designation.
  if(!label&&verified!==school){
    const suffix=verified.trim().split(/\s+/).at(-1)||'';
    if(suffix&&suffix.toLowerCase()!==school.toLowerCase())label=suffix;
  }
  return label&&label.length<=35?label:'';
};
const teamPage=t=>women?
  (validId(t?.id)?'ncaaw-team.html?team='+encodeURIComponent(t.id):''):
  (String(t?.canonical||'').startsWith('ncaa:')?'ncaam-team.html?team='+encodeURIComponent(t.id):'');

/* One authentic, restrained SLT game card. No imaginary arena, title marks or empty stats. */
const emblem=t=>{
 if(window.MBBLogos?.byESPN){try{return window.MBBLogos.byESPN(t.id,'featured',t.name)}catch{}}
 return '<span class="sl-emblem" style="--ring1:'+brand(t)+';--ring2:'+secondary(t)+'"><span>'+
   esc(t.name.slice(0,2))+'</span></span>';
};
const favorite=t=>'<button type="button" class="sl-follow'+(followed.has(t.id)?' is-followed':'')+
 '" data-follow="'+esc(t.id)+'" aria-pressed="'+followed.has(t.id)+'">'+
 (followed.has(t.id)?'✓ Following':'Follow '+esc(t.name))+'</button>';
const bugTeam=(t,side,g)=>{
 const label='<span class="sl-bug-logo">'+emblem(t)+'</span><strong>'+esc(t.name)+'</strong>';
 const href=teamPage(t);
 return '<div class="sl-bug-team" data-side="'+side+'" style="--team-color:'+brand(t)+'">'+
  (href?'<a class="sl-bug-name" href="'+esc(href)+'">'+label+'</a>':'<span class="sl-bug-name">'+label+'</span>')+
  '<b class="sl-bug-score">'+(g.phase==='upcoming'||t.score==null||!Number.isFinite(+t.score)?'—':Number(t.score))+'</b></div>';
};
function card(g,featured){
 const href=gameDetailsHref(g,women),ex=g.kind==='exhibition',site=String(g.venue||'').trim();
 const broadcast=String(g.broadcast||'').trim(),phase=g.phase==='live'?'LIVE':g.phase==='final'?'FINAL':'UPCOMING';
 const source=String(g.source||'Unspecified');
 return '<article class="sl-game sl-courtside-card" style="--sl-away:'+brand(g.away)+';--sl-home:'+brand(g.home)+'">'+
 '<div class="sl-bug-top"><b class="sl-bug-mark">SLT</b>'+
 '<span class="sl-bug-phase sl-bug-phase-'+g.phase+'">'+phase+'</span>'+
 '<span class="sl-bug-clock">'+esc(formatClock(g))+'</span>'+
 (broadcast?'<span class="sl-bug-network">'+esc(broadcast)+'</span>':'')+
 '<small class="sl-bug-division">'+(women?'WOMEN':'MEN')+' · D-I</small></div>'+
 '<div class="sl-bug-pair">'+bugTeam(g.away,'away',g)+bugTeam(g.home,'home',g)+'</div>'+
 (site?'<p class="sl-bug-site">'+(g.neutral?'NEUTRAL SITE · ':'VENUE · ')+esc(site)+
 (g.venueCity?' · '+esc(g.venueCity):'')+'</p>':
 g.neutral?'<p class="sl-bug-site">NEUTRAL SITE · VENUE NOT VERIFIED</p>':'')+
 '<div class="sl-bug-footer"><details class="sl-bug-follows"><summary>Follow teams</summary><div>'+
 favorite(g.away)+favorite(g.home)+'</div></details>'+
 '<span class="sl-bug-source" title="'+esc(source)+'">SOURCE · '+esc(source)+'</span>'+
 '<a class="sl-bug-open" href="'+esc(href)+'"'+(ex?' target="_blank" rel="noopener noreferrer"':'')+'>'+
 (ex?'VIEW SOURCE':g.phase==='live'?'FOLLOW COURTCAST':'OPEN GAMEFILE')+' →</a></div></article>';
}
const render=()=>{
 const games=selectGames(loaded,selected,filter,search,followed),shown=games.slice(0,limit);
 document.getElementById('sl-date').textContent=dateLabel(selected);
 document.getElementById('sl-count').textContent=games.length+' '+(games.length===1?'game':'games');
 document.getElementById('sl-data').textContent=lastUpdate?'Updated '+lastUpdate:'Checking game data…';
 for(const b of document.querySelectorAll('[data-filter]')){const active=b.dataset.filter===filter;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));}
 const empty=sourceError?'<div class="sl-empty"><strong>Data source unavailable.</strong><p>'+esc(sourceError)+'</p><button type="button" id="sl-retry">Retry connection</button></div>':
 '<div class="sl-empty"><strong>No games match this view.</strong><p>Change the date or filter. Only source-backed fixtures are shown.</p></div>';
 const phaseLabel={live:'ON THE FLOOR',upcoming:'COMING UP',final:'FINAL SCORES'};
 const grouped=filter==='all'?['live','upcoming','final'].map(phase=>{
   const rows=shown.filter(g=>g.phase===phase);
   return rows.length?'<section class="sl-game-section" data-slate-phase="'+phase+'">'+
    '<div class="sl-game-section-head"><h3>'+phaseLabel[phase]+'</h3><span>'+rows.length+
    ' '+(rows.length===1?'GAME':'GAMES')+'</span></div>'+
    '<div class="sl-game-section-cards">'+rows.map(g=>card(g,shown.indexOf(g)===0)).join('')+'</div></section>':'';
 }).join(''):shown.map((g,i)=>card(g,i===0)).join('');
 document.getElementById('sl-games').innerHTML=shown.length?grouped:empty;
 document.getElementById('sl-more').hidden=games.length<=shown.length;
 document.getElementById('sl-more').textContent='Show more games ('+(games.length-shown.length)+' remaining)';
 document.getElementById('sl-coverage').textContent=women?
  'Women’s coverage follows the published rolling scoreboard and independent women’s RETRO ratings.':
  'Men’s coverage combines the published scoreboard, verified fixtures and independent 1500-reset RETRO. Exhibitions are excluded from Elo.';
 saveURL();
};
async function refresh(){
 if(loading)return;loading=true;const status=document.getElementById('sl-data');status.textContent='Refreshing verified sources…';
 try{
  const menFiles=['data/mbb-live.json','data/ncaam-2026-27-upcoming-forecasts.json','data/ncaam-2026-27-retro-primary.json','data/ncaam-2026-27-espn-team-crosswalk.json','data/dual-ring-team-palette.json','data/mbb-exhibition-finals-2026-27.json','data/mbb-arena-registry.json','data/ncaam-score-calibration.json','data/mbb-verified-game-sites-2026-27.json'];
  const womenFiles=['data/ncaaw-2026-27-games.json','data/ncaaw-2026-27-retro-primary.json','data/ncaam-2026-27-espn-team-crosswalk.json','data/dual-ring-team-palette.json','data/ncaaw-2026-27-teams.json','data/mbb-live.json'];
  const paths=women?womenFiles:menFiles;
  const output=await Promise.all(paths.map(p=>fetchJSON(p).catch(()=>null)));
  if(women){
    const [results,rank,c,pal,wTeams,feed]=output;
    if(!results||rank?.gender!=='women'||rank.starting_elo!==1500)throw Error('Women’s game or rating data unavailable');
    cross=c||{teams:[]};ratings=rankingsMap(rank);palette=pal?.wbb||pal?.mbb||{};
    womenTeams=new Map((wTeams?.teams||[]).map(t=>[String(t.team_id),t]));
    sourceFeed=feed||null;seasonStats=insight?.seasonProfiles(rank.events)||new Map();
    loaded=dedupeFixtures(normalizeWomen(results,rank,cross));
    lastUpdate='women’s rolling fixture ledger';
  }else{
    const [feed,forecast,rank,c,pal,ex,arenas,calibration,verifiedSites]=output;
    if(!feed||rank?.model!=='retro-clean-slate'||rank.starting_elo!==1500||rank.rankings?.length!==365)
      throw Error('Men’s scoreboard or certified RETRO feed unavailable');
    cross=c||{teams:[]};ratings=rankingsMap(rank);palette=pal?.mbb||{};
    arenaRegistry=arenas?.teams||{};scoreCalibration=calibration;
    const before=new Map(loaded.filter(g=>g.phase==='live'&&g.kind==='regular').map(g=>
      [g.id,{id:g.id,day:g.day,away_score:g.away.score,home_score:g.home.score}]));
    sourceFeed=feed;seasonStats=insight?.seasonProfiles(rank.events)||new Map();
    loaded=[...normalizeMen(feed,forecast,cross,verifiedSites),...normalizeExhibitions(ex,cross)];
    liveChanges=new Map(loaded.filter(g=>g.phase==='live').flatMap(g=>{
      const delta=insight?.scoreDelta(before.get(g.id),g);
      return delta?[[g.id,delta]]:[];
    }));
    lastUpdate=feed.scores_updated_at?new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(feed.scores_updated_at)):'source refresh pending';
    await window.MBBLogos?.ready;
  }
  sourceError='';
 }catch(err){if(!loaded.length)sourceError=String(err.message||'Unable to retrieve fixtures');}
 finally{loading=false;render()}
}
document.getElementById('sl-prev').addEventListener('click',()=>{selected=shift(selected,-1);limit=18;render()});
document.getElementById('sl-next').addEventListener('click',()=>{selected=shift(selected,1);limit=18;render()});
document.getElementById('sl-picker').addEventListener('change',e=>{if(e.target.value){selected=e.target.value;limit=18;render()}});
document.getElementById('sl-search').addEventListener('input',e=>{search=e.target.value;limit=18;render()});
document.getElementById('sl-filters').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;filter=b.dataset.filter;limit=18;render()});
document.getElementById('sl-more').addEventListener('click',()=>{limit+=18;render()});
document.getElementById('sl-reload').addEventListener('click',refresh);
document.getElementById('sl-games').addEventListener('click',e=>{
 const b=e.target.closest('[data-follow]');if(b){const id=b.dataset.follow;
   followed.has(id)?followed.delete(id):followed.add(id);
   try{localStorage.setItem(favoriteKey,JSON.stringify([...followed]))}catch{}
   render();return}
 if(e.target.id==='sl-retry')refresh();
});
document.getElementById('sl-picker').value=selected;
const originalRender=render;
const refreshPicker=()=>{document.getElementById('sl-picker').value=selected};
const changeObserver=new MutationObserver(refreshPicker);changeObserver.observe(document.getElementById('sl-date'),{childList:true});
document.title=(women?'Women’s':'Men’s')+' College Basketball Games | The Sporting Life & Times';
document.getElementById('sl-women').classList.toggle('is-active',women);
document.getElementById('sl-men').classList.toggle('is-active',!women);
if(women)document.getElementById('sl-filter-exhibitions').hidden=true;
refresh();setInterval(()=>{if(!document.hidden)refresh()},90000);
}
return{normalizeMen,normalizeWomen,normalizeExhibitions,selectGames,gameDetailsHref,formatClock,isoDate,shift,start};
});
