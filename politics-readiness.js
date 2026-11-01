(function(){
"use strict";
const node=document.getElementById("politics-sim-readiness");
if(!node)return;
function elem(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
async function build(){
 try{
 const r=await fetch("politics-sim-readiness.json?v="+Date.now(),{cache:"no-store"});
 if(!r.ok)throw Error("Unavailable");
 const d=await r.json();
 if(!Array.isArray(d.checks)||!d.checks.length){node.textContent="Original-input collection is not yet complete. No independent 2026 probability model has been approved.";return;}
 node.replaceChildren();
 const headline=elem("div",null,"sim-ready-head");
 const h=elem("strong","NOT YET READY TO PUBLISH INDEPENDENT ODDS","sim-ready-warning");
 const counter=elem("span",d.counts.verified+" verified · "+d.counts.partial+" partial · "+d.counts.missing+" missing","sim-ready-status");
 headline.append(h,counter);node.append(headline);
 const p=elem("p","Our evidence inventory tracks primary-source observations, not projections from other forecasters. A 'partial' dataset is NOT cleared for predictive use.","fine");node.append(p);
 const grid=elem("div",null,"sim-ready-grid");
 (d.checks||[]).forEach(c=>{
   const card=elem("article",null,"sim-check "+(c.state||"missing"));
   card.append(elem("span",String(c.state||"missing").toUpperCase(),"sim-state"));
   card.append(elem("h3",c.id.replaceAll("_"," ")));
   card.append(elem("p",c.evidence,"sim-evidence"));
   card.append(elem("p",c.blocker,"fine"));
   grid.append(card);
 });
 node.append(grid);
 const foot=elem("p","Certified original forecast probabilities published: "+d.certified_original_probability_count+". Data alone do not establish district-specific win probabilities, majority probabilities or odds of a given seat count.","sim-ready-foot");
 node.append(foot);
 }catch{node.textContent="The simulation-readiness audit is currently unavailable. Our original House/Senate/governor model remains uncertified.";}
}
build();
})();