/* Shared RETRO projection strip for NBA scorebug ledgers.
   Only pregame; one forecast model and one rounding rule across both views. */
(()=>{'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const teams=new Set('ATL BOS BKN CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS'.split(' '));
let state=null,loading=null,lastLoad=0,pending=false;
async function read(path){const r=await fetch(path+'?edition='+Math.floor(Date.now()/60000),{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error(path+': HTTP '+r.status);return r.json();}
async function prepare(){
 if(state&&Date.now()-lastLoad<60000)return state;
 if(loading)return loading;
 loading=(async()=>{
  if(!window.RabbyPossessionModel)throw Error('Shared NBA possession model not loaded');
  const [elo,stats,priors]=await Promise.all([read('data/nba-elo-shadow-2026-27.json'),read('data/nba-possession-inputs.json'),read('data/nba-2025-26-team-advanced.json')]);
  if(elo.status!=='primary_live_earned_elo'||elo.parameters?.season_start_elo!==1500||elo.parameters?.home_elo!==40)throw Error('RETRO Elo not verified');
  const ratings=Object.fromEntries((elo.rankings||[]).filter(x=>teams.has(x.team)&&Number.isFinite(x.elo)).map(x=>[x.team,x.elo]));
  const model=window.RabbyPossessionModel.build(stats,4,priors);
  if(Object.keys(ratings).length!==30||model?.coverage?.teams!==30)throw Error('Incomplete verified forecast inputs');
  state={ratings,model};lastLoad=Date.now();return state;
 })().finally(()=>{loading=null});
 return loading;
}
function apply(){
 const cards=[...document.querySelectorAll('.ledger26-card[data-nba-game]')];
 const board=document.getElementById('nba-retro-forecast-board');
 const boardRows=[];
 for(const card of cards){
  const home=card.dataset.nbaHome,away=card.dataset.nbaAway,phase=card.dataset.nbaPhase;
  const summary=card.querySelector('summary');
  if(!summary)continue;
  let strip=summary.querySelector('.nba-retro-schedule-forecast');
  if(phase!=='pre'){strip?.remove();continue;}
  if(!teams.has(home)||!teams.has(away)||!state)continue;
  const p=window.RabbyPossessionModel.project(home,away,state.model,state.ratings);
  if(!p)continue;
  const favorite=p.margin>=0?home:away,rounded=Math.round(Math.abs(p.margin)*2)/2;
  const spread=rounded===0?'EVEN':favorite+' −'+rounded.toFixed(1);
  const chance=Math.round((p.margin>=0?p.homeWin:1-p.homeWin)*100);
  const html='<strong>RETRO PROJECTION</strong><span>'+esc(spread)+'</span><span>Projected '+p.awayScore+'–'+p.homeScore+'</span><span>'+chance+'% Elo '+esc(favorite)+'</span>';
  if(!strip){strip=document.createElement('div');strip.className='nba-retro-schedule-forecast';summary.append(strip);}
  if(strip.innerHTML!==html)strip.innerHTML=html;
  boardRows.push('<div class="nba-retro-board-row"><span>'+esc(away)+' at '+esc(home)+'</span><strong>'+esc(spread)+'</strong><span>Projected '+p.awayScore+'–'+p.homeScore+'</span></div>');
 }
 if(board){
  const html=boardRows.length?'<div class="nba-retro-board-count">'+boardRows.length+' upcoming game forecasts · spreads rounded to 0.5</div>'+boardRows.join(''):'<p class="nba-retro-board-empty">No upcoming-game projections are available for the selected date. Live and final games do not receive new pregame forecasts.</p>';
  if(board.innerHTML!==html)board.innerHTML=html;
 }
}
function queue(){
 if(pending)return;pending=true;
 queueMicrotask(()=>{pending=false;apply();});
}
async function refresh(){
 try{await prepare();apply()}catch(e){console.warn('NBA RETRO ledger projection unavailable:',e.message);}
}
const target=$('#nba-live-feed')||$('#app');
if(target)new MutationObserver(queue).observe(target,{childList:true,subtree:true});
refresh();
setInterval(()=>{if(!document.hidden)refresh()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();