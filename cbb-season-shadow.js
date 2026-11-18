/* Sporting Life & Times: independent current-season-only shadow model.
   Never reads RETRO ratings or forecasts as inputs. No write to RETRO. */
(()=>{'use strict';
const $=s=>document.querySelector(s);
const norm=id=>String(id??'').replace(/^espn:/,'');
const iso=x=>String(x||'').slice(0,10);
const valid=x=>Number.isFinite(Number(x))&&Number(x)>=0;
const gender=()=>document.body.dataset.gender==='women'||document.body.dataset.page==='women-team'||new URLSearchParams(location.search).get('gender')==='women'?'women':'men';
const fetchJSON=async p=>{const r=await fetch(p,{cache:'no-store'});if(!r.ok)throw Error(p+': '+r.status);return r.json()};
const accepted=g=>g&&g.site_verified===true&&valid(g.home_score)&&valid(g.away_score)&&Number(g.home_score)!==Number(g.away_score)&&g.home_id&&g.away_id;
function train(games,date){
 const earlier=games.filter(g=>g.day<date);
 if(earlier.length<80)return null;
 const mean=earlier.reduce((s,g)=>s+g.hs+g.as,0)/earlier.length,stats=new Map(),lambda=2,homeEdge=4;
 const node=id=>{if(!stats.has(id))stats.set(id,{m:[],t:[]});return stats.get(id)};
 for(const g of earlier){
  const m=g.hs-g.as-(g.neutral?0:homeEdge),t=g.hs+g.as-mean;
  node(g.h).m.push([g.a,m]);node(g.a).m.push([g.h,-m]);
  node(g.h).t.push([g.a,t]);node(g.a).t.push([g.h,t]);
 }
 let strength=new Map(),pace=new Map();
 for(const id of stats.keys()){strength.set(id,0);pace.set(id,0)}
 for(let n=0;n<35;n++){
  const nextS=new Map(),nextP=new Map();
  for(const [id,v] of stats){
   nextS.set(id,v.m.reduce((s,[opp,m])=>s+m+(strength.get(opp)||0),0)/(v.m.length+lambda));
   nextP.set(id,v.t.reduce((s,[opp,t])=>s+t-(pace.get(opp)||0),0)/(v.t.length+lambda));
  }strength=nextS;pace=nextP;
 }
 return {strength,pace,mean,homeEdge,played:stats};
}
function predict(m,g){
 if(!m||!m.played.has(g.h)||!m.played.has(g.a))return null;
 const margin=(m.strength.get(g.h)||0)-(m.strength.get(g.a)||0)+(g.neutral?0:m.homeEdge);
 const total=m.mean+(m.pace.get(g.h)||0)+(m.pace.get(g.a)||0);
 const h=(total+margin)/2,a=(total-margin)/2;
 if(!Number.isFinite(h)||!Number.isFinite(a)||h<0||a<0)return null;
 let home=Math.round(h),away=Math.round(a);
 // Whole-point basketball scores must always have a winner, including near-even models.
 if(home===away){if(margin<0)away+=1;else home+=1;}
 return {home,away,margin,seasonGames:m.played.get(g.h).m.length+m.played.get(g.a).m.length};
}
const state={games:[],byId:new Map(),byDate:new Map(),ready:false,error:false};
async function init(){
 const women=gender()==='women';
 const [finals,fixtures,extra]=await Promise.all([
  fetchJSON(women?'data/ncaaw-2026-27-verified-games.json':'data/mbb-2026-2027-results.json'),
  fetchJSON(women?'data/ncaaw-2026-27-games.json':'data/ncaam-2026-27-upcoming-forecasts.json'),
  women?fetchJSON('data/ncaaw-2026-27-retro-primary.json'):Promise.resolve(null)
 ]);
 const di=women?new Set((extra.rankings||[]).map(x=>String(x.team_id))):null;
 state.games=(finals.games||[]).filter(accepted).filter(g=>!di||(di.has(String(g.home_id))&&di.has(String(g.away_id)))).map(g=>({
  id:norm(g.id),day:iso(g.date),h:String(g.home_id),a:String(g.away_id),
  hs:Number(g.home_score),as:Number(g.away_score),neutral:g.neutral===true
 })).sort((a,b)=>a.day.localeCompare(b.day));
 const ingest=g=>{
  const id=norm(g.id||g.game_id);if(!id||!g.home_id||!g.away_id)return;
  const datum={id,day:iso(g.date),h:String(g.home_id),a:String(g.away_id),
   neutral:g.neutral===true||g.venue_verification==='neutral'||g.site==='neutral'};
  if(!state.byId.has(id))state.byId.set(id,datum);
 };
 for(const g of state.games)ingest({...g,id:g.id,home_id:g.h,away_id:g.a,date:g.day});
 for(const g of (women?[...(fixtures.finals||[]),...(fixtures.games||[]),...(fixtures.upcoming||[]),...(fixtures.scheduled||[])]:fixtures.games||[]))ingest(g);
 state.ready=true;update();
}
function getModel(day){
 if(!/^20\d\d-\d\d-\d\d$/.test(day))return null;
 if(!state.byDate.has(day))state.byDate.set(day,train(state.games,day));
 return state.byDate.get(day);
}
// Explicitly documented neutral venues; event keyed by date and the two
// canonical NCAA team IDs, not by the nominal home team in a schedule feed.
const verifiedNeutralPairs=new Set([
 '2026-11-20|ncaa:609574|ncaa:609584' // Indiana vs Kentucky, Lucas Oil Stadium
]);
const pairKey=(date,a,b)=>date+'|'+[String(a),String(b)].sort().join('|');
function gameFrom(el){
 const raw=el.dataset.gameId||el.dataset.cbbForecastId;
 const fixture=state.byId.get(norm(raw));
 const day=el.dataset.day||el.dataset.gameDay||el.dataset.cbbForecastDay||
   el.querySelector('time')?.dateTime?.slice(0,10)||fixture?.day;
 if(!day)return null;
 // Prefer the published fixture only when both identities agree with the card.
 // A team's schedule may use a different nominal home/away designation.
 const dh=String(el.dataset.homeId||''),da=String(el.dataset.awayId||'');
 const fixtureMatches=!dh||!da||([dh,da].sort().join('|')===[String(fixture?.h),String(fixture?.a)].sort().join('|'));
 const match=fixture&&fixtureMatches?fixture:
   dh&&da?{h:dh,a:da,neutral:false,day}:null;
 if(!match)return null;
 const verifiedNeutral=verifiedNeutralPairs.has(pairKey(day,match.h,match.a));
 if(!verifiedNeutral&&(el.dataset.forecastVenue==='disputed'||el.dataset.gameSite==='unknown'))return null;
 const loc=el.dataset.gameSite||el.dataset.forecastVenue;
 const neutral=verifiedNeutral||loc==='neutral'||loc==='verified-neutral'||match.neutral===true;
 // For a neutral matchup, canonicalize order independently of the nominal
 // home team. Both schedule and Ledger therefore predict the same fixture.
 const [h,a]=neutral?[String(match.h),String(match.a)].sort():[String(match.h),String(match.a)];
 return {h,a,day,neutral};
}
function makeLabel(pred,el,g){
 const winningId=pred.home>pred.away?g.h:g.a;
 const dh=String(el.dataset.homeId||''),da=String(el.dataset.awayId||'');
 const name=winningId===dh?(el.dataset.homeName||el.dataset.cbbHomeName):
            winningId===da?(el.dataset.awayName||el.dataset.cbbAwayName):
            '';
 const team=String(name||'').trim();
 const margin=(Math.abs(pred.home-pred.away)).toFixed(1);
 const escaped=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const leader=team?escaped(team)+' by '+margin:'Projected winner by '+margin;
 return '<span class="slt-shadow-kicker">SEASON-ONLY <span>SHADOW TEST</span></span>'+
 '<span class="slt-shadow-score">'+pred.away+'–'+pred.home+'</span>'+
 '<span class="slt-shadow-detail">'+leader+' · TOTAL '+(pred.away+pred.home)+'</span>';
}
function decorate(el){
 if(!state.ready)return;
 const ledger=el.matches('.sl-game-expansion');
 const row=ledger?el.closest('.sl-game'):el;
 if(row?.dataset.exhibition==='true'||el.dataset.exhibition==='true')return;
 const upcoming=ledger?!!el.querySelector('.ledger26-status[data-phase="upcoming"]'):el.dataset.calendarState==='upcoming';
 if(!upcoming){
  row?.querySelector(':scope > .slt-shadow-line')?.remove();
  if(!ledger){let next=row.nextElementSibling;while(next&&(next.classList.contains('victorian-stat-detail')||next.classList.contains('cbb-schedule-forecast-row')))next=next.nextElementSibling;if(next?.classList.contains('cbb-season-shadow-row'))next.remove();}
  return;
 }
 const g=gameFrom(el),p=g?predict(getModel(g.day),g):null;
 if(ledger){
  let box=row.querySelector(':scope > .slt-shadow-line');
  if(!p){box?.remove();return;}
  const markup=makeLabel(p,el,g);
  if(box?.dataset.rendered===markup)return;
  if(!box){box=document.createElement('div');box.className='slt-shadow-line';row.appendChild(box);}
  box.dataset.rendered=markup;box.innerHTML=markup;
  return;
 }
 // The Result column is narrow. Use an independent full-width seven-column row
 // after the game and any existing statistics/RETRO receipt rows.
 const oldInline=row.querySelector('.sched-result-cell > .slt-shadow-line');
 oldInline?.remove();
 let band=row.nextElementSibling;
 while(band&&(band.classList.contains('victorian-stat-detail')||band.classList.contains('cbb-schedule-forecast-row')))band=band.nextElementSibling;
 const existing=band?.classList.contains('cbb-season-shadow-row')?band:null;
 if(!p){existing?.remove();return;}
 const markup=makeLabel(p,el,g);
 if(existing?.dataset.rendered===markup){existing.hidden=row.hidden;return;}
 let line=existing;
 if(!line){
  line=document.createElement('tr');line.className='cbb-season-shadow-row';
  line.innerHTML='<td colspan="7"><div class="slt-shadow-line"></div></td>';
  row.parentNode.insertBefore(line,band);
 }
 line.dataset.rendered=markup;
 line.hidden=row.hidden;
 line.querySelector('.slt-shadow-line').innerHTML=markup;
}
let pending=false;
function update(){
 pending=false;
 for(const el of document.querySelectorAll('.sl-game-expansion[data-game-id], #full-season-schedule tr[data-cbb-forecast-id], #full-season-schedule tr.wbb-game-entry'))decorate(el);
}
function schedule(){if(pending)return;pending=true;requestAnimationFrame(update)}
const observer=new MutationObserver(schedule);
observer.observe(document.documentElement,{subtree:true,childList:true});
init().catch(err=>{state.error=true;console.warn('[Season-only shadow] Not available:',err.message)});
})();