/* The Sporting Life & Times — independent NCAA men's basketball desk.
   Official-looking standings are NOT imported from a second data source:
   game ledger, W-L and forecasts follow the same owned Elo replay. */
(async()=>{
"use strict";
const byId=id=>document.getElementById(id);
const safe=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const pct=(w,l)=>w+l?(100*w/(w+l)).toFixed(1)+"%":"—";
const number=x=>Number.isFinite(Number(x))?Number(x).toFixed(1):"—";
const files={
  roster:"data/ncaam-2026-27-preseason-roster-informed.json",
  current:"data/ncaam-2026-27-current-provisional.json",
  ledger:"data/ncaam-2026-27-game-ledger.json",
  upcoming:"data/ncaam-2026-27-upcoming-forecasts.json",
  feeds:"multi_scoreboards.json",
  news:"articles.json"
};
async function get(url){
  try{const r=await fetch(url,{cache:"no-store"});return r.ok?await r.json():null}catch{return null}
}
const [roster,current,ledger,upcoming,feeds,news]=await Promise.all(Object.values(files).map(get));
const verified=x=>x?.season==="2026-27"&&x.team_count===365&&x.rankings?.length===365
 &&new Set(x.rankings.map(t=>t.team_id)).size===365
 &&x.rankings.every((t,i)=>t.rank===i+1&&Number.isFinite(Number(t.elo)));
const base=verified(roster)?roster:null;
const live=verified(current)&&current.games_played>0&&
 current.preseason_baseline==="data/ncaam-2026-27-preseason-roster-informed.json"?current:null;
const ratings=live||base;
if(!ratings){
  byId("desk-state").textContent="Verified NCAA ratings unavailable; no fabricated rankings will be shown.";
  return;
}
const teams=ratings.rankings;
const lookup=new Map(teams.map(t=>[t.team_id,t]));
const names=new Map(teams.map(t=>[t.team.toLowerCase(),t]));
const fullSeason=Boolean(live);
byId("desk-state").textContent=fullSeason?
 "CURRENT SEASON · "+ratings.games_played+" VERIFIED FINALS · ELO UPDATED THROUGH "+safe(ratings.as_of):
 "2026–27 PRESEASON EDITION · 365 INDEPENDENT ELO RATINGS · ROSTER-INFORMED, PROVISIONAL";
byId("desk-summary").textContent=fullSeason?
 "Game results, records, Elo and forecasts all come from the same deduplicated NCAA result ledger. No unverified player-quality coefficient.":
 "The season has not started. Showing the roster-informed preseason baseline; records are 0–0 until verified completed games enter the NCAA ledger.";
byId("elo-leaders").innerHTML=teams.slice(0,16).map(t=>
 '<div class="cbb-ranking"><span class="cbb-rank">'+t.rank+'</span><strong>'+safe(t.team)+'</strong><span class="cbb-muted">'+safe(t.conference)+'</span><b>'+number(t.elo)+'</b></div>').join("");
const confs=[...new Set(teams.map(t=>t.conference).filter(Boolean))].sort();
const selector=byId("conference-filter");
for(const c of confs){const option=document.createElement("option");option.value=c;option.textContent=c;selector.appendChild(option)}
const want=confs.includes("Big Ten")?"Big Ten":confs[0];
selector.value=want;
function standings(){
 const c=selector.value;
 const list=teams.filter(t=>t.conference===c).sort((a,b)=>{
  const aw=a.conference_wins||0,al=a.conference_losses||0;
  const bw=b.conference_wins||0,bl=b.conference_losses||0;
  const ap=aw+al?aw/(aw+al):-1,bp=bw+bl?bw/(bw+bl):-1;
  return bp-ap || (b.wins||0)-(a.wins||0) || b.elo-a.elo;
 });
  const rows=list.map(t=>'<tr><td>'+safe(t.team)+'</td><td>'+((t.wins||0)+'-'+(t.losses||0))+'</td><td>'+pct(t.wins||0,t.losses||0)+'</td><td>'+((t.conference_wins||0)+'-'+(t.conference_losses||0))+'</td><td>'+number(t.elo)+'</td></tr>').join("");
  byId("standings").innerHTML='<div class="cbb-table-scroll"><table class="cbb-table"><thead><tr><th>Team</th><th>W–L</th><th>Win %</th><th>Conf.</th><th>Elo</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
selector.addEventListener("change",standings);standings();

function result(g){
 const home=lookup.get(g.home_id),away=lookup.get(g.away_id);
 if(!home||!away)return "";
 const winner=g.winner_id===home.team_id;
 return '<div class="cbb-game"><small>'+safe(g.date)+' · FINAL</small><div class="cbb-versus"><span><strong>'+safe(away.team)+'</strong><em>'+safe((away.wins||0)+'-'+(away.losses||0))+'</em></span><b>'+g.away_score+'</b></div><div class="cbb-versus"><span><strong>'+safe(home.team)+'</strong><em>'+safe((home.wins||0)+'-'+(home.losses||0))+'</em></span><b>'+g.home_score+'</b></div><small>Pre-game forecast: '+safe(home.team)+' '+(100*g.home_win_probability).toFixed(1)+'%'+(winner?' · home team won':' · away team won')+'</small></div>';
}
const finals=Array.isArray(ledger?.games)?ledger.games:[];
byId("results").innerHTML=finals.length?finals.slice(-12).reverse().map(result).join(""):'<p class="cbb-muted">No confirmed 2026–27 finals have entered the independent Elo ledger yet.</p>';
function forecast(g){
 const h=lookup.get(g.home_id),a=lookup.get(g.away_id);
 if(!h||!a)return "";
 return '<div class="cbb-game"><small>'+safe(g.date)+' · UPCOMING / UNCONFIRMED</small><div class="cbb-versus"><strong>'+safe(a.team)+'</strong><span>'+((a.wins||0)+'-'+(a.losses||0))+'</span></div><div class="cbb-versus"><strong>'+safe(h.team)+'</strong><span>'+((h.wins||0)+'-'+(h.losses||0))+'</span></div><div class="cbb-probability"><span>'+safe(h.team)+' '+(100*g.home_win_probability).toFixed(1)+'%</span><span>'+safe(a.team)+' '+(100*(1-g.home_win_probability)).toFixed(1)+'%</span></div></div>';
}
const future=Array.isArray(upcoming?.games)?upcoming.games:[];
byId("forecasts").innerHTML=future.length?future.slice(0,12).map(forecast).join(""):'<p class="cbb-muted">Verified schedule forecasts will appear when the 2026–27 NCAA game feed becomes available. No probabilities have been invented.</p>';
const entry=feeds?.leagues?.find(e=>e.league==="Men's College Basketball");
const livegames=(entry?.games||[]).filter(g=>g.state!=="post").slice(0,8);
byId("live-scoreboard").innerHTML=livegames.length?livegames.map(g=>'<div class="cbb-game"><small>'+safe(g.status||"Scheduled")+'</small>'+(g.teams||[]).map(t=>'<div class="cbb-versus"><span>'+(t.logo?'<img loading="lazy" alt="" src="'+safe(t.logo)+'">':"")+'<strong>'+safe(t.name)+'</strong></span><b>'+safe(g.state==="pre"?"":t.score??"")+'</b></div>').join("")+'</div>').join(""):'<p class="cbb-muted">No current scoreboard entries from the external game feed.</p>';
const stories=(news?.articles||[]).filter(a=>/college basketball|ncaa basketball|march madness|hoosiers basketball/i.test([a.title,a.summary,a.category].join(" "))).slice(0,7);
byId("stories").innerHTML=stories.length?stories.map(a=>'<article class="cbb-story"><a href="'+safe(a.url||"#")+'" target="_blank" rel="noopener">'+safe(a.title)+'</a><small>'+safe(a.source||"")+'</small></article>').join(""):'<p class="cbb-muted">No verified college basketball headlines available in the latest news feed.</p>';
byId("updated").textContent=fullSeason?"Independent Elo ledger: "+safe(ratings.as_of):"Preseason edition · No games played";
})();