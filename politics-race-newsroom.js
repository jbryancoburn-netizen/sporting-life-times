/* Race-page editorial wire. Headlines/links only, no invented reporting or odds. */
(function(){"use strict";
const byId=id=>document.getElementById(id);
const page=document.body.dataset.housePage;
if(!["district","state"].includes(page))return;
const states=Object.fromEntries("AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming".split("|").map(v=>v.split(":")));
const sources=new Set(["NPR","PBS News","Axios","ProPublica","POLITICO","BBC News"]);
const topical=/election|midterm|house|senate|congress|campaign|ballot|vot(er|ing)|politic|government|president|supreme court/i;
const date=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d:null;};
const stamp=d=>d.toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/New_York",timeZoneName:"short"});
const escaped=t=>t.replace(/[|\\{}()[\]^$+*?.]/g,"\\$&");
const contains=(title,term)=>new RegExp("\\b"+escaped(term)+"\\b","i").test(title);
function context(){const q=new URLSearchParams(location.search),dist=(q.get("district")||"").toUpperCase(),code=(q.get("state")||dist.slice(0,2)).toUpperCase();return {dist,code,state:states[code]||""};}
function candidateNames(){return [...document.querySelectorAll("#front-field .front-person-name")].map(x=>x.textContent.trim()).filter(x=>x.includes(" "));}
function match(a,ctx,names){
 if(ctx.dist&&new RegExp("\\b"+escaped(ctx.dist).replace("\\-","[- ]?")+"\\b","i").test(a.title))return "DISTRICT MENTION";
 if(names.some(name=>contains(a.title,name)||name.trim().split(/\s+/).slice(-1)[0].length>=6&&contains(a.title,name.trim().split(/\s+/).slice(-1)[0])&&ctx.state&&contains(a.title,ctx.state)))return "CANDIDATE MENTION";
 if(ctx.state&&contains(a.title,ctx.state))return "STATE MENTION";
 return null;
}
function article(a,label){
 const box=document.createElement("article");box.className="race-wire-article";
 const meta=document.createElement("p");meta.className="race-wire-byline";meta.textContent=(label||"NATIONAL POLITICS")+" · "+a.source+" · "+stamp(date(a.published_at));
 const h=document.createElement("h3"),link=document.createElement("a");link.href=a.url;link.target="_blank";link.rel="noopener noreferrer";link.textContent=a.title+" ↗";h.append(link);box.append(meta,h);return box;
}
async function build(){
 const host=byId("race-wire-items"),status=byId("race-wire-status");if(!host||!status)return;
 try{
  const response=await fetch("politics-news.json?v="+Date.now(),{cache:"no-store"});if(!response.ok)throw Error("Feed unavailable");
  const feed=await response.json(),updated=date(feed.updated_at);
  if(feed.status!=="ok"||!updated||!Array.isArray(feed.articles))throw Error("Feed not verified");
  const valid=feed.articles.filter(a=>{
   try{return sources.has(a.source)&&typeof a.title==="string"&&a.title.length>18&&/^https:\/\//.test(a.url)&&date(a.published_at)&&topical.test(a.title);}catch{return false;}
  }).sort((a,b)=>date(b.published_at)-date(a.published_at));
  const ctx=context(),names=candidateNames(),local=valid.map(a=>({a,label:match(a,ctx,names)})).filter(x=>x.label);
  const picks=[],seen=new Set();
  for(const item of [...local,...valid.map(a=>({a,label:null}))]){
   if(picks.length===3)break;
   if(seen.has(item.a.url))continue;
   seen.add(item.a.url);picks.push(item);
  }
  if(!picks.length)throw Error("No verified headlines");
  host.replaceChildren(...picks.map(x=>article(x.a,x.label)));
  const age=(Date.now()-updated.getTime())/3600000,fresh=age>=-2&&age<=6;
  status.textContent=(local.length?
   local.length+" headline"+(local.length===1?"":"s")+" mention"+(local.length===1?"s":"")+" a state, district or verified candidate. ":
   "No directly matching headline in this feed; broader political reporting follows. ")+
   (fresh?"Collected ":"Archived collection: ")+stamp(updated)+". Headlines are not evidence of a candidate's ballot status.";
 }catch(e){
  host.replaceChildren();
  const p=document.createElement("p");p.className="race-wire-unavailable";p.textContent="The publisher headline feed is temporarily unavailable. The official-source election research remains accessible.";
  host.append(p);status.textContent="Publisher collection unavailable · no fabricated headlines displayed.";
 }
}
function init(){
 if(page==="district"){
  const node=byId("front-field");
  if(node&&!node.querySelector(".front-person-name")){
   const obs=new MutationObserver(()=>{if(node.querySelector(".front-person-name")){obs.disconnect();build();}});
   obs.observe(node,{subtree:true,childList:true});
   setTimeout(()=>{obs.disconnect();if(!byId("race-wire-items")?.childElementCount)build();},4500);
   return;
  }
 }
 build();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
