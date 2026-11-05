/* News-first edition layout. The existing league news renderer remains the authority.
   Where an edition has no native reporting desk, use the published attributed news feeds only. */
(()=>{'use strict';
function init(){
 const kind=document.body.dataset.sltFront;if(!kind)return;
 const $=s=>document.querySelector(s);
 const native={
  cbb:'.cbb-front-edition',euro:'#league-news',epl:'#slt-news',league:'#league-news',
  nbl:'#league-news',soccer:'#college-soccer-editorial',echl:'#league-news',
  nba:'#slt-nba-front-news',nfl:'#slt-nfl-front-news'
 };
 const labels={cfb:'College Football',d2men:'Division II Men’s Basketball',d2women:'Division II Women’s Basketball',d3men:'Division III Men’s Basketball',d3women:'Division III Women’s Basketball',soccerMen:'NCAA Men’s Soccer',front:'Around the Sporting World'};
 const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 const dates=s=>{const d=new Date(s||'');return Number.isFinite(+d)?d.toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):''};
 const samePage=u=>{try{const p=new URL(u,location.href);return p.pathname===location.pathname&&(!p.hash||p.hash==='#')}catch{return false}};
 const pickFirst=()=>$(native[kind]||'');
 let wire=null,news=null,directory=null;
 function placement(node){
  const after={
   cbb:'.slt-department-band',euro:'.slt-department-band',nbl:'.nbl-edition-head',league:'.hub-intro',
   soccer:'#cs-edition-bar',echl:'.hub-intro',soccerMen:'.soccer-hero',
   front:'.section-strap'
  };
  if(kind==='nba'||kind==='nfl')return;
  if(kind==='soccerMen'){const hero=$('.soccer-hero');if(hero?.parentNode){hero.before(node);return;}}
  let anchor=$(after[kind]||'');
  if(anchor&&anchor.parentNode){anchor.after(node);return;}
  const main=$('main');
  if(main){main.prepend(node);return;}
  const head=$('header');if(head)head.after(node);
 }
 function linksForPaper(){
  if(kind==='league'){
   // Construct the department register from actual sections, not other sports' navigation.
   const out=[],seen=new Set();
   for(const section of document.querySelectorAll('main section[id]')){
    if(section.id==='league-news'||seen.has(section.id))continue;
    const label=section.querySelector('h2,h3')?.textContent?.trim().replace(/\\s+/g,' ');
    if(!label)continue;seen.add(section.id);out.push({href:'#'+section.id,label});
   }
   return out.slice(0,14);
  }
  const nav=kind==='front'?$('.nav'):(kind==='nbl'?$('.nbl-jump'):null)||(kind==='soccer'||kind==='echl'?$('.hub-nav'):null)||$('header nav')||$('nav[aria-label]');
  if(!nav)return [];
  const used=new Set(),out=[];
  for(const a of nav.querySelectorAll('a[href]')){
   const label=a.textContent.trim().replace(/\s+/g,' ');
   const href=a.getAttribute('href')||'';
   if(!label||/^(front page|the front page|all sports|sports desks|home|newspaper)$/i.test(label)||samePage(href)||href.startsWith('javascript:'))continue;
   const key=href.replace(/\?.*$/,'')+'|'+label.toLowerCase();
   if(used.has(key))continue;used.add(key);out.push({href,label});
  }
  return out.slice(0,18);
 }
 function makeDirectory(){
  // These two editions already have a hand-built publication directory, preserve it.
  if(kind==='cbb'||kind==='euro')return;
  const items=linksForPaper();if(!items.length||!news)return;
  if(!directory){
   directory=document.createElement('section');directory.className='slt-front-directory';
   directory.setAttribute('aria-label','Explore the newspaper');
   const h=document.createElement('div');h.className='slt-front-heading';
   h.innerHTML='<div><span class="slt-front-eyebrow">THE DEPARTMENTS / OPEN AN EDITION</span><h2>Inside This Newspaper</h2></div>';
   directory.append(h);const grid=document.createElement('div');grid.className='slt-front-directory-grid';directory.append(grid);
  }
  const grid=directory.querySelector('.slt-front-directory-grid');grid.replaceChildren();
  for(const it of items){const a=document.createElement('a');a.href=it.href;a.textContent=it.label;grid.append(a);}
  // The link register follows the day's news, rather than preceding its headlines.
  if(news.nextElementSibling!==directory)news.after(directory);
 }
 function positionNative(){
  const current=pickFirst();if(!current)return false;
  // Avoid an observer loop: rebuilding links mutates the DOM and would
  // otherwise trigger the same observer indefinitely.
  if(current===news&&directory?.previousElementSibling===news)return true;
  if(current!==news){news=current;news.classList.add('slt-front-news');}
  if(kind!=='nba'&&kind!=='nfl'&&news.dataset.sltFrontMoved!=='yes'){
   news.dataset.sltFrontMoved='yes';placement(news);
  }
  makeDirectory();return true;
 }
 const topic={cfb:/\b(college football|ncaa football|fbs|cfp|college football playoff|bowl season)\b/i,
  d2men:/\b(division\s*(?:ii|2)|d-?ii|d2|ncaa\s*(?:ii|d2))\b/i,
  d2women:/\b(division\s*(?:ii|2)|d-?ii|d2|ncaa\s*(?:ii|d2))\b/i,
  d3men:/\b(division\s*(?:iii|3)|d-?iii|d3|ncaa\s*(?:iii|d3))\b/i,
  d3women:/\b(division\s*(?:iii|3)|d-?iii|d3|ncaa\s*(?:iii|d3))\b/i};
 function fits(a){
  const q=[a.title,a.summary,a.category].join(' ');
  if(kind==='cfb')return topic.cfb.test(q)&&!/\bnfl\b|professional football/i.test(q);
  if(/^d[23]/.test(kind)){
   if(!topic[kind].test(q)||!/basketball|hoops|court|march madness/i.test(q))return false;
   if(/women/i.test(kind)&&/\bmen.s basketball\b/i.test(q))return false;
   if(/men/i.test(kind)&&!/women/i.test(kind)&&/\bwomen.s basketball\b/i.test(q))return false;
   return true;
  }
  if(kind==='soccerMen')return Array.isArray(a.team_keys)&&a.team_keys.some(k=>k.startsWith('men-'));
  return true;
 }
 function ensureWire(){
  if(news)return;
  wire=document.createElement('section');wire.className='slt-front-news slt-front-wire';wire.setAttribute('aria-label','Latest sourced sports reporting');
  wire.innerHTML='<div class="slt-front-heading"><div><span class="slt-front-eyebrow">THE LATEST DISPATCHES / ATTRIBUTED REPORTING</span><h2>'+esc(labels[kind]||'The Leading Stories')+'</h2></div><span class="slt-front-status" role="status">Opening the news wire…</span></div><div class="slt-front-grid" aria-live="polite"><p>Checking current verified reports…</p></div>';
  news=wire;placement(wire);makeDirectory();
 }
 async function load(path){
  const r=await fetch(path+(path.includes('?')?'&':'?')+'front_news='+Math.floor(Date.now()/60000),{cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('Headline source temporarily unavailable');return r.json();
 }
 async function refreshWire(){
  if(!wire||document.hidden)return;
  const files=kind==='soccerMen'?['data/college-soccer-team-news.json']:
   /^d[23]/.test(kind)?['data/cbb-national-news.json','articles.json']:
   kind==='front'?['data/nba-top-stories.json','data/cbb-national-news.json','articles.json','nbl-articles.json']:
   ['articles.json'];
  const all=await Promise.allSettled(files.map(load));
  let items=[],times=[];
  all.forEach((v,i)=>{if(v.status!=='fulfilled')return;const d=v.value;times.push(d.updated_at);const source=Array.isArray(d)?d:d.articles||[];for(const a of source){if(!a.title||!a.url||!fits(a))continue;let url;try{url=new URL(a.url);if(!['http:','https:'].includes(url.protocol))continue}catch{continue}items.push(a)}});
  const seen=new Set();items=items.filter(a=>{const key=String(a.url).split('#')[0];if(seen.has(key))return false;seen.add(key);return true});
  items.sort((a,b)=>(Date.parse(b.published_at)||0)-(Date.parse(a.published_at)||0));
  if(kind==='front'){const seenSports=new Map();items=items.filter(a=>{const k=String(a.category||'').toLowerCase()==='multi-sport'?'general':String(a.category||'general');const n=seenSports.get(k)||0;if(n>=4)return false;seenSports.set(k,n+1);return true})}
  items=items.slice(0,12);
  const target=wire.querySelector('.slt-front-grid');
  if(items.length){
   target.innerHTML=items.map((a,i)=>'<article><p class="slt-front-byline">'+esc(a.source||'Original publisher')+' · '+esc(dates(a.published_at))+'</p><h3><a href="'+esc(a.url)+'" target="_blank" rel="noopener noreferrer">'+esc(a.title)+'</a></h3>'+(a.summary?'<p>'+esc(String(a.summary).replace(/<[^>]+>/g,'').slice(0,i===0?270:170))+'</p>':'')+'</article>').join('');
  }else if(!target.querySelector('article')){
   target.innerHTML='<p>No verified '+esc(labels[kind]||'sports')+' stories are available in the current published news sources. Stories will appear here when matching reports are collected.</p>';
  }
  const latest=Math.max(...times.map(t=>Date.parse(t)||0),0);
  const age=latest?Date.now()-latest:Infinity;
  const note=wire.querySelector('.slt-front-status');
  note.textContent=(!all.some(x=>x.status==='fulfilled')?'News sources unavailable · ':age>2*3600000?'Latest feed delayed · ':'News wire updated · ')+(latest?dates(latest):'time unavailable')+' · Checked '+dates(Date.now());
 }
 // Native editions remain bound to their existing, sport-specific live headline feed.
 if(!positionNative()&&!native[kind]){ensureWire();refreshWire();}
 if(native[kind]&&(kind==='nba'||kind==='nfl')){
  // These homepages rerender after live score updates. Reattach the department
  // register to the new headline section each time without accumulating copies.
  const main=$('main')||document.body;
  const observer=new MutationObserver(()=>positionNative());
  observer.observe(main,{childList:true,subtree:true});
 }else if(native[kind]&&!news){
  const main=$('main')||document.body;
  const observer=new MutationObserver(()=>{if(positionNative())observer.disconnect()});
  observer.observe(main,{childList:true,subtree:true});
  setTimeout(()=>observer.disconnect(),30000);
 }
 if(wire){
  setInterval(refreshWire,60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshWire()});
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();