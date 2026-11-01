(function () {
"use strict";
const root=document.getElementById("nfl-app");
const page=document.body.getAttribute("data-page")||"front";
const params=new URLSearchParams(location.search);
const encode=encodeURIComponent;
const escapeHtml=x=>String(x==null?"":x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const format=(n,dec=0)=>Number.isFinite(Number(n))?Number(n).toLocaleString("en-US",{maximumFractionDigits:dec,minimumFractionDigits:dec}):"—";
const date=x=>{try{return new Date(x).toLocaleString("en-US",{timeZone:"America/New_York",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"});}catch(e){return x||"TBA";}};
const urlTeam=id=>"nfl-team.html?team="+encode(id);
const urlGame=id=>"nfl-game.html?id="+encode(id);
const link=(href,title)=>'<a href="'+escapeHtml(href)+'">'+escapeHtml(title)+'</a>';
let feed={},teams={},games=[];
function team(id){return teams[String(id)]||{id:String(id),name:"Unknown team",code:"?",color:"#222",secondary_color:"#cfa951"};}
function crest(t,size=""){return '<span class="nfl-two-band '+size+'" style="--primary:'+escapeHtml(t.color||"#222")+';--secondary:'+escapeHtml(t.secondary_color||"#cfa951")+'"><img loading="lazy" src="'+escapeHtml(t.logo||"")+'" alt=""></span>';}
function side(s,showScore){const t=team(s.id);return '<div class="nfl-side">'+crest(t,"sm")+link(urlTeam(t.id),t.name)+(showScore&&s.score!=null?'<b class="nfl-score">'+s.score+'</b>':"")+'</div>';}
function panel(title,content){return '<section class="nfl-section"><h2>'+escapeHtml(title)+'</h2>'+content+'</section>';}
function note(content){return '<div class="nfl-note">'+content+'</div>';}
function gridTable(headers,rows){let out='<div style="overflow-x:auto"><table class="nfl-table"><thead><tr>';
headers.forEach(h=>out+='<th>'+escapeHtml(h)+'</th>');
out+='</tr></thead><tbody>'+rows.join("")+'</tbody></table></div>';
return out;}
function club(t){return '<div class="club">'+crest(t,"sm")+link(urlTeam(t.id),t.name)+'</div>';}
function gameCard(g){const done=g.state==="post",e=g.elo||{};
let out='<article class="nfl-card"><div class="meta"><span>WEEK '+g.week+'</span><span>'+escapeHtml(g.status)+'</span></div><div class="match">';
out+=side(g.away,done||g.state==="in")+side(g.home,done||g.state==="in")+'</div>';
out+='<div class="line">'+escapeHtml(date(g.date))+(g.broadcast?" · "+escapeHtml(g.broadcast):"")+'</div>';
if(e.home_win_probability!=null)out+='<div class="line">USRS: '+team(g.home.id).code+' '+format(e.home_win_probability*100)+'% · projection '+e.away_projected_points+'–'+e.home_projected_points+'</div>';
return out+'<div class="line">'+link(urlGame(g.id),"Game center →")+'</div></article>';}
function gameLine(g){const done=g.state!=="pre";
return '<div class="nfl-game"><div class="meta"><span>WEEK '+g.week+' · '+escapeHtml(g.status)+'</span><span>'+escapeHtml(date(g.date))+'</span></div>'+side(g.away,done)+side(g.home,done)+'<div class="line">'+escapeHtml(g.venue||"Venue TBA")+' · '+link(urlGame(g.id),"Game details →")+'</div></div>';}
function sorted(t){return t.slice().sort((a,b)=>b.pct-a.pct||b.w-a.w||b.elo-a.elo);}
function seasonTable(t){return gridTable(["TEAM","W-L-T","PCT","PF","PA","DIFF","ELO"],sorted(t).map(x=>'<tr><td>'+club(x)+'</td><td><span class="nfl-record-nowrap">'+x.w+'–'+x.l+'–'+x.t+'</span></td><td>'+(x.pct*100).toFixed(1)+'%</td><td>'+x.pf+'</td><td>'+x.pa+'</td><td>'+x.point_diff+'</td><td><b>'+format(x.elo,1)+'</b></td></tr>'));}
function statsCaveat(){const c=feed.coverage||{};return note(c.boxscore_complete?"Player statistics represent all "+c.finals+" completed-game box scores in this edition.":"<strong>PARTIAL STATISTICS:</strong> "+c.boxscores+" of "+c.finals+" final-game box scores recovered. Player and team statistical totals are incomplete until all game boxes are verified.");}
function week(){const next=games.filter(g=>new Date(g.date).getTime()>Date.now()-86400000).sort((a,b)=>a.date.localeCompare(b.date));return next.length?next[0].week:18;}
function directory(){return '<div class="nfl-directory">'+feed.teams.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(t=>'<a class="nfl-tile" href="'+urlTeam(t.id)+'">'+crest(t,"sm")+'<span>'+escapeHtml(t.name)+'<span class="small">'+escapeHtml(t.division)+' · '+t.w+'-'+t.l+'-'+t.t+'</span></span></a>').join("")+'</div>';}
const leaderLabels={
 passing:{title:"PASSING",unit:"YDS",sub:"Passing yards"},rushing:{title:"RUSHING",unit:"YDS",sub:"Rushing yards"},
 receiving:{title:"RECEIVING",unit:"YDS",sub:"Receiving yards"},tackles:{title:"TACKLES",unit:"TOT",sub:"Total tackles"},
 sacks:{title:"SACKS",unit:"SACKS",sub:"Quarterback sacks"},interceptions:{title:"INTERCEPTIONS",unit:"INT",sub:"Defensive interceptions"}
};
function playerExtra(p,category){
 const s=p.stats||{},keys=category==="passing"?[["TD","TD"],["INT","INT"]]:category==="rushing"?[["CAR","ATT"],["TD","TD"]]:category==="receiving"?[["REC","REC"],["TD","TD"]]:category==="tackles"?[["SOLO","SOLO"],["TFL","TFL"]]:category==="sacks"?[["TFL","TFL"],["QB HTS","QB HITS"]]:[["YDS","RETURN YDS"],["TD","TD"]];
 return keys.filter(([key])=>s[key]!=null).map(([key,label])=>'<span><b>'+format(s[key],1)+'</b> '+label+'</span>').join("");
}
function leaderRow(p,i,category,max,compact=false){
 const t=team(p.team_id),frac=Math.max(0,Math.min(100,100*(Number(p.value)||0)/Math.max(1,max)));
 return '<div class="nfl-leader-row '+(compact?'compact':'')+'" style="--club-color:'+escapeHtml(t.color)+';--club-alt:'+escapeHtml(t.secondary_color)+'">'+
 '<span class="nfl-leader-rank">'+String(i+1).padStart(2,"0")+'</span>'+
 '<div class="nfl-leader-face"><img loading="lazy" src="'+escapeHtml(p.headshot||"")+'" alt=""></div>'+
 '<div class="nfl-leader-info"><b>'+escapeHtml(p.name)+'</b><div class="nfl-leader-club">'+crest(t,"sm")+' '+link(urlTeam(t.id),t.code)+
 '<span class="nfl-leader-detail"> · '+format(p.games)+' games</span></div>'+
 '<div class="nfl-progress" aria-hidden="true"><span style="width:'+frac.toFixed(1)+'%"></span></div>'+
 (compact?'':'<div class="nfl-leader-extras">'+playerExtra(p,category)+'</div>')+'</div>'+
 '<div class="nfl-leader-value"><b>'+format(p.value,category==="sacks"?1:0)+'</b><small>'+escapeHtml(leaderLabels[category].unit)+'</small></div></div>';
}
function listLeaders(category,limit,teamFilter){
 const src=teamFilter?(((feed.team_leaders||{})[teamFilter]||{})[category]||((feed.leaders||{})[category]||[]).filter(p=>p.team_id===teamFilter)):((feed.leaders||{})[category]||[]);
 const rows=src.slice(0,limit),max=rows.length?rows[0].value:1;
 return rows.map((p,i)=>leaderRow(p,i,category,max,true)).join("")||'<p class="nfl-small">Verified player figures pending.</p>';
}
function featurePlayer(p,i,category){
 const t=team(p.team_id),label=leaderLabels[category];
 return '<article class="nfl-feature-player place-'+(i+1)+'" style="--club-color:'+escapeHtml(t.color)+';--club-alt:'+escapeHtml(t.secondary_color)+'">'+
 '<div class="nfl-feature-top"><span class="nfl-place-label">'+(i===0?"LEAGUE LEADER":i===1?"SECOND PLACE":"THIRD PLACE")+'</span>'+crest(t,"head")+'</div>'+
 '<div class="nfl-feature-portrait"><img loading="lazy" src="'+escapeHtml(p.headshot||"")+'" alt=""></div>'+
 '<div class="nfl-feature-details"><p class="nfl-feature-team">'+escapeHtml(t.name)+'</p><h2>'+escapeHtml(p.name)+'</h2>'+
 '<div class="nfl-feature-number">'+format(p.value,category==="sacks"?1:0)+'<span>'+escapeHtml(label.unit)+'</span></div>'+
 '<div class="nfl-feature-extra">'+playerExtra(p,category)+'</div><p class="nfl-small">'+format(p.games)+' verified games</p></div></article>';
}
function home(){
const w=week(),thisWeek=games.filter(g=>g.week===w);
const finals=games.filter(g=>g.state==="post").slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7);
const future=games.filter(g=>g.state!=="post").slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(0,7);
let out='<p class="nfl-kicker">NATIONAL FOOTBALL LEAGUE · 2026</p><h1 class="nfl-title">THE NFL NEWSPAPER</h1>';
out+='<p class="nfl-lede">The entire NFL season in the Sporting Life &amp; Times: all 32 clubs, sourced results, standings, independent USRS Elo, game previews and player leaders.</p>';
const model=feed.model||{};
 out+='<div class="nfl-model-ribbon"><div class="nfl-model-head"><span>USRS · INDEPENDENT ELO MODEL</span><a href="nfl-rankings.html">POWER RANKINGS →</a></div><div class="nfl-model-metrics">'+
 '<div><strong>1500</strong><span>Starting Elo · all clubs</span></div>'+
 '<div><strong>+'+format(model.home_advantage_elo)+'</strong><span>Calibrated home field</span></div>'+
 '<div><strong>'+format(model.k_base)+'</strong><span>Calibrated K-factor</span></div>'+
 '<div><strong>'+format(model.calibration_validation_brier,4)+'</strong><span>2025 holdout Brier</span></div>'+
 '</div><p>Fit to '+format(model.calibration_train_games)+' historical games; checked against '+format(model.calibration_validation_games)+' unseen 2025 games. Every new season resets to 1500.</p></div>';
 out+='<div class="nfl-controls"><b>THE SCOREBOARD · WEEK '+w+'</b> · '+link("nfl-schedule.html","Full 18-week schedule →")+'</div><div class="nfl-rail">'+thisWeek.map(gameCard).join("")+'</div>';
out+='<div class="nfl-front-grid"><div>';
out+=panel("NFL · TOP STORIES",'<div id="nfl-stories">Loading sourced headlines…</div>');
out+=panel("RECENT FINALS",finals.map(gameLine).join("")||"No verified finals.");
out+=panel("NEXT GAMES",future.map(gameLine).join("")||"Fixtures currently unavailable.");
out+='</div><div>';
out+=panel("USRS · TOP TEN",gridTable(["TEAM","W-L-T","ELO"],feed.teams.slice(0,10).map((t,i)=>'<tr><td><strong>'+(i+1)+'.</strong> '+club(t)+'</td><td>'+t.w+'-'+t.l+'-'+t.t+'</td><td><b>'+format(t.elo,1)+'</b></td></tr>'))+'<p class="nfl-small">'+link("nfl-rankings.html","Complete 32-team ranking →")+'</p>');
let leaders="<div class='nfl-duo'>";
["passing","rushing","receiving","sacks"].forEach(cat=>{leaders+=panel(cat.toUpperCase(),listLeaders(cat,5));});
leaders+="</div>";
out+=panel("PLAYER LEADERS",statsCaveat()+leaders);
out+=panel("LEAGUE COVERAGE",'<div class="nfl-statline"><div class="nfl-stat"><b>'+feed.coverage.finals+'</b><span>Finals</span></div><div class="nfl-stat"><b>'+feed.coverage.boxscores+'</b><span>Box scores</span></div><div class="nfl-stat"><b>1500</b><span>Starting Elo</span></div><div class="nfl-stat"><b>32</b><span>Teams</span></div></div>');
out+='</div></div>';
return out+'<section class="nfl-section" id="teams"><h2>FIND YOUR TEAM</h2>'+directory()+'</section>';
}
function standings(){
let out='<p class="nfl-kicker">REGULAR SEASON · CONFERENCE TABLES</p><h1 class="nfl-title">NFL STANDINGS</h1>';
out+=note("Standings are computed from ESPN-sourced finals. Display ties use Elo after win percentage, <strong>not</strong> the NFL’s complete official tiebreaking procedures.");
["AFC","NFC"].forEach(conf=>{
out+='<p class="nfl-kicker">'+conf+'</p><div class="nfl-grid">';
["East","North","South","West"].forEach(div=>{out+=panel(conf+" "+div,seasonTable(feed.teams.filter(t=>t.division===conf+" "+div)));});
out+='</div>';
});
return out;
}
function rankings(){
const last={};games.filter(g=>g.state==="post").forEach(g=>["away","home"].forEach(side=>last[g[side].id]=g.elo&&g.elo[side+"_delta"]));
const m=feed.model||{};
let out='<p class="nfl-kicker">THE USRS RATING DESK · HISTORICALLY CALIBRATED</p><h1 class="nfl-title">NFL ELO POWER RANKINGS</h1>';
out+='<div class="nfl-ranking-model"><span><b>1,500</b> starting Elo</span><span><b>+'+format(m.home_advantage_elo)+'</b> home field</span><span><b>K '+format(m.k_base)+'</b> margin adjusted</span><span><b>'+format(m.calibration_train_games)+'</b> training games</span></div>';
out+=note("The 2026 season starts with all 32 franchises at exactly <b>1500 Elo</b>. Home field and K are fitted to 2023–24 finals, and validated against held-out 2025 results. Prior seasons never carry ratings forward; neutral-site games have no home advantage. Ratings are independent from official NFL standings.");
out+='<div class="nfl-elo-podium">'+feed.teams.slice(0,3).map((t,i)=>'<a class="nfl-elo-podium-card" style="--team:'+escapeHtml(t.color)+'" href="'+urlTeam(t.id)+'"><span>NO. '+(i+1)+'</span>'+crest(t,"lg")+'<b>'+escapeHtml(t.name)+'</b><strong>'+format(t.elo,1)+'</strong><small>'+t.w+'–'+t.l+'–'+t.t+' · '+(t.elo_change>0?'+':'')+format(t.elo_change,1)+' from 1500</small></a>').join("")+'</div>';
const rows=feed.teams.map((t,i)=>{const pct=Math.max(2,Math.min(100,((t.elo-1250)/500)*100));
return '<tr><td><strong class="nfl-power-rank">'+(i+1)+'</strong></td><td>'+club(t)+'</td><td><span class="nfl-record-nowrap">'+t.w+'–'+t.l+'–'+t.t+'</span></td><td><div class="nfl-elo-meter" style="--elo-team:'+escapeHtml(t.color)+'"><span style="width:'+pct.toFixed(1)+'%"></span></div><b>'+format(t.elo,1)+'</b></td><td class="'+(t.elo_change>=0?'nfl-positive':'nfl-negative')+'">'+(t.elo_change>0?'+':'')+format(t.elo_change,1)+'</td><td>'+(last[t.id]==null?'—':(last[t.id]>0?'+':'')+format(last[t.id],1))+'</td></tr>';});
const cards=feed.teams.map((t,i)=>{
 const pct=Math.max(2,Math.min(100,((t.elo-1250)/500)*100));
 const delta=(t.elo_change>0?"+":"")+format(t.elo_change,1);
 const lg=last[t.id]==null?"—":(last[t.id]>0?"+":"")+format(last[t.id],1);
 return '<a class="nfl-rank-card" href="'+urlTeam(t.id)+'" style="--rank-club:'+escapeHtml(t.color)+'">'+
  '<span class="nfl-rank-card-place">'+(i+1)+'</span>'+crest(t,"sm")+
  '<span class="nfl-rank-card-identity"><strong>'+escapeHtml(t.name)+'</strong>'+
   '<span class="nfl-rank-card-record" aria-label="Wins losses ties"><em>W–L–T</em> '+t.w+'–'+t.l+'–'+t.t+'</span></span>'+
  '<span class="nfl-rank-card-rating"><strong>'+format(t.elo,1)+'</strong><small>ELO</small></span>'+
  '<span class="nfl-rank-card-meter"><i style="width:'+pct.toFixed(1)+'%"></i></span>'+
  '<span class="nfl-rank-card-changes"><span class="'+(t.elo_change>=0?'nfl-positive':'nfl-negative')+'">FROM 1500 '+delta+'</span>'+
   '<span>LAST '+lg+'</span></span></a>';
}).join("");
return out+'<div class="nfl-rank-desktop">'+gridTable(["RANK","TEAM","W-L-T","2026 ELO","FROM 1500","LAST GAME"],rows)+'</div>'+
 '<div class="nfl-rank-mobile" aria-label="NFL Elo rankings with single-line team records">'+cards+'</div>';
}
function players(){
 const categories=["passing","rushing","receiving","tackles","sacks","interceptions"];
 let cat=params.get("category")||"passing";if(!categories.includes(cat))cat="passing";
 const rows=(feed.leaders||{})[cat]||[],label=leaderLabels[cat];
 let out='<p class="nfl-kicker">THE NFL PLAYER DESK · 2026 REGULAR SEASON</p><h1 class="nfl-title">THE LEAGUE LEADERS</h1>'+
 '<p class="nfl-lede">The NFL’s standout performances, drawn from verified 2026 game box scores. Explore every major yardage and defensive category.</p>'+
 '<div class="nfl-controls nfl-stat-filters" aria-label="Statistic category">';
 categories.forEach(c=>{out+='<a class="nfl-button" aria-pressed="'+(c===cat)+'" href="nfl-players.html?category='+c+'">'+leaderLabels[c].title+'</a>';});
 out+='</div>';
 if(rows.length){
  out+='<div class="nfl-stats-hero"><div class="nfl-stats-hero-title"><span>STATISTICAL LEADERBOARD / '+label.title+'</span><strong>'+label.sub+'</strong></div>'+
    '<div class="nfl-feature-grid">'+rows.slice(0,3).map((p,i)=>featurePlayer(p,i,cat)).join("")+'</div></div>';
  out+='<section class="nfl-section nfl-leaderboard-section"><div class="nfl-leaderboard-header"><div><p class="nfl-label">THE FULL TOP 30</p><h2>'+label.title+' LEADERBOARD</h2></div><span class="nfl-small">TOTAL · '+label.unit+' · TEAM · GAMES</span></div>'+
  '<div class="nfl-leaderboard">'+rows.map((p,i)=>leaderRow(p,i,cat,rows[0].value,false)).join("")+'</div></section>';
 }else out+=note("No source-confirmed player totals for "+escapeHtml(cat)+" yet.");
 return out+statsCaveat();
}
function schedule(){
const weeks=[...new Set(games.map(g=>g.week))].sort((a,b)=>a-b);
let w=Number(params.get("week"))||week();if(!weeks.includes(w))w=weeks[0];
let out='<p class="nfl-kicker">ALL 18 WEEKS · COMPLETE REGULAR SEASON</p><h1 class="nfl-title">NFL SCHEDULE &amp; RESULTS</h1>';
out+='<div class="nfl-controls"><label for="nfl-week">WEEK</label><select id="nfl-week">';
weeks.forEach(x=>{out+='<option value="'+x+'" '+(x===w?"selected":"")+'>WEEK '+x+'</option>';});
out+='</select></div><div class="nfl-slate">'+games.filter(g=>g.week===w).map(gameCard).join("")+'</div>';
return out+note("Away team first, home team second. Kickoff times shown in Eastern Time. USRS projections are independent estimates.");
}
function gameCenter(){
const chosen=params.get("team")||"all";
let out='<p class="nfl-kicker">SCORES · SCHEDULE · PROJECTIONS</p><h1 class="nfl-title">NFL GAME CENTER</h1><div class="nfl-controls"><label for="nfl-team-select">TEAM</label><select id="nfl-team-select"><option value="all">ALL TEAMS</option>';
feed.teams.slice().sort((a,b)=>a.name.localeCompare(b.name)).forEach(t=>{out+='<option value="'+t.id+'" '+(chosen===t.id?"selected":"")+'>'+escapeHtml(t.name)+'</option>';});
out+='</select></div>';
const relevant=games.filter(g=>chosen==="all"||g.away.id===chosen||g.home.id===chosen).slice().sort((a,b)=>b.date.localeCompare(a.date));
return out+relevant.map(gameLine).join("");
}
function teamPage(){
const id=params.get("team"),t=team(id);
if(!teams[id])return note("Unknown NFL franchise. "+link("nfl.html","Choose a team."));
const slate=games.filter(g=>g.away.id===id||g.home.id===id).sort((a,b)=>a.date.localeCompare(b.date));
let out='<div class="nfl-team-head">'+crest(t,"lg")+'<div><p class="nfl-kicker">'+escapeHtml(t.division)+'</p><h1>'+escapeHtml(t.name)+'</h1><span class="detail">'+t.w+'–'+t.l+'–'+t.t+' · '+format(t.elo,1)+' Elo · '+(t.elo_change>0?"+":"")+format(t.elo_change,1)+' this season</span></div></div>';
const metrics=[["Points for",t.pf],["Points against",t.pa],["Total yards",(t.team_stats||{}).totalYards],["Pass yards",(t.team_stats||{}).netPassingYards],["Rush yards",(t.team_stats||{}).rushingYards],["1st downs",(t.team_stats||{}).firstDowns],["Turnovers",(t.team_stats||{}).turnovers],["Point diff.",t.point_diff]];
out+='<div class="nfl-statline nfl-team-statline" style="--stat-accent:'+escapeHtml(t.color)+'">'+metrics.map(v=>'<div class="nfl-stat"><b>'+format(v[1])+'</b><span>'+escapeHtml(v[0])+'</span></div>').join("")+'</div>'+statsCaveat();
out+='<div class="nfl-duo">'+panel("RECENT RESULTS",slate.filter(g=>g.state==="post").slice(-5).reverse().map(gameLine).join(""))+panel("NEXT KICKOFFS",slate.filter(g=>g.state!=="post").slice(0,5).map(gameLine).join(""))+'</div>';
out+=panel("CLUB STATISTICAL LEADERS",'<div class="nfl-grid">'+["passing","rushing","receiving","sacks"].map(cat=>'<div class="nfl-team-leaders"><h3>'+escapeHtml(leaderLabels[cat].title)+'</h3>'+listLeaders(cat,4,id)+'</div>').join("")+'</div>');
const rows=slate.map(g=>{const atHome=g.home.id===id,other=atHome?g.away:g.home,us=atHome?g.home:g.away,opp=team(other.id);
const result=g.state==="post"?(us.score>other.score?"W ":us.score<other.score?"L ":"T ")+us.score+"–"+other.score:(g.state==="in"?"LIVE":"Scheduled");
return '<tr><td>W'+g.week+' · '+escapeHtml(date(g.date))+'</td><td>'+crest(opp,"sm")+' '+(atHome?"vs ":"@ ")+link(urlGame(g.id),opp.name)+'</td><td>'+escapeHtml(result)+'</td><td>'+format((g.elo||{})[(atHome?"home":"away")+"_before"],1)+'</td></tr>';});
out+=panel("FULL 2026 TEAM SCHEDULE",gridTable(["WEEK / DATE","OPPONENT","RESULT","PRE-GAME ELO"],rows));
return out+panel("2026 ROSTER",'<div id="nfl-roster">Checking sourced roster…</div>');
}
async function roster(){
const id=params.get("team"),el=document.getElementById("nfl-roster");if(!el)return;
try{const res=await fetch("data/nfl-2026-rosters.json?t="+Date.now(),{cache:"no-store"});if(!res.ok)throw Error("Roster not yet published");
const json=await res.json(),rows=(json.teams||{})[id]||[];
el.innerHTML=rows.length?gridTable(["PLAYER","POSITION","NO.","STATUS"],rows.map(p=>'<tr><td><div class="nfl-player"><img loading="lazy" src="'+escapeHtml(p.headshot||"")+'" alt="">'+escapeHtml(p.name)+'</div></td><td>'+escapeHtml(p.position)+'</td><td>'+escapeHtml(p.jersey)+'</td><td>'+escapeHtml(p.status||"")+'</td></tr>')):note("Current roster has not been verified.");}
catch(e){el.innerHTML=note("Roster feed unavailable. Club results and ratings remain available.");}
}
function gamePage(){
const g=games.find(g=>g.id===params.get("id"));if(!g)return note("Game not found. "+link("nfl-game-center.html","Open the Game Center."));
const a=team(g.away.id),h=team(g.home.id),elo=g.elo||{};
let out='<p class="nfl-kicker">WEEK '+g.week+' · '+escapeHtml(g.status)+'</p><h1 class="nfl-title">'+escapeHtml(a.name)+' at '+escapeHtml(h.name)+'</h1>';
out+='<div class="nfl-team-head" style="justify-content:space-between;flex-wrap:wrap">'+side(g.away,true)+'<strong>AT</strong>'+side(g.home,true)+'</div>';
out+='<p class="nfl-small">'+escapeHtml(date(g.date))+' · '+escapeHtml(g.venue||"Venue TBA")+' · '+escapeHtml(g.broadcast||"Broadcast TBA")+'</p>';
const stats=[["Home win chance",elo.home_win_probability==null?"—":format(100*elo.home_win_probability,1)+"%"],["Away win chance",elo.away_win_probability==null?"—":format(100*elo.away_win_probability,1)+"%"],["Predicted score",elo.away_projected_points==null?"—":elo.away_projected_points+"–"+elo.home_projected_points],["Home Elo change",elo.home_delta==null?"Pending":format(elo.home_delta,1)]];
out+='<div class="nfl-statline">'+stats.map(v=>'<div class="nfl-stat"><b>'+v[1]+'</b><span>'+v[0]+'</span></div>').join("")+'</div>';
return out+panel("BOX SCORE &amp; TEAM STATISTICS",'<div id="nfl-game-box">Loading sourced box score…</div>')+'<p class="nfl-small">'+link(g.url,"ESPN source game page ↗")+'</p>';
}
async function gameBox(){
 const id=params.get("id"),el=document.getElementById("nfl-game-box");if(!el)return;
 try{const res=await fetch("data/nfl-2026-boxscores.json?t="+Date.now(),{cache:"no-store"});if(!res.ok)throw Error();
 const json=await res.json(),box=(json.games||{})[id];if(!box){el.innerHTML=note("Detailed statistics not available for this game yet; unverified values are never filled in.");return;}
 const g=games.find(x=>x.id===id),a=team(g.away.id),h=team(g.home.id),aa=(box.teams||{})[a.id]||{},hh=(box.teams||{})[h.id]||{};
 const pairs=[["Total yards","totalYards"],["Passing yards","netPassingYards"],["Rushing yards","rushingYards"],["First downs","firstDowns"],["Turnovers","turnovers"]];
 let out='<div class="nfl-box-comparison"><div class="nfl-box-side">'+crest(a,"head")+'<strong>'+escapeHtml(a.code)+'</strong></div>'+
 '<div class="nfl-box-comparison-center"><span>TEAM COMPARISON</span><b>FINAL GAME STATISTICS</b></div><div class="nfl-box-side">'+crest(h,"head")+'<strong>'+escapeHtml(h.code)+'</strong></div></div>';
 out+='<div class="nfl-box-bars">';
 pairs.forEach(([title,key])=>{const av=aa[key],hv=hh[key],mx=Math.max(1,Number(av)||0,Number(hv)||0);
 out+='<div class="nfl-box-row"><b>'+format(av)+'</b><div class="nfl-box-stat"><span>'+title+'</span><div class="nfl-box-compare"><i style="--bar-color:'+escapeHtml(a.color)+';width:'+((Number(av)||0)/mx*100).toFixed(1)+'%"></i><i style="--bar-color:'+escapeHtml(h.color)+';width:'+((Number(hv)||0)/mx*100).toFixed(1)+'%"></i></div></div><b>'+format(hv)+'</b></div>';});
 out+='</div>';
 out+='<div class="nfl-grid">'+[a,h].map(t=>panel(t.name+' · Complete Team Box Score',Object.entries((box.teams||{})[t.id]||{}).map(([key,v])=>'<div class="nfl-mini">'+escapeHtml(key.replace(/([A-Z])/g," $1"))+'<b>'+format(v,1)+'</b></div>').join(""))).join("")+'</div>';
 ["passing","rushing","receiving","defensive","interceptions","kicking","punting"].forEach(cat=>{
 const lines=(box.players||[]).filter(p=>(p.category||"").includes(cat));if(!lines.length)return;
 const columns=[...new Set(lines.flatMap(p=>Object.keys(p.stats||{})))].slice(0,7);
 out+=panel(cat.toUpperCase(),gridTable(["PLAYER","TEAM"].concat(columns),lines.map(p=>'<tr><td><div class="nfl-player"><img loading="lazy" src="'+escapeHtml(p.headshot||"")+'" alt=""><b>'+escapeHtml(p.name)+'</b></div></td><td>'+crest(team(p.team_id),"sm")+'</td>'+columns.map(c=>'<td>'+((p.stats||{})[c]==null?"—":format(p.stats[c],1))+'</td>').join("")+'</tr>')));
 });
 el.innerHTML=out;}catch(e){el.innerHTML=note("Box-score data unavailable for this matchup.");}
}

function prng(seed){let x=seed>>>0;return()=>{x+=0x6D2B79F5;let t=x;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function playoffs(){
const random=prng(20261101),count=2000,tracker={};
feed.teams.forEach(t=>tracker[t.id]={playoff:0,division:0,conference:0,champion:0});
const remaining=games.filter(g=>g.state!=="post");
function pick(a,b,home=true){const ra=team(a).elo+(home?(Number(feed.model.home_advantage_elo)||55):0),rb=team(b).elo;return random()<1/(1+Math.pow(10,-(ra-rb)/400))?a:b;}
for(let i=0;i<count;i++){
const wins={};feed.teams.forEach(t=>wins[t.id]=t.w+t.t*0.5);
remaining.forEach(g=>wins[pick(g.home.id,g.away.id,!g.neutral_site)]++);
const champs={};
["AFC","NFC"].forEach(conf=>{
const group=feed.teams.filter(t=>t.conference===conf);
const order=(a,b)=>wins[b.id]-wins[a.id]||b.elo-a.elo;
const leaders=["East","North","South","West"].map(d=>group.filter(t=>t.division===conf+" "+d).sort(order)[0]).sort(order);
const wild=group.filter(t=>!leaders.includes(t)).sort(order).slice(0,3);
const seed=leaders.concat(wild).map(t=>t.id);
seed.forEach(id=>tracker[id].playoff++);
leaders.forEach(t=>tracker[t.id].division++);
let first=[pick(seed[1],seed[6]),pick(seed[2],seed[5]),pick(seed[3],seed[4])];
first.sort((a,b)=>seed.indexOf(a)-seed.indexOf(b));
const byeOpponent=first.pop();
const semi1=pick(seed[0],byeOpponent),semi2=pick(first[0],first[1]);
const champ=pick(semi1,semi2);
tracker[champ].conference++;champs[conf]=champ;
});
tracker[pick(champs.AFC,champs.NFC,false)].champion++;
}
let out='<p class="nfl-kicker">THE PLAYOFF DESK · 2,000 SIMULATIONS</p><h1 class="nfl-title">NFL PLAYOFF PICTURE</h1>';
out+=note("Independent USRS simulation of remaining games and a 14-team postseason. Division leaders seed ahead of wild cards. Uses current Elo; does not implement all NFL official tiebreakers, account for injuries or update ratings during simulated future games. Probabilities are <b>model estimates</b>, not official NFL seedings.");
out+='<div class="nfl-sim">';
["AFC","NFC"].forEach(conf=>{
const rows=feed.teams.filter(t=>t.conference===conf).sort((a,b)=>tracker[b.id].playoff-tracker[a.id].playoff).map(t=>{
const x=tracker[t.id];return '<tr><td>'+club(t)+'</td><td>'+format(100*x.division/count,1)+'%</td><td><b>'+format(100*x.playoff/count,1)+'%</b></td><td>'+format(100*x.conference/count,1)+'%</td><td>'+format(100*x.champion/count,1)+'%</td></tr>';});
out+=panel(conf+" PLAYOFF ODDS",gridTable(["TEAM","DIV","PLAYOFF","CONF","TITLE"],rows));
});
return out+'</div>';
}
async function news(){
const target=document.getElementById("nfl-stories");if(!target)return;
try{const res=await fetch("articles.json?ts="+Date.now(),{cache:"no-store"});if(!res.ok)throw Error();
const obj=await res.json(),items=Array.isArray(obj)?obj:(obj.articles||[]);
const relevant=items.filter(p=>/(\bnfl\b|national football league|super bowl|gridiron)/i.test([p.title,p.summary,p.category].join(" "))).slice(0,7);
target.innerHTML=relevant.length?'<div class="nfl-news">'+relevant.map(a=>'<article class="nfl-story"><a target="_blank" rel="noopener noreferrer" href="'+escapeHtml(a.url||"#")+'">'+escapeHtml(a.title)+'</a><p>'+escapeHtml(a.source||"Source")+' · '+escapeHtml(a.published_at||"")+'</p></article>').join("")+'</div>':note("No sourced NFL headlines in the current site feed.");}
catch(e){target.innerHTML=note("Headline feed unavailable; game scores and model data remain independent.");}
}
async function main(){
try{const res=await fetch("data/nfl-2026-edition.json?t="+Date.now(),{cache:"no-store"});if(!res.ok)throw Error("The NFL season data has not published yet");
feed=await res.json();if(feed.season!==2026||!Array.isArray(feed.games)||feed.games.length<200||feed.teams.length!==32)throw Error("Incomplete season feed; publication blocked");
feed.teams.forEach(t=>teams[t.id]=t);games=feed.games;
const screens={front:home,standings:standings,rankings:rankings,players:players,schedule:schedule,games:gameCenter,team:teamPage,game:gamePage,playoffs:playoffs};
root.innerHTML=(screens[page]||home)();
document.getElementById("nfl-stamp").textContent="Verified NFL feed · "+date(feed.updated_at)+" · "+feed.coverage.games+" fixtures · "+feed.coverage.finals+" finals · "+feed.coverage.boxscores+" boxes";
if(page==="front")news();
if(page==="team")roster();
if(page==="game")gameBox();
const wk=document.getElementById("nfl-week");if(wk)wk.onchange=()=>location.href="nfl-schedule.html?week="+encode(wk.value);
const ts=document.getElementById("nfl-team-select");if(ts)ts.onchange=()=>location.href="nfl-game-center.html?team="+encode(ts.value);
}catch(e){
document.getElementById("nfl-stamp").textContent="NFL data verification pending";
root.innerHTML='<p class="nfl-kicker">THE NFL EDITION</p><h1 class="nfl-title">NFL DATA PUBLICATION PENDING</h1><div class="nfl-error"><p>The NFL newspaper is installed, but a complete sourced 2026 ledger has not been published. No placeholder ratings or invented player statistics will be shown.</p><p>'+escapeHtml(e.message)+'</p>'+link("sports.html","Browse the sports desks")+'</div>';
}}
main();
})();