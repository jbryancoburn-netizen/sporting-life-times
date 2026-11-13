/* Four-league two-tone badges. Keep original team artwork, never guess team IDs. */
(()=>{
'use strict';
const league=document.currentScript?.dataset?.sltLeague;
if(!['nba','euroleague','mbb','soccer'].includes(league))return;
// Men's D-I basketball has its own roundel-aware renderer. Never decorate it twice.
if(league==='mbb')return;
let colors={};let vintageByTeam={};let socByESPN=new Map(),socByURL=new Map(),eurByURL=new Map(),nbaByID=new Map();
const hex=v=>/^#[a-f0-9]{6}$/i.test(v||'');
const pathname=v=>{try{return new URL(v,location.href).pathname.toLowerCase()}catch{return ''}};
const suffix={ny:'NYK',wsh:'WAS',gs:'GSW',sa:'SAS',no:'NOP',utah:'UTA'};
function prepare(all){
 for(const [k,n] of Object.entries({nba:30,euroleague:20,mbb:365,soccer:213})){
  if(Object.keys(all[k]||{}).length!==n)throw Error('Team palette incomplete '+k);
  for(const [id,p] of Object.entries(all[k]))if(!hex(p.primary)||!hex(p.secondary)||p.primary.toLowerCase()===p.secondary.toLowerCase())throw Error('Same ring colors '+k+' '+id);
 }
 colors=all[league];
 if(league==='soccer')for(const [id,p] of Object.entries(colors)){
  if(p.espn_id)socByESPN.set(String(p.espn_id),{id,...p});
  if(p.logo_url)socByURL.set(pathname(p.logo_url),{id,...p});
 }
 if(league==='euroleague')for(const [id,p] of Object.entries(colors))if(p.logo_url)eurByURL.set(pathname(p.logo_url),{id,...p});
 if(league==='nba')for(const [id,p] of Object.entries(colors))if(p.nba_id)nbaByID.set(String(p.nba_id),{id,...p});
}
function identity(img){
 const src=img.getAttribute('src')||'',path=pathname(src);
 if(league==='nba'){
  const key=src.match(/(?:nba-logos\/|teamlogos\/nba\/(?:500|500-dark)\/)([A-Za-z]{2,3})\.(?:png|webp|svg)/i)?.[1]?.toUpperCase()||'';
  const code=suffix[key.toLowerCase()]||key;
  if(colors[code])return {id:code,...colors[code]};
  const num=src.match(/\/logos\/nba\/(\d{10})\//)?.[1];if(num)return nbaByID.get(num)||null;
  const attr=img.dataset.teamCode||img.closest('[data-team-code]')?.dataset.teamCode||'';
  return colors[attr.toUpperCase()]?{id:attr.toUpperCase(),...colors[attr.toUpperCase()]}:null;
 }
 if(league==='euroleague'){
  const id=img.dataset.euroleagueCode||src.match(/\/euroleague-logos\/([A-Z]{3})\.(?:png|svg|webp)/i)?.[1]||'';
  return colors[id]?{id,...colors[id]}:eurByURL.get(path)||null;
 }
 if(league==='mbb'){
  const id=img.closest('.mbb-mark')?.dataset.espnId||src.match(/\/ncaa\/(?:500|500-dark)\/(\d+)\.(?:png|svg|webp)/i)?.[1]||'';
  return colors[id]?{id,...colors[id]}:null;
 }
 if(league==='soccer'){
  const direct=socByURL.get(path);if(direct)return direct;
  const id=src.match(/\/ncaa\/(?:500|500-dark)\/(\d+)\.(?:png|svg|webp)/i)?.[1]||'';
  if(id)return socByESPN.get(id)||null;
  const raw=img.closest('[data-team]')?.dataset.team||img.closest('[data-team-id]')?.dataset.teamId||'';
  const slug=colors[raw]?raw:'men-d1:'+raw;return colors[slug]?{id:slug,...colors[slug]}:null;
 }
 return null;
}
/* The archive uses one vetted mark per franchise, with the original local logo
   retained as an automatic fallback. Score/data handling is deliberately untouched. */
function archivalNBAImage(img,entry){
 if(league!=='nba'||!entry?.id)return;
 const mark=vintageByTeam[entry.id];
 const historical='assets/nba-vintage-logos/'+entry.id+'.png';
 if(!mark||mark.logo_url!==historical)return;
 const original=img.getAttribute('src')||'';
 if(img.dataset.sltVintageStatus)return;
 if(!/(?:\/nba-logos\/|\/nba-vintage-logos\/|\/teamlogos\/nba\/(?:500|500-dark)\/|\/logos\/nba\/)/i.test(original))return;
 // Every vintage image is a verified local file in the repo; no external
 // CDN hosts are read, even as a fallback. A failed local-era mark falls
 // back to a second locally stored official NBA logo.
 const fallback=mark.fallback_url;
 if(!/^assets\/nba-logos\/[A-Z]{2,3}\.png$/.test(fallback))return;
 img.dataset.teamCode=entry.id;
 img.dataset.sltVintageOriginal=original;
 img.dataset.sltVintageStatus='loading';
 img.addEventListener('error',()=>{
  if(img.getAttribute('src')===historical){
   img.dataset.sltVintageStatus='fallback';
   img.setAttribute('src',fallback);
  }
 });
 img.addEventListener('load',()=>{
  const source=img.getAttribute('src');
  if(source===historical||source===fallback){
    img.dataset.sltVintageStatus=source===historical?'loaded':'fallback-loaded';
    img.hidden=false;
  }
 });
 img.setAttribute('src',historical);
}
function paint(el,entry){
 el.style.setProperty('--slt-dual-primary',entry.primary);
 el.style.setProperty('--slt-dual-secondary',entry.secondary);
 el.dataset.sltDualTeam=entry.id||'';
}
const hostSelector='.mbb-mark,.slt-mark,.cs-mark,.cs-showcase-logo,.soccer-crest,.soccer-monogram,.team-monogram,.team-logo-shell';
function apply(img){
 if(!img.isConnected||!img.getAttribute('src'))return;
 // The Pitch's crest renderer owns exactly two rings. Never layer legacy rings on it.
 if(league==='soccer'&&img.closest('.cs-pitch-badge,.cs-match-badge,.soccer-school-mark,.ncaa-native-mark'))return;
 // College soccer's main desk now owns a single two-color crest system.
 // Never layer these legacy outlines on the scoreboard or selection rankings.
 if(league==='soccer'&&document.body?.dataset?.league==='college-soccer'&&img.closest('#college-soccer-visual-desk .cs-mark,#cs-showcase .cs-showcase-logo'))return;
 // The unified NBA/EuroLeague/NBL paper owns its crest badge.
 // Applying this site's generic two-ring treatment here caused FOUR overlapping rings.
 if(img.closest('.pb-club-crest'))return;
 if(img.closest('.team-hero-logo-bg,.story-img,.news-photo,.hero-watermark,.player-photo,.player-portrait,.player-headshot'))return;
 const base=identity(img);if(!base)return;
 const era=vintageByTeam[base.id];
 const entry=league==='nba'&&hex(era?.ring_primary)&&hex(era?.ring_secondary)
  ?{...base,primary:era.ring_primary,secondary:era.ring_secondary}:base;
 archivalNBAImage(img,entry);
 const host=img.closest(hostSelector);
 if(host&&host.querySelectorAll('img').length===1){
  host.classList.add('slt-dual-shell');paint(host,entry);
  img.classList.remove('slt-dual-image');
  if(league==='nba'){
   /* Existing NBA stylesheets include stronger !important single-ring rules.
      Inline overrides make the shared shell the ONLY source of both rings. */
   const set=(k,v)=>img.style.setProperty(k,v,'important');
   host.style.setProperty('border','var(--slt-nba-crest-stroke,4px) solid '+entry.primary,'important');
   host.style.setProperty('box-sizing','border-box','important');
   host.style.setProperty('border-radius','50%','important');
   host.style.setProperty('position','relative','important');
   host.style.setProperty('overflow','hidden','important');
   host.style.setProperty('padding','0','important');
   set('position','absolute');set('top','50%');set('left','50%');
   set('right','auto');set('bottom','auto');
   set('transform','translate(-50%,-50%)');
   set('width','calc(100% - var(--slt-nba-artwork-inset,17px))');set('height','calc(100% - var(--slt-nba-artwork-inset,17px))');
   set('max-width','calc(100% - var(--slt-nba-artwork-inset,17px))');set('max-height','calc(100% - var(--slt-nba-artwork-inset,17px))');
   set('min-width','0');set('min-height','0');
   set('border','0');set('box-shadow','none');set('padding','0');
   set('margin','0');set('background','transparent');set('object-fit','contain');
   set('clip-path','circle(50% at 50%)');
  }else for(const prop of ['border','box-shadow','padding'])img.style.removeProperty(prop);
 }else{
  img.classList.add('slt-dual-image');paint(img,entry);
  const set=(k,v)=>img.style.setProperty(k,v,'important');
  const stroke=league==='nba'?'var(--slt-nba-crest-stroke,4px)':'3px';
  set('border',stroke+' solid '+entry.secondary);set('box-shadow','0 0 0 '+stroke+' '+entry.primary);
  set('border-radius','50%');set('background','#fff');set('padding','3px');
  set('box-sizing','border-box');set('object-fit','contain');set('aspect-ratio','1 / 1');
 }
}
function visit(root){
 if(root.nodeType!==1)return;
 if(root.matches?.('img[src]'))apply(root);
 root.querySelectorAll?.('img[src]').forEach(apply);
 if(league==='mbb'){
  const badges=[...(root.matches?.('.mbb-mark')?[root]:[]),...(root.querySelectorAll?.('.mbb-mark')||[])];
  for(const badge of badges){const id=badge.dataset.espnId,p=colors[id];if(p){badge.classList.add('slt-dual-shell');paint(badge,{id,...p})}}
 }
 if(league==='soccer'){
  const slug=new URLSearchParams(location.search).get('team');
  if(slug&&slug.startsWith('men-d1:')&&colors[slug])for(const node of root.querySelectorAll?.('#college-team-profile .team-monogram')||[]){node.classList.add('slt-dual-shell');paint(node,{id:slug,...colors[slug]});}
 }
}
const queue=new Set();let queued=false;
function flush(){queued=false;for(const el of queue)if(el.isConnected)visit(el);queue.clear()}
function schedule(el){if(el?.nodeType!==1)return;queue.add(el);if(!queued){queued=true;requestAnimationFrame(flush)}}
async function init(){
 try{
  const res=await fetch('data/dual-ring-team-palette.json?v=nonwhite-rings-20261029',{cache:'force-cache'});
  if(!res.ok)throw Error('Palette download HTTP '+res.status);
  prepare(await res.json());
  if(league==='nba'){
   document.body.classList.add('slt-nba-bold-rings');
   try{
    const archive=await fetch('data/nba-vintage-logos.json?v=20261113a',{cache:'force-cache'});
    if(!archive.ok)throw Error('NBA vintage catalogue HTTP '+archive.status);
    const catalog=await archive.json();
    if(Object.keys(catalog.teams||{}).length!==30)throw Error('NBA vintage catalogue is incomplete');
    vintageByTeam=catalog.teams;
   }catch(error){console.error('NBA historic marks unavailable; retaining current artwork:',error);}
  }
  schedule(document.body);
  new MutationObserver(items=>{
   for(const m of items){
    if(m.type==='attributes'){schedule(m.target);continue;}
    for(const n of m.addedNodes)if(n.nodeType===1)schedule(n);
   }
  }).observe(document.body,{childList:true,subtree:true,attributes:league==='nba',attributeFilter:league==='nba'?['src']:undefined});
 }catch(error){console.error('Two-tone logo registry:',error)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
