(function(){
"use strict";
const byId=id=>document.getElementById(id);
const utcDate=value=>{const date=new Date(value);return Number.isFinite(date.getTime())?date:null;};
const formatTime=date=>date.toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/New_York",timeZoneName:"short"});
function message(node,text){node.replaceChildren();const p=document.createElement("p");p.className="fine";p.textContent=text;node.appendChild(p);}
async function loadJSON(path){const response=await fetch(path+"?v="+Date.now(),{cache:"no-store"});if(!response.ok)throw Error("Source unavailable");return response.json();}
function displayPolls(data){
 const root=byId("original-polling");
 if(!data||data.status!=="ok"||!data.average||!data.computed_at){message(root,"Independent polling average: awaiting three or more verified polling organizations. Existing third-party polling above remains separately attributed.");return;}
 const updated=utcDate(data.computed_at),age=updated?(Date.now()-updated.getTime())/3600000:Infinity;
 if(age>48||age< -2){message(root,"Our independently calculated polling average is out of date ("+(updated?formatTime(updated):"unknown")+"). It is not being displayed as current.");return;}
 root.replaceChildren();
 const heading=document.createElement("h3");heading.textContent="Our polling average: Democrats "+data.average.dem.toFixed(1)+"% · Republicans "+data.average.rep.toFixed(1)+"%";root.appendChild(heading);
 const meta=document.createElement("p");meta.className="fine";meta.textContent="Computed "+formatTime(updated)+" · "+data.poll_count+" polls, "+data.pollsters+" polling firms · 35-day rolling window · VoteHub (CC BY 4.0). This is our original weighted average, not a seat forecast.";root.appendChild(meta);
 const track=document.createElement("div");track.className="original-poll-track";track.setAttribute("role","img");track.setAttribute("aria-label","Original generic ballot average, Democrats "+data.average.dem+"%, Republicans "+data.average.rep+"%");
 const dem=document.createElement("span");dem.style.width=data.average.dem+"%";dem.className="dem";
 const rep=document.createElement("span");rep.style.width=data.average.rep+"%";rep.className="rep";
 track.append(dem,rep);root.appendChild(track);
 const link=document.createElement("a");link.href="https://votehub.com/polls/api/";link.target="_blank";link.rel="noopener";link.textContent="Poll data, licensing and aggregation documentation ↗";root.appendChild(link);
}
function displayPollCoverage(audit){
 const root=byId("original-polling");
 if(!audit||!audit.checked_at||root.querySelector(".original-poll-track"))return;
 const checked=utcDate(audit.checked_at);
 const p=document.createElement("p");p.className="fine";
 if(audit.status==="insufficient_polling"){
   p.textContent="Most recent data check: "+(checked?formatTime(checked):"date unavailable")+". VoteHub supplied "+audit.raw_poll_records+" total records; "+audit.eligible_polls+" qualified polls from "+audit.unique_pollsters+" polling organizations. We require at least "+audit.minimum_pollsters+" organizations. No unsupported average will be shown.";
 }else{
   p.textContent="Most recent source check: "+(checked?formatTime(checked):"unavailable")+". Source status: "+audit.status+". We preserve the prior verified dataset instead of inventing an average.";
 }
 root.appendChild(p);
}
function displayNews(data){
 const root=byId("live-politics-wire");
 if(!data||data.status!=="ok"||!Array.isArray(data.articles)||!data.articles.length){message(root,"Live political headlines are awaiting the first verified publisher-feed refresh. Use the curated reporting links above in the meantime.");return;}
 const refreshed=utcDate(data.updated_at),hours=refreshed?(Date.now()-refreshed.getTime())/3600000:Infinity;
 if(hours>6||hours< -2){message(root,"The last successful publisher-feed collection is older than six hours ("+(refreshed?formatTime(refreshed):"unknown")+"). The wire is temporarily marked stale; the source links above remain available.");return;}
 const valid=data.articles.filter(article=>{
  try{const url=new URL(article.url);return url.protocol==="https:"&&article.source&&article.title&&utcDate(article.published_at);}catch{return false;}
 }).slice(0,28);
 if(!valid.length){message(root,"No validated political headlines are available.");return;}
 root.replaceChildren();
 const top=document.createElement("div");top.className="wire-status";top.textContent="Publisher links · "+data.source_count+" accessible feeds · Refreshed "+formatTime(refreshed)+" · Headlines only · No articles republished";root.appendChild(top);
 const chips=document.createElement("div");chips.className="wire-filters";root.appendChild(chips);
 const list=document.createElement("div");list.className="wire-stories";root.appendChild(list);
 const sources=[...new Set(valid.map(a=>a.source))];
 function render(filter){
  list.replaceChildren();
  valid.filter(article=>filter==="All"||article.source===filter).slice(0,18).forEach(article=>{
   const box=document.createElement("article");
   const eyebrow=document.createElement("div");eyebrow.className="wire-byline";
   const date=utcDate(article.published_at);
   eyebrow.textContent=article.source+" · "+(date?formatTime(date):"Date unavailable");
   const title=document.createElement("h3");const link=document.createElement("a");link.href=article.url;link.rel="noopener noreferrer";link.target="_blank";link.textContent=article.title;title.appendChild(link);
   box.append(eyebrow,title);list.appendChild(box);
  });
 }
 ["All",...sources].forEach((s,i)=>{
  const chip=document.createElement("button");chip.type="button";chip.textContent=s;chip.className=i===0?"active":"";
  chip.setAttribute("aria-pressed",i===0?"true":"false");
  chip.addEventListener("click",()=>{
   chips.querySelectorAll("button").forEach(b=>{b.classList.toggle("active",b===chip);b.setAttribute("aria-pressed",b===chip?"true":"false");});
   render(s);
  });chips.appendChild(chip);
 });
 render("All");
}
async function ready(){
 await Promise.all([
   loadJSON("politics-news.json").then(displayNews).catch(()=>message(byId("live-politics-wire"),"Publisher feeds are temporarily unavailable. Curated links above remain available.")),
   Promise.all([loadJSON("politics-polls.json"),loadJSON("politics-poll-health.json")]).then(([polls,audit])=>{displayPolls(polls);displayPollCoverage(audit);}).catch(()=>message(byId("original-polling"),"Polling source audit is unavailable; no unverified average will be displayed."))
 ]);
}
if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",ready);}else{ready();}
})();