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
// The scoreboard uses the same verified, published ledger as the ratings.
// Do not make an unapproved third-party request in a visitor's browser.
function showGames(m){
 const recent=m.ledger.slice(-12).reverse();
 if(!recent.length){
   $('nba-elo-scoreboard').innerHTML='<p>No verified completed games in the NBA Elo ledger yet.</p>';
   $('nba-score-status').textContent='Official-source schedule integration pending; no unsupported fixtures are displayed.';
   return;
 }
 $('nba-elo-scoreboard').innerHTML=recent.map(game=>{
  const away=game.away,home=game.home;
  // Use pregame Elo from the audited event replay, not postgame ratings to label predictions.
  const prob=eloWin(game.home_before,game.away_before);
  const raw=m.rawEvents?.find(e=>e.id===game.id);
  const result=raw?safe(raw.away_score)+' – '+safe(raw.home_score):'Final';
  return '<article class="nba-fixture"><div class="nba-fixture-head">FINAL · Verified NBA Elo ledger</div><div class="nba-fixture-match"><span>'+badges(away)+'<small>Current Elo '+m.current[away].toFixed(1)+'</small></span><strong>'+result+'</strong><span>'+badges(home)+'<small>Current Elo '+m.current[home].toFixed(1)+'</small></span></div><div class="nba-forecast-bar"><span style="width:'+(100*(1-prob)).toFixed(1)+'%"></span><span style="width:'+(100*prob).toFixed(1)+'%"></span></div><p class="hub-small">Reconstructed pregame Elo: '+safe(codes[away])+' '+(100*(1-prob)).toFixed(1)+'% · '+safe(codes[home])+' '+(100*prob).toFixed(1)+'%. Retrospective model estimate, not an archived pregame prediction.</p></article>';
 }).join('');
 $('nba-score-status').textContent='Recent completed NBA games from our independently audited Elo ledger. The upcoming and live fixture feed is withheld pending the official-first adapter.';
}
(async()=>{try{const m=await model();board(m);showGames(m)}catch(e){$('nba-elo-status').textContent='Ratings unavailable: '+e.message}}})();
