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
 const finalists=r["2024_house_result_on_prior_boundaries"]?.finalists||[];
 const geo=r["2024_to_2026_geography_comparison"];
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
  headline=r.id+": a reported "+dec(Math.abs(pm))+"-point poll gap, with questions to answer.";
  sub="A "+pLabel+" dated "+reported+" reports "+(pm===0?"a tied Democratic–Republican race":nameD(pm>0?"D":"R").toLowerCase()+" "+dec(Math.abs(pm))+" points ahead")+".";
  importance=geo==="pending_district_block_comparison"?"The state changed its map, but this district has not been individually compared.":geo==="verified_changed_district_blocks"?"A verified district-level Census-block change separates the 2024 and 2026 geographies.":"No comparable two-party margin is available."
 }else if(h){
  if(diff<1000)headline="Only "+fmt(diff)+" votes separated the major parties last time.";
  else if(Math.abs(hm)<5)headline="The last House vote was decided by "+dec(Math.abs(hm))+" points.";
  else headline=r.id+": a "+dec(Math.abs(hm))+"-point 2024 margin sets the historical scene.";
  sub="In 2024, "+nameD(hm>0?"D":"R").toLowerCase()+" received "+fmt(Math.max(h.dem_votes,h.rep_votes))+" votes to "+fmt(Math.min(h.dem_votes,h.rep_votes))+" for the other major party. No independently reviewed 2026 named-candidate district poll is in this desk's ledger.";
  importance="No new district poll has cleared our source review. The absence of a poll in this ledger does not mean no polls exist, and 2024 vote totals do not establish a 2026 winner.";
 }else if(finalists.length===2){
  const [winner,runner]=finalists;
  headline=winner.name+" defeated "+runner.name+" in the 2024 general election.";
  sub=winner.name+" ("+partyName(winner.party)+") received "+fmt(winner.votes)+" votes; "+runner.name+
    " ("+partyName(runner.party)+") received "+fmt(runner.votes)+". Winning margin: "+fmt(winner.votes-runner.votes)+" votes."+
    (winner.party===runner.party?" Both finalists belonged to the same party.":"");
  importance="These are actual historic results, never 2026 votes or a projected partisan margin. "+
    (geo==="pending_district_block_comparison"?"2026 district lines have not been individually assessed.":
      geo==="verified_changed_district_blocks"?"This district's 2026 boundaries differ from 2024.":"District geography was unchanged.");
 }else{
  headline=geo==="pending_district_block_comparison"?r.id+": district comparison pending.":geo==="verified_changed_district_blocks"?r.id+": confirmed new district boundaries.":r.id+": new 2026 lines, old results cannot compare.":r.id+": the contest needs more direct election evidence.";
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
 const official=r.official_2026_candidate_snapshot?.candidates||[];
 if(!p&&!h&&official.length){
  const pair=official.filter(c=>c.party==="DEM"||c.party==="REP");
  if(pair.length===2)sub="State-listed 2026 candidates "+pair.map(c=>c.name).join(" and ")+" face voters in "+r.id+". This desk has not verified a current named-candidate poll or comparable two-party 2024 margin.";
  else sub="The state election office lists "+official.length+" official 2026 ballot contender"+(official.length===1?"":"s")+" in "+r.id+". This is a candidate snapshot, not a race projection.";
 }
 const items=[];
 if(h)items.push({value:fmt(diff),unit:"VOTE GAP · 2024",note:"Actual counted Democratic–Republican vote difference; comparable district lines.",tone:"past"});
 else if(finalists.length===2)items.push({value:fmt(finalists[0].votes-finalists[1].votes),unit:"2024 FINALIST GAP",note:"Actual candidate results, including same-party races.",tone:"past"});
 else items.push({value:"—",unit:"2024 COMPARISON",note:geo==="verified_changed_district_blocks"?"District geometry changed.":geo==="pending_district_block_comparison"?"Individual district map review pending.":"Counted two-party data unavailable.",tone:"past"});
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
 // Every state uses the same newsroom feature, including all Iowa seats.
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
 // One newsroom lead: present the authentic candidate field with the reported
 // race narrative, not in a second identical box further down the page.
 const field=$("front-field");
 if(field){head.append(field);root.classList.add("editorial-race-layout");}
 const context=el("aside",null,"race-editor-note");
 context.append(el("b","HOW TO READ THE EVIDENCE"),el("p",s.importance));
 featured.append(head,context);
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
 // Preserve every original source and data table, but move it beneath one
 // accessible disclosure on non-Iowa pages. Iowa has its own established dossier.
 const sourcePanels=document.querySelector("body[data-house-page=district] .panels");
 const fecPanel=document.querySelector("body[data-house-page=district] .fec-wrap");
 const historyPanel=$("result-panel")?.closest("section");
 if(sourcePanels&&fecPanel&&historyPanel&&!$("race-receipts")){
  const details=el("details",null,"race-deep-dive");details.id="race-receipts";
  details.append(el("summary","THE ORIGINAL REPORTS · CANDIDATES, POLLS, FEC AND 2024 RETURNS"));
  const content=el("div",null,"race-deep-content");
  content.append(sourcePanels,fecPanel,historyPanel);
  details.append(content);
  const mapWarning=$("map-warning");
  if(mapWarning)mapWarning.insertAdjacentElement("afterend",details);
  else root.insertAdjacentElement("afterend",details);
 }
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
 return a;
}
function evidenceWatch(r){
 const s=story(r);
 const closePoll=s.pm!=null&&Math.abs(s.pm)<=6;
 const closePast=s.hm!=null&&Math.abs(s.hm)<5;
 const mixed=s.pm!=null&&s.hm!=null&&s.pm*s.hm<0;
 const watch=closePoll||closePast||mixed;
 const tier=s.p?.source_tier==="original_release_checked"&&s.p?.source_verified===true?0:s.p?1:2;
 const distance=s.pm!=null?Math.abs(s.pm):s.hm!=null?Math.abs(s.hm):100;
 return {watch:!!watch,mixed,closePoll,closePast,tier,distance,s};
}
function orderRaces(rows){
 return [...rows].sort((a,b)=>{
  const a0=evidenceWatch(a),b0=evidenceWatch(b);
  const arrA=[a0.watch?0:1,a0.tier,a0.distance,a0.s.p?-1:0];
  const arrB=[b0.watch?0:1,b0.tier,b0.distance,b0.s.p?-1:0];
  for(let i=0;i<arrA.length;i++)if(arrA[i]!==arrB[i])return arrA[i]-arrB[i];
  return a.id.localeCompare(b.id);
 });
}
function renderState({state,rows}){
 const host=$("state-editorial-stories");if(!host)return;
 const eligible=orderRaces(rows).slice(0,Math.min(6,rows.length));
 const title=$("state-editorial-title");
 if(title)title.textContent=state.name+": the races worth opening";
 const watch=rows.filter(r=>evidenceWatch(r).watch).length;
 const sub=$("state-editorial-deck");
 if(sub)sub.textContent=watch+" district"+(watch===1?"":"s")+" flagged by close or conflicting observed evidence in this state. These are research-watch labels, not certified 2026 projections. Every district is listed below.";
 host.replaceChildren(...eligible.map(makeStateStory));
}
function renderNational({rows}){
 const area=$("national-watch-races");if(!area)return;
 const all=rows.filter(r=>evidenceWatch(r).watch);
 const head=$("national-watch-count");
 if(head)head.textContent=all.length+" districts meet this desk's evidence-watch criteria · not forecast odds";
 const featured=orderRaces(all).slice(0,12);
 const cards=featured.map(r=>{
  const info=evidenceWatch(r),a=el("a",null,"national-race-card");
  a.href="politics-house-district.html?district="+encodeURIComponent(r.id);
  const label=info.mixed?"CONFLICTING SIGNALS":info.closePoll?"CLOSE REPORTED POLL":"CLOSE PREVIOUS ELECTION";
  const crest=el("div",null,"national-race-crest");
  const flag=document.createElement("img");flag.loading="lazy";flag.decoding="async";flag.alt=r.state+" state flag";
  flag.src="https://flagcdn.com/us-"+r.state.toLowerCase()+".svg";
  flag.onerror=()=>{flag.remove();crest.textContent=r.state;};
  crest.append(flag);
  const content=el("div",null,"national-race-copy");
  content.append(el("span",r.id+" · "+label,"national-race-kicker"),
   el("strong",info.s.headline,"national-race-title"),
   el("span",info.s.pm!=null?"Reported poll: "+dec(Math.abs(info.s.pm))+" points":"Actual 2024 gap: "+dec(Math.abs(info.s.hm))+" points","national-race-figure"),
   el("span","OPEN THE RACE FILE →","national-race-open"));
  a.append(crest,content);return a;
 });
 area.replaceChildren(...cards);
}

window.PoliticsRaceExperience=Object.freeze({renderDistrict,renderState,renderNational,evidenceWatch,orderRaces,story,validPoll,validHistory});
})();
