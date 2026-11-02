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
  return dedupeFixtures([...result.values()]);
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
const homeProfile=g=>{
  if(women||g.kind==='exhibition'||!g.home?.canonical)return null;
  const info=arenaRegistry[String(g.home.id)];
  const name=String(info?.home_arena||'').trim(),source=String(info?.home_arena_source||'');
  if(!name||!/^https:\/\/[^\s"'<>]+$/i.test(source))return null;
  return {name,source};
};
// These are editorial school pennants, not claims about actual arena
// banners, championship wins or physical architectural features.
// Editorial badges use a small vetted NCAA title ledger; unknown teams never get invented stars.
const ncaaTitleYears={"men":{"8":[1994],"12":[1997],"24":[1942],"25":[1959],"26":[1964,1965,1967,1968,1969,1970,1971,1972,1973,1975,1995],"30":[],"41":[1999,2004,2011,2014,2023,2024],"46":[1984],"57":[2006,2007,2025],"84":[1940,1953,1976,1981,1987],"96":[1948,1949,1951,1958,1978,1996,1998,2012],"97":[1980,1986],"107":[1947],"120":[2002],"127":[1979,2000],"130":[1989,2026],"150":[1991,1992,2001,2010,2015],"152":[1974,1983],"153":[1957,1982,1993,2005,2009,2017],"183":[2003],"194":[1960],"197":[1945,1946],"222":[1985,2016,2018],"239":[2021],"254":[1944],"258":[2019],"269":[1977],"275":[1941],"2132":[1961,1962],"2305":[1952,1988,2008,2022],"2325":[1954],"2350":[1963],"2439":[1990],"2483":[1939],"2539":[1955,1956],"2638":[1966],"2751":[1943]},"women":{"24":[1990,1992,2021],"26":[2026],"30":[1983,1984],"41":[1995,2000,2002,2003,2004,2009,2010,2013,2014,2015,2016,2025],"87":[2001,2018],"99":[2023],"120":[2006],"153":[1994],"239":[2005,2012,2019],"245":[2011],"251":[1986],"295":[1985],"2348":[1982,1988],"2509":[1999],"2579":[2017,2022,2024],"2633":[1987,1989,1991,1996,1997,1998,2007,2008],"2641":[1993]}};
const titleSource={men:'https://www.ncaa.com/history/basketball-men/d1',women:'https://www.ncaa.com/history/basketball-women/d1'};
const rivalryLedger={
 '150|153':{name:'Tobacco Road',source:'https://goduke.com/news/2026/3/6/mens-basketball-top-ranked-duke-hosts-no-17-unc-in-rivalry-clash'},
 '84|2509':{name:'Indiana–Purdue',source:'https://www.dukebasketballreport.com/2024/9/1/24232760/the-best-rivalries-college-basketball-duke-north-carolina-cincinnati-xavier-indiana-purdue'},
 '96|97':{name:'Battle for the Bluegrass',source:'https://news.bet365.com/en-us/article/10-best-rivalries-in-mens-college-basketball/2023121516070914571'},
 '84|96':{name:'Indiana–Kentucky',source:'https://www.lucasoilstadium.com/event/iu-vs-uk-mens-basketball/'}
};
const titleMarks=t=>{
 const years=(ncaaTitleYears[women?'women':'men']||{})[String(t.id)]||[];
 if(!years.length)return '';
 const heading=years.length+' NCAA Division I titles: '+years.join(', ');
 return '<span class="sl-title-stars" title="'+esc(heading)+'" aria-label="'+esc(heading)+'">'+
  '<span aria-hidden="true">'+years.map(y=>'<i title="'+y+'">★</i>').join('')+'</span></span>';
};
const editorialBadges=g=>{
 if(g.kind==='exhibition')return '';
 const key=[String(g.away.id),String(g.home.id)].sort((a,b)=>Number(a)-Number(b)).join('|');
 const rivalry=!women?rivalryLedger[key]:null;
 const tags=[];
 if(rivalry)tags.push('<a class="sl-editorial-badge sl-rivalry" href="'+esc(rivalry.source)+'" target="_blank" rel="noopener noreferrer" title="Verified rivalry source">RIVALRY · '+esc(rivalry.name)+' ↗</a>');
 if(g.phase==='upcoming'&&Number.isFinite(g.probability)){
  const underdog=Math.min(g.probability,1-g.probability),eloGap=Math.abs((rating(g.away)||1500)-(rating(g.home)||1500));
  if(underdog>=0.30&&underdog<=0.45&&eloGap>=40)
   tags.push('<span class="sl-editorial-badge sl-upset" title="USRS probability: underdog '+Math.round(underdog*100)+'%; threshold 30–45%, rating gap at least 40">UPSET WATCH · '+Math.round(underdog*100)+'% underdog chance</span>');
 }
 return tags.length?'<div class="sl-editorial-badges">'+tags.join('')+'</div>':'';
};
const pennant=t=>{
 const shape='point',link=teamPage(t);
 const open=link?'<a href="'+esc(link)+'" aria-label="View '+esc(t.name)+' team page"':'<div';
 const close=link?'</a>':'</div>';
 const elo=rating(t),nickname=mascot(t);
 return open+' class="sl-pennant sl-pennant--'+shape+
   '" style="--pennant:'+brand(t)+';--pennant-accent:'+secondary(t)+';--star-ink:'+starInk(t)+'">'+
   '<span class="sl-pennant-seam" aria-hidden="true"></span>'+
   '<span class="sl-pennant-rivet" aria-hidden="true"></span>'+
   titleMarks(t)+'<span class="sl-pennant-brand">'+emblem(t)+'</span>'+
   '<span class="sl-pennant-name">'+esc(t.name)+'</span>'+
   '<strong class="sl-pennant-mascot">'+esc(nickname||t.name)+'</strong>'+
   (elo!==null?'<span class="sl-pennant-rating">USRS '+elo+'</span>':'')+close;
};
const arenaStage=g=>{
 const profile=homeProfile(g),venue=String(g.venue||'').trim();
 const intro=venue?'GAME VENUE':profile?'THE HOME-COURT FILE':'VENUE NOT REPORTED';
 const name=venue||profile?.name||'Venue not confirmed';
 const source=venue?'VENUE REPORTED BY GAME FEED':profile?
   'DOCUMENTED SCHOOL HOME COURT · NOT CONFIRMED FOR THIS GAME':'VENUE AWAITING SOURCE';
 const link=profile&&!venue?'<a href="'+esc(profile.source)+
   '" target="_blank" rel="noopener noreferrer">University source ↗</a>':'';
  const phase=g.phase==='final'?'FINAL SCORE':g.phase==='live'?'LIVE FROM THE COURT':'THE MATCHUP';
 const homeLabel=mascot(g.home)||g.home.name;
 const awayLabel=mascot(g.away)||g.away.name;
 return '<div class="sl-arena-stage sl-stage-'+esc(g.phase)+'" aria-label="Team-specific school pennants, graphic hardwood court and sourced venue information">'+
  '<div class="sl-arena-gallery">'+
  '<div class="sl-stands" aria-hidden="true"></div>'+
  '<div class="sl-arena-wordmark sl-arena-wordmark-away" aria-hidden="true">'+esc(awayLabel)+'</div>'+
  '<div class="sl-arena-wordmark sl-arena-wordmark-home" aria-hidden="true">'+esc(homeLabel)+'</div>'+
  '<div class="sl-stage-beam" aria-hidden="true"><span>'+esc(phase)+'</span></div>'+
  '<div class="sl-pennant-row">'+pennant(g.away)+
  '<div class="sl-stage-mid" aria-hidden="true"><span>'+(g.phase==='final'?'FT':g.phase==='live'?'LIVE':'VS')+'</span><small>THE SLATE</small></div>'+
  pennant(g.home)+'</div>'+
  '<div class="sl-floor-graphic" aria-hidden="true"><span class="sl-floor-half"></span>'+
  '<span class="sl-floor-circle"></span><span class="sl-floor-key"></span></div>'+
  '<span class="sl-arena-spotlight" aria-hidden="true"></span></div>'+
  '<div class="sl-arena-caption"><div><small>'+esc(intro)+'</small>'+
  '<strong>'+esc(name)+'</strong><span>'+esc(source)+'</span></div>'+link+'</div></div>';
};
const emblem=t=>{
  if(window.MBBLogos?.byESPN&&palette[String(t.id)])
    return window.MBBLogos.byESPN(t.id,'featured',t.name);
  const obj=womenTeams.get(String(t.id))||ratings.get(String(t.id))||{},logo=String(obj.logo||'');
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
  const aw=rankOf(g.away,ratings,women),hm=rankOf(g.home,ratings,women);
  if(g.kind==='exhibition')return ['The preseason record','An exhibition final, kept separate from the regular-season standings and RETRO Elo.'];
  if(g.phase==='live'&&g.home.score!==null&&g.away.score!==null){
    const diff=g.home.score-g.away.score,leader=diff>0?g.home.name:g.away.name;
    return [diff===0?'Nothing between them':leader+' leads by '+Math.abs(diff),
      'Live score: '+g.away.name+' '+g.away.score+', '+g.home.name+' '+g.home.score+
      '. Scores follow the attributed live feed.'];
  }
  if(g.phase==='final'&&g.home.score!==null&&g.away.score!==null){
    const diff=g.home.score-g.away.score,leader=diff>0?g.home.name:g.away.name;
    return [diff===0?'Finished level':leader+' wins by '+Math.abs(diff),
      'The final: '+g.away.name+' '+g.away.score+', '+g.home.name+' '+g.home.score+
      '. Open the Gamefile for available sourced box-score detail.'];
  }
  if(!has)return ['The matchup file','Both teams do not yet have certified RETRO ratings.'];
  const leader=a>=h?g.away.name:g.home.name,diff=Math.abs(a-h);
  const combined=(Number(aw?.games_played)||0)+(Number(hm?.games_played)||0);
  if(!combined)return ['A clean slate','Both programs remain at the 1500 RETRO starting line. The first verified final will change that.'];
  if(Number(aw?.wins)>0&&Number(hm?.wins)>0&&Number(aw?.losses)===0&&Number(hm?.losses)===0)
    return ['Unbeaten starts meet','Neither team has lost a verified 2026–27 final. '+leader+
      ' carries the '+Math.round(diff)+'-point rating edge.'];
  if(aw?.conference&&hm?.conference&&aw.conference===hm.conference)
    return ['A conference test',g.away.name+' and '+g.home.name+
      ' share the '+aw.conference+'. The current RETRO gap is '+Math.round(diff)+' points.'];
  return [diff<=1?'The numbers are level':leader+' holds the RETRO edge',
    'A '+Math.round(diff)+'-point difference in independent in-season Elo. All programs started at 1500.'];
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
const comparison=g=>{
 if(g.kind==='exhibition')return '';
 const x=seasonStats.get(String(g.away.canonical)),y=seasonStats.get(String(g.home.canonical));
 if(!x?.g&&!y?.g)return '<p class="sl-info-pending">In-season offense, defense and pace appear only after verified games and box scores are available.</p>';
 const line=(label,a,b,format)=>'<div class="sl-comparison-line"><span>'+esc(label)+'</span>'+
  '<strong>'+esc(a&&a.g?format(a):'—')+'</strong><i aria-hidden="true"></i>'+
  '<strong>'+esc(b&&b.g?format(b):'—')+'</strong></div>';
 const n=p=>(p.pf/p.g).toFixed(1),allowed=p=>(p.pa/p.g).toFixed(1);
 const form=p=>p.results.slice(-5).map(r=>r.result).join(' · ');
 return '<div class="sl-season-comparison"><div class="sl-comparison-title"><span>2026–27 VERIFIED FINALS</span>'+
  '<span>'+esc(g.away.name)+' / '+esc(g.home.name)+'</span></div>'+
  line('Points for / G',x,y,n)+line('Points against / G',x,y,allowed)+
  line('Last five',x,y,form)+
  line('Verified home W–L',x,y,p=>p.homeG?p.homeW+'–'+p.homeL:'—')+
  '<p>Regular-season verified finals only · sample sizes '+(x?.g||0)+' and '+(y?.g||0)+
  '. Home W–L excludes neutral sites and games without a verified court.</p></div>';
};
const projectedScoreCard=g=>{
 const projection=insight?.projectedScore(g,scoreCalibration,ratings);
 if(!projection)return '';
 return '<div class="sl-score-projection"><div><span>THE USRS SCORE FORECAST</span>'+
  '<strong>'+esc(g.away.name)+' '+projection.away+' · '+esc(g.home.name)+' '+projection.home+'</strong></div>'+
  '<p>'+esc(projection.caveat)+'</p></div>';
};
const liveEditorial=g=>{
 if(g.phase==='live'){
  const delta=liveChanges.get(g.id);
  const leader=g.home.score===g.away.score?'TIED':g.home.score>g.away.score?g.home.name:g.away.name;
  const diff=Math.abs(g.home.score-g.away.score);
  return '<div class="sl-live-desk"><div><span class="sl-live-pulse">● LIVE SCOREBOARD</span>'+
    '<strong>'+esc(leader)+(diff?' +'+diff:'')+'</strong>'+
    '<small>'+esc(g.status||'Game in progress')+'</small></div>'+
    (delta?'<div class="sl-update-graphic"><span>SINCE LAST SOURCE CHECK</span>'+
      '<strong>'+esc(g.away.name)+' +'+delta.away+' / '+esc(g.home.name)+' +'+delta.home+'</strong>'+
      '<small>Not a verified uninterrupted run</small></div>':
      '<div class="sl-update-graphic"><span>SCORING MOVEMENT</span>'+
      '<strong>Tracking verified score changes</strong><small>Play-by-play needed for exact scoring runs</small></div>')+
    '</div>';
 }
 const data=insight?.gameNumbers(g,sourceFeed,women?'women':'men');
 const leaders=insight?.gameLeaders(g,sourceFeed,women?'women':'men')||[];
 if(!data&&!leaders.length)return '';
 let html='<section class="sl-game-analytics"><div class="sl-comparison-title"><span>THE GAME IN NUMBERS</span>'+
   '<span>SOURCE-VERIFIED BOX</span></div>';
 if(data?.metrics?.length){
  html+='<div class="sl-game-metrics">'+data.metrics.map(m=>
   '<div class="sl-game-metric"><small>'+esc(m.label)+'</small><strong>'+
   esc(m.away)+(m.suffix||'')+' <span>—</span> '+esc(m.home)+(m.suffix||'')+
   '</strong></div>').join('')+'</div>'+
   '<p>'+esc(data.caveat)+'</p><a href="'+esc(data.source_url)+
   '" target="_blank" rel="noopener noreferrer">Attribution: NCAA-origin box score ↗</a>';
 }
 if(leaders.length)html+='<div class="sl-leading-players"><span>LEADING SCORERS</span>'+
   leaders.map(p=>'<div><strong>'+esc(p.name)+'</strong><small>'+esc(p.school)+'</small>'+
   '<b>'+esc(p.pts)+' PTS · '+esc(p.reb)+' REB · '+esc(p.ast)+' AST</b></div>').join('')+'</div>';
 return html+'</section>';
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
 const decided=(g.phase==='final'||g.phase==='live')&&Number.isFinite(g.away.score)&&Number.isFinite(g.home.score);
 const ahead=decided?(g.away.score===g.home.score?null:g.away.score>g.home.score?g.away:g.home):null;
 const resultLine=decided?'<div class="sl-score-context"><span>'+
  esc(g.phase==='final'?'FINAL RESULT':'CURRENT LEADER')+'</span><strong>'+
  esc(ahead?ahead.name:g.phase==='final'?'Result needs verification':'Game tied')+
  '</strong><small>'+esc(ahead?'Margin '+Math.abs(g.away.score-g.home.score):'')+'</small></div>':'';
 const venue=g.venue?'<span class="sl-location">'+esc(g.venue)+'</span>':'';
 return '<article class="sl-game'+(featured?' sl-featured':'')+'" style="--sl-away:'+brand(g.away)+';--sl-home:'+brand(g.home)+
  ';--sl-away-alt:'+secondary(g.away)+';--sl-home-alt:'+secondary(g.home)+'">'+
  '<div class="sl-game-bar"><span class="sl-tag '+(g.phase==='live'?'sl-live':'')+'">'+
  esc(g.kind==='exhibition'?'EXHIBITION':g.phase==='live'?'LIVE':g.phase==='final'?'FINAL':'UPCOMING')+'</span>'+
  '<span class="sl-game-time">'+esc(formatClock(g))+'</span>'+venue+'</div>'+
  editorialBadges(g)+arenaStage(g)+
  '<div class="sl-game-main sl-game-main--'+esc(g.phase)+'"><div class="sl-game-teams">'+
  '<div class="sl-school">'+team(g.away)+favorite(g.away)+'</div>'+
  '<div class="sl-vs">'+(score?'<strong>'+esc(score)+'</strong>':'<span>VS</span>')+'</div>'+
  '<div class="sl-school">'+team(g.home)+favorite(g.home)+'</div>'+
  '</div><div class="sl-game-editorial"><p class="sl-kicker">'+(featured?'THE FEATURE MATCHUP':'MATCHUP NOTES')+'</p>'+
  '<h3>'+esc(pair[0])+'</h3><p>'+esc(pair[1])+'</p>'+
  '<div class="sl-rating-pair"><span>'+esc(g.away.name)+' <b>'+ (rating(g.away)??'—')+'</b></span>'+
  '<i aria-hidden="true"></i><span>'+esc(g.home.name)+' <b>'+(rating(g.home)??'—')+'</b></span></div>'+
  resultLine+matchupStats(g)+comparison(g)+meter(g)+projectedScoreCard(g)+liveEditorial(g)+'</div></div>'+
  '<div class="sl-game-footer"><span>'+esc(source)+'</span>'+
  '<a class="sl-details" href="'+esc(href)+'"'+(isExternal?' target="_blank" rel="noopener noreferrer"':'')+'>'+
  (isExternal?'Result source':'Game details')+' <span aria-hidden="true">↗</span></a>'+
  (!women&&g.home?.canonical?'<a class="sl-arena-deep-link" href="ncaam-arena.html?team='+
    encodeURIComponent(g.home.id)+'">Arena File ↗</a>':'')+'</div></article>';
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
  const menFiles=['data/mbb-live.json','data/ncaam-2026-27-upcoming-forecasts.json','data/ncaam-2026-27-retro-primary.json','data/ncaam-2026-27-espn-team-crosswalk.json','data/dual-ring-team-palette.json','data/mbb-exhibition-finals-2026-27.json','data/mbb-arena-registry.json','data/ncaam-score-calibration.json'];
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
    const [feed,forecast,rank,c,pal,ex,arenas,calibration]=output;
    if(!feed||rank?.model!=='retro-clean-slate'||rank.starting_elo!==1500||rank.rankings?.length!==365)
      throw Error('Men’s scoreboard or certified RETRO feed unavailable');
    cross=c||{teams:[]};ratings=rankingsMap(rank);palette=pal?.mbb||{};
    arenaRegistry=arenas?.teams||{};scoreCalibration=calibration;
    const before=new Map(loaded.filter(g=>g.phase==='live'&&g.kind==='regular').map(g=>
      [g.id,{id:g.id,day:g.day,away_score:g.away.score,home_score:g.home.score}]));
    sourceFeed=feed;seasonStats=insight?.seasonProfiles(rank.events)||new Map();
    loaded=[...normalizeMen(feed,forecast,cross),...normalizeExhibitions(ex,cross)];
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
