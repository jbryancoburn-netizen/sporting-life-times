(function(){
"use strict";
/* The Sporting Life & Times — NFL Game Day.
   Browser-side live updates; season JSON is explicitly labeled as stale fallback.
   Existing independent retro Elo/standings are not modified. */
const page=document.body.getAttribute("data-page");
if(!["front","games","game"].includes(page))return;
const endpoint="https://site.api.espn.com/apis/site/v2/sports/football/nfl/";
const currentEvent=new URLSearchParams(location.search).get("id");
const str=v=>String(v==null?"":v);
const html=v=>str(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const monthDay=d=>{try{return new Date(d).toLocaleString("en-US",{timeZone:"America/New_York",weekday:"short",hour:"numeric",minute:"2-digit"});}catch(_){return "Kickoff TBA";}};
const etDate=(v=new Date())=>{const z=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(v);const p={};z.forEach(x=>p[x.type]=x.value);return p.year+"-"+p.month+"-"+p.day;};
const shift=(iso,days)=>{const d=new Date(iso+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
let chosenDate=etDate(), source="none", lastData=null, mounted=false, busy=false;
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
function snapshotEvent(g){return {...g,stale:true,away:{...g.away,color:"#252525",secondary:"#ba9957"},home:{...g.home,color:"#252525",secondary:"#ba9957"}};}
async function json(url){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{const r=await fetch(url,{cache:"no-store",signal:controller.signal,headers:{"Accept":"application/json"}});
  if(!r.ok)throw Error("HTTP "+r.status);return await r.json();
 }finally{clearTimeout(timer);}
}
async function scoreboard(){
 try{
  const raw=await json(endpoint+"scoreboard?dates="+urlDay(chosenDate)+"&limit=20");
  if(!Array.isArray(raw.events))throw Error("No event collection");
  source="live";return arr(raw.events).map(normalizeEvent).filter(Boolean).sort((a,b)=>str(a.date).localeCompare(str(b.date)));
 }catch(e){
  const raw=await json("data/nfl-2026-edition.json?livefallback="+Date.now());
  if(!Array.isArray(raw.games))throw Error("No season snapshot");
  source="snapshot";
  return raw.games.filter(g=>g.date&&etDate(new Date(g.date))===chosenDate).map(snapshotEvent).sort((a,b)=>str(a.date).localeCompare(str(b.date)));
 }
}
const logo=t=>'<span class="nfl-badge sm" style="--nfl-primary:'+html(t.color)+';--nfl-secondary:'+html(t.secondary)+'"><span class="nfl-badge-core"><img loading="lazy" src="'+html(t.logo)+'" alt=""></span></span>';
function teamRow(t,state){
 return '<div class="nfl-live-row">'+logo(t)+'<span class="nfl-live-team">'+html(t.name)+'<small>'+html(t.record||t.code)+'</small></span>'+
 '<span class="nfl-live-points">'+(state==="pre"?"—":html(t.score==null?"—":t.score))+'</span></div>';
}
function liveStatus(g){
 if(g.state==="in")return (g.stale?"IN PROGRESS · SNAPSHOT":((g.period>4?"OT":"Q"+g.period)+" · "+(g.clock||"LIVE")));
 if(g.state==="post")return "FINAL";
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
 stage.addEventListener("click",e=>{const btn=e.target.closest("button[data-day]");if(btn){chosenDate=shift(chosenDate,Number(btn.dataset.day));document.getElementById("nfl-live-date").value=chosenDate;update();}});
 stage.querySelector("#nfl-live-today").onclick=()=>{chosenDate=etDate();stage.querySelector("#nfl-live-date").value=chosenDate;update();};
 stage.querySelector("#nfl-live-date").addEventListener("change",e=>{if(/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)){chosenDate=e.target.value;update();}});
 return stage;
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
async function performers(games){
 const holder=document.getElementById("nfl-live-performers");
 if(!holder)return;
 const gen=++statsGeneration;
 const relevant=games.filter(g=>g.state==="in"||g.state==="post").slice(0,8);
 if(!relevant.length||source!=="live"){holder.hidden=true;return;}
 holder.hidden=false;
 holder.innerHTML="<h3>TODAY’S STATISTICAL STANDOUTS</h3><p class='nfl-live-status'>Reading verified game box scores…</p>";
 const all=await Promise.all(relevant.map(async g=>{try{return categoryLeaders(await json(endpoint+"summary?event="+encodeURIComponent(g.id)));}catch(_){return [];}}));
 if(gen!==statsGeneration)return;
 const leaders=all.flat(),top=["PASS","RUSH","REC"].map(k=>leaders.filter(x=>x.kind===k).sort((a,b)=>b.value-a.value)[0]).filter(Boolean);
 if(!top.length){holder.innerHTML="<h3>TODAY’S STATISTICAL STANDOUTS</h3><p class='nfl-live-status'>Player totals are not available from the live source yet.</p>";return;}
 holder.innerHTML="<h3>TODAY’S STATISTICAL STANDOUTS</h3><div class='nfl-live-performance-grid'>"+top.map(x=>
 '<div class="nfl-live-performance"><img loading="lazy" src="'+html(x.headshot)+'" alt=""><div><b>'+html(x.name)+'</b><span>'+html(x.team+' · '+x.kind+' YARDS')+'</span></div><strong>'+x.value+'</strong></div>').join("")+'</div>';
}
async function update(){
 if(busy||document.hidden)return;busy=true;
 const target=document.getElementById("nfl-live-grid");
 try{
  const results=await scoreboard();lastData=results;
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
 finally{busy=false;}
}
function boxRows(summary){
 const teams=arr(summary.boxscore?.teams);
 if(teams.length<2)return '<p>Detailed team statistics have not been published for this game.</p>';
 const stats=t=>{const r={};arr(t.statistics).forEach(x=>{r[x.name]=x.displayValue;});return r;};
 const find=id=>teams.find(t=>str(t.team?.id)===str(id));
 const away=find(summary.__away),home=find(summary.__home);
 const a=stats(away||teams[0]),h=stats(home||teams[1]);
 const rows=[["First downs","firstDowns"],["Total yards","totalYards"],["Passing yards","netPassingYards"],["Rushing yards","rushingYards"],["Turnovers","turnovers"],["Third downs","thirdDownEff"],["Time of possession","possessionTime"]]
  .filter(row=>a[row[1]]!=null||h[row[1]]!=null)
  .map(([label,key])=>'<tr><td>'+html(label)+'</td><td>'+html(a[key]??"—")+'</td><td>'+html(h[key]??"—")+'</td></tr>');
 return rows.length?'<table class="nfl-live-mini-table"><thead><tr><th>TEAM STATS</th><th>'+html(summary.__awayCode)+'</th><th>'+html(summary.__homeCode)+'</th></tr></thead><tbody>'+rows.join("")+'</tbody></table>':
 '<p>Live team totals pending.</p>';
}
function playRows(summary){
 const current=summary.drives?.current,prior=arr(summary.drives?.previous);
 const plays=arr(current?.plays).slice(-5);
 if(!plays.length){
  const last=prior.at(-1);
  plays.push(...arr(last?.plays).slice(-5));
 }
 if(!plays.length)plays.push(...arr(summary.scoringPlays).slice(-5));
 if(!plays.length)return '<p>No play descriptions are available yet.</p>';
 return plays.reverse().map(p=>'<div class="nfl-live-play"><b>'+html(p.clock?.displayValue||p.period?.number&&"Q"+p.period.number||"PLAY")+'</b> · '+html(p.text||p.type?.text||"Play detail pending")+'</div>').join("");
}
async function gameDetails(){
 const target=document.getElementById("nfl-live-game-data");if(!target||!currentEvent||document.hidden)return;
 try{
  const d=await json(endpoint+"summary?event="+encodeURIComponent(currentEvent));
  const match=arr(d.header?.competitions)[0]||{},c=arr(match.competitors);
  const a=c.find(x=>x.homeAway==="away"),h=c.find(x=>x.homeAway==="home");
  const nGame=lastData?.find(x=>x.id===currentEvent);
  const box={...d,__away:str(a?.team?.id||nGame?.away.id),__home:str(h?.team?.id||nGame?.home.id),
   __awayCode:a?.team?.abbreviation||nGame?.away.code||"AWAY",__homeCode:h?.team?.abbreviation||nGame?.home.code||"HOME"};
  const status=match.status||d.header?.competitions?.[0]?.status||{};
  const state=status.type?.description||status.type?.shortDetail||"Game update";
  const gameLeaders=categoryLeaders(d);
  const leaders=["PASS","RUSH","REC"].map(k=>gameLeaders.filter(p=>p.kind===k).sort((x,y)=>y.value-x.value)[0]).filter(Boolean);
  target.innerHTML='<div class="nfl-live-head"><div><span class="nfl-live-kicker">GAME-DAY TRACKER · IN-GAME STATISTICS</span><h2>'+html(state)+'</h2></div>'+
   '<span class="nfl-live-status">Live source · '+html(new Date().toLocaleTimeString("en-US",{timeZone:"America/New_York",hour:"numeric",minute:"2-digit"}))+' ET · refresh 25 seconds</span></div>'+
   '<div class="nfl-live-detail-grid"><div>'+boxRows(box)+'</div><div><h3>RECENT PLAYS</h3>'+playRows(d)+'</div></div>'+
   (leaders.length?'<div class="nfl-live-performers"><h3>GAME LEADERS</h3><div class="nfl-live-performance-grid">'+leaders.map(p=>
    '<div class="nfl-live-performance"><img loading="lazy" src="'+html(p.headshot)+'" alt=""><div><b>'+html(p.name)+'</b><span>'+html(p.team+' · '+p.kind+' YARDS')+'</span></div><strong>'+p.value+'</strong></div>').join("")+'</div></div>':
   '<p class="nfl-live-status">Player box scores pending.</p>');
 }catch(e){
  target.innerHTML='<p class="nfl-live-error">In-game statistics are temporarily unavailable from the live source. The verified historical game details below remain available.</p>';
 }
}
async function waitForPage(){
 for(let tries=0;tries<60;tries++){
  if(document.querySelector("#nfl-app .nfl-title"))return true;
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 return false;
}
async function initialize(){
 if(mounted||!await waitForPage())return;mounted=true;
 const root=document.getElementById("nfl-app");
 if(page==="game"){
  const box=root.querySelector(".nfl-team-head");
  if(!box)return;
  const section=document.createElement("section");section.id="nfl-live-game-data";section.className="nfl-live-details";
  section.innerHTML='<h2>LIVE GAME-DAY TRACKER</h2><p>Loading in-game statistics…</p>';
  box.insertAdjacentElement("afterend",section);gameDetails();
  setInterval(gameDetails,25000);
  return;
 }
 const section=newStage();
 const title=root.querySelector(".nfl-title");
 if(title)title.insertAdjacentElement("afterend",section);
 else root.prepend(section);
 update();setInterval(update,25000);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)update();});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initialize,{once:true});else initialize();
})();