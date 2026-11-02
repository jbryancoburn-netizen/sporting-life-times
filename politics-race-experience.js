/* The Political Life & Times · source-first 2026 race storytelling.
 * Two separate observations (2026 poll and 2024 counted votes) are not a time
 * series and must never be interpreted as calculated swing or modeled odds.
 */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const el=(tag,text,cl)=>{
 const x=document.createElement(tag);
 if(text!==undefined&&text!==null)x.textContent=String(text);
 if(cl)x.className=cl;
 return x;
};
const fmt=n=>Number(n).toLocaleString("en-US",{maximumFractionDigits:0});
const dec=n=>Number(n).toFixed(1);
const partyName=p=>({D:"Democratic",R:"Republican",DEM:"Democratic",REP:"Republican",IND:"Independent",LIB:"Libertarian",GRE:"Green",WRI:"Write-in",NPA:"No party",NPP:"No party"})[p]||p;
const nameD=(s)=>s==="D"?"Democrats":"Republicans";
const pctParty=p=>(p==="D"||p==="DEM")?"dem":(p==="R"||p==="REP")?"rep":"other";
function validPoll(r){
 for(const p of r.district_specific_2026_polls||[]){
  if(p.question_type!=="named_house"||!Array.isArray(p.candidates))continue;
  const d=p.candidates.filter(x=>x.party==="D"),g=p.candidates.filter(x=>x.party==="R");
  if(d.length!==1||g.length!==1||!p.candidates.every(c=>Number.isFinite(c.pct)&&c.pct>=0&&c.pct<=100)||p.candidates.reduce((s,c)=>s+c.pct,0)>100.01)continue;
  return p;
 }
 return null;
}
function validHistory(r){
 const h=r["2024_house_result_on_prior_boundaries"];
 return h&&h.same_2026_geography&&h.both_major_parties&&Number.isFinite(h.dem_votes)&&Number.isFinite(h.rep_votes)&&h.dem_votes>=0&&h.rep_votes>=0&&h.dem_votes+h.rep_votes>0?h:null;
}
function pollMargin(p){
 const d=p.candidates.find(c=>c.party==="D").pct;
 const r=p.candidates.find(c=>c.party==="R").pct;
 return d-r;
}
function story(r){
 const p=validPoll(r),h=validHistory(r),n=r.official_2026_candidate_snapshot?.candidates?.length||0;
 const diff=h?Math.abs(h.dem_votes-h.rep_votes):null;
 const hm=h?100*(h.dem_votes-h.rep_votes)/(h.dem_votes+h.rep_votes):null;
 const pm=p?pollMargin(p):null;
 const pName=p?.pollster||"";
 const reported=p?.reported_date||p?.end_date||"date unavailable";
 const pLabel=p&&p.source_tier==="original_release_checked"&&p.source_verified===true?"directly checked published poll":"secondary report of a poll";
 let headline,sub,eyebrow="THE RACE IN 30 SECONDS",importance;
 if(p&&h){
  const pollSide=pm>0?"Democrats":pm<0?"Republicans":"Neither party";
  const voteSide=hm>0?"Democrats":"Republicans";
  const contrast=Math.sign(pm)!==Math.sign(hm)&&pm!==0;
  if(diff<1000){
   headline=fmt(diff)+" votes decided the last election.";
   sub="In 2024, "+voteSide.toLowerCase()+" won the House vote by only "+fmt(diff)+" ballots. A "+pLabel+" lists "+pollSide.toLowerCase()+" "+(pm===0?"tied":"ahead by "+dec(Math.abs(pm))+" points")+".";
  }else if(contrast){
   headline="A reported poll and the last election point in different directions.";
   sub="The "+pLabel+" lists "+pollSide.toLowerCase()+" "+(pm===0?"tied":"up "+dec(Math.abs(pm))+" points")+". In 2024, "+voteSide.toLowerCase()+" won this district by "+dec(Math.abs(hm))+" points.";
  }else{
   headline="A "+dec(Math.abs(hm))+"-point race in 2024. A different test in 2026.";
   sub="The last House election favored "+voteSide.toLowerCase()+". The latest "+pLabel+" lists "+pollSide.toLowerCase()+" "+(pm===0?"tied":"ahead by "+dec(Math.abs(pm))+" points")+".";
  }
  importance="The two measures come from different elections, candidates, and populations. A 2026 poll is not counted votes; neither one is a verified 2026 prediction.";
 }else if(p){
  headline="A "+dec(Math.abs(pm))+"-point reported poll gap. What does it really establish?";
  sub="A "+pLabel+" dated "+reported+" reports "+(pm===0?"a tied Democratic–Republican race":nameD(pm>0?"D":"R").toLowerCase()+" "+dec(Math.abs(pm))+" points ahead")+".";
  importance=r["2026_boundaries_revised"]?"The district has new 2026 boundaries, so an old House result cannot be used as a comparable baseline.":"No comparable two-party vote margin is verified in the published archive.";
 }else if(h){
  if(diff<1000)headline="Only "+fmt(diff)+" votes separated the major parties last time.";
  else if(Math.abs(hm)<5)headline="The last House vote was decided by "+dec(Math.abs(hm))+" points.";
  else headline="A "+dec(Math.abs(hm))+"-point 2024 House margin. The 2026 question remains.";
  sub="In 2024, "+nameD(hm>0?"D":"R").toLowerCase()+" received "+fmt(Math.max(h.dem_votes,h.rep_votes))+" votes to "+fmt(Math.min(h.dem_votes,h.rep_votes))+" for the other major party. No independently reviewed 2026 named-candidate district poll is in this desk's ledger.";
  importance="No new district poll has cleared our source review. The absence of a poll in this ledger does not mean no polls exist, and 2024 vote totals do not establish a 2026 winner.";
 }else{
  headline=r["2026_boundaries_revised"]?"New 2026 district boundaries. Old numbers no longer match.":"This district needs more direct election evidence.";
  sub=n?"An official 2026 candidate list is present. A usable current poll and comparable two-party historical vote margin are not both available.":"The newsroom is still checking current candidates and directly usable district election measurements.";
  importance="The absence of data should not be colored as a tie, a toss-up or a predicted winner.";
 }
 // Third-party polling is often important in a close contest, and must not disappear into "other".
 if(p){
  const namedOthers=p.candidates.filter(c=>c.party!=="D"&&c.party!=="R"&&c.pct>=5).sort((a,b)=>b.pct-a.pct);
  if(namedOthers.length){
   const notable=namedOthers[0];
   sub+=" The same report lists "+notable.name+" ("+partyName(notable.party)+") at "+dec(notable.pct)+"%.";
  }
 }
 if(!p&&h&&r.official_2026_candidate_snapshot?.candidates?.length){
  const current=r.official_2026_candidate_snapshot.candidates;
  const d=current.find(c=>c.party==="DEM"),g=current.find(c=>c.party==="REP");
  if(d&&g)sub+=" The election-office list names "+d.name+" (D) and "+g.name+" (R) for 2026.";
 }
 const items=[];
 if(h)items.push({value:fmt(diff),unit:"VOTE GAP · 2024",note:"Actual counted Democratic–Republican vote difference; comparable district lines.",tone:"past"});
 else items.push({value:"—",unit:"2024 COMPARISON",note:r["2026_boundaries_revised"]?"Old boundaries: not a valid district comparison.":"Counted two-party data unavailable.",tone:"past"});
 if(p){
  const sign=pm>0?"D":pm<0?"R":"TIE";
  items.push({value:pm===0?"TIE":sign+" +"+dec(Math.abs(pm)),unit:"2026 REPORTED POLL · POINTS",note:pName+" · listed "+reported+" · "+(p.source_tier==="original_release_checked"?"original checked":"secondary source; method not fully verified"),tone:"survey"});
 }else items.push({value:"NO POLL",unit:"2026 DISTRICT SURVEY",note:"No source-reviewed named-candidate poll in this desk's ledger.",tone:"survey"});
 items.push({value:n||"—",unit:"2026 VERIFIED CANDIDATES",note:n?"From the state election-office list, not FEC registration counts.":"Official general-election roster not independently transcribed.",tone:"ballot"});
 return {p,h,headline,sub,eyebrow,importance,items,pm,hm,diff};
}
function sourceLink(label,url){
 if(!/^https:\/\//.test(url||""))return null;
 const a=el("a",label+" ↗","race-source-link");a.href=url;a.target="_blank";a.rel="noopener noreferrer";return a;
}
function barRow(name,pct,cls,note){
 const row=el("div",null,"race-plot-row");
 const line=el("div",null,"race-plot-text");
 line.append(el("strong",name),el("b",dec(pct)+"%"));
 const track=el("div",null,"race-plot-track");
 track.setAttribute("role","img");track.setAttribute("aria-label",name+": "+dec(pct)+" percent"+(note?" "+note:""));
 const fill=el("span",null,"race-plot-fill "+cls);fill.style.width=Math.min(100,Math.max(0,pct))+"%";track.append(fill);
 row.append(line,track);return row;
}
function snapshotPanel(data,type){
 const section=el("section",null,"race-snapshot-panel");section.id="race-panel-"+type;section.setAttribute("role","tabpanel");
 const top=el("div",null,"race-snapshot-head");
 if(type==="poll"){
  const p=data.p;
  top.append(el("strong","2026 · PUBLISHED POLL","race-period"),el("small",p?"SURVEY RESPONSES, NOT VOTES":"NO REVIEWED DISTRICT POLL"));
  section.append(top);
  if(p){
   section.append(el("h3",p.pollster,"race-snapshot-title"));
   section.append(el("p","Reported "+(p.reported_date||p.end_date||"date unknown")+" · "+(p.source_tier==="original_release_checked"?"Original release checked":"Secondary public compilation; survey sample and sponsorship not independently confirmed"),"race-snapshot-sub"));
   const plot=el("div",null,"race-plot");
   for(const c of p.candidates)plot.append(barRow(c.name+" · "+partyName(c.party),c.pct,pctParty(c.party),"reported poll response share"));
   section.append(plot);
   const reported=p.candidates.reduce((s,c)=>s+c.pct,0);
   if(reported<99.99)section.append(el("p","Other, undecided or unreported: "+dec(100-reported)+"% (not assigned to any candidate).","race-snapshot-note"));
   const links=el("div",null,"race-source-row");
   const src=sourceLink("Original article or linked publication",p.source_url);
   const compilation=sourceLink("Public poll compilation",p.compilation_url);
   if(src)links.append(src);if(compilation&&p.source_tier!=="original_release_checked")links.append(compilation);
   section.append(links);
   section.append(el("p","Reported candidate shares are not election probabilities. Poll field dates and weighting are not inferred from a compilation listing date.","race-snapshot-note"));
  }else section.append(el("p","This desk does not have a verified named-candidate 2026 district poll to chart. No substitute figures will be shown.","race-no-data"));
 }else{
  const h=data.h;
  top.append(el("strong","2024 · COUNTED HOUSE VOTES","race-period"),el("small",h?"ARCHIVED HOUSE RETURNS · PRIOR ELECTION":"COMPARISON UNAVAILABLE"));
  section.append(top);
  if(h){
   section.append(el("h3",fmt(data.diff)+" votes separated the major parties","race-snapshot-title"));
   const sum=h.dem_votes+h.rep_votes+Math.max(0,h.other_votes||0);
   section.append(el("p","Total vote entries in source: "+fmt(sum)+". These are 2024 results on comparable district boundaries, not 2026 polling.","race-snapshot-sub"));
   const plot=el("div",null,"race-plot");
   plot.append(barRow("Democratic · "+fmt(h.dem_votes)+" votes",100*h.dem_votes/sum,"dem","actual 2024 share of all counted votes"));
   plot.append(barRow("Republican · "+fmt(h.rep_votes)+" votes",100*h.rep_votes/sum,"rep","actual 2024 share of all counted votes"));
   if(h.other_votes>0)plot.append(barRow("Other · "+fmt(h.other_votes)+" votes",100*h.other_votes/sum,"other","actual 2024 share of all counted votes"));
   section.append(plot);
   const src=sourceLink("2024 House vote data",h.source_url);if(src)section.append(src);
   section.append(el("p","The 2024 race might feature different candidates. Its results must not be treated as a poll of 2026 voters.","race-snapshot-note"));
  }else section.append(el("p","Comparable 2024 D/R counted votes are unavailable for this 2026 district. The newsroom does not backfill old district lines.","race-no-data"));
 }
 return section;
}
function renderDistrict({r,state}){
 const root=$("district-front");if(!root)return;
 const s=story(r);
 const title=$("front-title");if(title)title.textContent=r.at_large?state.name+" · At-large":state.name+" · District "+Number(r.district);
 // Lead with an actual reporting takeaway instead of a district number or a generic research phrase.
 const banner=root.querySelector(".front-deck");if(banner)banner.textContent="An independently assembled guide to the candidate field, published polling and actual prior election returns.";
 const featured=el("section",null,"race-experience");featured.id="race-experience";featured.setAttribute("aria-label","Editorial summary and district evidence");
 const head=el("div",null,"race-experience-top");
 const intro=el("div",null,"race-experience-lead");
 intro.append(el("span",s.eyebrow,"race-eyebrow"),el("h2",s.headline,"race-feature-headline"),el("p",s.sub,"race-feature-deck"));
 head.append(intro);
 const context=el("aside",null,"race-editor-note");
 context.append(el("b","WHY THE DISTINCTION MATTERS"),el("p",s.importance));
 head.append(context);featured.append(head);
 const metrics=el("div",null,"race-headline-numbers");
 for(const item of s.items){
  const box=el("div",null,"race-number race-number-"+item.tone);
  box.append(el("strong",item.value),el("span",item.unit),el("p",item.note));
  metrics.append(box);
 }
 featured.append(metrics);
 const explore=el("section",null,"race-explore");explore.id="race-snapshots";
 explore.append(el("span","THE GRAPHICS DESK","race-eyebrow"),el("h2","Two snapshots. Two different kinds of evidence.","race-explore-head"));
 explore.append(el("p","Choose the 2026 survey report or the actual 2024 House count. The figures never share one scale and are not combined into a made-up swing.","race-explore-intro"));
 const buttons=el("div",null,"race-tabbar");buttons.setAttribute("role","tablist");buttons.setAttribute("aria-label","Choose the source of district numbers");
 const pan=el("div",null,"race-tabpanels");
 const descriptors=[{type:"poll",label:s.p?"2026 polling":"2026 poll unavailable"},{type:"history",label:s.h?"2024 actual votes":"2024 vote unavailable"}];
 const components=descriptors.map((d,i)=>{
  const btn=el("button",d.label,"race-tab");btn.type="button";btn.id="race-tab-"+d.type;btn.setAttribute("role","tab");btn.setAttribute("aria-controls","race-panel-"+d.type);
  btn.setAttribute("aria-selected",i===0?"true":"false");btn.tabIndex=i===0?0:-1;
  const panel=snapshotPanel(s,d.type);panel.setAttribute("aria-labelledby",btn.id);panel.hidden=i!==0;
  btn.addEventListener("click",()=>activate(d.type));buttons.append(btn);pan.append(panel);
  return {d,btn,panel};
 });
 function activate(type,focus=false){
  for(const comp of components){
   const active=comp.d.type===type;
   comp.btn.setAttribute("aria-selected",String(active));
   comp.btn.tabIndex=active?0:-1;comp.panel.hidden=!active;
   if(active&&focus)comp.btn.focus();
  }
 }
 buttons.addEventListener("keydown",event=>{
  if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
  event.preventDefault();
  const current=components.findIndex(x=>x.btn.getAttribute("aria-selected")==="true");
  const next=event.key==="Home"?0:event.key==="End"?components.length-1:(current+(event.key==="ArrowRight"?1:-1)+components.length)%components.length;
  activate(components[next].d.type,true);
 });
 explore.append(buttons,pan);featured.append(explore);
 // Put the data story above the generic source and filing blocks on every district file.
 const before=root.querySelector(".front-evidence-grid");
 if(before)root.insertBefore(featured,before);else root.append(featured);
 if(window.PoliticsRaceBranding)window.PoliticsRaceBranding.renderDistrict(r,state);
}
function makeStateStory(r){
 const s=story(r),a=el("a",null,"state-brief-card");
 a.href="politics-house-district.html?district="+encodeURIComponent(r.id);
 const top=el("div",null,"state-brief-top");
 top.append(el("strong",r.id),el("span",s.p?"2026 POLL + 2024 COUNT":s.h?"2024 COUNT ONLY":"DATA LIMITED"));
 a.append(top,el("h3",s.headline),el("p",s.sub));
 const bottom=el("div",null,"state-brief-bottom");
 if(s.h)bottom.append(el("b",fmt(s.diff)+"-VOTE 2024 GAP"));
 if(s.p)bottom.append(el("b",(s.pm===0?"TIED":(s.pm>0?"D ":"R ")+dec(Math.abs(s.pm))+"-POINT")+" REPORTED POLL GAP"));
 if(!s.p&&!s.h)bottom.append(el("b","SOURCE REVIEW NEEDED"));
 bottom.append(el("span","READ THE RACE →"));a.append(bottom);
 if(window.PoliticsRaceBranding)window.PoliticsRaceBranding.decorateStateCard(a,r);
 return a;
}
function priority(r){
 const brand=window.PoliticsRaceBranding;
 const evidence=brand?brand.watch(r):null;
 const data=story(r);
 const old=data.hm!=null?Math.abs(data.hm):100;
 const close=Math.min(data.pm!=null?Math.abs(data.pm):100,old);
 const hasBoth=Number(data.p!=null&&data.h!=null);
 const tier=evidence?.isWatch?0:data.p?1:data.h?2:3;
 // Directly reviewed original survey receives priority *within* watch category.
 const original=evidence?.poll?.source==="ORIGINAL POLL"?0:1;
 return [tier,original,close,hasBoth?-1:0];
}
function orderRaces(rows){
 return [...rows].sort((a,b)=>{
  const ap=priority(a),bp=priority(b);
  for(let i=0;i<ap.length;i++)if(ap[i]!==bp[i])return ap[i]-bp[i];
  return a.id.localeCompare(b.id);
 });
}
function renderState({state,rows}){
 const host=$("state-editorial-stories");if(!host)return;
 const eligible=orderRaces(rows).slice(0,Math.min(6,rows.length));
 const title=$("state-editorial-title");if(title)title.textContent=state.name+": The races that deserve a closer look";
 const filtered=eligible.filter(r=>window.PoliticsRaceBranding?.watch(r).isWatch).length;
 const sub=$("state-editorial-deck");
 if(sub)sub.textContent=filtered+" evidence-based watch race"+(filtered===1?"":"s")+" in this featured selection. Every district has its own full race file; close or conflicting measured signals are NOT certified 2026 win probabilities.";
 host.replaceChildren(...eligible.map(makeStateStory));
}
function renderNational({rows}){
 const host=$("national-watch-races");if(!host)return;
 const eligible=orderRaces(rows).filter(r=>window.PoliticsRaceBranding?.watch(r).isWatch).slice(0,12);
 host.replaceChildren();
 const heading=$("national-watch-count");
 if(heading)heading.textContent=rows.filter(r=>window.PoliticsRaceBranding?.watch(r).isWatch).length+" evidence-watch districts in our current ledger";
 for(const r of eligible){
  const anchor=el("a",null,"national-watch-tile");
  if(window.PoliticsRaceBranding)window.PoliticsRaceBranding.decorateNationalCard(anchor,r);
  host.append(anchor);
 }
}

window.PoliticsRaceExperience=Object.freeze({renderDistrict,renderState,renderNational,story,validPoll,validHistory,orderRaces});
})();
