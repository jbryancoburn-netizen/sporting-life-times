/* NBA Rabby Forecast Desk: one verified possession engine on every NBA page.
 * Predictions exist only for scheduled pregame matchups; earned Elo and score
 * estimates are separate forecasts, never retrospective "pregame" claims.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const aliases={NY:'NYK',GS:'GSW',SA:'SAS',NO:'NOP',WSH:'WAS',UTAH:'UTA'};
const canonical=c=>aliases[String(c||'').toUpperCase()]||String(c||'').toUpperCase();
const fmt=d=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(d))+' ET';
async function get(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error('Unable to load '+path);return r.json();}
function matchup(g,model,ratings,calendar=[]){
 const home=g.teams?.find(t=>t.home_away==='home'),away=g.teams?.find(t=>t.home_away==='away');
 const h=canonical(home?.code),a=canonical(away?.code);
 const p=window.RabbyPossessionModel.project(h,a,model,ratings);
 if(!p)return '';
 const names={home:home?.name||h,away:away?.name||a};
 const favorite=p.homeWin>=0.5?h:a,scoreFavorite=p.homeScore>p.awayScore?h:a;
 const scorebug=window.SLTScorebug.render({mode:'upcoming',projected:true,subtitle:fmt(g.date),
  away:{code:a,name:names.away},home:{code:h,name:names.home},
  awayScore:p.awayScore,homeScore:p.homeScore,footer:''});
 const edge=p.margin>=0?h:a;
 const spreadText=Math.abs(p.margin)<0.5?'EVEN':edge+' −'+Math.abs(p.margin).toFixed(1);
 const homeWidth=(100*p.homeWin).toFixed(1);
 const aRest=window.RabbyPossessionModel.scheduleContext(a,g.date,calendar);
 const hRest=window.RabbyPossessionModel.scheduleContext(h,g.date,calendar);
 const restPanel='<div class="rabby-rest-context"><small>GAME-DAY REST · COMPLETED + PUBLISHED FIXTURES</small><span>'+esc(a)+': '+esc(window.RabbyPossessionModel.restDisplay(aRest))+'</span><span>'+esc(h)+': '+esc(window.RabbyPossessionModel.restDisplay(hRest))+'</span><small>Schedule information only; fatigue is not assigned untested point deductions.</small></div>';
 const warning=favorite!==scoreFavorite?'<p class="rabby-v2-disagreement">Elo and the possession score favor different teams; neither is a certainty.</p>':'';
 const link=g.id?'<a class="rabby-v2-game-link" href="nba-live-game.html?game='+encodeURIComponent(String(g.id).replace(/^espn-nba-/,''))+'">Game details ↗</a>':'';
 return '<article class="rabby-game rabby-v2-game">'+scorebug+
  '<div class="rabby-v2-odds"><div><strong>'+esc(a)+' '+(100*(1-p.homeWin)).toFixed(1)+'%</strong><small>USRS Elo win chances</small><strong>'+esc(h)+' '+(100*p.homeWin).toFixed(1)+'%</strong></div><div class="rabby-v2-prob-bar"><span style="width:'+homeWidth+'%"></span></div></div>'+
  '<div class="rabby-v2-mainstats"><div><small>EXPECTED MARGIN</small><b>'+esc(spreadText)+'</b></div><div><small>PROJECTED TOTAL</small><b>'+p.total.toFixed(1)+'</b></div><div><small>ESTIMATED PACE</small><b>'+p.possessions.toFixed(1)+'</b></div></div>'+
  restPanel+
  '<div class="rabby-v2-label">OFFENSE MATCHED AGAINST OPPONENT DEFENSE</div>'+
  '<div class="rabby-v2-breakdown"><div><small>'+esc(a)+' offensive efficiency</small><b>'+p.awayOffense.toFixed(1)+'</b><small>'+esc(h)+' defensive allowance</small><b>'+p.homeDefense.toFixed(1)+'</b><strong>Matchup: '+p.awayEfficiency.toFixed(1)+'</strong></div>'+
   '<div><small>'+esc(h)+' offensive efficiency</small><b>'+p.homeOffense.toFixed(1)+'</b><small>'+esc(a)+' defensive allowance</small><b>'+p.awayDefense.toFixed(1)+'</b><strong>Matchup: '+p.homeEfficiency.toFixed(1)+'</strong></div></div>'+
  '<p class="rabby-v2-provenance">Points per 100 possessions · '+esc(a)+' '+p.awayGames+' games, '+esc(h)+' '+p.homeGames+' games · 12-game shrinkage · six-game 2025–26 prior · frozen historical calibration</p>'+
  '<div data-nba-availability-away="'+esc(a)+'" data-nba-availability-home="'+esc(h)+'"></div>'+warning+link+'</article>';
}
async function show(){
 if(!window.RabbyPossessionModel||!window.SLTScorebug)throw Error('Shared scoring and scorebug libraries are missing');
 const [elo,stats,schedule,priors]=await Promise.all([
  get('data/nba-2026-27-current-provisional.json'),
  get('data/nba-possession-inputs.json'),
  get('data/nba-upcoming-schedule.json'),
  get('data/nba-2025-26-team-advanced.json')
 ]);
 const ratings=Object.fromEntries((elo.rankings||[]).filter(r=>Number.isFinite(Number(r.elo))).map(r=>[r.team,Number(r.elo)]));
 const model=window.RabbyPossessionModel.build(stats,4,priors);
 if(Object.keys(ratings).length!==30||!model||model.coverage.teams!==30)throw Error('All 30 teams require verified NBA scoring and Elo data');
 window.NBARabbyForecastState={ratings,model,project:(home,away)=>window.RabbyPossessionModel.project(home,away,model,ratings)};
 document.dispatchEvent(new Event('nba:forecast-ready'));
 const now=Date.now(),limit=now+72*3600000;
 const games=(schedule.games||[]).filter(g=>g.state==='pre'&&Date.parse(g.date)>now&&Date.parse(g.date)<=limit)
  .sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)).slice(0,18);
 const calendar=[...(elo.events||[]),...(schedule.games||[])];
 const cards=games.map(g=>matchup(g,model,ratings,calendar)).filter(Boolean);
 const target=$('nba-rabby-games'),status=$('nba-rabby-status');
 if(target)target.innerHTML=cards.length?cards.join(''):'<p class="nba-empty">No future NBA tipoffs in the next 72 hours of the published schedule.</p>';
 const cal=model.calibration;
 const holdout=cal&&Number.isFinite(cal.marginMAE)&&Number.isFinite(cal.totalMAE)?' · Original neutral-prior 2025–26 validation: '+cal.testGames+' games, margin MAE '+cal.marginMAE.toFixed(1)+', total MAE '+cal.totalMAE.toFixed(1)+' points':'';
 if(status)status.textContent=model.coverage.games+' attributed, completed team box scores · '+model.coverage.teams+' NBA teams · '+cards.length+' upcoming forecasts'+holdout+' · New hybrid: 26-game exploratory 2026–27 check (not a holdout), margin MAE 12.75 vs 13.23 neutral · Early-season accuracy remains uncertain.';
}
function unavailable(e){
 const status=$('nba-rabby-status'),target=$('nba-rabby-games');
 if(status)status.textContent='Verified NBA scoring inputs unavailable: '+e.message;
 if(target)target.innerHTML='<p class="nba-empty">Do not substitute a generic league-average score. Waiting for qualified box scores. <a href="nba-game-center.html">Open Game Center ↗</a></p>';
}
async function refresh(){try{await show();}catch(e){console.warn('NBA Rabby forecast:',e);unavailable(e);}}
refresh();
setInterval(()=>{if(!document.hidden)refresh();},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
})();
