/* One NCAA Division I men's basketball logo identity + rendering contract. */
(function(w){
'use strict';
// Do not redecorate football or soccer logos in the shared live-game page.
const onVictorianLivePage=/\/live-game\.html$/i.test(String(w.location?.pathname||''));
if(onVictorianLivePage&&!['ncaam','ncaaw'].includes(new URLSearchParams(String(w.location?.search||'')).get('league')))return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'');
const safeURL=v=>{try{let u=new URL(v);return u.protocol==='https:'?u.href:''}catch{return ''}};
const byNcaa=new Map(),byName=new Map(),ambiguous=new Set(),outsideByName=new Map(),outsideAmbiguous=new Set();
let registry={},palette={},outside={};
const outsideAliases=t=>[t.school,t.feed_name,t.corrected_name,...(t.aliases||[])].filter(Boolean).map(norm);
// Independent NCAA and ESPN identifiers may name the same real university.
// Do not mark a school's name ambiguous when verified records describe the
// SAME identity. Prefer the numeric scoreboard key and keep both source IDs.
function sameOutsideSchool(a,b){
 const x=norm(a?.school),y=norm(b?.school);
 if(!x||!y)return false;
 if(x===y)return true;
 return (x.startsWith(y)||y.startsWith(x))&&
   safeURL(a?.logo_url)&&safeURL(a?.logo_url)===safeURL(b?.logo_url);
}
function registerOutside(id,entry){
 for(const key of outsideAliases(entry)){
  if(!key||outsideAmbiguous.has(key)||byName.has(key))continue;
  const prior=outsideByName.get(key);
  if(prior&&prior!==id){
   if(sameOutsideSchool(outside[prior],entry)){
    if(/^[0-9]+$/.test(id)&&!/^[0-9]+$/.test(prior))outsideByName.set(key,id);
   }else{outsideByName.delete(key);outsideAmbiguous.add(key);}
  }else outsideByName.set(key,id);
 }
}
function alias(n,id){let key=norm(n);if(!key||ambiguous.has(key))return;if(byName.has(key)&&byName.get(key)!==id){ambiguous.add(key);byName.delete(key)}else byName.set(key,id)}
const ready=(async()=>{
try{
const [reg,cross,colors,opponents]=await Promise.all([
  ...['data/mbb-logo-registry.json','data/ncaam-2026-27-espn-team-crosswalk.json','data/dual-ring-team-palette.json?v=ncaa-two-rings-20261101b']
    .map(p=>fetch(p,{cache:'no-cache'}).then(x=>{if(!x.ok)throw Error(p+' '+x.status);return x.json()})),
  fetch('data/mbb-out-of-division-opponent-logos.json?v=nov9-crest-identity-20261109b',{cache:'no-cache'})
    .then(x=>x.ok?x.json():{teams:{}}).catch(()=>({teams:{}}))
]);
if(Object.keys(reg.teams||{}).length!==365||cross.teams?.length!==365)throw Error('Incomplete 365-team logo registry');
registry=reg.teams;palette=colors.mbb||{};outside=opponents?.teams||{};
if(Object.keys(palette).length!==365)throw Error('Incomplete 365-program MBB color palette');
for(let row of cross.teams){
const id=String(row.espn_id),found=registry[id];
if(!found||found.canonical_id!==row.id||String(found.espn_id)!==id)throw Error('Logo ID mismatch: '+row.name);
if(!['embedded_roundel','flat','unverified'].includes(found.artwork_type))throw Error('Missing explicit artwork type: '+row.name);
const color=palette[id];
if(!color||!/^#[0-9a-f]{6}$/i.test(color.primary)||!/^#[0-9a-f]{6}$/i.test(color.secondary)||color.primary===color.secondary)throw Error('Missing two distinct logo colors: '+row.name);
byNcaa.set(row.id,id);for(let name of [row.name,row.espn_name,found.school,found.display_name,found.provider_team_name])alias(name,id);
}
if(byNcaa.size!==365)throw Error('Incomplete NCAA crosswalk');
// Official schedule lists UT Chattanooga; this is the NCAA Division I Chattanooga Mocs.
alias('UT Chattanooga','236');
// Reviewed official-school labels that differ from the provider's directory names.
alias("University of Mississippi","145");
alias("Central Connecticut State University","2115");
alias("North Carolina A&T State University","2448");
alias("Bethune-Cookman University","2065");
alias("Texas-Arlington","250");
alias("Tennessee-Martin","2630");
alias("University of Tennessee at Martin","2630");
alias("University of Tennessee at Chattanooga","236");
// Exact identities from the 365-school crosswalk, reviewed against schedule labels.
alias("University of Southern Mississippi","2572");
alias("Southern Mississippi","2572");
alias("University of Nebraska at Omaha","2437");
alias("UMKC","140");
alias("Missouri-Kansas City","140");
alias("California State University at Fullerton","2239");
alias("University of North Carolina Wilmington","350");
alias("University of Illinois Chicago","82");
alias("Stephen F. Austin","2617");
alias("McNeese State","2377");
alias("McNeese State University","2377");
alias("San Jose State","23");
alias("Brigham Young","252");
alias("Arkansas State University","2032");
alias("Arkansas Little Rock","2031");
alias("University of California Santa Barbara","2540");
alias("Central Connecticut State","2115");
alias("North Carolina A&T State","2448");
alias("Texas A&M - Corpus Christi","357");
alias("Texas A&M-Corpus Christi","357");
alias("Univ. of Washington","264");
alias("Univ. of Seattle","2547");
alias("Florida International University","2229");
alias("Long Beach State University","299");
alias("Virginia Commonwealth University","2670");
alias("South Carolina State University","2569");
alias("SC State","2569");
alias("Ragin' Cajuns","309");
alias("University of North Carolina at Wilmington","350");
alias("University of California at Santa Barbara","2540");
alias("University of California, Santa Barbara","2540");
alias("California State University Fullerton","2239");
for(const [id,entry] of Object.entries(outside)){
 if(registry[id]||!safeURL(entry.logo_url)||!/^#[0-9a-f]{6}$/i.test(entry.primary||'')||
   !/^#[0-9a-f]{6}$/i.test(entry.secondary||'')||
   entry.primary.toLowerCase()===entry.secondary.toLowerCase())continue;
 registerOutside(id,entry);
}
return true;
}catch(e){console.error('MBB logo registry:',e);return false}
})();
function render(options={}){
const name=String(options.name||'Team'),ncaa=String(options.ncaaId||''),given=String(options.espnId||'');
const resolved=byNcaa.get(ncaa)||'',byTitle=byName.get(norm(name))||'';
let id=resolved||given||byTitle;
// When a dated school calendar has a stale ESPN opponent ID, an unambiguous
// official crosswalk name takes priority. Never substitute a fuzzy match.
if(!ncaa&&byTitle&&given&&byTitle!==given)id=byTitle;
if((resolved&&given&&resolved!==given)||(ncaa&&registry[id]?.canonical_id!==ncaa))id='';
// For an explicitly named non-D-I opponent, the exact curated school identity
// takes precedence over a stale or reused Division I provider ID. Never infer
// a non-D-I identity from a numeric ESPN ID alone.
// Try exact aliases first; fixture feeds often append a mascot to the
// certified school name. Resolve such a suffix only when there is exactly
// one eligible outside-division school (never a fuzzy cross-school guess).
function outsideSchoolId(value){
 const key=norm(value);
 if(outsideByName.has(key))return outsideByName.get(key);
 if(byName.has(key)||key.length<8)return '';
 const matches=new Set();
 for(const [alias,id] of outsideByName){
  if(alias.length>=8&&key.startsWith(alias)&&key.length>alias.length)matches.add(id);
  // Allow shorter exact school labels when the catalog lists the full university
  // name or a mascot suffix. Only a unique school survives the ambiguity guard.
  if(key.length>=8&&alias.startsWith(key)&&alias.length>key.length)matches.add(id);
  if(matches.size>1)return '';
 }
 return matches.size===1?[...matches][0]:'';
}
const outsideNameId=!ncaa?outsideSchoolId(name):'';
const outsideNameEntry=outsideNameId?outside[outsideNameId]:null;
const outsideExact=!!outsideNameEntry&&outsideSchoolId(name)===outsideNameId;
// A supplied provider ID with a matching school alias retains THAT verified
// artwork, even if another provider has the same university under a different
// numeric or NCAA ID. A stale or mismatched ID is still rejected by name.
const directOutside=!ncaa&&!registry[id]&&!!outside[id]&&outsideAliases(outside[id]).includes(norm(name));
const known=(outsideExact||directOutside)?null:(registry[id]||null);
const outsideID=directOutside?id:outsideExact?outsideNameId:'';
const outsideEntry=outsideID&&outside[outsideID]&&(outsideSchoolId(name)===outsideID||outsideAliases(outside[outsideID]).includes(norm(name)))?outside[outsideID]:null;
const school=known,brand=known?palette[id]:outsideEntry,art=known?school.artwork_type:outsideEntry?'flat':'unverified';
const primary=known?(school.logo_url_verified?safeURL(school.official_logo_url||school.logo_url):''):
 outsideEntry?safeURL(outsideEntry.logo_url):'';
const backup=known?(school.provider_logo_candidates||[]).map(safeURL).find(x=>x&&x!==primary)||'':
 outsideEntry?safeURL(outsideEntry.logo_alternate_url)||'':'';
const initials=name.split(/\s+/).slice(0,2).map(v=>v[0]||'').join('').toUpperCase();
const kind=/^(small|score|power|schedule|hero|featured|history)$/.test(options.size||'')?options.size:'small';
const clr=brand?.primary||'#385866',alt=brand?.secondary||'#597582';
return '<span class="mbb-mark mbb-mark--'+kind+' mbb-mark--art-'+art+(primary?'':' mbb-mark--missing')+'" style="--mbb-primary:'+esc(clr)+';--mbb-secondary:'+esc(alt)+'" data-espn-id="'+esc(known?id:(outsideEntry?outsideID:''))+'" data-artwork="'+esc(art)+'" data-ring-count="2" role="img" aria-label="'+esc(name)+' logo"><span class="mbb-mark__initials" aria-hidden="true">'+esc(initials)+'</span>'+(primary?'<img class="mbb-mark__img" src="'+esc(primary)+'" data-logo-alternate="'+esc(backup)+'" loading="lazy" decoding="async" alt="" onerror="window.MBBLogos.fail(this)">':'')+'</span>';
}
function fail(img){
if(!(img instanceof HTMLImageElement))return;
const alt=safeURL(img.dataset.logoAlternate);
if(alt&&img.src!==alt){img.dataset.logoAlternate='';img.src=alt;return;}
img.closest('.mbb-mark')?.classList.add('mbb-mark--missing');img.remove();
}
// Repair wrappers left by an older cached publisher decorator. The marker
// prevents that old script from wrapping the same artwork a second time.
function stripLegacyRings(root=document){
 const badges=new Set();
 if(root.matches?.('.mbb-mark'))badges.add(root);
 const owner=root.closest?.('.mbb-mark');if(owner)badges.add(owner);
 root.querySelectorAll?.('.mbb-mark').forEach(b=>badges.add(b));
 for(const badge of badges){
  badge.classList.remove('slt-dual-shell');
  for(const wrapper of badge.querySelectorAll('.slt-mark')){
   const img=wrapper.querySelector('img.mbb-mark__img');
   if(img){img.dataset.sltMarkState='1';wrapper.replaceWith(img);}
  }
  for(const img of badge.querySelectorAll('img.mbb-mark__img')){
   img.classList.remove('slt-dual-image');
   for(const prop of ['border','outline','box-shadow','padding','border-radius','background'])img.style.removeProperty(prop);
  }
 }
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
w.MBBLogos={ready,render,byNCAA:(id,size,name)=>render({ncaaId:id,name,size}),byESPN:(id,size,name)=>render({espnId:id&& (registry[String(id)]||outside[String(id)])?String(id):'',name:name||registry[String(id)]?.school||outside[String(id)]?.corrected_name||outside[String(id)]?.school,size}),byName:(name,size)=>render({name,size}),fail,stripLegacyRings,upgradeLegacyCalendar,upgradeBareLogos,logoURL:id=>registry[byNcaa.get(id)]?.logo_url||'',colorForESPN:id=>palette[String(id)]?{...palette[String(id)]}:outside[String(id)]?{primary:outside[String(id)].primary,secondary:outside[String(id)].secondary}:null,schoolNameForESPN:id=>String(registry[String(id)]?.school||outside[String(id)]?.corrected_name||outside[String(id)]?.school||'').replace(/\bSt\.$/,'State')};
ready.then(ok=>{
 if(!ok)return;
 const run=()=>{stripLegacyRings(document);upgradeLegacyCalendar();upgradeBareLogos(document)};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
 if(document.documentElement)new MutationObserver(changes=>{for(const change of changes)for(const node of change.addedNodes)if(node.nodeType===1){upgradeBareLogos(node);stripLegacyRings(node)}}).observe(document.documentElement,{subtree:true,childList:true});
});
})(window);
