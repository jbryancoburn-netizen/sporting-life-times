/* One NCAA Division I men's basketball logo identity + rendering contract. */
(function(w){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'');
const safeURL=v=>{try{let u=new URL(v);return u.protocol==='https:'?u.href:''}catch{return ''}};
const byNcaa=new Map(),byName=new Map(),ambiguous=new Set();let registry={},palette={};
function alias(n,id){let key=norm(n);if(!key||ambiguous.has(key))return;if(byName.has(key)&&byName.get(key)!==id){ambiguous.add(key);byName.delete(key)}else byName.set(key,id)}
const ready=(async()=>{
try{
const [reg,cross,colors]=await Promise.all(['data/mbb-logo-registry.json','data/ncaam-2026-27-espn-team-crosswalk.json','data/dual-ring-team-palette.json'].map(p=>fetch(p,{cache:'no-cache'}).then(x=>{if(!x.ok)throw Error(p+' '+x.status);return x.json()})));
if(Object.keys(reg.teams||{}).length!==365||cross.teams?.length!==365)throw Error('Incomplete 365-team logo registry');
registry=reg.teams;palette=colors.mbb||{};
if(Object.keys(palette).length!==365)throw Error('Incomplete 365-program MBB color palette');
for(let row of cross.teams){
const id=String(row.espn_id),found=registry[id];
if(!found||found.canonical_id!==row.id||String(found.espn_id)!==id)throw Error('Logo ID mismatch: '+row.name);
if(!['embedded_roundel','flat','unverified'].includes(found.artwork_type))throw Error('Missing explicit artwork type: '+row.name);
const color=palette[id];
if(!color||!/^#[0-9a-f]{6}$/i.test(color.primary)||!/^#[0-9a-f]{6}$/i.test(color.secondary)||color.primary===color.secondary)throw Error('Missing two distinct logo colors: '+row.name);
byNcaa.set(row.id,id);for(let name of [row.name,row.espn_name,found.school,found.display_name,found.provider_team_name])alias(name,id);
}
if(byNcaa.size!==365)throw Error('Incomplete NCAA crosswalk');return true;
}catch(e){console.error('MBB logo registry:',e);return false}
})();
function render(options={}){
const name=String(options.name||'Team'),ncaa=String(options.ncaaId||''),given=String(options.espnId||'');
const resolved=byNcaa.get(ncaa)||'',byTitle=byName.get(norm(name))||'';
let id=resolved||given||byTitle;
// When a dated school calendar has a stale ESPN opponent ID, an unambiguous
// official crosswalk name takes priority. Never substitute a fuzzy match.
if(!ncaa&&byTitle&&given&&byTitle!==given)id=byTitle;
if((resolved&&given&&resolved!==given)||!registry[id]||(ncaa&&registry[id].canonical_id!==ncaa))id='';
const school=registry[id],brand=palette[id],art=school?.artwork_type||'unverified';
const corrected=school?.ring_override==='two'&&art==='embedded_roundel';
const primary=school?.logo_url_verified?safeURL(school.official_logo_url||school.logo_url):'';
const backup=(school?.provider_logo_candidates||[]).map(safeURL).find(x=>x&&x!==primary)||'';
const initials=name.split(/\s+/).slice(0,2).map(v=>v[0]||'').join('').toUpperCase();
const kind=/^(small|score|power|schedule|hero|featured|history)$/.test(options.size||'')?options.size:'small';
const clr=brand?.primary||'#385866',alt=brand?.secondary||'#597582';
return '<span class="mbb-mark mbb-mark--'+kind+' mbb-mark--art-'+art+(corrected?' mbb-mark--corrected-two-rings':'')+(primary?'':' mbb-mark--missing')+'" style="--mbb-primary:'+esc(clr)+';--mbb-secondary:'+esc(alt)+'" data-espn-id="'+esc(id)+'" data-artwork="'+esc(art)+'" role="img" aria-label="'+esc(name)+' logo"><span class="mbb-mark__initials" aria-hidden="true">'+esc(initials)+'</span>'+(primary?'<img class="mbb-mark__img" src="'+esc(primary)+'" data-logo-alternate="'+esc(backup)+'" loading="lazy" decoding="async" alt="" onerror="window.MBBLogos.fail(this)">':'')+'</span>';
}
function fail(img){
if(!(img instanceof HTMLImageElement))return;
const alt=safeURL(img.dataset.logoAlternate);
if(alt&&img.src!==alt){img.dataset.logoAlternate='';img.src=alt;return;}
img.closest('.mbb-mark')?.classList.add('mbb-mark--missing');img.remove();
}
function upgradeLegacyCalendar(){
for(let node of document.querySelectorAll('#mbb-calendar-host .sched-logo:not(.mbb-mark)')){
const src=node.querySelector('img')?.getAttribute('src')||'';
const id=src.match(/\/ncaa\/(?:500|500-dark)\/(\d+)\.png/i)?.[1]||'';
const name=node.closest('.sched-matchup')?.querySelector('.sched-opponent strong')?.textContent||'Team';
const temp=document.createElement('div');temp.innerHTML=render({espnId:id,name,size:'schedule'});node.replaceWith(temp.firstElementChild);
}
}
// Third-party legacy views sometimes output a bare ESPN PNG. Upgrade it exactly
// once into the same MBB badge; never wrap the badge a second time.
function upgradeBareLogos(root=document){
 const list=[];
 if(root.tagName==='IMG')list.push(root);
 root.querySelectorAll?.('img[src*="/teamlogos/ncaa/"]').forEach(img=>list.push(img));
 for(const img of list){
  if(!img.isConnected||img.closest('.mbb-mark')||img.matches('.player-photo,.player-portrait,.mbb-player-photo')||img.closest('.player-photo,.player-portrait,.mbb-player-image-wrap'))continue;
  const id=(img.getAttribute('src')||'').match(/\/ncaa\/(?:500|500-dark)\/(\d+)\.(?:png|webp)/i)?.[1];
  if(!id||!registry[id])continue;
  const temp=document.createElement('span');temp.innerHTML=render({espnId:id,name:registry[id].school,size:'small'});
  img.replaceWith(temp.firstElementChild);
 }
}
w.MBBLogos={ready,render,byNCAA:(id,size,name)=>render({ncaaId:id,name,size}),byESPN:(id,size,name)=>render({espnId:id&&registry[String(id)]?String(id):'',name:name||registry[String(id)]?.school,size}),byName:(name,size)=>render({name,size}),fail,upgradeLegacyCalendar,upgradeBareLogos,logoURL:id=>registry[byNcaa.get(id)]?.logo_url||''};
ready.then(ok=>{
 if(!ok)return;
 const run=()=>{upgradeLegacyCalendar();upgradeBareLogos(document)};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
 if(document.documentElement)new MutationObserver(changes=>{for(const change of changes)for(const node of change.addedNodes)if(node.nodeType===1)upgradeBareLogos(node)}).observe(document.documentElement,{subtree:true,childList:true});
});
})(window);
