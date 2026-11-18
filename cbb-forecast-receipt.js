/* Shared pretipoff RETRO receipt, same presentation for both basketball editions.
   Never estimate historical pregame forecasts from postgame ratings. */
(function(root){
'use strict';
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cleanId=v=>String(v||'').replace(/^espn:/,'');
const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const readNumber=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
const key=(day,id)=>String(day||'')+'|'+cleanId(id);
const archives={men:new Map(),women:new Map()},scored=new Map(),upcomingMen=new Map();
let ready=false,queued=false;const canonicalNames={men:new Map(),women:new Map()};
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
function indexUpcomingMen(data){
 if(data?.season!=='2026-27'||!Array.isArray(data.games))return;
 const seen=new Set();
 for(const game of data.games){
  const k=key(game.date,game.id);
  if(seen.has(k)){upcomingMen.delete(k);continue;}
  seen.add(k);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(game.date)||!/^\d+$/.test(cleanId(game.id))||
    !game.home_id||!game.away_id||!Number.isFinite(game.projected_home_margin)||
    !Number.isFinite(game.home_win_probability)||game.home_win_probability<0||game.home_win_probability>1)continue;
  upcomingMen.set(k,game);
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
 const k=key(day,id);
 const current=phase==='upcoming'&&gender==='men'?upcomingMen.get(k):null;
 const p=current||archives[gender].get(k);
 if((!p||!identityMatches(p,homeId,awayId))&&phase==='upcoming')return ''; // Do not invent forecasts for games without a published exact-match snapshot.
 if(!p||!identityMatches(p,homeId,awayId))
  return '<div class="cbb-forecast-receipt cbb-forecast-receipt--missing"><span class="cbb-forecast-kicker">RETRO BEFORE TIP</span><span>No archived pregame forecast</span></div>';
 // Use the archive's verified home/away IDs, not schedule-row display orientation.
 const names=canonicalNames[gender]||new Map();
 homeName=names.get(String(p.home_id))||homeName;
 awayName=names.get(String(p.away_id))||awayName;
 const predicted=p.projected_home_margin,probability=p.home_win_probability;
 const fav=predicted>0?'HOME':predicted<0?'AWAY':'EVEN';
 const sideName=side=>side==='HOME'?homeName:side==='AWAY'?awayName:'Even';
 const half=Math.round(Math.abs(predicted)*2)/2;
 const chance=Math.round(100*Math.max(probability,1-probability));
 const spread=fav==='EVEN'?'Even':sideName(fav)+' −'+half.toFixed(1);
 let state='locked',verdict=current?'Current projection':'Forecast locked',comparison='';
 const forecast='<div class="cbb-forecast-metric"><span class="cbb-forecast-label">Pregame forecast</span><strong class="cbb-forecast-value">'+safe(spread)+'</strong><span class="cbb-forecast-detail">'+chance+'% win chance</span></div>';
 if(phase==='final'&&number(actual)!==null){
  const win=actual>0?'HOME':actual<0?'AWAY':'TIED';
  const error=Math.abs(actual-predicted);
  state=fav==='EVEN'?'even':fav===win?'correct':'missed';
  verdict=fav==='EVEN'?'Toss-up forecast':fav===win?'Winner correct':'Winner missed';
  const result=win==='TIED'?'Tied':sideName(win)+' by '+Math.abs(actual).toFixed(0);
  comparison='<div class="cbb-forecast-metric"><span class="cbb-forecast-label">Final result</span><strong class="cbb-forecast-value">'+safe(result)+'</strong><span class="cbb-forecast-detail">Margin error <b>'+error.toFixed(1)+' pts</b></span></div>';
 }else if(phase==='final'){
  state='pending';verdict='Comparison pending';
  comparison='<div class="cbb-forecast-metric"><span class="cbb-forecast-label">Final result</span><span class="cbb-forecast-detail">Final comparison pending</span></div>';
 }else if(!current){
  comparison='<div class="cbb-forecast-metric cbb-forecast-lock"><span class="cbb-forecast-detail">Pregame forecast locked</span><span class="cbb-forecast-lock-note">Recorded before tipoff</span></div>';
 }
 const captured=current?'Current RETRO projection':p.captured_at_utc?'Frozen '+p.captured_at_utc:'Preserved pretipoff snapshot';
 return '<div class="cbb-forecast-receipt cbb-forecast-receipt--'+state+'" aria-label="'+safe(current?'Current RETRO projection':'Archived RETRO forecast and game result')+'" title="'+safe(captured)+'"><div class="cbb-forecast-heading"><span class="cbb-forecast-kicker">'+(current?'RETRO PROJECTION':'RETRO BEFORE TIP')+'</span><span class="cbb-forecast-verdict">'+verdict+'</span></div><div class="cbb-forecast-comparison">'+forecast+comparison+'</div></div>';
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
function updateScheduleCorner(row,gender,id,day){
  const corner=row.querySelector('.sched-corner');
  const archive=archives[gender].get(key(day,id));
  const self=row.dataset.schedTeam,opponent=row.dataset.schedOpponent;
  const result=row.querySelector('.sched-result-score, .wbb-result-cell > strong')?.textContent.trim().match(/^[WL]\s+(\d+)\s*[–-]\s*(\d+)/);
  if(corner&&row.dataset.calendarState==='final'&&archive&&result&&self&&opponent&&
    [archive.home_id,archive.away_id].map(String).includes(self)&&[archive.home_id,archive.away_id].map(String).includes(opponent)){
   const projected=(String(archive.home_id)===self?1:-1)*archive.projected_home_margin;
   const margin=Number(result[1])-Number(result[2]);
   const signed=n=>n>0?'+'+n:String(n);
   const text='Projected '+signed(projected)+' · Final '+signed(margin);
   if(corner.dataset.forecastComparison!==text){
    corner.dataset.forecastComparison=text;
    corner.innerHTML='<span>RETRO vs. final</span><b>'+safe(text)+'</b>';
    corner.hidden=false;
   }
  }
}
function decorate(){
 document.querySelectorAll('#full-season-schedule tr.wbb-game-entry').forEach(row=>
  updateScheduleCorner(row,'women',row.dataset.gameId,row.dataset.gameDay));
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
  // The archived forecast is retained for live/final analysis only; the pregame
  // scorebug already contains the forecast and must not echo its figures.
  set(summary,status==='upcoming'?'':markup);
 });
 document.querySelectorAll('#desk .wbb-scorebug-card[data-game-id]').forEach(details=>{
  const bug=details.querySelector('.ledger26-scorebug'),summary=details.querySelector('summary');
  if(!bug||!summary)return;
  const status=bug.querySelector('.ledger26-status[data-phase]')?.dataset.phase||'';
  set(summary,status==='upcoming'?'':receipt('women',details.dataset.gameId,details.dataset.gameDay,status,
    scoreFromBug(bug),details.dataset.homeId,details.dataset.awayId,details.dataset.homeName||'Home',details.dataset.awayName||'Away'));
 });
 // Live Game Center shares the same preserved, source-matched pretipoff ledger.
 document.querySelectorAll('#cbb-cards .cbb-ledger-card[data-cbb-game]').forEach(card=>{
  const bug=card.querySelector('.ledger26-scorebug'),summary=card.querySelector('.ledger26-summary');
  if(!bug||!summary)return;
  const phase=bug.querySelector('.ledger26-status[data-phase]')?.dataset.phase||'';
  const gender=card.dataset.cbbGender==='women'?'women':'men';
  const home=card.dataset.cbbHomeId||'',away=card.dataset.cbbAwayId||'';
  const day=card.dataset.cbbDay||'';
  const p=scored.get(key(day,card.dataset.cbbGame));
  const audited=gender==='men'&&identityMatches(p,home,away)?number(p.actual_home_margin):null;
  set(summary,phase==='upcoming'?'':receipt(gender,card.dataset.cbbGame,day,phase,audited!==null?audited:scoreFromBug(bug),
   home,away,card.dataset.cbbHomeName||'Home',card.dataset.cbbAwayName||'Away'));
 });
 document.querySelectorAll('#mbb-calendar-host .mbb-schedule-table tr[data-cbb-forecast-id]').forEach(row=>{
  const dest=row.querySelector('.sched-result-cell');
  if(!dest)return;
  // The receipt is a separate seven-column table row, never a narrow result-cell sidebar.
  // Keep the main game's controls and the adjacent expandable stats row unchanged.
  const old=dest.querySelector(':scope > .cbb-forecast-receipt');
  old?.remove();
  const previousSummary=dest.querySelector(':scope > .sched-result-summary');
  if(previousSummary){
   while(previousSummary.firstChild)dest.insertBefore(previousSummary.firstChild,previousSummary);
   previousSummary.remove();
  }
  dest.classList.remove('sched-result-cell--forecast');
  const phase=row.dataset.calendarState==='final'?'final':row.dataset.calendarState==='upcoming'?'upcoming':'';
  const markup=receipt('men',row.dataset.cbbForecastId,row.dataset.cbbForecastDay,
    phase,number(scored.get(key(row.dataset.cbbForecastDay,row.dataset.cbbForecastId))?.actual_home_margin)??readNumber(row.dataset.cbbFinalHomeMargin),null,null,row.dataset.cbbHomeName||'Home',row.dataset.cbbAwayName||'Away');
  updateScheduleCorner(row,'men',row.dataset.cbbForecastId,row.dataset.cbbForecastDay);
  let band=row.nextElementSibling;
  if(band?.classList.contains('victorian-stat-detail'))band=band.nextElementSibling;
  if(!band?.classList.contains('cbb-schedule-forecast-row')){
   band=document.createElement('tr');
   band.className='cbb-schedule-forecast-row';
   band.innerHTML='<td colspan="7"></td>';
   const anchor=row.nextElementSibling?.classList.contains('victorian-stat-detail')?row.nextElementSibling:row;
   anchor.after(band);
  }
  band.dataset.forecastFor=row.dataset.cbbForecastId||'';
  band.hidden=row.hidden;
  set(band.firstElementChild,markup);
  band.hidden=row.hidden||!markup;
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
 const [men,women,report,upcoming,menRatings,womenRatings]=await Promise.all([
  loadJSON('data/retro-pregame-archive-2026-27.json'),
  loadJSON('data/ncaaw-retro-pregame-archive-2026-27.json'),
  loadJSON('data/retro-spread-accuracy-2026-27.json'),
  document.querySelector('#mbb-calendar-host')?loadJSON('data/ncaam-2026-27-upcoming-forecasts.json'):null,
  loadJSON('data/ncaam-2026-27-retro-primary.json'),loadJSON('data/ncaaw-2026-27-retro-primary.json')]);
 for(const [gender,data] of [['men',menRatings],['women',womenRatings]])for(const t of data?.rankings||[])canonicalNames[gender].set(String(t.team_id),String(t.team||t.team_name||''));
 indexArchive(men,'men');indexArchive(women,'women');indexScored(report);indexUpcomingMen(upcoming);
 ready=true;decorate();
 for(const selector of ['#sl-games','#mbb-calendar-host','#desk','#cbb-cards']){
  const el=document.querySelector(selector);
  if(el)new MutationObserver(queue).observe(el,{subtree:true,childList:true,characterData:true,attributes:false});
 }
}
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
}
if(typeof module!=='undefined'&&module.exports)module.exports={receipt,indexArchive,archives,indexScored,scored,indexUpcomingMen};
root.SLTForecastReceipt={receipt,refresh:queue};
})(typeof window!=='undefined'?window:globalThis);

