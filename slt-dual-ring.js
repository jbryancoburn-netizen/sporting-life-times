/* Four-league two-tone badges. Keep original team artwork, never guess team IDs. */
(()=>{
'use strict';
const league=document.currentScript?.dataset?.sltLeague;
if(!['nba','euroleague','mbb','soccer'].includes(league))return;
let colors={};let socByESPN=new Map(),socByURL=new Map(),eurByURL=new Map(),nbaByID=new Map();
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
function paint(el,entry){
 el.style.setProperty('--slt-dual-primary',entry.primary);
 el.style.setProperty('--slt-dual-secondary',entry.secondary);
 el.dataset.sltDualTeam=entry.id||'';
}
const hostSelector='.mbb-mark,.slt-mark,.cs-mark,.cs-showcase-logo,.soccer-crest,.soccer-monogram,.team-monogram,.team-logo-shell';
function apply(img){
 if(!img.isConnected||!img.getAttribute('src'))return;
 if(img.closest('.team-hero-logo-bg,.story-img,.news-photo,.hero-watermark,.player-photo,.player-portrait,.player-headshot'))return;
 const entry=identity(img);if(!entry)return;
 const host=img.closest(hostSelector);
 if(host&&host.querySelectorAll('img').length===1){
  host.classList.add('slt-dual-shell');paint(host,entry);
  img.classList.remove('slt-dual-image');
  for(const prop of ['border','box-shadow','padding'])img.style.removeProperty(prop);
 }else{
  img.classList.add('slt-dual-image');paint(img,entry);
  const set=(k,v)=>img.style.setProperty(k,v,'important');
  set('border','3px solid '+entry.secondary);set('box-shadow','0 0 0 3px '+entry.primary);
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
  prepare(await res.json());schedule(document.body);
  new MutationObserver(items=>{for(const m of items)for(const n of m.addedNodes)if(n.nodeType===1)schedule(n)}).observe(document.body,{childList:true,subtree:true});
 }catch(error){console.error('Two-tone logo registry:',error)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
