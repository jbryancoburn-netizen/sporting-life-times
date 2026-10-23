import {model,codes,logo,eloWin,changeTag,safe} from './nba-elo-model.js';
const $=id=>document.getElementById(id);
const badges=t=>'<img loading="lazy" width="28" height="28" alt="" src="'+logo(t)+'" onerror="this.hidden=true"> '+safe(codes[t]);
const clock=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
function board(m){
 const rows=Object.keys(m.current).sort((a,b)=>m.current[b]-m.current[a]);
 $('nba-elo-grid').innerHTML='<div class="nba-current-table-wrap"><table class="nba-current-table"><thead><tr><th>#</th><th>Team</th><th>Offseason</th><th>Last week</th><th>Current Elo</th><th>Daily Δ</th></tr></thead><tbody>'+rows.map((t,i)=>'<tr><td>'+(i+1)+'</td><th class="nba-team">'+badges(t)+'</th><td>'+m.start[t].toFixed(2)+'</td><td>'+(m.weekly?.[t]?.toFixed(2)??'N/A')+'</td><td class="nba-primary-number">'+m.current[t].toFixed(2)+'</td><td>'+(m.daily?changeTag(m.current[t]-m.daily[t]):'N/A')+'</td></tr>').join('')+'</tbody></table></div>';
 $('nba-elo-status').textContent=m.games+' completed season games · Rankings update from verified finals · seven-day and daily movement become available when every published game has a verified timestamp.';
 $('nba-elo-comparison').innerHTML='<p class="hub-small">Offseason and current ratings appear in the primary table. The frozen 2025–26 final rankings remain in the archive below.</p>';
 const standings=rows.map((t,i)=>'<tr><td>'+(i+1)+'</td><th>'+badges(t)+'</th><td><strong>'+m.current[t].toFixed(1)+'</strong></td></tr>').join('');
 $('nba-elo-standings').innerHTML='<div class="nba-current-table-wrap"><table class="nba-current-table"><thead><tr><th>Elo rank</th><th>Team</th><th>Elo</th></tr></thead><tbody>'+standings+'</tbody></table></div>';
}
const teamFrom=competitor=>{const a=competitor?.team?.abbreviation;const aliases={NY:'NYK',GS:'GSW',SA:'SAS',NO:'NOP',WSH:'WAS',UTAH:'UTA'};return aliases[a]||a};
async function getGames(){
 const dt=new Date(), date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(dt).replaceAll('-','');
 const url='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates='+date+'&limit=100';
 const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw Error('Score feed unavailable');
 const data=await response.json();if(!Array.isArray(data.events))throw Error('Invalid NBA schedule');
 return data.events;
}
function showGames(m,games){
 const rows=games.map(ev=>{
 const comp=ev.competitions?.[0],h=comp?.competitors?.find(x=>x.homeAway==='home'),a=comp?.competitors?.find(x=>x.homeAway==='away');
 const home=teamFrom(h),away=teamFrom(a);
 if(!m.current[home]||!m.current[away])return '';
 const prob=eloWin(m.current[home],m.current[away]),finished=ev.status?.type?.completed===true;
 const live=ev.status?.type?.state==='in';
 const score=(finished||live)?safe(a.score??'–')+' – '+safe(h.score??'–'):clock.format(new Date(ev.date));
 return '<article class="nba-fixture"><div class="nba-fixture-head">'+safe(ev.status?.type?.shortDetail||'Scheduled')+'</div><div class="nba-fixture-match"><span>'+badges(away)+'<small>Elo '+m.current[away].toFixed(1)+'</small></span><strong>'+score+'</strong><span>'+badges(home)+'<small>Elo '+m.current[home].toFixed(1)+'</small></span></div><div class="nba-forecast-bar"><span style="width:'+(100*(1-prob)).toFixed(1)+'%"></span><span style="width:'+(100*prob).toFixed(1)+'%"></span></div><p class="hub-small">Pre-game-style Elo baseline using latest published ratings: '+safe(codes[away])+' '+(100*(1-prob)).toFixed(1)+'% · '+safe(codes[home])+' '+(100*prob).toFixed(1)+'%. '+(finished?'Shown for reference, not archived as an actual pregame forecast.':'Win probabilities are provisional; player availability not included.')+'</p></article>';
 }).filter(Boolean);
 $('nba-elo-scoreboard').innerHTML=rows.join('')||'<p>No NBA games listed for today.</p>';
 $('nba-score-status').textContent='NBA scoreboard · scores may refresh independently of Elo, which changes only after finalized nightly replay.';
}
(async()=>{try{const m=await model();board(m);try{showGames(m,await getGames())}catch(e){$('nba-score-status').textContent='NBA game feed temporarily unavailable; Elo rankings remain available.'}}catch(e){$('nba-elo-status').textContent='Ratings unavailable: '+e.message}}})();
