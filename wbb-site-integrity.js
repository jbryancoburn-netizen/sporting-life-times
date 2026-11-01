/* NCAA women's basketball: source-attributed site disputes; do not guess home court. */
(function(w){
'use strict';
const validId=s=>/^\d+$/.test(String(s??''));
const safeURL=s=>typeof s==='string'&&/^https:\/\//i.test(s)?s:'';
function index(doc){
 const map=new Map();
 if(doc?.season!=='2026-27'||doc?.gender!=='women'||doc.status!=='unresolved_university_site_claims'||
    !Array.isArray(doc.games))return map;
 for(const r of doc.games){
  if(!r||!validId(r.game_id)||!validId(r.team_id)||
     !['home','away','neutral'].includes(r.published_site)||
     !['home','away','neutral'].includes(r.university_listed_site)||
     r.published_site===r.university_listed_site||!safeURL(r.source_url))continue;
  const id=String(r.game_id),set=map.get(id)||[];
  if(set.some(x=>x.team_id===String(r.team_id)))continue;
  set.push({...r,game_id:id,team_id:String(r.team_id)});
  map.set(id,set);
 }
 return map;
}
function claims(game,map){
 if(!game||!map||!validId(game.id)||game.status==='final'||game.completed)return [];
 return (map.get(String(game.id))||[]).filter(r=>{
  const isParticipant=[game.home_id,game.away_id].map(String).includes(r.team_id);
  if(!isParticipant)return false;
  // Recheck the exact contested school perspective against published
  // game identity; do not attach a stale claim to a changed home/away mapping.
  const expected=(game.neutral===true||game.site==='neutral')?'neutral':
   String(game.home_id)===r.team_id?'home':'away';
  return expected===r.published_site;
 });
}
function note(claims){
 if(!claims.length)return '';
 return claims.some(x=>x.site_evidence==='vs_prefix')?
  'Venue review: university “vs.” listing does not prove an on-campus game.':
  'Venue review: university site designation differs from the published calendar.';
}
w.WBBSiteIntegrity={index,claims,note,safeURL};
})(window);
