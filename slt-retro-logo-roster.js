/* Sporting Life & Times / draft 1980s basketball logo resolver.
   One roster: fetch existing Victorian identity catalogs; historic logos are optional overlays.
   No existing production page imports this script. */
(function(root){
'use strict';
const paths={
  retro:'data/slt-basketball-retro-logo-overrides.json',
  men:'data/mbb-logo-registry.json',
  women:'data/ncaaw-2026-27-teams.json',
  additional:'data/mbb-out-of-division-opponent-logos.json'
};
let pending=null,cache=null;
function https(value){return typeof value==='string'&&/^https:\/\//i.test(value)?value:null}
function local(value){return typeof value==='string'&&/^[a-z0-9][a-z0-9/._-]*\.(?:png|webp|svg)$/i.test(value)?value:null}
function safe(value){return https(value)||local(value)}
async function getJSON(path){
  const response=await fetch(path,{cache:'no-store'});
  if(!response.ok)throw Error('Logo registry unavailable: '+path+' HTTP '+response.status);
  return response.json();
}
function load(){
  if(cache)return Promise.resolve(cache);
  if(pending)return pending;
  pending=Promise.all([getJSON(paths.retro),getJSON(paths.men),getJSON(paths.women),getJSON(paths.additional)])
   .then(([retro,men,women,additional])=>{
      if(retro?.schema!=='slt-basketball-logo-overrides-v1'||retro?.nba?.length!==30)throw Error('Incorrect retro overlay');
      const male=men?.teams||{},female=women?.teams||[],extra=additional?.teams||{};
      if(Object.keys(male).length!==365||female.length!==363||Object.keys(extra).length!==674)throw Error('Original Victorian roster changed: review source IDs before release');
      const femaleIds=new Set(female.map(t=>String(t.team_id)));
      if([...femaleIds].some(id=>!male[id]))throw Error('Women’s roster identity mismatch');
      cache={retro,men:male,womenIds:femaleIds,additional:extra};
      return cache;
   }).catch(e=>{pending=null;throw e});
  return pending;
}
function nba(b,code,options){
  const key=String(code||'').trim().toUpperCase();
  const t=b.retro.nba.find(record=>record.code===key);if(!t)return null;
  const current=safe('assets/nba-logos/'+key+'.png');
  const candidate=https(t.retro_logo);
  const approved=t.historical_artwork_quality==='approved_hd_visual_and_source';
  const useHistorical=Boolean(candidate&&(approved||options?.allowUnverifiedArchivePreview));
  return Object.freeze({id:key,team:t.team,src:useHistorical?candidate:current,
    fallback:current,era:t.retro_era||null,
    historical_name:t.heritage_predecessor?t.retro_label:null,
    true_1980s:t.retro_status==='historic_mark_in_use_during_1980s',
    quality_approved:approved,preview_only:useHistorical&&!approved,
    source:t.archival_source||null});
}
function college(b,id,options){
  const key=String(id||'').trim(),t=b.men[key];if(!t)return null;
  const overlay=b.retro.ncaa_by_espn_id?.[key]||{};
  const current=https(t.official_logo_url)||https(t.logo_url);
  const candidate=https(overlay.retro_logo);
  const approved=overlay.historical_artwork_quality==='approved_hd_visual_and_source';
  const useHistorical=Boolean(candidate&&(approved||options?.allowUnverifiedArchivePreview));
  return Object.freeze({id:key,team:t.display_name||t.school,men:true,women:b.womenIds.has(key),
    src:useHistorical?candidate:current,fallback:current,era:overlay.retro_years||null,
    verified_current_source:t.logo_url_verified===true,quality_approved:approved,
    preview_only:useHistorical&&!approved,source:'data/mbb-logo-registry.json'});
}
function opponent(b,id){
  const key=String(id||'').trim(),t=b.additional[key];if(!t)return null;
  return Object.freeze({id:key,team:t.school||t.feed_name,
    src:https(t.logo_url),fallback:null,identity_status:t.identity_verification||'unverified',
    division_one:false,source:'data/mbb-out-of-division-opponent-logos.json'});
}
function mountImage(img,record,options){
  if(!img||!record)throw Error('Image and team record required');
  const primary=safe(record.src),fallback=safe(record.fallback),min=Number(options?.minimumIntrinsicPx)||240;
  if(!primary&&!fallback){img.removeAttribute('src');img.dataset.logoQuality='missing';return img}
  let usingFallback=false;
  function revert(reason){
    if(fallback&&!usingFallback&&img.src!==fallback&&!img.src.endsWith(fallback)){
      usingFallback=true;img.dataset.logoQuality='fallback-'+reason;img.src=fallback;
    }else img.dataset.logoQuality='failed-'+reason;
  }
  img.loading='lazy';img.decoding='async';
  img.onerror=()=>revert('broken-url');
  img.onload=()=>{
    if((img.naturalWidth<min||img.naturalHeight<min)&&!usingFallback){revert('low-resolution');return}
    img.dataset.logoQuality=usingFallback?'fallback-loaded':'source-resolution-pass';
  };
  img.src=primary||fallback;
  return img;
}
root.SLTBasketballRetroLogos=Object.freeze({
 load,
 nba:async(code,options)=>nba(await load(),code,options),
 college:async(id,options)=>college(await load(),id,options),
 opponent:async(id)=>opponent(await load(),id),
 mountImage,
 counts:async()=>{const b=await load();return Object.freeze({nba:b.retro.nba.length,ncaa_men:Object.keys(b.men).length,ncaa_women:b.womenIds.size,additional_opponents:Object.keys(b.additional).length})}
});
})(typeof window!=='undefined'?window:globalThis);
