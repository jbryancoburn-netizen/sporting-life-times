/* Shared pretipoff RETRO receipt, same presentation for both basketball editions.
   Never estimate historical pregame forecasts from postgame ratings. */
(function(root){
'use strict';
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cleanId=v=>String(v||'').replace(/^espn:/,'');
const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const readNumber=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
const key=(day,id)=>String(day||'')+'|'+cleanId(id);
const archives={men:new Map(),women:new Map()},scored=new Map();
let ready=false,queued=false;
function indexArchive(data,gender){
 if(data?.season!=='2026-27'||!Array.isArray(data.predictions))return;
 const seen=new Set(),conflicts=new Set();
 for(const p of data.predictions){
  const k=key(p.date,p.id);
  if(seen.has(k)){conflicts.add(k);archives[gender].delete(k);continue;}
  seen.add(k);
  if(!/^2026-\d\d-\d\d$/.test(String(p.date||''))||!/^\d+$/.test(cleanId(p.id))||
    !Number.isFinite(p.projected_home_margin)||!Number.isFinite(p.home_win_probability)||
    p.home_win_probability<0||p.home_win_probability>1)continue;
  if(!conflicts.has(k))archives[gender].set(k,p);
 }
}
function indexScored(data){
 if(data?.season!=='2026-27')return;
 for(const p of data.games||[]){
  if(Number.isFinite(p.actual_home_margin))scored.set(key(p.date,p.id),p);
 }
}
function identityMatches(row,home,away){
 if(!row)return false;
 if(home&&String(row.home_id)!==String(home))return false;
 if(away&&String(row.away_id)!==String(away))return false;
 return true;
}
function receipt(gender,id,day,phase,actual,homeId='',awayId='',homeName='Home',awayName='Away'){
 if(!['upcoming','live','final'].includes(phase))return '';
 const k=key(day,id),p=archives[gender].get(k);
 if(!p||!identityMatches(p,homeId,awayId))
  return '<div class="cbb-forecast-receipt cbb-forecast-receipt--missing"><span class="cbb-forecast-kicker">RETRO BEFORE TIP</span><span>No archived pregame forecast</span></div>';
 const predicted=p.projected_home_margin,probability=p.home_win_probability;
 const fav=predicted>0?'HOME':predicted<0?'AWAY':'EVEN';
 const sideName=side=>side==='HOME'?homeName:side==='AWAY'?awayName:'Even';
 const half=Math.round(Math.abs(predicted)*2)/2;
 const chance=Math.round(100*Math.max(probability,1-probability));
 const spread=fav==='EVEN'?'Even':sideName(fav)+' −'+half.toFixed(1);
 const parts=['<span class="cbb-forecast-kicker">RETRO BEFORE TIP</span>',
   '<strong>'+safe(spread)+'</strong>','<span>'+chance+'% win chance</span>'];
 if(phase==='final'&&number(actual)!==null){
  const win=actual>0?'HOME':actual<0?'AWAY':'TIED';
  const error=Math.abs(actual-predicted);
  parts.push('<span>Final: '+safe(sideName(win))+(win==='TIED'?'':' by '+Math.abs(actual).toFixed(0))+'</span>');
  parts.push('<strong>Miss: '+error.toFixed(1)+' pts</strong>');
  parts.push('<span class="cbb-forecast-verdict">'+(fav==='EVEN'?'Toss-up forecast':fav===win?'✓ Winner correct':'✕ Winner missed')+'</span>');
 }else if(phase==='final')parts.push('<span>Final comparison pending</span>');
 else parts.push('<span>Pregame forecast locked</span>');
 const captured=p.captured_at_utc?'Frozen '+p.captured_at_utc:'Preserved pretipoff snapshot';
 return '<div class="cbb-forecast-receipt" aria-label="'+safe('Archived RETRO forecast and game result')+'" title="'+safe(captured)+'">'+parts.join('<span class="cbb-forecast-divider" aria-hidden="true">·</span>')+'</div>';
}
function set(node,markup){
 if(!node)return;
 const old=node.querySelector(':scope > .cbb-forecast-receipt');
 if(!markup){old?.remove();return;}
 if(old?.outerHTML===markup)return;
 old?.remove();node.insertAdjacentHTML('beforeend',markup);
}
function scoreFromBug(bug){
 const values=[...bug.querySelectorAll('.ledger26-points')].map(e=>readNumber(e.textContent.trim()));
 return values.length===2&&values.every(v=>v!==null)?values[1]-values[0]:null;
}
function decorate(){
 if(!ready)return;
 document.querySelectorAll('#sl-games .sl-game-expansion').forEach(details=>{
  const status=details.querySelector('.ledger26-status[data-phase]')?.dataset.phase||'';
  const bug=details.querySelector('.ledger26-scorebug'),summary=details.querySelector('summary');
  if(!bug||!summary)return;
  const home=details.dataset.homeId||'',away=details.dataset.awayId||'';
  const gender=details.dataset.gender==='women'?'women':'men',day=details.dataset.day||'';
  const p=scored.get(key(day,details.dataset.gameId));
  const audited=gender==='men'&&identityMatches(p,home,away)?number(p.actual_home_margin):null;
  const actual=audited!==null?audited:scoreFromBug(bug);
  const markup=receipt(gender,details.dataset.gameId,day,status,actual,home,away,details.dataset.homeName||'Home',details.dataset.awayName||'Away');
  set(summary,markup);
 });
 document.querySelectorAll('#desk .wbb-scorebug-card[data-game-id]').forEach(details=>{
  const bug=details.querySelector('.ledger26-scorebug'),summary=details.querySelector('summary');
  if(!bug||!summary)return;
  const status=bug.querySelector('.ledger26-status[data-phase]')?.dataset.phase||'';
  set(summary,receipt('women',details.dataset.gameId,details.dataset.gameDay,status,
    scoreFromBug(bug),details.dataset.homeId,details.dataset.awayId,details.dataset.homeName||'Home',details.dataset.awayName||'Away'));
 });
 document.querySelectorAll('#mbb-calendar-host .mbb-schedule-table tr[data-cbb-forecast-id]').forEach(row=>{
  const dest=row.querySelector('.sched-result-cell');
  const phase=row.dataset.calendarState==='final'?'final':'upcoming';
  set(dest,receipt('men',row.dataset.cbbForecastId,row.dataset.cbbForecastDay,
    phase,readNumber(row.dataset.cbbFinalHomeMargin),null,null,row.dataset.cbbHomeName||'Home',row.dataset.cbbAwayName||'Away'));
 });
}
function queue(){
 if(queued)return;
 queued=true;
 setTimeout(()=>{queued=false;decorate();},80);
}
async function loadJSON(path){
 try{const r=await fetch(path,{cache:'no-store'});return r.ok?await r.json():null;}catch{return null;}
}
async function init(){
 const [men,women,report]=await Promise.all([
  loadJSON('data/retro-pregame-archive-2026-27.json'),
  loadJSON('data/ncaaw-retro-pregame-archive-2026-27.json'),
  loadJSON('data/retro-spread-accuracy-2026-27.json')]);
 indexArchive(men,'men');indexArchive(women,'women');indexScored(report);
 ready=true;decorate();
 for(const selector of ['#sl-games','#mbb-calendar-host','#desk']){
  const el=document.querySelector(selector);
  if(el)new MutationObserver(queue).observe(el,{subtree:true,childList:true,characterData:true,attributes:false});
 }
}
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
}
if(typeof module!=='undefined'&&module.exports)module.exports={receipt,indexArchive,archives,indexScored,scored};
root.SLTForecastReceipt={receipt,refresh:queue};
})(typeof window!=='undefined'?window:globalThis);
