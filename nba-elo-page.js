import {model,codes,logo,eloWin,changeTag,safe} from './nba-elo-model.js';
const $=id=>document.getElementById(id);
const notice=(id,message)=>{const el=$(id);if(el)el.textContent=message};
const badges=t=>'<img loading="lazy" width="28" height="28" alt="" src="'+logo(t)+'" onerror="this.hidden=true"> '+safe(codes[t]);
const clock=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
async function loadFrozen(){const r=await fetch('data/nba-2025-26-final.json');if(!r.ok)throw Error('Frozen rankings unavailable');const d=await r.json();if(d.rankings?.length!==30)throw Error('Incomplete frozen rankings');return Object.fromEntries(d.rankings.map(x=>[x.team,x.elo]));}
async function board(m){
 const rows=Object.keys(m.current).sort((a,b)=>m.current[b]-m.current[a]);
 $('nba-elo-grid').innerHTML='<div class="nba-current-table-wrap"><table class="nba-current-table"><thead><tr><th>#</th><th>Team</th><th>Offseason</th><th>Last week</th><th>Current Elo</th><th>Daily Δ</th></tr></thead><tbody>'+rows.map((t,i)=>'<tr><td>'+(i+1)+'</td><th class="nba-team">'+badges(t)+'</th><td>'+m.start[t].toFixed(2)+'</td><td>'+(m.weekly?.[t]?.toFixed(2)??'N/A')+'</td><td class="nba-primary-number">'+m.current[t].toFixed(2)+'</td><td>'+(m.daily?changeTag(m.current[t]-m.daily[t]):'N/A')+'</td></tr>').join('')+'</tbody></table></div>';
 $('nba-elo-status').textContent=m.games+' completed season games · Rankings update from verified finals · seven-day and daily movement become available when every published game has a verified timestamp.';

 const frozen=await loadFrozen();
 const snapshots=[
  {name:'2026–27 CURRENT',ratings:m.current,primary:true},
  {name:'2026–27 OPENING',ratings:m.start},
  {name:'2025–26 FINAL',ratings:frozen}
 ];
 $('nba-elo-comparison').innerHTML='<div class="nba-snapshot-grid">'+snapshots.map(snapshot=>{
  const order=Object.keys(snapshot.ratings).sort((a,b)=>snapshot.ratings[b]-snapshot.ratings[a]);
  return '<section class="nba-snapshot"><h3>'+snapshot.name+'</h3><table class="nba-mini-table"><thead><tr><th>#</th><th>Club</th><th>Elo</th></tr></thead><tbody>'+order.map((t,i)=>'<tr><td>'+(i+1)+'</td><th>'+badges(t)+'</th><td>'+snapshot.ratings[t].toFixed(1)+'</td></tr>').join('')+'</tbody></table></section>';
 }).join('')+'</div>';
 const standings=rows.map((t,i)=>'<tr><td>'+(i+1)+'</td><th>'+badges(t)+'</th><td><strong>'+m.current[t].toFixed(1)+'</strong></td></tr>').join('');
 $('nba-elo-standings').innerHTML='<div class="nba-current-table-wrap"><table class="nba-current-table"><thead><tr><th>Elo rank</th><th>Team</th><th>Elo</th></tr></thead><tbody>'+standings+'</tbody></table></div>';
 const record=Object.fromEntries(Object.keys(codes).map(t=>[t,{w:0,l:0}]));
 for(const game of m.rawEvents){
  if(!record[game.home]||!record[game.away])continue;
  const winner=game.home_score>game.away_score?game.home:game.away;
  const loser=winner===game.home?game.away:game.home;
  record[winner].w++;record[loser].l++;
 }
 const byWins=Object.keys(record).sort((a,b)=>record[b].w-record[a].w||record[a].l-record[b].l||m.current[b]-m.current[a]);
 $('nba-season-records').innerHTML='<p class="hub-small">Verified Elo ledger only: '+m.games+' final games. This is a partial season record, not the official NBA standings. Complete conference standings will be published when a full verified standings source is available.</p><div class="nba-current-table-wrap"><table class="nba-current-table"><thead><tr><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>Elo</th></tr></thead><tbody>'+byWins.map(t=>{const r=record[t],n=r.w+r.l;return '<tr><th>'+badges(t)+'</th><td>'+r.w+'</td><td>'+r.l+'</td><td>'+(n?(r.w/n).toFixed(3):'—')+'</td><td>'+m.current[t].toFixed(1)+'</td></tr>'}).join('')+'</tbody></table></div>';

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
(async()=>{try{const m=await model();await board(m);showGames(m)}catch(e){$('nba-elo-status').textContent='Ratings unavailable: '+e.message}}})();
