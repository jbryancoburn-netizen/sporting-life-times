/* Sporting Life & Times: independently sourced reporting on all 32 NFL club pages. */
(function(){
"use strict";
if(document.body.dataset.page!=="team")return;
const teamId=new URLSearchParams(location.search).get("team");
if(!/^\d{1,3}$/.test(teamId||""))return;
const app=document.getElementById("nfl-app");
if(!app)return;
const tabs=["All","Pre-Game","Post-Game","Injuries","Team News"];
const premium=[["chicagotribune.com","Chicago Tribune",6],["nytimes.com/athletic/","The Athletic",5],["theathletic.com","The Athletic",5],["nytimes.com","The New York Times",5],["washingtonpost.com","The Washington Post",5],["wsj.com","The Wall Street Journal",5]];
let stories=[],selected="All",ready=false,checked=0,started=false;
const escape=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const teamName=()=>app.querySelector(".nfl-team-head h1")?.textContent?.trim()||"";
const dateValue=s=>{const n=Date.parse(s||"");return Number.isFinite(n)?n:0};
function who(s){
 let host="";
 try{const u=new URL(s.url);host=u.hostname.replace(/^www\./,"")+u.pathname}catch(_){}
 const p=premium.find(x=>host.includes(x[0]));
 return {name:p?p[1]:s.source||"Original publisher",weight:p?p[2]:0};
}
function category(s){
 if(tabs.includes(s.category)&&s.category!=="All")return s.category;
 const t=(s.title+" "+s.summary).toLowerCase();
 if(/\b(injur|concussion|inactive|ruled out|questionable|doubtful|practice|hamstring|injured reserve)\w*/.test(t))return "Injuries";
 if(/\b(preview|pregame|pre-game|before kickoff|prediction|what to watch|matchup|how to watch)\b/.test(t))return "Pre-Game";
 if(/\b(recap|postgame|post-game|takeaways|final score|defeat|victory|beats?|rallied|loss|won|winning field goal)\b/.test(t))return "Post-Game";
 return "Team News";
}
function normalized(raw,origin){
 if(!raw||typeof raw!=="object")return null;
 const url=raw.url||raw.links?.web?.href||raw.links?.mobile?.href||raw.link;
 try{if(new URL(url).protocol!=="https:")return null}catch(_){return null}
 const title=String(raw.title||raw.headline||"").trim();
 const published=raw.published_at||raw.published||raw.lastModified||raw.updated_at;
 const when=dateValue(published);
 if(!title||!when||when>Date.now()+7200000||when<Date.now()-21*86400000)return null;
 return {title,url,published_at:new Date(when).toISOString(),
  source:raw.source||(origin==="espn"?"ESPN":"Original publisher"),
  summary:String(raw.summary||raw.description||"").replace(/<[^>]*>/g,"").slice(0,180),
  category:String(raw.category||""),team_ids:Array.isArray(raw.team_ids)?raw.team_ids.map(String):null,origin};
}
function matches(s,n){
 if(s.team_ids)return s.team_ids.includes(teamId);
 if(s.origin==="espn")return true;
 const text=(s.title+" "+s.summary).toLowerCase();
 if(text.includes(n.toLowerCase()))return true;
 const nickname=n.split(" ").slice(-1)[0].toLowerCase();
 const re=new RegExp("\\b"+nickname+"\\b","i");
 return re.test(text)&&(s.origin!=="general"||/\b(nfl|football|quarterback|touchdown|week|bears|bucs|packers|chiefs|jets|giants|ravens|49ers|dolphins|bills|broncos|seahawks|patriots|raiders|commanders|cowboys|eagles|falcons|saints|panthers|lions|vikings|rams|chargers|bengals|titans|colts|jaguars|texans|steelers|cardinals|browns)\b/i.test(text));
}
function rank(s){
 const age=Math.max(0,(Date.now()-dateValue(s.published_at))/86400000);
 const src=who(s);
 return (src.weight+(teamId==="3"&&src.name==="Chicago Tribune"?3:0))*3-age*1.7;
}
function ensure(){
 const anchor=app.querySelector(".nfl-team-statline")||app.querySelector(".nfl-team-head");
 const n=teamName();
 if(!anchor||!n)return false;
 if(!app.querySelector("#nfl-team-press")){
  const section=document.createElement("section");
  section.id="nfl-team-press";section.className="nfl-press";
  section.setAttribute("aria-label",n+" reporting");
  section.innerHTML='<p class="nfl-press-kicker">THE CLUB PRESS / ORIGINAL PUBLISHERS</p><div class="nfl-press-title"><div><h2>'+escape(n)+' News &amp; Reporting</h2><p>Pre-game previews, post-game analysis, injuries and club news.</p></div><span role="status" id="nfl-press-status">Opening the news desk…</span></div><div id="nfl-press-tabs" class="nfl-press-tabs"></div><div id="nfl-press-list" class="nfl-press-list"></div><p class="nfl-press-foot">Links open the original publisher. Subscriber publications may require sign-in. No article text is reproduced.</p>';
  anchor.after(section);
 }
 render();return true;
}
function render(){
 const root=document.getElementById("nfl-press-list");
 const filters=document.getElementById("nfl-press-tabs");
 const status=document.getElementById("nfl-press-status");
 if(!root||!filters||!status)return;
 filters.innerHTML=tabs.map(x=>{
  const count=x==="All"?stories.length:stories.filter(s=>category(s)===x).length;
  return '<button type="button" data-filter="'+escape(x)+'" aria-pressed="'+(selected===x)+'"'+(!count?' disabled':'')+'>'+escape(x)+' <small>'+count+'</small></button>';
 }).join("");
 filters.querySelectorAll("button:not([disabled])").forEach(b=>b.onclick=()=>{selected=b.dataset.filter;render()});
 if(!ready){status.textContent="Checking verified reports…";root.innerHTML="<p>Loading the team news wire…</p>";return}
 status.textContent=stories.length+" linked reports · Checked "+new Date(checked).toLocaleTimeString("en-US",{timeZone:"America/New_York",hour:"numeric",minute:"2-digit"})+" ET";
 const shown=stories.filter(s=>selected==="All"||category(s)===selected).slice(0,14);
 root.innerHTML=shown.map(s=>{
  const src=who(s);
  const when=new Date(s.published_at).toLocaleDateString("en-US",{timeZone:"America/New_York",month:"short",day:"numeric",year:"numeric"});
  return '<article class="nfl-press-item"><div class="nfl-press-byline">'+escape(category(s))+' · '+escape(src.name)+' · '+escape(when)+(src.weight?' <span class="nfl-press-paid">SUBSCRIBER</span>':'')+'</div><h3><a target="_blank" rel="noopener noreferrer" href="'+escape(s.url)+'">'+escape(s.title)+' ↗</a></h3>'+(s.summary?'<p>'+escape(s.summary)+'</p>':'')+'</article>';
 }).join("")||'<p class="nfl-press-empty">No verified '+escape(selected==="All"?"team stories":selected.toLowerCase()+" stories")+' in the connected feeds right now. Headlines are never invented.</p>';
}
async function load(url){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),9000);
 try{
  const sep=url.includes("?")?"&":"?";
  const r=await fetch(url+sep+"news="+Math.floor(Date.now()/300000),{cache:"no-store",signal:controller.signal});
  if(!r.ok)throw Error("Source unavailable");
  return await r.json();
 }finally{clearTimeout(timer)}
}
async function update(){
 const n=teamName();if(!n)return;
 const urls=["data/nfl-subscriber-reporting.json","articles.json","https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/"+encodeURIComponent(teamId)+"/news?limit=30"];
 const res=await Promise.allSettled(urls.map(load));
 const all=[];
 res.forEach((r,i)=>{
  if(r.status!=="fulfilled")return;
  const d=r.value;
  const list=Array.isArray(d)?d:Array.isArray(d.articles)?d.articles:[];
  list.forEach(item=>{const v=normalized(item,i===0?"curated":i===1?"general":"espn");if(v&&matches(v,n))all.push(v)});
 });
 const seen=new Set();
 stories=all.sort((a,b)=>rank(b)-rank(a)||dateValue(b.published_at)-dateValue(a.published_at)).filter(s=>{
  const key=s.url.replace(/[#?].*$/,"").replace(/\/$/,"");
  if(seen.has(key))return false;seen.add(key);return true;
 }).slice(0,45);
 ready=true;checked=Date.now();render();
}
let pending=false;
new MutationObserver(()=>{
 if(pending)return;pending=true;
 requestAnimationFrame(()=>{pending=false;if(ensure()&&!started){started=true;update()}});
}).observe(app,{childList:true});
ensure();
if(teamName()&&!started){started=true;update()}
setInterval(()=>{if(!document.hidden&&started)update()},300000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&started)update()});
})();