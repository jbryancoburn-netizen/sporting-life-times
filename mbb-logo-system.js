/* One NCAA Division I men's basketball logo identity + rendering contract. */
(function(w){
'use strict';
// Do not redecorate football or soccer logos in the shared live-game page.
const onVictorianLivePage=/\/live-game\.html$/i.test(String(w.location?.pathname||''));
if(onVictorianLivePage&&!['ncaam','ncaaw'].includes(new URLSearchParams(String(w.location?.search||'')).get('league')))return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'');
// Exact ESPN identities of the 18 current Big Ten members; no guessed aliases.
// Use real original-era mascot artwork over generic helmets or lettermarks.
const BIG_TEN_HERITAGE=Object.freeze({
 '84':'assets/cbb-big-ten-1980s/centered/indiana.png?v=20261114-bigten-live1',
 '356':'assets/cbb-big-ten-1980s/centered/illinois.png?v=20261114-bigten-live1',
 '2294':'assets/cbb-big-ten-1980s/centered/iowa.png?v=20261114-bigten-live1',
 '130':'assets/cbb-big-ten-1980s/centered/michigan.png?v=20261114-bigten-live1',
 '127':'assets/cbb-big-ten-1980s/centered/michigan-state-gruff.png?v=20261114-gruff-full-art1',
 '135':'assets/cbb-big-ten-1980s/centered/minnesota.png?v=20261114-bigten-live1',
 '77':'assets/cbb-big-ten-1980s/centered/northwestern.png?v=20261114-bigten-live1',
 '194':'assets/cbb-big-ten-1980s/centered/ohio-state.png?v=20261114-bigten-live1',
 '2509':'assets/cbb-big-ten-1980s/centered/purdue.png?v=20261114-bigten-live1',
 '275':'assets/cbb-big-ten-1980s/centered/wisconsin.png?v=20261114-bigten-live1',
 '213':'assets/cbb-big-ten-1980s/centered/penn-state.png?v=20261114-bigten-live1',
 '158':'assets/cbb-big-ten-1980s/centered/nebraska.png?v=20261114-bigten-live1',
 '120':'assets/cbb-big-ten-1980s/centered/maryland-terrapin.png?v=20261114-bigten-live1',
 '164':'assets/cbb-big-ten-1980s/centered/rutgers.png?v=20261114-bigten-live1',
 '26':'assets/cbb-big-ten-1980s/centered/ucla.png?v=20261114-bigten-live1',
 '30':'assets/cbb-big-ten-1980s/centered/usc.png?v=20261114-bigten-live1',
 '2483':'assets/cbb-big-ten-1980s/centered/oregon.png?v=20261114-bigten-live1',
 '264':'assets/cbb-big-ten-1980s/centered/washington.png?v=20261114-bigten-live1'
});
// Exact ACC school IDs, never name-matched or inferred from conference.
// Every vintage emblem is self-hosted, source-provenanced and ring-safe.
const ACC_HERITAGE=Object.freeze({
 '24':'assets/cbb-acc-1980s/stanford.png?v=20261114-acc18-live1',
 '25':'assets/cbb-acc-1980s/california.png?v=20261114-acc18-live1',
 '52':'assets/cbb-acc-1980s/florida-state.png?v=20261114-acc18-live1',
 '59':'assets/cbb-acc-1980s/georgia-tech.png?v=20261114-acc18-live1',
 '87':'assets/cbb-acc-1980s/notre-dame.png?v=20261114-acc18-live1',
 '97':'assets/cbb-acc-1980s/louisville.png?v=20261114-acc18-live1',
 '103':'assets/cbb-acc-1980s/boston-college.png?v=20261114-acc18-live1',
 '150':'assets/cbb-acc-1980s/duke.png?v=20261114-acc18-live1',
 '152':'assets/cbb-acc-1980s/nc-state.png?v=20261114-acc18-live1',
 '153':'assets/cbb-acc-1980s/north-carolina.png?v=20261114-acc18-live1',
 '154':'assets/cbb-acc-1980s/wake-forest.png?v=20261114-acc18-live1',
 '183':'assets/cbb-acc-1980s/syracuse.png?v=20261114-acc18-live1',
 '221':'assets/cbb-acc-1980s/pittsburgh.png?v=20261114-pitt-standing-1980-approved1',
 '228':'assets/cbb-acc-1980s/clemson.png?v=20261114-acc18-live1',
 '258':'assets/cbb-acc-1980s/virginia.png?v=20261114-acc18-live1',
 '259':'assets/cbb-acc-1980s/virginia-tech.png?v=20261114-acc18-live1',
 '2390':'assets/cbb-acc-1980s/miami.png?v=20261114-acc18-live1',
 '2567':'assets/cbb-acc-1980s/smu.png?v=20261114-acc18-live1'
});
const SEC_HERITAGE=Object.freeze({
 '333':'assets/cbb-sec-1980s/alabama.png?v=20261114-sec16-live1',
 '8':'assets/cbb-sec-1980s/arkansas.png?v=20261114-sec16-live1',
 '2':'assets/cbb-sec-1980s/auburn.png?v=20261114-sec16-live1',
 '57':'assets/cbb-sec-1980s/florida.png?v=20261114-sec16-live1',
 '61':'assets/cbb-sec-1980s/georgia.png?v=20261114-sec16-live1',
 '96':'assets/cbb-sec-1980s/kentucky.png?v=20261114-sec16-live1',
 '99':'assets/cbb-sec-1980s/lsu.png?v=20261114-sec16-live1',
 '344':'assets/cbb-sec-1980s/mississippi-state.png?v=20261114-sec16-live1',
 '142':'assets/cbb-sec-1980s/missouri.png?v=20261114-sec16-live1',
 '201':'assets/cbb-sec-1980s/oklahoma.png?v=20261114-sec16-live1',
 '145':'assets/cbb-sec-1980s/ole-miss.png?v=20261114-sec16-live1',
 '2579':'assets/cbb-sec-1980s/south-carolina.png?v=20261114-sec16-live1',
 '2633':'assets/cbb-sec-1980s/tennessee.png?v=20261114-sec16-live1',
 '251':'assets/cbb-sec-1980s/texas.png?v=20261114-sec16-live1',
 '245':'assets/cbb-sec-1980s/texas-am.png?v=20261114-sec16-live1',
 '238':'assets/cbb-sec-1980s/vanderbilt.png?v=20261114-sec16-live1'
});
const BIG_EAST_HERITAGE=Object.freeze({
 '2086':'assets/cbb-big-east-1980s/butler.png?v=20261114-bigeast-refresh2',
 '156':'assets/cbb-big-east-1980s/creighton.png?v=20261114-bigeast-refresh2',
 '305':'assets/cbb-big-east-1980s/depaul.png?v=20261114-bigeast-refresh2',
 '46':'assets/cbb-big-east-1980s/georgetown.png?v=20261114-bigeast-refresh2',
 '269':'assets/cbb-big-east-1980s/marquette.png?v=20261114-bigeast-refresh2',
 '2507':'assets/cbb-big-east-1980s/providence.png?v=20261114-bigeast-refresh2',
 '2550':'assets/cbb-big-east-1980s/seton-hall.png?v=20261114-bigeast-refresh2',
 '2599':'assets/cbb-big-east-1980s/st-johns.png?v=20261114-bigeast-refresh2',
 '41':'assets/cbb-big-east-1980s/uconn.png?v=20261114-bigeast-refresh2',
 '222':'assets/cbb-big-east-1980s/villanova.png?v=20261114-bigeast-refresh2',
 '2752':'assets/cbb-big-east-1980s/xavier.png?v=20261114-bigeast-refresh2'
});
const A10_HERITAGE=Object.freeze({
 '2244':'assets/cbb-atlantic-10-1980s/george-mason.png?v=source-optical-audit-20261115-2',
 '45':'assets/cbb-atlantic-10-1980s/george-washington.png?v=20261114-a10-refresh2',
 '2350':'assets/cbb-atlantic-10-1980s/loyola-chicago.png?v=normalized-source-20261115-1',
 '227':'assets/cbb-atlantic-10-1980s/rhode-island.png?v=normalized-source-20261115-1',
 '2184':'assets/cbb-atlantic-10-1980s/duquesne.png?v=a10-archive-20261114-1',
 '2325':'assets/cbb-atlantic-10-1980s/la-salle.png?v=a10-archive-20261114-1',
 '2603':'assets/cbb-atlantic-10-1980s/saint-joseph-s.png?v=a10-archive-20261114-1',
 '2670':'assets/cbb-atlantic-10-1980s/vcu.png?v=source-optical-audit-20261115-2',
 '2166':'assets/cbb-atlantic-10-1980s/davidson.png?v=a10-archive-20261114-1',
 '2168':'assets/cbb-atlantic-10-1980s/dayton.png?v=a10-archive-20261114-1',
 '2230':'assets/cbb-atlantic-10-1980s/fordham.png?v=source-optical-audit-20261115-2',
 '139':'assets/cbb-atlantic-10-1980s/saint-louis.png?v=a10-archive-20261114-1',
 '179':'assets/cbb-atlantic-10-1980s/st-bonaventure.png?v=a10-archive-20261114-3'
});
const MOUNTAIN_WEST_HERITAGE=Object.freeze({
 '167':'assets/cbb-mountain-west-1980s/new-mexico.png?v=source-optical-audit-20261115-2',
 '2005':'assets/cbb-mountain-west-1980s/air-force.png?v=mountain-west-heritage-20261114-1',
 '2253':'assets/cbb-mountain-west-1980s/grand-canyon.png?v=mountain-west-heritage-20261114-1',
 '2440':'assets/cbb-mountain-west-1980s/nevada.png?v=mountain-west-heritage-20261114-1',
 '23':'assets/cbb-mountain-west-1980s/san-jose-state.png?v=source-optical-audit-20261115-2',
 '2638':'assets/cbb-mountain-west-1980s/utep.png?v=utep-basketball-20261114-2',
 '62':'assets/cbb-mountain-west-1980s/hawaii.png?v=mountain-west-heritage-20261114-1',
 '302':'assets/cbb-mountain-west-1980s/uc-davis.png?v=mountain-west-heritage-20261114-1',
 '2439':'assets/cbb-mountain-west-1980s/unlv.png?v=mountain-west-heritage-20261114-1',
 '2751':'assets/cbb-mountain-west-1980s/wyoming.png?v=mountain-west-heritage-20261114-1'
});
const retroURLForESPN=id=>BIG_TEN_HERITAGE[String(id)]||ACC_HERITAGE[String(id)]||SEC_HERITAGE[String(id)]||BIG_EAST_HERITAGE[String(id)]||A10_HERITAGE[String(id)]||MOUNTAIN_WEST_HERITAGE[String(id)]||'';

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
const school=known,brand=known?palette[id]:outsideEntry;
const heritage=known?retroURLForESPN(id):'';
// The complete 512px two-ring badge is precomposed into this self-hosted PNG.
const baked=heritage?'assets/cbb-heritage-medallions/'+id+'.png?v=20261115-asset-baked1':'';
const art=heritage?'flat':known?school.artwork_type:outsideEntry?'flat':'unverified';
const primary=baked||heritage||(known?(school.logo_url_verified?safeURL(school.official_logo_url||school.logo_url):''):
 outsideEntry?safeURL(outsideEntry.logo_url):'');
// Keep verified modern artwork as the fallback whenever a vintage local asset fails.
// No other sport uses this renderer, and the badge retains its two-color ring.
const modern=known?(school.logo_url_verified?safeURL(school.official_logo_url||school.logo_url):''):'';
// Local heritage artwork must not silently switch to a modern third-party
// logo. If a selected local file is unavailable, fail visibly for audit.
const backup=heritage?'':known?(school.provider_logo_candidates||[]).map(safeURL).find(x=>x&&x!==primary)||'':
 outsideEntry?safeURL(outsideEntry.logo_alternate_url)||'':'';
const initials=name.split(/\s+/).slice(0,2).map(v=>v[0]||'').join('').toUpperCase();
const kind=/^(small|score|power|schedule|hero|featured|history)$/.test(options.size||'')?options.size:'small';
const clr=brand?.primary||'#385866',alt=brand?.secondary||'#597582';
return '<span class="mbb-mark mbb-mark--'+kind+' mbb-mark--art-'+art+(heritage?' mbb-mark--heritage':'')+(baked?' mbb-mark--baked':'')+(primary?'':' mbb-mark--missing')+'" style="--mbb-primary:'+esc(clr)+';--mbb-secondary:'+esc(alt)+'" data-espn-id="'+esc(known?id:(outsideEntry?outsideID:''))+'" data-artwork="'+esc(art)+'" data-ring-count="2" role="img" aria-label="'+esc(name)+' logo"><span class="mbb-mark__initials" aria-hidden="true">'+esc(initials)+'</span>'+(primary?'<img class="mbb-mark__img" src="'+esc(primary)+'" data-logo-alternate="'+esc(backup)+'" loading="lazy" decoding="async" alt="" onerror="window.MBBLogos.fail(this)">':'')+'</span>';
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
w.MBBLogos={ready,render,byNCAA:(id,size,name)=>render({ncaaId:id,name,size}),byESPN:(id,size,name)=>render({espnId:id&& (registry[String(id)]||outside[String(id)])?String(id):'',name:name||registry[String(id)]?.school||outside[String(id)]?.corrected_name||outside[String(id)]?.school,size}),byName:(name,size)=>render({name,size}),fail,stripLegacyRings,upgradeLegacyCalendar,upgradeBareLogos,logoURL:id=>(retroURLForESPN(byNcaa.get(id)||id)?'assets/cbb-heritage-medallions/'+(byNcaa.get(id)||id)+'.png?v=20261115-asset-baked1':'')||registry[byNcaa.get(id)]?.logo_url||'',retroURLForESPN,heritageTeamIds:()=>Object.keys(BIG_TEN_HERITAGE),heritageACCTeamIds:()=>Object.keys(ACC_HERITAGE),heritageSECTeamIds:()=>Object.keys(SEC_HERITAGE),heritageBigEastTeamIds:()=>Object.keys(BIG_EAST_HERITAGE),heritageMountainWestTeamIds:()=>Object.keys(MOUNTAIN_WEST_HERITAGE),heritageA10TeamIds:()=>Object.keys(A10_HERITAGE),colorForESPN:id=>palette[String(id)]?{...palette[String(id)]}:outside[String(id)]?{primary:outside[String(id)].primary,secondary:outside[String(id)].secondary}:null,schoolNameForESPN:id=>String(registry[String(id)]?.school||outside[String(id)]?.corrected_name||outside[String(id)]?.school||'').replace(/\bSt\.$/,'State')};
ready.then(ok=>{
 if(!ok)return;
 const run=()=>{stripLegacyRings(document);upgradeLegacyCalendar();upgradeBareLogos(document)};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
 if(document.documentElement)new MutationObserver(changes=>{for(const change of changes)for(const node of change.addedNodes)if(node.nodeType===1){upgradeBareLogos(node);stripLegacyRings(node)}}).observe(document.documentElement,{subtree:true,childList:true});
});
})(window);
