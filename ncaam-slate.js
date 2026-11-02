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
function normalizeMen(feed,forecasts,crossList){
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
      status:g.status||'',venue:g.venue||'',broadcast:g.broadcast||'',
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
  return [...result.values()];
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
let cross={teams:[]},palette={},arenaRegistry={};
const favoriteKey='slt-slate-favorites-'+(women?'women':'men');
let followed=new Set();
try{followed=new Set(JSON.parse(localStorage.getItem(favoriteKey)||'[]').map(String))}catch{}
// Large source-backed identity and arena references remain stable during a
// page session; do not re-download them on every 90-second scoreboard tick.
const staticData=new Map();
const staticPaths=new Set(['data/ncaam-2026-27-espn-team-crosswalk.json',
  'data/dual-ring-team-palette.json','data/mbb-arena-registry.json']);
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
const homeProfile=g=>{
  if(women||g.kind==='exhibition'||!g.home?.canonical)return null;
  const info=arenaRegistry[String(g.home.id)];
  const name=String(info?.home_arena||'').trim(),source=String(info?.home_arena_source||'');
  if(!name||!/^https:\/\/[^\s"'<>]+$/i.test(source))return null;
  return {name,source};
};
const tonal=(t)=>'--sl-tone:'+brand(t)+';--sl-highlight:'+secondary(t);
const metricValue=n=>Number.isFinite(Number(n))?String(Math.round(Number(n))):'—';
const pennant=t=>'<div class="sl-pennant" style="--pennant:'+brand(t)+';--pennant-accent:'+secondary(t)+'">'+
 '<span class="sl-pennant-rivet" aria-hidden="true"></span>'+
 '<span class="sl-pennant-brand">'+emblem(t)+'</span>'+
 '<span class="sl-pennant-name">'+esc(t.name)+'</span>'+
 '<strong class="sl-pennant-mascot">'+esc(mascot(t)||'BASKETBALL')+'</strong></div>';
const arenaStage=g=>{
  const profile=homeProfile(g),venue=String(g.venue||'').trim();
  const intro=venue?'GAME VENUE':profile?'THE HOME-COURT FILE':'THE MATCHUP FLOOR';
  const name=venue||profile?.name||'COLLEGE BASKETBALL';
  const source=venue?'SOURCED GAME LOCATION':profile?'SCHOOL ARENA REFERENCE · NOT A VERIFIED GAME SITE':'EDITORIAL COURT GRAPHIC';
  const link=profile&&!venue?'<a href="'+esc(profile.source)+'" target="_blank" rel="noopener noreferrer">Arena source ↗</a>':'';
  return '<div class="sl-arena-stage" aria-label="Team-color matchup pennants and documented arena context">'+
   '<div class="sl-arena-gallery"><div class="sl-arena-wordmark" aria-hidden="true">'+
   esc(mascot(g.home)||g.home.name)+'</div><div class="sl-stage-beam" aria-hidden="true"></div>'+
   '<div class="sl-pennant-row">'+pennant(g.away)+
   '<div class="sl-stage-mid" aria-hidden="true"><span>SL<span class="sl-mid-dot">•</span>T</span><small>MATCHUP</small></div>'+
   pennant(g.home)+'</div><div class="sl-floor-graphic" aria-hidden="true">'+
   '<span class="sl-floor-half"></span><span class="sl-floor-circle"></span><span class="sl-floor-key"></span></div></div>'+
   '<div class="sl-arena-caption"><div><small>'+esc(intro)+'</small><strong>'+esc(name)+'</strong>'+
   '<span>'+esc(source)+'</span></div>'+link+'</div></div>';
};
const emblem=t=>{
  if(!women&&window.MBBLogos?.byESPN)return window.MBBLogos.byESPN(t.id,'featured',t.name);
  const obj=rankings.get(String(t.id))||{},logo=String(obj.logo||'');
  const primary=brand(t),secondary=palette[String(t.id)]?.secondary||'#b39a65';
  const safe=/^https:\/\/[^\s"'<>]+$/i.test(logo)?logo:'';
  return '<span class="sl-emblem" style="--ring1:'+esc(primary)+';--ring2:'+esc(secondary)+'">'+
    (safe?'<img loading="lazy" decoding="async" src="'+esc(safe)+'" alt="">':
    '<span>'+esc(String(t.name).slice(0,2))+'</span>')+'</span>';
};
const rating=t=>{const r=rankOf(t,ratings,women);return r&&Number.isFinite(+r.elo)?Math.round(+r.elo):null};
const record=t=>{const r=rankOf(t,ratings,women);return r&&r.wins!=null&&r.losses!=null?Number(r.wins)+'–'+Number(r.losses):'0–0'};
const team=t=>{const profile=rankOf(t,ratings,women),url=teamPage(t);
 const body='<span class="sl-team">'+emblem(t)+'<span class="sl-team-copy"><strong>'+esc(t.name)+'</strong>'+
  '<small>'+esc(mascot(t)||'')+'</small>'+
  '<span class="sl-record">'+esc(record(t))+' <span aria-hidden="true">·</span> RETRO '+(rating(t)??'—')+'</span>'+
  (profile?.conference?'<span class="sl-conference">'+esc(profile.conference)+'</span>':'')+
  '</span></span>';
 return url?'<a class="sl-team-link" href="'+esc(url)+'" aria-label="Open '+esc(t.name)+' team page">'+body+'</a>':body;
};
const favorite=t=>'<button class="sl-follow'+(followed.has(t.id)?' is-followed':'')+'" type="button" data-follow="'+esc(t.id)+'" aria-pressed="'+followed.has(t.id)+'" title="'+(followed.has(t.id)?'Unfollow':'Follow')+' '+esc(t.name)+'">'+(followed.has(t.id)?'★':'☆')+'<span class="sr-only"> Follow '+esc(t.name)+'</span></button>';
const lens=g=>{
  const a=rating(g.away),h=rating(g.home),has=a!==null&&h!==null;
  if(g.kind==='exhibition')return ['Preseason ledger','This result does not affect regular-season records or RETRO ratings.'];
  if(g.phase==='live'&&g.home.score!==null&&g.away.score!==null){
    const diff=g.home.score-g.away.score,leader=diff>0?g.home.name:g.away.name;
    return [diff===0?'Level game':leader+' by '+Math.abs(diff),
      'Reported live score: '+g.away.score+'–'+g.home.score+'. Updates depend on the source feed.'];
  }
  if(g.phase==='final')return ['Final result','Reported score: '+g.away.score+'–'+g.home.score+'. See the Gamefile for available statistics.'];
  if(!has)return ['Matchup preview','RETRO information is not available for both teams.'];
  const leader=a>=h?g.away.name:g.home.name,diff=Math.abs(a-h);
  return [diff<=1?'An even RETRO matchup':leader+' enters '+Math.round(diff)+' Elo ahead',
    'Current independent 2026–27 ratings; both teams started at 1500.'];
};
const matchupStats=g=>{
 if(g.kind==='exhibition')return '<div class="sl-matchup-facts"><span>EXHIBITION</span><strong>NOT PART OF RETRO</strong></div>';
 const a=rankOf(g.away,ratings,women),h=rankOf(g.home,ratings,women);
 if(!a||!h)return '';
 const vA=rating(g.away),vH=rating(g.home);
 const delta=vA!==null&&vH!==null?Math.abs(vA-vH):null;
 const leader=delta===0?'LEVEL':vA>vH?g.away.name:g.home.name;
 const matchTotal=(Number(a.games_played)||0)+(Number(h.games_played)||0);
 return '<div class="sl-matchup-facts">'+
  '<span><small>USRS GAP</small><strong>'+(delta===null?'—':delta+' pts')+'</strong></span>'+
  '<span><small>RATING EDGE</small><strong>'+esc(leader)+'</strong></span>'+
  '<span><small>COMBINED FINALS</small><strong>'+matchTotal+'</strong></span></div>';
};
const meter=g=>{
  if(g.phase!=='upcoming'||!Number.isFinite(g.probability))return '';
  const home=Math.round(g.probability*100),away=100-home;
  return '<div class="sl-prob"><div class="sl-prob-caption"><span>'+esc(g.away.name)+' '+away+'%</span>'+
    '<b>USRS PREGAME</b><span>'+esc(g.home.name)+' '+home+'%</span></div>'+
    '<div class="sl-prob-track"><span style="width:'+away+'%;background:'+brand(g.away)+'"></span>'+
    '<span style="width:'+home+'%;background:'+brand(g.home)+'"></span></div></div>';
};
function card(g,featured){
 const pair=lens(g),href=gameDetailsHref(g,women);
 const isExternal=g.kind==='exhibition';
 const source=g.kind==='exhibition'?(g.evidence==='secondary'?'Published secondary result':'University / cited result'):
   g.phase==='final'?g.evidence==='final-source'?'Attributed final':'Reported final':
   g.phase==='live'?'Live scoreboard':'Sourced fixture + USRS';
 const score=g.phase==='upcoming'?'':(g.away.score===null||g.home.score===null?'SCORE PENDING':g.away.score+' — '+g.home.score);
 const venue=g.venue?'<span class="sl-location">'+esc(g.venue)+'</span>':'';
 return '<article class="sl-game'+(featured?' sl-featured':'')+'" style="--sl-away:'+brand(g.away)+';--sl-home:'+brand(g.home)+
  ';--sl-away-alt:'+secondary(g.away)+';--sl-home-alt:'+secondary(g.home)+'">'+
  '<div class="sl-game-bar"><span class="sl-tag '+(g.phase==='live'?'sl-live':'')+'">'+
  esc(g.kind==='exhibition'?'EXHIBITION':g.phase==='live'?'LIVE':g.phase==='final'?'FINAL':'UPCOMING')+'</span>'+
  '<span class="sl-game-time">'+esc(formatClock(g))+'</span>'+venue+'</div>'+
  arenaStage(g)+
  '<div class="sl-game-main"><div class="sl-game-teams">'+
  '<div class="sl-school">'+team(g.away)+favorite(g.away)+'</div>'+
  '<div class="sl-vs">'+(score?'<strong>'+esc(score)+'</strong>':'<span>VS</span>')+'</div>'+
  '<div class="sl-school">'+team(g.home)+favorite(g.home)+'</div>'+
  '</div><div class="sl-game-editorial"><p class="sl-kicker">'+(featured?'THE FEATURE MATCHUP':'MATCHUP NOTES')+'</p>'+
  '<h3>'+esc(pair[0])+'</h3><p>'+esc(pair[1])+'</p>'+
  '<div class="sl-rating-pair"><span>'+esc(g.away.name)+' <b>'+ (rating(g.away)??'—')+'</b></span>'+
  '<i aria-hidden="true"></i><span>'+esc(g.home.name)+' <b>'+(rating(g.home)??'—')+'</b></span></div>'+
  matchupStats(g)+meter(g)+'</div></div>'+
  '<div class="sl-game-footer"><span>'+esc(source)+'</span>'+
  '<a class="sl-details" href="'+esc(href)+'"'+(isExternal?' target="_blank" rel="noopener noreferrer"':'')+'>'+
  (isExternal?'Result source':'Game details')+' <span aria-hidden="true">↗</span></a></div></article>';
}
const render=()=>{
 const games=selectGames(loaded,selected,filter,search,followed),shown=games.slice(0,limit);
 document.getElementById('sl-date').textContent=dateLabel(selected);
 document.getElementById('sl-count').textContent=games.length+' '+(games.length===1?'game':'games');
 document.getElementById('sl-data').textContent=lastUpdate?'Updated '+lastUpdate:'Checking game data…';
 for(const b of document.querySelectorAll('[data-filter]')){const active=b.dataset.filter===filter;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));}
 const empty=sourceError?'<div class="sl-empty"><strong>Data source unavailable.</strong><p>'+esc(sourceError)+'</p><button type="button" id="sl-retry">Retry connection</button></div>':
 '<div class="sl-empty"><strong>No games match this view.</strong><p>Change the date or filter. Only source-backed fixtures are shown.</p></div>';
 document.getElementById('sl-games').innerHTML=shown.length?shown.map((g,i)=>card(g,i===0)).join(''):empty;
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
  const menFiles=['data/mbb-live.json','data/ncaam-2026-27-upcoming-forecasts.json','data/ncaam-2026-27-retro-primary.json','data/ncaam-2026-27-espn-team-crosswalk.json','data/dual-ring-team-palette.json','data/mbb-exhibition-finals-2026-27.json','data/mbb-arena-registry.json'];
  const womenFiles=['data/ncaaw-2026-27-games.json','data/ncaaw-2026-27-retro-primary.json','data/ncaam-2026-27-espn-team-crosswalk.json','data/dual-ring-team-palette.json'];
  const paths=women?womenFiles:menFiles;
  const output=await Promise.all(paths.map(p=>fetchJSON(p).catch(()=>null)));
  if(women){
    const [results,rank,c,pal]=output;
    if(!results||rank?.gender!=='women'||rank.starting_elo!==1500)throw Error('Women’s game or rating data unavailable');
    cross=c||{teams:[]};ratings=rankingsMap(rank);palette=pal?.wbb||pal?.mbb||{};
    loaded=normalizeWomen(results,rank,cross);
    lastUpdate='women’s rolling fixture ledger';
  }else{
    const [feed,forecast,rank,c,pal,ex,arenas]=output;
    if(!feed||rank?.model!=='retro-clean-slate'||rank.starting_elo!==1500||rank.rankings?.length!==365)
      throw Error('Men’s scoreboard or certified RETRO feed unavailable');
    cross=c||{teams:[]};ratings=rankingsMap(rank);palette=pal?.mbb||{};
    arenaRegistry=arenas?.teams||{};
    loaded=[...normalizeMen(feed,forecast,cross),...normalizeExhibitions(ex,cross)];
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
