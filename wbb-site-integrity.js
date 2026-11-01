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
function easternDay(value){
 const dt=new Date(value||'');
 if(!Number.isFinite(dt.getTime()))return '';
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',
  year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(dt);
 const get=k=>parts.find(p=>p.type===k)?.value||'';
 return get('year')+'-'+get('month')+'-'+get('day');
}
function neutrals(doc){
 const found=new Map();
 if(doc?.season!=='2026-27'||doc?.gender!=='women'||
    doc.source_scope!=='two_source_neutral_site_verification'||!Array.isArray(doc.games))return found;
 for(const g of doc.games){
  if(!g||!validId(g.game_id)||!validId(g.team_id)||!validId(g.opponent_id)||
     !/^202[67]-\d\d-\d\d$/.test(g.date||'')||g.verified_site!=='neutral'||
     !safeURL(g.source_url)||!safeURL(g.corroborating_source_url))continue;
  const id=String(g.game_id);
  if(found.has(id)){found.delete(id);continue;} // Ambiguity cannot be promoted.
  found.set(id,g);
 }
 return found;
}
function certifiedNeutral(game,map){
 if(!game||!map||!validId(game.id))return null;
 const row=map.get(String(game.id));
 if(!row||String(row.team_id)===String(row.opponent_id))return null;
 if(new Set([String(game.home_id),String(game.away_id)]).size!==2)return null;
 if(![String(game.home_id),String(game.away_id)].includes(String(row.team_id))||
    ![String(game.home_id),String(game.away_id)].includes(String(row.opponent_id)))return null;
 if(easternDay(game.date)!==row.date)return null;
 return row;
}
function verifiedHomeCourts(doc){
 const map=new Map();
 if(doc?.season!=='2026-27'||doc?.gender!=='women'||doc.status!=='reciprocal_official_home_venue_verified'||!Array.isArray(doc.games))return map;
 for(const r of doc.games){
  const id=String(r.game_id||''),h=String(r.verified_home_id||''),a=String(r.verified_away_id||'');
  if(!validId(id)||!validId(h)||!validId(a)||h===a||
   !/^202[67]-\d\d-\d\d$/.test(r.date||'')||
   !r.venue||!r.city||!Array.isArray(r.sources)||r.sources.length<3||
   new Set(r.sources).size<3||r.sources.some(x=>!safeURL(x)))continue;
  if(map.has(id)){map.delete(id);continue;}
  map.set(id,r);
 }
 return map;
}
function officialHome(game,map){
 if(!game||!map||!validId(game.id)||game.completed||game.status==='final')return null;
 const r=map.get(String(game.id));
 if(!r||easternDay(game.date)!==r.date)return null;
 if(new Set([String(game.home_id),String(game.away_id)]).size!==2)return null;
 if(new Set([String(game.home_id),String(game.away_id)]).size!==new Set([String(r.verified_home_id),String(r.verified_away_id)]).size)return null;
 if(![String(game.home_id),String(game.away_id)].includes(String(r.verified_home_id))||
    ![String(game.home_id),String(game.away_id)].includes(String(r.verified_away_id)))return null;
 return r;
}
function correctedHome(game,map,teamId){
 const r=officialHome(game,map);
 if(!r)return game;
 const result={...game,home_id:String(r.verified_home_id),away_id:String(r.verified_away_id),
  venue:r.venue,city:r.city,neutral:false,official_home_site_verified:true,
  official_home_site_sources:r.sources};
 if(teamId!=null)result.site=String(teamId)===String(r.verified_home_id)?'home':'away';
 return result;
}
function claims(game,map,verifiedNeutralMap){
 if(certifiedNeutral(game,verifiedNeutralMap))return [];
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
w.WBBSiteIntegrity={index,claims,note,safeURL,neutrals,certifiedNeutral,verifiedHomeCourts,officialHome,correctedHome};
})(window);
