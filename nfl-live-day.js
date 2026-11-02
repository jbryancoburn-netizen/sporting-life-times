(function(){
"use strict";
/* The Sporting Life & Times — NFL Game Day.
   Browser-side live updates; season JSON is explicitly labeled as stale fallback.
   Existing independent retro Elo/standings are not modified. */
const page=document.body.getAttribute("data-page");
if(!["front","games","game"].includes(page))return;
const endpoint="https://site.api.espn.com/apis/site/v2/sports/football/nfl/";
const query=new URLSearchParams(location.search);
const currentEvent=query.get("id");
const requestedDate=query.get("date");
const selectedTeam=query.get("team")||"all";
const str=v=>String(v==null?"":v);
const html=v=>str(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const monthDay=d=>{try{return new Date(d).toLocaleString("en-US",{timeZone:"America/New_York",weekday:"short",hour:"numeric",minute:"2-digit"});}catch(_){return "Kickoff TBA";}};
const etDate=(v=new Date())=>{const z=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(v);const p={};z.forEach(x=>p[x.type]=x.value);return p.year+"-"+p.month+"-"+p.day;};
const shift=(iso,days)=>{const d=new Date(iso+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
let chosenDate=requestedDate&&/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)?requestedDate:etDate(), source="none", lastData=null, mounted=false, busy=false, rerun=false;
const urlDay=d=>d.replace(/-/g,"");
const arr=v=>Array.isArray(v)?v:[];
const n=v=>{const f=Number(str(v).replace(/,/g,""));return Number.isFinite(f)?f:0;};
const gameUrl=id=>"nfl-game.html?id="+encodeURIComponent(id);
function teamOf(x){
 const t=x.team||{};
 return {id:str(t.id||x.id),name:t.displayName||t.name||x.name||"Team",code:t.abbreviation||x.code||"NFL",
  logo:t.logo||t.logos?.[0]?.href||x.logo||"",color:"#"+str(t.color||"252525").replace(/^#/,""),
  secondary:"#"+str(t.alternateColor||"c5a85c").replace(/^#/,""),score:x.score==null?null:n(x.score),
  record:arr(x.records)[0]?.summary||""};
}
function normalizeEvent(e){
 const c=arr(e.competitions)[0]||{},competitors=arr(c.competitors);
 const a=competitors.find(x=>x.homeAway==="away"),h=competitors.find(x=>x.homeAway==="home");
 if(!a||!h)return null;
 const s=e.status||c.status||{},kind=s.type||{};
 const state=kind.state||((kind.completed||/final/i.test(kind.name||""))?"post":"pre");
 const broadcasts=arr(c.broadcasts).flatMap(x=>arr(x.names)).filter(Boolean);
 const other=arr(c.geoBroadcasts).map(x=>x.media?.shortName).filter(Boolean);
 return {id:str(e.id),date:e.date,away:teamOf(a),home:teamOf(h),state:state,
  status:kind.shortDetail||kind.detail||kind.description||kind.name||"",
  clock:s.displayClock||c.status?.displayClock||"",period:s.period||c.status?.period||0,
  venue:c.venue?.fullName||"",broadcast:[...new Set([...broadcasts,...other])].join(", "),
  week:e.week?.number||"",situation:c.situation||e.situation||null,stale:false};
}
function snapshotEvent(g,brands){
 const branded=side=>{const t=brands[String(side.id)]||{};return {...side,color:t.color||side.color||"#252525",secondary:t.secondary_color||side.secondary||"#ba9957"};};
 return {...g,stale:true,away:branded(g.away),home:branded(g.home)};
}
async function json(url){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{const r=await fetch(url,{cache:"no-store",signal:controller.signal,headers:{"Accept":"application/json"}});
  if(!r.ok)throw Error("HTTP "+r.status);return await r.json();
 }finally{clearTimeout(timer);}
}
async function scoreboard(requestDate){
 try{
  const raw=await json(endpoint+"scoreboard?dates="+urlDay(requestDate)+"&limit=20");
  if(!Array.isArray(raw.events))throw Error("No event collection");
  source="live";return arr(raw.events).map(normalizeEvent).filter(Boolean).sort((a,b)=>str(a.date).localeCompare(str(b.date)));
 }catch(e){
  const raw=await json("data/nfl-2026-edition.json?livefallback="+Date.now());
  if(!Array.isArray(raw.games))throw Error("No season snapshot");
  source="snapshot";
  const brands=Object.fromEntries(arr(raw.teams).map(t=>[str(t.id),t]));
  return raw.games.filter(g=>g.date&&etDate(new Date(g.date))===requestDate).map(g=>snapshotEvent(g,brands)).sort((a,b)=>str(a.date).localeCompare(str(b.date)));
 }
}
const logo=t=>'<span class="nfl-badge sm" style="--nfl-primary:'+html(t.color)+';--nfl-secondary:'+html(t.secondary)+'"><span class="nfl-badge-core"><img loading="lazy" src="'+html(t.logo)+'" alt=""></span></span>';
function teamRow(t,state){
 return '<div class="nfl-live-row">'+logo(t)+'<span class="nfl-live-team">'+html(t.name)+'<small>'+html(t.record||t.code)+'</small></span>'+
 '<span class="nfl-live-points">'+(state==="pre"?"—":html(t.score==null?"—":t.score))+'</span></div>';
}
function liveStatus(g){
 if(g.state==="in")return (g.stale?"IN PROGRESS · SNAPSHOT":((g.period>4?"OT":"Q"+g.period)+" · "+(g.clock||"LIVE")));
 if(g.state==="post")return (Number(g.period)>4||/\b(?:OT|OVERTIME)\b/i.test(g.status||""))?"FINAL/OT":"FINAL";
 return monthDay(g.date);
}
function card(g){
 const title=liveStatus(g),k=g.state==="in"?"live":"",isLive=g.state==="in"&&!g.stale;
 const venue=g.broadcast||g.venue||"Game details";
 return '<a class="nfl-live-card '+(isLive?"live-now":"")+'" href="'+gameUrl(g.id)+'" aria-label="'+html(g.away.name+" at "+g.home.name+", "+title)+'">'+
 '<div class="nfl-live-meta"><span>WEEK '+html(g.week||"—")+'</span><span class="'+k+'">'+(isLive?'<i class="nfl-live-dot"></i>':"")+html(title)+'</span></div>'+
 teamRow(g.away,g.state)+teamRow(g.home,g.state)+
 '<div class="nfl-live-footer">'+html(venue)+(g.stale?' · Saved snapshot':'')+'</div></a>';
}
function dateLabel(){return new Date(chosenDate+"T17:00:00Z").toLocaleDateString("en-US",{timeZone:"America/New_York",weekday:"long",month:"short",day:"numeric"});}
function newStage(){
 const stage=document.createElement("section");stage.id="nfl-live-stage";stage.className="nfl-live-stage";
 stage.innerHTML='<div class="nfl-live-head"><div><span class="nfl-live-kicker">THE NFL · GAME DAY</span><h2>LIVE SCORES &amp; GAME CENTER</h2></div>'+
 '<div class="nfl-live-actions"><button type="button" data-day="-1" aria-label="Previous day">←</button>'+
 '<input type="date" id="nfl-live-date" aria-label="Choose NFL game day" value="'+chosenDate+'">'+
 '<button type="button" data-day="1" aria-label="Next day">→</button><button type="button" id="nfl-live-today">TODAY</button></div></div>'+
 '<div class="nfl-live-status" id="nfl-live-status">Connecting to today’s NFL scoreboard…</div>'+
 '<div class="nfl-live-grid" id="nfl-live-grid" aria-live="polite"></div>'+
 '<div id="nfl-live-performers" class="nfl-live-performers" hidden></div>';
 stage.addEventListener("click",e=>{const btn=e.target.closest("button[data-day]");if(btn)changeDate(shift(chosenDate,Number(btn.dataset.day)));});
 stage.querySelector("#nfl-live-today").onclick=()=>changeDate(etDate());
 stage.querySelector("#nfl-live-date").addEventListener("change",e=>{if(/^\d{4}-\d{2}-\d{2}$/.test(e.target.value))changeDate(e.target.value);});
 return stage;
}
function changeDate(day){
 chosenDate=day;
 const picker=document.getElementById("nfl-live-date");if(picker)picker.value=day;
 if(page==="games"){const current=new URL(location.href);current.searchParams.set("date",day);history.replaceState(history.state,"",current);}
 update();
}
function stamp(message){
 const el=document.getElementById("nfl-live-status");if(el)el.innerHTML=message;
}
function categoryLeaders(summary){
 let found=[];
 for(const block of arr(summary.boxscore?.players)){
  for(const category of arr(block.statistics)){
   const kind=str(category.name||category.type).toLowerCase();
   if(!["passing","rushing","receiving"].some(x=>kind.includes(x)))continue;
   const labels=arr(category.labels).map(x=>str(x).toUpperCase());
   const index=labels.findIndex(x=>x==="YDS"||x==="YARDS");
   if(index<0)continue;
   for(const p of arr(category.athletes)){
    const value=n(arr(p.stats)[index]);if(!value)continue;
    const athlete=p.athlete||{};
    found.push({kind:kind.includes("pass")?"PASS":kind.includes("rush")?"RUSH":"REC",name:athlete.displayName||athlete.fullName||"Player",
     value,headshot:athlete.headshot?.href||"",team:block.team?.abbreviation||""});
   }
  }
 }
 return found;
}
let statsGeneration=0;
const boxCache=new Map();
async function cachedLeaders(g){
 const entry=boxCache.get(g.id),lifetime=g.state==="post"?600000:65000;
 if(entry&&Date.now()-entry.when<lifetime)return entry.leaders;
 try{
  const leaders=categoryLeaders(await json(endpoint+"summary?event="+encodeURIComponent(g.id)));
  boxCache.set(g.id,{when:Date.now(),leaders});return leaders;
 }catch(_){return entry?entry.leaders:[];}
}
async function performers(games){
 const holder=document.getElementById("nfl-live-performers");
 if(!holder)return;
 const gen=++statsGeneration;
 const relevant=games.filter(g=>g.state==="in"||g.state==="post").slice(0,8);
 if(!relevant.length||source!=="live"){holder.hidden=true;return;}
 holder.hidden=false;
 holder.innerHTML="<h3>TODAY’S STATISTICAL STANDOUTS</h3><p class='nfl-live-status'>Reading verified game box scores…</p>";
 const all=await Promise.all(relevant.map(cachedLeaders));
 if(gen!==statsGeneration)return;
 const leaders=all.flat(),top=["PASS","RUSH","REC"].map(k=>leaders.filter(x=>x.kind===k).sort((a,b)=>b.value-a.value)[0]).filter(Boolean);
 if(!top.length){holder.innerHTML="<h3>TODAY’S STATISTICAL STANDOUTS</h3><p class='nfl-live-status'>Player totals are not available from the live source yet.</p>";return;}
 holder.innerHTML="<h3>TODAY’S STATISTICAL STANDOUTS</h3><div class='nfl-live-performance-grid'>"+top.map(x=>
 '<div class="nfl-live-performance"><img loading="lazy" src="'+html(x.headshot)+'" alt=""><div><b>'+html(x.name)+'</b><span>'+html(x.team+' · '+x.kind+' YARDS')+'</span></div><strong>'+x.value+'</strong></div>').join("")+'</div>';
}
async function update(){
 if(document.hidden)return;
 if(busy){rerun=true;return;}busy=true;
 const target=document.getElementById("nfl-live-grid"),viewingDate=chosenDate;
 try{
  const allResults=await scoreboard(viewingDate);
  if(viewingDate!==chosenDate){rerun=true;return;}
  const results=allResults.filter(g=>selectedTeam==="all"||g.away.id===selectedTeam||g.home.id===selectedTeam);lastData=results;
  const live=results.filter(g=>g.state==="in").length,finals=results.filter(g=>g.state==="post").length;
  const when=new Date().toLocaleTimeString("en-US",{timeZone:"America/New_York",hour:"numeric",minute:"2-digit"});
  stamp((source==="live"?'<strong>● LIVE SOURCE · updated '+html(when)+' ET</strong>':'<b>Saved season snapshot — live source unavailable.</b>')+
   ' · '+html(dateLabel())+' · '+results.length+' games · '+live+' in progress · '+finals+' final'+(source==="live"?' · Auto-refreshes every 25 seconds':' · Scores may be delayed'));
  if(target)target.innerHTML=results.length?results.map(card).join(""):'<div class="nfl-live-error">No games on this date. Choose another day to browse scores.</div>';
  if(page==="front"&&source==="live"){
   const rail=document.querySelector("#nfl-app>.nfl-rail"),bar=rail?.previousElementSibling;
   if(rail)rail.hidden=true;if(bar&&bar.classList.contains("nfl-controls"))bar.hidden=true;
  }
  if(page==="front"&&source==="snapshot"){
   const rail=document.querySelector("#nfl-app>.nfl-rail"),bar=rail?.previousElementSibling;
   if(rail)rail.hidden=false;if(bar&&bar.classList.contains("nfl-controls"))bar.hidden=false;
  }
  if(source==="live"&&chosenDate===etDate())performers(results);
  else{++statsGeneration;const el=document.getElementById("nfl-live-performers");if(el)el.hidden=true;}
 }catch(e){stamp('<b>Live score source is unavailable.</b> The season newspaper below remains accessible; no unverified game results are displayed.');}
 finally{busy=false;if(rerun){rerun=false;queueMicrotask(update);}}
}
function boxRows(summary){
 const teams=arr(summary.boxscore?.teams);
 if(teams.length<2)return '<p class="nfl-live-status">Source-confirmed team statistics are pending.</p>';
 const stats=t=>{const r={};arr(t.statistics).forEach(x=>{r[x.name]=x.displayValue;});return r;};
 const find=id=>teams.find(t=>str(t.team?.id)===str(id));
 const a=stats(find(summary.__away)||teams[0]),h=stats(find(summary.__home)||teams[1]);
 // Percentages for charts only; source values remain unchanged in printed statistics.
 const numeric=v=>{
  if(v==null)return null;
  const vstr=str(v).replace(/,/g,"").trim(),time=vstr.match(/^(\d+):(\d{2})$/);
  if(time)return Number(time[1])*60+Number(time[2]);
  const ratio=vstr.match(/^(\d+)\s*[-/]\s*(\d+)$/);
  if(ratio)return Number(ratio[2])?100*Number(ratio[1])/Number(ratio[2]):0;
  return /^-?\d+(?:\.\d+)?$/.test(vstr)?Number(vstr):null;
 };
 const rows=[["First downs","firstDowns"],["Total yards","totalYards"],["Passing yards","netPassingYards"],
  ["Rushing yards","rushingYards"],["Turnovers","turnovers"],["Third downs","thirdDownEff"],
  ["Time of possession","possessionTime"]].filter(row=>a[row[1]]!=null||h[row[1]]!=null);
 if(!rows.length)return '<p>Live team totals pending.</p>';
 let out='<section class="nfl-live-stats-graphic"><div class="nfl-live-metric-head"><span>FIELD PERFORMANCE</span><strong>'+
  '<span class="nfl-metric-identity away">'+html(summary.__awayCode)+'</span> <span class="nfl-metric-vs">/</span> <span class="nfl-metric-identity home">'+html(summary.__homeCode)+'</span></strong></div>';
 rows.forEach(([label,key])=>{
  const av=numeric(a[key]),hv=numeric(h[key]),total=Math.max(1,Math.max(0,av||0)+Math.max(0,hv||0));
  const aw=av==null||hv==null||(av===0&&hv===0)?50:100*Math.max(0,av)/total,hw=100-aw;
  out+='<div class="nfl-live-metric" data-metric="'+html(key)+'"><span class="label">'+html(label)+'</span>'+
   '<div class="nfl-live-metric-values"><b class="nfl-metric-away">'+html(a[key]??"—")+'</b>'+
   '<div class="nfl-live-metric-bars" aria-hidden="true"><i style="width:'+aw.toFixed(2)+'%"></i>'+
   '<em style="width:'+hw.toFixed(2)+'%"></em></div><b class="nfl-metric-home">'+html(h[key]??"—")+'</b></div></div>';
 });
 return out+'</section>';
}
function playRows(summary){
 const done=(summary.header?.competitions||[]).some(c=>c.status?.type?.state==="post");
 const scored=arr(summary.scoringPlays);
 const current=summary.drives?.current,prior=arr(summary.drives?.previous);
 let plays=done&&scored.length?scored.slice(-8):arr(current?.plays).slice(-7);
 if(!plays.length)plays=arr(prior.at(-1)?.plays).slice(-7);
 if(!plays.length)plays=scored.slice(-7);
 if(!plays.length)return '<p>No source-verified play descriptions are available yet.</p>';
 return plays.reverse().map(p=>{
  const words=str(p.text||p.type?.text||"Play detail pending");
  const kind=/touchdown|field goal is good|extra point is good|safety/i.test(words)?'is-scoring':
   /intercepted|fumble recovered|turnover on downs/i.test(words)?'is-turnover':'';
  const q=p.period?.number?'Q'+p.period.number+' · ':'';
  return '<div class="nfl-live-play '+kind+'"><b>'+html(q+str(p.clock?.displayValue||"")||'PLAY')+
   '</b><span>'+html(words)+'</span></div>';
 }).join("");
}
function nflGameStatInsight(box,comp){
 const entries=arr(box.boxscore?.teams),participants=arr(comp?.competitors);
 if(entries.length<2||participants.length<2)return '';
 const a=participants.find(t=>t.homeAway==="away"),h=participants.find(t=>t.homeAway==="home");
 if(!a||!h)return '';
 const yards=id=>{
  const t=entries.find(x=>str(x.team?.id)===str(id));
  const value=arr(t?.statistics).find(x=>x.name==="totalYards")?.displayValue;
  return value!=null&&/^\d[\d,]*$/.test(str(value))?Number(str(value).replace(/,/g,'')):null;
 };
 const ay=yards(a.team?.id),hy=yards(h.team?.id),as=Number(a.score),hs=Number(h.score);
 if(ay==null||hy==null||!Number.isFinite(as)||!Number.isFinite(hs)||as===hs)return '';
 const winner=as>hs?a:h,loser=as>hs?h:a;
 const winnerY=as>hs?ay:hy,loserY=as>hs?hy:ay;
 const short=t=>str(t.team?.shortDisplayName||t.team?.displayName||t.team?.abbreviation||"Club");
 if(winnerY>=loserY)return '';
 return '<div class="nfl-story-field-note"><small>THE NUMBER BEHIND THE RESULT</small><strong>'+
  html(short(winner))+' won despite being outgained by '+html(loserY-winnerY)+' yards.</strong>'+
  '<span>'+html(short(loser))+' '+html(loserY)+' total yards · '+html(short(winner))+' '+html(winnerY)+' total yards</span></div>';
}
let lastVerifiedGame=null,verifiedGameAt=0,verifiedFetchInFlight=null;
async function loadVerifiedGame(){
 const age=Date.now()-verifiedGameAt;
 if(lastVerifiedGame&&age<300000)return lastVerifiedGame;
 if(verifiedFetchInFlight)return verifiedFetchInFlight;
 verifiedFetchInFlight=Promise.all([
  json("data/nfl-2026-boxscores.json?v="+Math.floor(Date.now()/300000)),
  json("data/nfl-2026-edition.json?v="+Math.floor(Date.now()/300000))
 ]).then(([boxes,season])=>{
  const game=arr(season.games).find(g=>str(g.id)===str(currentEvent));
  const box=(boxes.games||{})[str(currentEvent)];
  if(!game||!box)throw Error("No verified published player box score for this event");
  lastVerifiedGame={game,box,updated:boxes.updated_at||season.updated_at};
  verifiedGameAt=Date.now();
  return lastVerifiedGame;
 }).finally(()=>{verifiedFetchInFlight=null});
 return verifiedFetchInFlight;
}
function offlineBoxRows(verified){
 const {game,box}=verified;
 const teamStats=["away","home"].map(side=>{
  const id=str(game[side].id),stats=box.teams?.[id]||{};
  return {team:{id},statistics:Object.entries(stats).map(([name,value])=>({name,displayValue:str(value)}))};
 });
 const summary={boxscore:{teams:teamStats},
  __away:str(game.away.id),__home:str(game.home.id),
  __awayCode:game.away.code,__homeCode:game.home.code};
 const competitors=["away","home"].map(side=>({homeAway:side,team:{id:str(game[side].id),displayName:game[side].name,
  shortDisplayName:game[side].name},score:game[side].score}));
 return {summary,comp:{competitors}};
}
function offlineQuarters(verified){
 const {game,box}=verified;
 const away=arr(box.period_lines?.away).length?arr(box.period_lines.away):arr(game.away.linescores);
 const home=arr(box.period_lines?.home).length?arr(box.period_lines.home):arr(game.home.linescores);
 if(!away.length||!home.length)return '<p>Verified quarter details pending.</p>';
 return '<div class="nfl-offline-quarter-list">'+
  away.slice(0,Math.min(5,away.length)).map((q,i)=>'<div class="nfl-offline-quarter">'+
   '<b>'+(i>=4?'OT':'Q'+(i+1))+'</b><span>'+html(game.away.code)+' '+html(q.score??"—")+
   ' · '+html(game.home.code)+' '+html(home[i]?.score??"—")+'</span></div>').join("")+'</div>';
}
function offlinePlayers(verified){
 const {game,box}=verified;
 const kinds=[["passing","PASS"],["rushing","RUSH"],["receiving","REC"]];
 const spots=kinds.flatMap(([category,kind])=>[game.away,game.home].map(side=>{
  const list=arr(box.players).filter(p=>p.team_id===str(side.id)&&p.category===category&&Number.isFinite(Number(p.stats?.YDS)));
  if(!list.length)return null;
  const player=list.sort((x,y)=>Number(y.stats.YDS)-Number(x.stats.YDS))[0];
  return {team:side.code,kind,value:player.stats.YDS,name:player.name,headshot:player.headshot};
 }).filter(Boolean));
 if(!spots.length)return '';
 return '<div class="nfl-live-performers"><div class="nfl-story-leaders-head"><h3>THE PLAYER REPORT</h3>'+
  '<span>VERIFIED GAME LEADERS · BOTH CLUBS</span></div><div class="nfl-live-performance-grid">'+
  spots.map(p=>'<div class="nfl-live-performance" style="--spotlight-color:'+
   (p.team===game.away.code?'var(--nfl-story-away)':'var(--nfl-story-home)')+'">'+
   '<img loading="lazy" src="'+html(p.headshot||"")+'" alt=""><div><small class="nfl-story-player-kind">'+
   html(p.team+' · '+p.kind+' LEADER')+'</small><b>'+html(p.name)+'</b><span>VERIFIED YARDS</span></div>'+
   '<strong>'+html(p.value)+'</strong></div>').join("")+'</div></div>';
}
async function renderVerifiedGame(target){
 const v=await loadVerifiedGame(),{summary,comp}=offlineBoxRows(v);
 if(!target?.isConnected)return;
 const formatted=v.updated?html(new Date(v.updated).toLocaleString("en-US",{
  timeZone:"America/New_York",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}))+" ET":"verified archive";
 target.innerHTML='<div class="nfl-live-head"><div><span class="nfl-live-kicker">SOURCED GAME REPORT</span>'+
  '<h2>Final game statistics</h2></div><span class="nfl-live-status">Verified season ledger · '+formatted+'</span></div>'+
  nflGameStatInsight({...v.box,boxscore:summary.boxscore},comp)+
  '<div class="nfl-live-detail-grid"><div>'+boxRows(summary)+'</div><div><h3>SCORING BY PERIOD</h3>'+
  offlineQuarters(v)+'</div></div>'+offlinePlayers(v);
 target.dataset.nflVerifiedFallback="1";
}


/* Source-only in-progress quarter chart; no speculative scoring. */
function paintVerifiedScoreTrend(summary,match,box){
 const holder=document.querySelector(".nfl-paper[data-page='game'] .nfl-feature-chart");
 if(!holder)return;
 const scores=arr(summary.scoringPlays).map(p=>({
  period:Number(p.period?.number||p.period||0),
  away:p.awayScore==null?NaN:Number(p.awayScore),
  home:p.homeScore==null?NaN:Number(p.homeScore),
  time:Number(p.clock?.value)
 })).filter(p=>p.period>=1&&Number.isFinite(p.away)&&Number.isFinite(p.home))
 .sort((a,b)=>a.period-b.period||(Number.isFinite(b.time)?b.time:0)-(Number.isFinite(a.time)?a.time:0));
 if(!scores.length)return;
 const actualPeriod=Number(match?.status?.period||summary.header?.competitions?.[0]?.status?.period||0);
 const through=Math.max(1,Math.min(9,Math.max(actualPeriod,...scores.map(p=>p.period))));
 const quarters=Math.max(4,through);
 let av=0,hv=0;
 const away=[0],home=[0];
 for(let q=1;q<=through;q++){
  const group=scores.filter(p=>p.period===q);
  if(group.length){av=group[group.length-1].away;hv=group[group.length-1].home;}
  away.push(av);home.push(hv);
 }
 const max=Math.max(7,Math.ceil(Math.max(...away,...home)/7)*7);
 const X=i=>49+(i/quarters)*515;
 const Y=v=>175-(v/max)*139;
 const line=vals=>vals.map((v,i)=>(i?"L":"M")+X(i).toFixed(1)+" "+Y(v).toFixed(1)).join(" ");
 const dot=(vals,cl)=>vals.slice(1).map((v,i)=>'<circle class="'+cl+'" cx="'+X(i+1).toFixed(1)+'" cy="'+Y(v).toFixed(1)+'" r="5"></circle>').join("");
 const grid=Array.from({length:4},(_,i)=>{
  const val=Math.round(max*i/3),y=Y(val);
  return '<line class="nfl-feature-chart-guide" x1="49" x2="564" y1="'+y+'" y2="'+y+'"></line>'+
   '<text class="nfl-feature-chart-tick" x="39" y="'+(y+4)+'" text-anchor="end">'+val+'</text>';
 }).join("");
 const ticks=Array.from({length:quarters},(_,i)=>
  '<text class="nfl-feature-chart-quarter'+(i+1>through?' is-future':'')+
  '" x="'+X(i+1)+'" y="210" text-anchor="middle">'+(i<4?'Q'+(i+1):'OT'+(i-3))+'</text>').join("");
 const current=match?.status?.type?.state==='post'?'FINAL':through<=4?'Q'+through:'OT'+(through-4);
 const aria='Verified scoring play progression: '+box.__awayCode+' '+away.slice(1).join(", ")+
  '; '+box.__homeCode+' '+home.slice(1).join(", ")+'.';
 const node=holder.querySelector(".nfl-score-live-preview,.nfl-story-arc,.nfl-live-scoring-timeline");
 if(!node)return;
 node.outerHTML='<div class="nfl-live-scoring-timeline" role="img" aria-label="'+html(aria)+'">'+
 '<svg viewBox="0 0 610 220" aria-hidden="true">'+grid+
 '<path class="arc-away" d="'+line(away)+'"></path><path class="arc-home" d="'+line(home)+'"></path>'+
 dot(away,'arc-away-dot')+dot(home,'arc-home-dot')+ticks+'</svg>'+
 '<div class="nfl-live-scoring-footer"><strong>'+html(current)+'</strong>'+
 '<span>SOURCED SCORING PLAYS · '+html(box.__awayCode)+' '+av+' / '+html(box.__homeCode)+' '+hv+'</span></div></div>';
 const heading=holder.querySelector(".nfl-feature-chart-header>span");
 if(heading)heading.textContent="Verified scoring progression";
}

async function gameDetails(){
 const target=document.getElementById("nfl-live-game-data");if(!target||!currentEvent||document.hidden)return;
 if(!target.dataset.nflVerifiedStarted){target.dataset.nflVerifiedStarted="1";renderVerifiedGame(target).catch(()=>{});}
 try{
  const d=await json(endpoint+"summary?event="+encodeURIComponent(currentEvent));
  const match=arr(d.header?.competitions)[0]||{},c=arr(match.competitors);
  const a=c.find(x=>x.homeAway==="away"),h=c.find(x=>x.homeAway==="home");
  const nGame=lastData?.find(x=>x.id===currentEvent);
  const box={...d,__away:str(a?.team?.id||nGame?.away.id),__home:str(h?.team?.id||nGame?.home.id),
   __awayCode:a?.team?.abbreviation||nGame?.away.code||"AWAY",__homeCode:h?.team?.abbreviation||nGame?.home.code||"HOME"};
  const status=match.status||d.header?.competitions?.[0]?.status||{};
  const state=status.type?.state==="post"&&(Number(status.period)>4||/\b(?:OT|OVERTIME)\b/i.test(status.type?.shortDetail||status.type?.description||""))?"FINAL/OT":status.type?.shortDetail||status.type?.description||"Game update";
  const gameLeaders=categoryLeaders(d);
  const spotlight=["PASS","RUSH","REC"].flatMap(kind=>
   [box.__awayCode,box.__homeCode].map(code=>gameLeaders.filter(p=>p.kind===kind&&p.team===code)
     .sort((x,y)=>y.value-x.value)[0]).filter(Boolean));
  const isFinal=status.type?.state==="post";
  paintVerifiedScoreTrend(d,match,box);
  const recentScoring=isFinal&&arr(d.scoringPlays).length>0;
  target.innerHTML='<div class="nfl-live-head"><div><span class="nfl-live-kicker">03 / VERIFIED GAME REPORT</span>'+
   '<h2>'+(isFinal?'Inside the final':html(state))+'</h2></div>'+
   '<span class="nfl-live-status">Sourced game record · checked '+
    html(new Date().toLocaleTimeString("en-US",{timeZone:"America/New_York",hour:"numeric",minute:"2-digit"}))+
    ' ET · refreshes every 25 seconds</span></div>'+
   nflGameStatInsight(box,match)+
   '<div class="nfl-live-detail-grid"><div>'+boxRows(box)+'</div><div><h3>'+
   (recentScoring?'THE SCORING PLAYS':'LATEST PLAYS')+'</h3>'+playRows(d)+'</div></div>'+
   (spotlight.length?'<div class="nfl-live-performers"><div class="nfl-story-leaders-head"><h3>THE PLAYER REPORT</h3>'+
    '<span>VERIFIED GAME LEADERS · BOTH CLUBS</span></div>'+
    '<div class="nfl-live-performance-grid">'+spotlight.map(p=>
     '<div class="nfl-live-performance" style="--spotlight-color:'+(p.team===box.__awayCode?'var(--nfl-story-away)':'var(--nfl-story-home)')+'">'+
     '<img loading="lazy" src="'+html(p.headshot)+'" alt=""><div><small class="nfl-story-player-kind">'+
     html(p.team+' · '+p.kind+' LEADER')+'</small><b>'+html(p.name)+'</b><span>VERIFIED YARDS</span></div>'+
     '<strong>'+html(p.value)+'</strong></div>').join("")+'</div></div>':
    '<p class="nfl-live-status">Verified individual statistics are not yet available for this game.</p>');
 }catch(e){
  try{await renderVerifiedGame(target);}
  catch(backupError){
   if(!target.querySelector(".nfl-live-metric")){
    target.innerHTML='<p class="nfl-live-status">Live statistics and the verified saved box score are temporarily unavailable. Game results and the independent forecast above remain available.</p>';
   }
  }
 }
}
async function waitForPage(){
 for(let tries=0;tries<60;tries++){
  if(document.querySelector("#nfl-app .nfl-title"))return true;
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 return false;
}
function mountContent(){
 const root=document.getElementById("nfl-app");if(!root)return;
 if(page==="game"){
  if(root.querySelector("#nfl-live-game-data"))return;
  const box=root.querySelector("#nfl-game-live-slot")||root.querySelector(".nfl-team-head");
  if(!box)return;
  const section=document.createElement("section");section.id="nfl-live-game-data";section.className="nfl-live-details";
  section.innerHTML='<h2>LIVE GAME-DAY TRACKER</h2><p>Loading in-game statistics…</p>';
  if(box.id==="nfl-game-live-slot")box.append(section);else box.insertAdjacentElement("afterend",section);gameDetails();
  return;
 }
 if(root.querySelector("#nfl-live-stage"))return;
 const section=newStage();
 if(page==="games"){
  // A rerender must not restore competing date navigation and stale cards.
  const duplicate=root.querySelector(".nfl-slate");if(duplicate)duplicate.hidden=true;
  const oldNav=root.querySelector(".nfl-day-nav");if(oldNav)oldNav.hidden=true;
 }
 const title=root.querySelector(".nfl-title");
 if(title)title.insertAdjacentElement("afterend",section);
 else root.prepend(section);
 update();
}
async function initialize(){
 if(mounted||!await waitForPage())return;mounted=true;
 mountContent();
 const root=document.getElementById("nfl-app");
 // The main NFL ledger redraws root.innerHTML whenever the saved score feed changes.
 // Remount the independent live stage without creating extra polling intervals.
 const observer=new MutationObserver(()=>{
  if(page==="game"?!root.querySelector("#nfl-live-game-data"):!root.querySelector("#nfl-live-stage"))mountContent();
 });
 observer.observe(root,{childList:true});
 setInterval(page==="game"?gameDetails:update,25000);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)(page==="game"?gameDetails():update());});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initialize,{once:true});else initialize();
})();