/* The Sporting Life & Times — independent NCAA men's basketball desk.
   Official-looking standings are NOT imported from a second data source:
   game ledger, W-L and forecasts follow the same owned Elo replay. */
(async()=>{
"use strict";
const byId=id=>document.getElementById(id);
const safe=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const pct=(w,l)=>w+l?(100*w/(w+l)).toFixed(1)+"%":"—";
const number=x=>Number.isFinite(Number(x))?Number(x).toFixed(1):"—";
const conferenceName=c=>({AAC:"American",MWC:"Mountain West",MVC:"Missouri Valley",MAC:"Mid-American",MEAC:"Mid-Eastern Athletic",NEC:"Northeast",OVC:"Ohio Valley",SWAC:"Southwestern Athletic",UAC:"United Athletic Conference",CAA:"Coastal Athletic Association",ASUN:"Atlantic Sun",WCC:"West Coast",SoCon:"Southern"}[c]||c);
const files={
  roster:"data/ncaam-2026-27-preseason-player-quality-live.json",
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
const [polls,teamCrosswalk]=await Promise.all([get("data/ncaam-2026-27-national-polls.json"),get("data/ncaam-2026-27-espn-team-crosswalk.json")]);
const pollBox=byId("cbb-polls");
const pollButtons=[...document.querySelectorAll("[data-poll]")];
const pollValid=p=>p&&Array.isArray(p.rankings)&&p.rankings.length===25&&p.rankings.every((x,i)=>x.rank===i+1&&x.team);
function renderPoll(which="ap"){
 if(!pollBox)return;
 const ap=polls?.polls?.ap,coaches=polls?.polls?.coaches;
 if(polls?.season!=="2026-27"||!pollValid(ap)||!pollValid(coaches)){
   pollBox.innerHTML='<p class="cbb-muted">Official national polls currently unavailable.</p>';return;
 }
 pollButtons.forEach(b=>{b.classList.toggle("active",b.dataset.poll===which);b.setAttribute("aria-pressed",String(b.dataset.poll===which))});
 const other=new Map(coaches.rankings.map(x=>[x.team,x.rank]));
 const rows=(which==="compare"?ap.rankings:polls.polls[which].rankings).map(x=>{
   const rankOther=other.get(x.team);
   return '<tr><td>'+x.rank+'</td><td>'+safe(x.team)+'</td>'+(which==="compare"?'<td>'+(rankOther??"NR")+'</td>':'')+'</tr>';
 }).join("");
 pollBox.innerHTML='<table class="cbb-table cbb-poll-table"><thead><tr><th>'+(which==="compare"?"AP":"#")+'</th><th>Team</th>'+(which==="compare"?"<th>Coaches</th>":"")+'</tr></thead><tbody>'+rows+'</tbody></table>';
 const link=which==="coaches"?coaches.source_url:ap.source_url;
 byId("cbb-poll-source").innerHTML='Preseason · October 19, 2026 · <a class="cbb-link" target="_blank" rel="noopener noreferrer" href="'+safe(link)+'">Source ↗</a> · Polls are independent of our Elo.';
}
pollButtons.forEach(b=>b.addEventListener("click",()=>renderPoll(b.dataset.poll)));
renderPoll();

const verified=x=>x?.season==="2026-27"&&x.team_count===365&&x.rankings?.length===365
 &&new Set(x.rankings.map(t=>t.team_id)).size===365
 &&x.rankings.every((t,i)=>t.rank===i+1&&Number.isFinite(Number(t.elo)));
const base=verified(roster)?roster:null;
const live=verified(current)&&current.games_played>0&&
 current.preseason_seed==="data/ncaam-2026-27-preseason-player-quality-live.json"?current:null;
const ratings=live||base;
if(!ratings){
  byId("desk-state").textContent="Verified NCAA ratings unavailable; no fabricated rankings will be shown.";
  return;
}
const teams=ratings.rankings;
const scoringShadow=await get("data/ncaam-2026-27-preseason-roster-informed.json");
const modelBox=byId("cbb-model-compare");
if(modelBox){
 const shadowOK=scoringShadow?.season==="2026-27"&&scoringShadow.status==="provisional-roster-identity-linked"&&scoringShadow.rankings?.length===365;
 const candidate=new Map(shadowOK?scoringShadow.rankings.map(t=>[t.team_id,t]):[]);
 const renderModel=()=>{const rows=teams.slice(0,15).map(t=>{
 const shadow=candidate.get(t.team_id);
 return '<tr><td>'+t.rank+'</td><td>'+safe(t.team)+'</td><td>'+number(t.base_elo)+'</td><td>'+number(t.elo)+'</td><td>'+(shadow?number(shadow.elo):"—")+'</td></tr>';
 }).join("");
 modelBox.innerHTML='<div class="cbb-table-scroll"><table class="cbb-table cbb-model-table"><thead><tr><th>#</th><th>Team</th><th>Game Elo</th><th>Roster</th><th>Quality*</th></tr></thead><tbody>'+rows+'</tbody></table></div><p class="cbb-muted">Published preseason player-quality ratings compared against the previous roster-informed Elo. Historical roster timing remains a limitation.</p>';
 };
 renderModel();
}

const lookup=new Map(teams.map(t=>[t.team_id,t]));
const espnIds=new Map((teamCrosswalk?.teams||[]).filter(t=>t.id&&/^\d+$/.test(String(t.espn_id||""))).map(t=>[t.id,String(t.espn_id)]));
const logo=t=>espnIds.has(t.team_id)?'<img loading="lazy" alt="" src="https://a.espncdn.com/i/teamlogos/ncaa/500/'+espnIds.get(t.team_id)+'.png">':'';
const pollRanks=key=>new Map((polls?.polls?.[key]?.rankings||[]).map(x=>[x.team,x.rank]));
const apRanks=pollRanks("ap"),coachRanks=pollRanks("coaches");
const normalize=n=>String(n).toLowerCase().replace(/[^a-z0-9]/g,"");
const aliases={"Connecticut":"UConn","Miami":"Miami (FL)","Southern California":"USC","Brigham Young":"BYU","Saint John's":"St. John's"};
const rankFor=(map,t)=>map.get(t.team)||map.get(aliases[t.team])||[...map.entries()].find(([n])=>normalize(n)===normalize(t.team))?.[1]||null;
const teamSearch=byId("cbb-team-search");
function searchTeams(){
 if(!teamSearch)return;
 const q=teamSearch.value.trim().toLowerCase();
 const found=q?teams.filter(t=>t.team.toLowerCase().includes(q)).slice(0,12):teams.slice(0,6);
 byId("cbb-team-results").innerHTML=found.map(t=>'<a class="cbb-team-link" href="ncaam-elo.html?team='+encodeURIComponent(t.team)+'"><span>'+safe(t.team)+'</span><span>#'+t.rank+' · '+number(t.elo)+'</span></a>').join("") || '<p class="cbb-muted">No school found in the 365-team rating field.</p>';
}
if(teamSearch){teamSearch.addEventListener("input",searchTeams);searchTeams()}
const fullSeason=Boolean(live);
byId("desk-state").textContent=fullSeason?
 "CURRENT SEASON · "+ratings.games_played+" VERIFIED FINALS · ELO UPDATED THROUGH "+safe(ratings.as_of):
 "2026–27 PRESEASON ELO · 365 TEAMS · PLAYER-QUALITY MODEL";
byId("desk-summary").textContent=fullSeason?
 "Game results, records, Elo and forecasts use the same verified final-score ledger and player-quality preseason seed.":
 "The season has not started. Showing the official player-quality preseason Elo; results will update after verified finals.";
byId("elo-leaders").innerHTML=teams.slice(0,16).map(t=>
 '<div class="cbb-ranking"><span class="cbb-rank">'+t.rank+'</span><strong class="cbb-ranking-name">'+logo(t)+safe(t.team)+'</strong><span class="cbb-muted">'+safe(conferenceName(t.conference))+'</span><b>'+number(t.elo)+'</b></div>').join("");
const confs=[...new Set(teams.map(t=>t.conference).filter(Boolean))].sort((a,b)=>conferenceName(a).localeCompare(conferenceName(b)));
const selector=byId("conference-filter");
for(const c of confs){const option=document.createElement("option");option.value=c;option.textContent=conferenceName(c);selector.appendChild(option)}
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
const finals=ledger?.season==="2026-27"&&Array.isArray(ledger.games)?ledger.games:[];
byId("results").innerHTML=finals.length?finals.slice(-12).reverse().map(result).join(""):'<p class="cbb-muted">No confirmed 2026–27 finals have entered the independent Elo ledger yet.</p>';
function forecast(g){
 const h=lookup.get(g.home_id),a=lookup.get(g.away_id);
 if(!h||!a)return "";
 const p=1/(1+10**(-(h.elo-a.elo)/400));
 const d=Math.max(-28,Math.min(28,(h.elo-a.elo)/25));
 const hs=Math.round(72+d/2),as=Math.round(72-d/2);
 return '<div class="cbb-game"><small>'+safe(g.date)+' · PROJECTED, NOT ACTUAL</small><div class="cbb-versus"><strong>'+safe(a.team)+'</strong><span>'+((a.wins||0)+'-'+(a.losses||0))+'</span></div><div class="cbb-versus"><strong>'+safe(h.team)+'</strong><span>'+((h.wins||0)+'-'+(h.losses||0))+'</span></div><div><strong>Projected score: '+safe(a.team)+' '+as+' — '+hs+' '+safe(h.team)+'</strong></div><div class="cbb-probability"><span>'+safe(h.team)+' '+(100*p).toFixed(1)+'%</span><span>'+safe(a.team)+' '+(100*(1-p)).toFixed(1)+'%</span></div><div class="cbb-probability-track" aria-hidden="true"><span style="width:'+(100*p).toFixed(1)+'%"></span></div></div>';
}
const future=Array.isArray(upcoming?.games)?upcoming.games.filter(g=>g.date>=new Date().toISOString().slice(0,10)):[];
byId("forecasts").innerHTML=future.length?future.slice(0,12).map(forecast).join(""):'<p class="cbb-muted">Verified schedule forecasts will appear when the 2026–27 NCAA game feed becomes available. No probabilities have been invented.</p>';
const entry=feeds?.leagues?.find(e=>e.league==="Men's College Basketball");
// Limit the external scoreboard to explicitly dated games today; never
// present last season's entries as live. Finals come from the verified ledger.
const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const dateOf=g=>String(g.date||g.game_date||g.start_date||g.startTime||g.start_time||"").slice(0,10);
const livegames=(entry?.games||[]).filter(g=>dateOf(g)===today&&["pre","in"].includes(g.state)).slice(0,8);
byId("live-scoreboard").innerHTML=livegames.length?livegames.map(g=>'<div class="cbb-game"><small>'+safe(g.status||"Scheduled")+'</small>'+(g.teams||[]).map(t=>'<div class="cbb-versus"><span>'+(t.logo?'<img loading="lazy" alt="" src="'+safe(t.logo)+'">':"")+'<strong>'+safe(t.name)+'</strong></span><b>'+safe(g.state==="pre"?"":t.score??"")+'</b></div>').join("")+'</div>').join(""):'<p class="cbb-muted">No current scoreboard entries from the external game feed.</p>';
const stories=(news?.articles||[]).filter(a=>/college basketball|ncaa basketball|march madness|hoosiers basketball|ncaam|men.s basketball/i.test([a.title,a.summary,a.category].join(" ")) && /^https:\/\//.test(a.url||"") && a.title).slice(0,15);
byId("stories").innerHTML=stories.length?stories.map((a,i)=>'<article class="cbb-story"><small>'+safe(a.source||"COLLEGE BASKETBALL")+(a.published_at?' · '+safe(String(a.published_at).slice(0,10)):'')+'</small><div><a href="'+safe(a.url)+'" target="_blank" rel="noopener noreferrer">'+safe(a.title)+'</a></div>'+(i<4&&a.summary?'<p>'+safe(a.summary)+'</p>':'')+'</article>').join(""):'<p class="cbb-muted">No attributed college basketball articles available from the current news feed.</p>';
byId("updated").textContent=fullSeason?"Independent Elo ledger: "+safe(ratings.as_of):"Preseason edition · No games played";
})();