/* NBA availability desk v1.
 * Team attribution from ESPN's league-wide team injury endpoint ONLY.
 * No player is inferred from roster-wire names, and statuses NEVER modify
 * scores without a separately validated player-impact model.
 */
(function(root){'use strict';
const API='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries';
const CODES=new Set('ATL BOS BKN CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS'.split(' '));
const ALIAS={NY:'NYK',GS:'GSW',SA:'SAS',NO:'NOP',WSH:'WAS',UTAH:'UTA'};
const code=t=>{const c=String(t||'').toUpperCase();return ALIAS[c]||c;};
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validDate=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?t:null};
const kind=raw=>{
 const s=String(raw||'').toLowerCase().trim().replace(/[-_]/g,' ');
 if(/(^|\b)(out|inactive|suspended)(\b|$)/.test(s))return 'out';
 if(/\bdoubtful\b/.test(s))return 'doubtful';
 if(/\bquestionable\b/.test(s))return 'questionable';
 if(/\bday to day\b|\bgtd\b|game time decision/.test(s))return 'day-to-day';
 if(/\bprobable\b/.test(s))return 'probable';
 return null;
};
const short={out:'OUT',doubtful:'DOUBTFUL',questionable:'QUESTIONABLE','day-to-day':'DAY-TO-DAY',probable:'PROBABLE'};
function parse(json,receivedAt=Date.now()){
 if(!Array.isArray(json?.injuries))return null;
 const teams={};let validTeams=0,matched=0,excluded=0;
 for(const group of json.injuries){
  const raw=code(group?.team?.abbreviation||group?.team?.shortDisplayName);
  if(!CODES.has(raw)||!Array.isArray(group.injuries)){excluded++;continue}
  validTeams++;
  const rows=teams[raw]||[];
  for(const r of group.injuries){
   const status=kind(r.status?.name||r.status?.type||r.status||r.fantasy?.status||'');
   const player=String(r.athlete?.displayName||r.athlete?.fullName||'').trim();
   if(!status||!player){excluded++;continue}
   const id=String(r.athlete?.id||'').trim();
   const key=id?'id:'+id:'name:'+player.toLowerCase();
   const timestamp=validDate(r.date||r.updated||r.details?.updated);
   rows.push({key,player,status,updatedAt:timestamp,injury:String(r.type?.description||r.type?.name||r.location||'').slice(0,80)});
   matched++;
  }
  teams[raw]=rows;
 }
 if(!validTeams)return null;
 for(const [team,list] of Object.entries(teams)){
  // Prevent one athlete having two contradictory statuses.
  const byId=new Map();
  for(const row of list){
   const prev=byId.get(row.key);
   if(!prev||(row.updatedAt||0)>(prev.updatedAt||0))byId.set(row.key,row);
  }
  teams[team]=[...byId.values()].sort((a,b)=>
   ({out:0,doubtful:1,questionable:2,'day-to-day':3,probable:4}[a.status]-
    {out:0,doubtful:1,questionable:2,'day-to-day':3,probable:4}[b.status])||
    a.player.localeCompare(b.player));
 }
 const reportedAt=validDate(json.timestamp||json.updated_at||json.updatedAt);
 // A genuinely stale source should never masquerade as a fresh lineup.
 const age=reportedAt==null?null:receivedAt-reportedAt;
 const current=age==null||(age>=-5*60*1000&&age<=24*60*60*1000);
 return {teams,reportedAt,fetchedAt:receivedAt,current,matched,excluded,
  source:API,attribution:'ESPN team-identified league injury report, NOT starting lineups'};
}
function teamRows(snapshot,team){
 const rows=snapshot.teams[code(team)];
 return Array.isArray(rows)?rows.slice(0,5):[];
}
function card(s,away,home){
 if(!s||!s.current)return '<div class="nba-availability-warning">Injury source unavailable or stale. No injury adjustment is applied to the forecast.</div>';
 const side=t=>{
  const c=code(t),rows=teamRows(s,c),remaining=(s.teams[c]||[]).length-rows.length;
  return '<div class="nba-av-team"><b>'+escape(c)+'</b>'+
   (rows.length?'<ul>'+rows.map(row=>'<li><span>'+escape(row.player)+'</span><em class="nba-av-status '+escape(row.status)+'">'+escape(short[row.status])+'</em></li>').join('')+'</ul>'+
   (remaining>0?'<small>+'+remaining+' additional reports</small>':''):
   '<small>No team-identified injury listing in this feed</small>')+'</div>';
 };
 const when=s.reportedAt?new Date(s.reportedAt).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET':'time of source report not provided';
 return '<div class="nba-availability-card"><div class="nba-availability-heading">AVAILABILITY WATCH <small>ESPN injury feed · '+escape(when)+'</small></div>'+
  '<div class="nba-av-grid">'+side(away)+side(home)+'</div>'+
  '<p>Reported status is not a confirmed starting lineup. <strong>Player availability has not been assigned unverified point adjustments.</strong> <a href="https://official.nba.com/nba-injury-report-2026-27-season/" target="_blank" rel="noopener noreferrer">Official NBA reports ↗</a></p></div>';
}
root.NBAAvailability={parse,teamRows,card};
if(typeof module!=='undefined')module.exports={parse,teamRows,card};
if(typeof document==='undefined')return;
let snapshot=null,attempted=false,renderQueued=false;
function render(){
 renderQueued=false;
 for(const el of document.querySelectorAll('[data-nba-availability-away][data-nba-availability-home]')){
  const a=code(el.dataset.nbaAvailabilityAway),h=code(el.dataset.nbaAvailabilityHome);
  if(!CODES.has(a)||!CODES.has(h)||a===h)continue;
  const fingerprint=(snapshot?.fetchedAt||'unavailable')+':'+a+':'+h;
  if(el.dataset.nbaAvailabilityFingerprint===fingerprint)continue;
  el.dataset.nbaAvailabilityFingerprint=fingerprint;
  el.innerHTML=card(snapshot,a,h);
 }
}
function scheduleRender(){
 if(renderQueued)return;renderQueued=true;
 requestAnimationFrame(render);
}
async function refresh(){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),9000);
 try{
  const r=await fetch(API,{cache:'no-store',signal:ctl.signal});
  if(!r.ok)throw Error('HTTP '+r.status);
  const p=parse(await r.json());
  if(!p)throw Error('No team-attributed injury records');
  snapshot=p;
 }catch(e){
  snapshot=null;
  console.warn('NBA availability source unavailable; no player impact applied',e.message);
 }finally{clearTimeout(timer);attempted=true;scheduleRender();}
}
function init(){
 scheduleRender();refresh();
 const target=document.querySelector('#app')||document.body;
 new MutationObserver(mutations=>{
  if(mutations.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('[data-nba-availability-away]')||n.querySelector?.('[data-nba-availability-away]')))))scheduleRender();
 }).observe(target,{childList:true,subtree:true});
 setInterval(()=>{if(!document.hidden)refresh();},10*60*1000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(typeof window!=='undefined'?window:globalThis);
