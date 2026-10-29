/* One NCAA Division I men's basketball logo identity + rendering contract. */
(function(w){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'');
const safeURL=v=>{try{let u=new URL(v);return u.protocol==='https:'?u.href:''}catch{return ''}};
const byNcaa=new Map(),byName=new Map(),ambiguous=new Set();let registry={};
function alias(n,id){let key=norm(n);if(!key||ambiguous.has(key))return;if(byName.has(key)&&byName.get(key)!==id){ambiguous.add(key);byName.delete(key)}else byName.set(key,id)}
const ready=(async()=>{
try{
const [reg,cross]=await Promise.all(['data/mbb-logo-registry.json','data/ncaam-2026-27-espn-team-crosswalk.json'].map(p=>fetch(p,{cache:'force-cache'}).then(x=>{if(!x.ok)throw Error(p+' '+x.status);return x.json()})));
if(Object.keys(reg.teams||{}).length!==365||cross.teams?.length!==365)throw Error('Incomplete 365-team logo registry');
registry=reg.teams;
for(let row of cross.teams){
const id=String(row.espn_id),found=registry[id];
if(!found||found.canonical_id!==row.id||String(found.espn_id)!==id)throw Error('Logo ID mismatch: '+row.name);
byNcaa.set(row.id,id);for(let name of [row.name,row.espn_name,found.school,found.display_name,found.provider_team_name])alias(name,id);
}
if(byNcaa.size!==365)throw Error('Incomplete NCAA crosswalk');return true;
}catch(e){console.error('MBB logo registry:',e);return false}
})();
function render(options={}){
const name=String(options.name||'Team'),ncaa=String(options.ncaaId||''),given=String(options.espnId||'');
const resolved=byNcaa.get(ncaa)||'',byTitle=byName.get(norm(name))||'';
let id=resolved||given||byTitle;
if((resolved&&given&&resolved!==given)||(byTitle&&id!==byTitle)||!registry[id]||(ncaa&&registry[id].canonical_id!==ncaa))id='';
const school=registry[id],color=school?.primary_color,ring=/^[a-f0-9]{6}$/i.test(color||'')?'#'+color:'#385866';
const primary=school?.logo_url_verified?safeURL(school.official_logo_url||school.logo_url):'';
const backup=(school?.provider_logo_candidates||[]).map(safeURL).find(x=>x&&x!==primary)||'';
const initials=name.split(/\s+/).slice(0,2).map(v=>v[0]||'').join('').toUpperCase();
const kind=/^(small|score|power|schedule|hero|featured|history)$/.test(options.size||'')?options.size:'small';
return '<span class="mbb-mark mbb-mark--'+kind+(primary?'':' mbb-mark--missing')+'" style="--mbb-ring:'+esc(ring)+'" data-espn-id="'+esc(id)+'" role="img" aria-label="'+esc(name)+' logo"><span class="mbb-mark__initials" aria-hidden="true">'+esc(initials)+'</span>'+(primary?'<img class="mbb-mark__img" src="'+esc(primary)+'" data-logo-alternate="'+esc(backup)+'" loading="lazy" decoding="async" alt="" onerror="window.MBBLogos.fail(this)">':'')+'</span>';
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
w.MBBLogos={ready,render,byNCAA:(id,size,name)=>render({ncaaId:id,name,size}),byESPN:(id,size,name)=>render({espnId:id&&registry[String(id)]?String(id):'',name,size}),byName:(name,size)=>render({name,size}),fail,upgradeLegacyCalendar,logoURL:id=>registry[byNcaa.get(id)]?.logo_url||''};
ready.then(ok=>{if(ok)upgradeLegacyCalendar()});
})(window);
