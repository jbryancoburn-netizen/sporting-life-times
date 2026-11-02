
/* Source-driven political homepage. Headlines link to publishers; no article text copied. */
(function(){"use strict";
const id=x=>document.getElementById(x);
const headlineRe=/election|midterm|senate|congress|house race|ballot|voter|candidate|governor|politic|democrat|republican|campaign|supreme court|president|trump|administration|capitol/i;
const states="AL Alabama|AK Alaska|AZ Arizona|AR Arkansas|CA California|CO Colorado|CT Connecticut|DE Delaware|FL Florida|GA Georgia|HI Hawaii|ID Idaho|IL Illinois|IN Indiana|IA Iowa|KS Kansas|KY Kentucky|LA Louisiana|ME Maine|MD Maryland|MA Massachusetts|MI Michigan|MN Minnesota|MS Mississippi|MO Missouri|MT Montana|NE Nebraska|NV Nevada|NH New Hampshire|NJ New Jersey|NM New Mexico|NY New York|NC North Carolina|ND North Dakota|OH Ohio|OK Oklahoma|OR Oregon|PA Pennsylvania|RI Rhode Island|SC South Carolina|SD South Dakota|TN Tennessee|TX Texas|UT Utah|VT Vermont|VA Virginia|WA Washington|WV West Virginia|WI Wisconsin|WY Wyoming".split("|").map(x=>({code:x.slice(0,2),name:x.slice(3)}));
const allowedSources=new Set(["PBS News","NPR","Axios","ProPublica","POLITICO","BBC News"]);
function date(x){const d=new Date(x);return Number.isFinite(d.getTime())?d:null;}
function clock(d){return d.toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/New_York",timeZoneName:"short"});}
function linkText(a,href,title){a.textContent=title;a.href=href;a.target="_blank";a.rel="noopener noreferrer";}
function makeStory(article){const box=document.createElement("article");const by=document.createElement("div");by.className="desk-byline";by.textContent=article.source+" · "+clock(date(article.published_at));const h=document.createElement("h4");const a=document.createElement("a");linkText(a,article.url,article.title);h.append(a);box.append(by,h);return box;}
function similar(a,b){const words=x=>new Set(x.toLowerCase().replace(/[^a-z ]/g," ").split(/\s+/).filter(w=>w.length>4&&!["election","midterm","senate","house","trump","democrat","republican"].includes(w)));const u=words(a),v=words(b);let n=0;u.forEach(w=>{if(v.has(w))n++;});return n>=3&&n/Math.max(1,Math.min(u.size,v.size))>.45;}
function uniqueStories(a){const out=[];for(const item of a){if(out.some(t=>similar(t.title,item.title)))continue;out.push(item);}return out;}
async function loadNews(){
 const rail=id("desk-rail-list");if(!rail)return;
 try{
  const r=await fetch("politics-news.json?v="+Date.now(),{cache:"no-store"});if(!r.ok)throw Error("feed unavailable");const j=await r.json();
  if(j.status!=="ok"||!Array.isArray(j.articles)||!date(j.updated_at))throw Error("feed not verified");
  const all=j.articles.filter(x=>{
   try{return allowedSources.has(x.source)&&typeof x.title==="string"&&x.title.length>18&&headlineRe.test(x.title)&&new URL(x.url).protocol==="https:"&&date(x.published_at);}catch{return false;}
  }).sort((a,b)=>date(b.published_at)-date(a.published_at));
  const unique=uniqueStories(all);if(!unique.length)throw Error("no political headlines");
  const freshAge=(Date.now()-date(j.updated_at).getTime())/3600000;
  const fresh=freshAge>=-2&&freshAge<=6;
  id("desk-feed-status").textContent=(fresh?"Publisher feeds updated ":"Last collected ")+clock(date(j.updated_at))+" · "+(fresh?"Sourced headlines":"Archive — refresh pending");
  id("desk-feed-state").textContent=fresh?"LATEST FROM VERIFIED PUBLISHERS":"LATEST AVAILABLE PUBLISHER LINKS";
  const main=unique[0];linkText(id("desk-feature-headline"),main.url,main.title);linkText(id("desk-feature-link"),main.url,"");id("desk-feature-link").setAttribute("aria-label","Open story at "+main.source+": "+main.title);
  id("desk-feature-source").textContent=main.source.toUpperCase()+" · "+clock(date(main.published_at));
  id("desk-feature-intro").textContent="A sourced headline from "+main.source+". Read the complete reporting at the publisher; explore the election data and race files below.";
  linkText(id("desk-feature-read"),main.url,"Read the report at "+main.source+" ↗");
  rail.replaceChildren();
  unique.slice(1,7).forEach(x=>rail.append(makeStory(x)));
  if(unique.length===1){const e=document.createElement("p");e.className="fine";e.textContent="The source wire currently has one verified political headline.";rail.append(e);}
 }catch(err){
  id("desk-feed-status").textContent="Source feed temporarily unavailable · Our election research pages remain accessible.";
  id("desk-feed-state").textContent="ELECTION COVERAGE";
  const fallback=[["Explore all 435 House districts","politics-house.html"],["Review documented race forecasts","#races"],["Find official 2026 candidates","politics-ballots.html"]];
  rail.replaceChildren();fallback.forEach(([title,href])=>{const box=document.createElement("article"),h=document.createElement("h4"),a=document.createElement("a");a.href=href;a.textContent=title;h.append(a);box.append(h);rail.append(box);});
 }
}
function countdown(){
 const countdownEl=id("countdown");if(!countdownEl)return;
 const delta=Date.UTC(2026,10,3,12)-Date.now();
 if(delta<=0){countdownEl.textContent="Election Day · Nov. 3";return;}
 const days=Math.floor(delta/86400000),hours=Math.floor((delta%86400000)/3600000);
 countdownEl.textContent=days+"d "+hours+"h to Election Day";
}
function initFind(){
 const input=id("desk-district-query"),form=id("desk-district-form"),out=id("desk-find-error");if(!form)return;
 const list=id("desk-state-suggestions");states.forEach(s=>{const opt=document.createElement("option");opt.value=s.code;opt.label=s.name;list.append(opt);const o=document.createElement("option");o.value=s.name;list.append(o);});
 form.addEventListener("submit",e=>{
  e.preventDefault();const raw=input.value.trim().toUpperCase().replace(/\s+/g," ").replace(/\u2013|\u2014/g,"-");
  const dist=raw.match(/^([A-Z]{2})\s*-\s*0?([1-9]|[1-4][0-9]|5[0-3])$/);
  const state=states.find(s=>s.code===raw||s.name.toUpperCase()===raw);
  if(dist&&states.some(s=>s.code===dist[1])){window.location.href="politics-house-district.html?district="+encodeURIComponent(dist[1]+"-"+String(dist[2]).padStart(2,"0"));return;}
  if(state){window.location.href="politics-house-state.html?state="+encodeURIComponent(state.code);return;}
  out.textContent="Enter a state (e.g. Florida or FL) or district (e.g. FL-14).";out.classList.add("desk-lookup-error");input.focus();
 });
 input.addEventListener("input",()=>{out.textContent="Enter a state or a House district, such as PA-07.";out.classList.remove("desk-lookup-error");});
}
function init(){
 const label=id("date-label");if(label)label.textContent=new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric",timeZone:"America/New_York"}).toUpperCase();
 countdown();setInterval(countdown,60000);initFind();loadNews();
 const more=document.querySelector(".desk-more");if(more){document.addEventListener("click",e=>{if(!more.contains(e.target))more.open=false;});document.addEventListener("keydown",e=>{if(e.key==="Escape")more.open=false;});}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
