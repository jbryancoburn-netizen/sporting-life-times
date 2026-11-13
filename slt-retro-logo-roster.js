/* Sporting Life & Times / non-production historic basketball identity resolver.
   Reads the existing Victorian roster by ID and treats historic marks as provenance-bound overrides.
   Do not include this script on existing Victorian pages until quality tests and release approval. */
(function(root){
  'use strict';
  const MANIFEST='data/slt-basketball-retro-logo-overrides.json';
  let cache=null, pending=null;
  const https=u=>typeof u==='string'&&/^https:\/\//i.test(u)?u:null;
  const local=u=>typeof u==='string'&&/^[a-z0-9][a-z0-9/._-]*\.(?:png|webp|svg)$/i.test(u)?u:null;
  const safe=u=>https(u)||local(u);
  function load(){
    if(cache)return Promise.resolve(cache);
    if(pending)return pending;
    pending=fetch(MANIFEST,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Retro logo registry '+r.status);return r.json()}).then(r=>{
      if(r?.schema!=='slt-basketball-logo-overrides-v1'||r?.nba?.length!==30||Object.keys(r?.ncaa_by_espn_id||{}).length!==365||Object.keys(r?.outside_di_overrides||{}).length!==674)throw Error('Incomplete logo roster');
      cache=r;return r;
    }).catch(e=>{pending=null;throw e});
    return pending;
  }
  function resolvedNBA(manifest,code,opts){
    const t=manifest.nba.find(t=>t.code===String(code||'').trim().toUpperCase());
    if(!t)return null;
    const baseline=safe(t.victorian_logo);
    const candidate=https(t.retro_logo);
    const approved=t.historical_artwork_quality==='approved_hd_visual_and_source';
    const preview=opts?.allowUnverifiedArchivePreview===true;
    const useVintage=Boolean(candidate&&(approved||preview));
    return Object.freeze({code:t.code,team:t.team,src:useVintage?candidate:baseline,fallback:baseline,era:t.retro_era,previous_identity:t.heritage_predecessor? t.retro_label:null,is_true_1980s:t.retro_status==='historic_mark_in_use_during_1980s',is_quality_approved:approved,preview_only:useVintage&&!approved,source:t.archival_source,identity_source:'Victorian NBA roster'});
  }
  function resolvedCollege(manifest,id,opts){
    const key=String(id||'').trim();const t=manifest.ncaa_by_espn_id[key];
    if(!t)return null;
    const current=safe(t.modern_logo),candidate=https(t.retro_logo);
    const approved=t.historical_artwork_quality==='approved_hd_visual_and_source',preview=opts?.allowUnverifiedArchivePreview===true;
    const useVintage=Boolean(candidate&&(approved||preview));
    return Object.freeze({id:key,team:t.display_name,men:t.mens,women:t.womens,src:useVintage?candidate:current,fallback:current,era:t.retro_years,preview_only:useVintage&&!approved,is_quality_approved:approved,identity_source:t.modern_logo_source});
  }
  function resolvedOpponent(manifest,id){
    const key=String(id||'').trim(),t=manifest.outside_di_overrides[key];if(!t)return null;
    return Object.freeze({id:key,team:t.school,src:safe(t.modern_logo),fallback:null,identity_status:t.identity_status,division_one:false});
  }
  /* Browser-side fail-safe: do not show a low-resolution retro asset when the
     original team artwork is clearer. The fallback never fabricates artwork. */
  function mountImage(img,record,opts){
    if(!img||!record)throw Error('A DOM image and valid logo record are required');
    const target=safe(record.src),fallback=safe(record.fallback);
    const minimum=Number(opts?.minimumIntrinsicPx)||240;
    if(!target&&!fallback){img.removeAttribute('src');img.dataset.logoQuality='missing';return img}
    let fallbackActive=false;
    function swap(reason){
      if(fallback&&!fallbackActive&&fallback!==img.src&&!String(img.src).endsWith(fallback)){
        fallbackActive=true;img.dataset.logoQuality='fallback-'+reason;img.src=fallback;
      }else{img.dataset.logoQuality='failed-'+reason}
    }
    img.decoding='async';img.loading='lazy';
    img.onerror=function(){swap('unavailable')};
    img.onload=function(){
      if((img.naturalWidth<minimum||img.naturalHeight<minimum)&&!fallbackActive){swap('low-resolution');return}
      img.dataset.logoQuality=fallbackActive?'fallback-loaded':'resolution-pass';
    };
    img.src=target||fallback;
    return img;
  }
  root.SLTBasketballRetroLogos=Object.freeze({
    load,
    nba:async(code,opts)=>resolvedNBA(await load(),code,opts),
    college:async(id,opts)=>resolvedCollege(await load(),id,opts),
    opponent:async id=>resolvedOpponent(await load(),id),
    mountImage,
    counts:async()=>{const r=await load();return Object.freeze({...r.stats})}
  });
})(typeof window!=='undefined'?window:globalThis);
