/* The Political Life & Times • 435 district evidence atlas.
 * Never create party shading from FEC filings, DDHQ chances, generic polls,
 * 2024 old district results in a 2026 redrawn House district, or guesses.
 */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const newEl=(tag,text,cl)=>{let x=document.createElement(tag);if(text!=null)x.textContent=text;if(cl)x.className=cl;return x};
const fmt=n=>Number(n).toLocaleString("en-US");
const one=n=>Number(n).toFixed(1);
const urlForState=s=>"politics-house-state.html?state="+encodeURIComponent(s);
const urlForDistrict=id=>"politics-house-district.html?district="+encodeURIComponent(id);
const partyName=p=>({"D":"Democratic","R":"Republican","DEM":"Democratic","REP":"Republican","NPA":"No Party Affiliation","NPP":"No Party Preference","WRI":"Qualified write-in","LPF":"Libertarian Party of Florida","AIP":"American Independent","PAF":"Peace and Freedom","LIB":"Libertarian","GRE":"Green"})[p]||p;
const color=(party,margin)=>{
 if(!["D","R"].includes(party))return {bg:"#d9ddda",fg:"#17242c"};
 const strength=margin==null?11:Math.min(42,Math.max(0,Math.abs(margin)));
 const light=Math.max(43,90-strength*1.2);
 return {bg:"hsl("+(party==="D"?216:4)+" 56% "+light+"%)",fg:light<65?"#ffffff":"#17242c"};
};
const voters=r=>{let a=r["2024_presidential_actual"];return a?(a.winner_party==="D"?"D":"R")+" +"+one(Math.abs(a.dem_margin_pp))+" pp · 2024 presidential":""};
function districtEvidence(r){
 const poll=(r.district_specific_2026_polls||[]).find(p=>p.question_type!=="generic_house");
 if(poll){
   const people=[...poll.candidates].sort((a,b)=>b.pct-a.pct);
   const margin=people[0].pct-people[1].pct;
   const leader=margin<=0?"TIE":people[0].party;
   return {source:poll.source_tier==="public_compilation_not_original_checked"?"2026 published poll (compiled)":"2026 district poll (original release checked)",text:margin<=0?"Tied in latest named-candidate poll":partyName(leader)+" +"+one(margin)+" points",
           party:leader,margin:margin,sub:poll.pollster+" · "+poll.end_date+(poll.source_tier==="public_compilation_not_original_checked"?" · unverified survey sample":""),
           source_url:poll.source_url,dated:"2026",poll:true};
 }
 const h=r["2024_house_result_on_prior_boundaries"];
 if(h && h.same_2026_geography){
   const margin=h.dem_two_party_margin_pp;
   return {source:"2024 House result",text:margin==null?partyName(h.party)+" won (no two-party margin)":partyName(h.party)+" +"+one(Math.abs(margin))+" points",
           party:margin==null?null:h.party,margin:margin==null?null:Math.abs(margin),sub:"2024 actual result · not a 2026 poll",
           source_url:h.source_url,dated:"2024",poll:false};
 }
 if(r["2026_boundaries_revised"]){
   return {source:"2026 district boundaries changed",text:"New 2026 boundaries",party:null,margin:null,
           sub:"No sourced 2026 district poll yet",dated:"2026",poll:false};
 }
 return {source:"No comparable local observations",text:"Data not available",party:null,margin:null,
          sub:"No sourced district poll or verified margin",dated:"2026",poll:false};
}
function assertAtlas(a){
 if(a?.status!=="COMPLETE_435_DISTRICT_RESEARCH_ATLAS_NOT_FORECAST"||a.district_count!==435||
    a.state_count!==50||!Array.isArray(a.districts)||a.districts.length!==435||
    !Array.isArray(a.states)||a.states.length!==50||a.forecast_eligible!==false||
    a.certified_2026_probabilities!==0)throw Error("Incomplete / uncertified House evidence");
}
async function readAtlas(){
 const response=await fetch("politics-house-atlas.json?t="+Date.now(),{cache:"no-store"});
 if(!response.ok)throw Error("Published source-ledger request failed");
 const x=await response.json();assertAtlas(x);return x;
}
function addLink(parent,text,href,cl){
 let a=newEl("a",text,cl);a.href=href;parent.append(a);return a;
}
function makeStateTile(s){
 let a=addLink(newEl("div"),s.code,urlForState(s.code),"state-tile");
 let m=s["2024_presidential_actual"],col=color(m.winner_party,Math.abs(m.dem_margin_pp));
 a.style.setProperty("--col",s.col);
 a.style.setProperty("--row",s.row);
 a.style.background=col.bg;a.style.color=col.fg;
 a.setAttribute("aria-label",s.name+": "+s.district_count+" House districts. 2024 statewide presidential "+(m.winner_party==="D"?"Democratic":"Republican")+" +"+one(Math.abs(m.dem_margin_pp))+" points. Open district directory.");
 a.title=s.name+" · "+voters(s)+" · "+s.district_count+" districts";
 return a;
}
function makeStateLink(s){
 const m=s["2024_presidential_actual"],c=color(m.winner_party,Math.abs(m.dem_margin_pp));
 let link=newEl("a",null,"state-link");link.href=urlForState(s.code);
 let stripe=newEl("div",null,"stripe");stripe.style.background=c.bg;
 let label=newEl("div");label.append(newEl("strong",s.name),newEl("small",s.district_count+" districts · "+s["2026_house_poll_count"]+" sourced poll"+(s["2026_house_poll_count"]===1?"":"s")));
 link.append(stripe,label,newEl("span","›","arrow"));return link;
}
function makeDistrictCard(r){
 const info=districtEvidence(r),c=color(info.party,info.margin);
 const link=newEl("a",null,"district-card");link.href=urlForDistrict(r.id);
 let top=newEl("div",null,"top"),mark=newEl("span",null,"marker");mark.style.background=c.bg;
 top.append(newEl("strong",r.at_large?r.state+" At-Large":r.id),mark);
 const status=newEl("div",info.text,"status");
 const sub=newEl("div",info.source+" · "+info.sub,"sub");
 const footer=newEl("div",null,"bottom");
 footer.append(newEl("span",r.official_2026_candidate_snapshot?"Candidates source-checked":"2026 candidate slate pending"));
 footer.append(newEl("span","Explore →"));
 link.append(top,status,sub,footer);
 link.title=r.id+": "+info.source+". "+info.text;
 return link;
}
function insertMetric(container,values){
 const cells=container.querySelectorAll(".metric b");
 values.forEach((v,i)=>{if(cells[i])cells[i].textContent=String(v)});
}
function title(suffix){document.title=suffix+" | The Political Life & Times"}
function err(message){const area=$("view-content")||$("state-cards")||$("district-details");if(area)area.replaceChildren(newEl("p",message,"notice-error"));}
function renderNational(a){
 title("All 435 U.S. House districts");
 insertMetric($("metrics"),["435","50",fmt(a["2026_official_ballot_offices"]),a["2026_polled_districts"]]);
 const board=$("state-tiles"),list=$("state-list");
 a.states.forEach(s=>{board.append(makeStateTile(s));list.append(makeStateLink(s))});
 const input=$("state-search");input.addEventListener("input",()=>{
   let term=input.value.trim().toLocaleLowerCase();
   list.replaceChildren();
   a.states.filter(s=>s.name.toLowerCase().includes(term)||s.code.toLowerCase().includes(term)).forEach(s=>list.append(makeStateLink(s)));
   if(!list.children.length)list.append(newEl("p","No states match that search.","footnote"));
 });
 $("atlas-updated").textContent="EVIDENCE ASSEMBLED "+a.generated_at.slice(0,10)+" · ORIGINAL SOURCE SNAPSHOTS";
}
function renderState(a){
 let code=(new URLSearchParams(location.search).get("state")||"").trim().toUpperCase();
 let state=a.states.find(x=>x.code===code);
 if(!state){err("This is not one of the 50 states. Choose a state from the House atlas.");return}
 title(state.name+" — all House districts");
 $("state-title").textContent=state.name+" · U.S. House";
 $("state-desc").textContent=state.district_count+" seats · open any district for its verified 2026 candidate slate, published polls, previous results and data-source notes.";
 $("state-back").href=urlForState(code);
 const pres=state["2024_presidential_actual"];
 $("state-history").textContent="2024 statewide presidential vote: "+(pres.winner_party==="D"?"Democratic":"Republican")+" +"+one(Math.abs(pres.dem_margin_pp))+" percentage points (historical, not 2026 district polling).";
 insertMetric($("metrics"),[state.district_count,state["2026_verified_house_nominee_offices"],state["2026_house_poll_count"],state["2026_congressional_map_changed"]?"REVISED":"UNCHANGED"]);
 const rows=a.districts.filter(x=>x.state===code).sort((a,b)=>a.district.localeCompare(b.district));
 let grid=$("district-cards"),select=$("district-filter");
 function paint(){
  let filter=select.value,shown=rows.filter(x=>filter==="all"||(filter==="poll"&&x.district_specific_2026_polls.length)||
    (filter==="ballot"&&x.official_2026_candidate_snapshot)||(filter==="historical"&&x["2024_house_result_on_prior_boundaries"]?.same_2026_geography));
  grid.replaceChildren();shown.forEach(r=>grid.append(makeDistrictCard(r)));
  if(!shown.length)grid.append(newEl("div","No district records in this filter. An empty filter does not mean there is no election.","callout"));
  $("district-count").textContent=shown.length+" / "+rows.length+" House districts";
 }
 select.addEventListener("change",paint);paint();
 if(window.PoliticalHouseGeoMap)window.PoliticalHouseGeoMap.render(code,rows,districtEvidence,color);
 if(state["2026_congressional_map_changed"]){
  let callout=$("boundary-caution");
  callout.hidden=false;
  callout.textContent="NEW 2026 MAP: "+state.name+" changed its congressional boundaries. The 2024 House district results use previous lines and do not color today's districts. Only actual 2026 district-specific polling can provide a current-geometry colored margin.";
 }
}
function candidatePanel(r){
 let panel=$("candidate-panel");
 const b=r.official_2026_candidate_snapshot;
 if(!b){
   panel.append(newEl("p","The state-qualified November 2026 candidate slate has not yet been independently transcribed for this office. FEC registrations do not prove ballot access."));
 }else{
   const head=b.contest_status==="unopposed_no_general_ballot"?"Unopposed office — no November ballot contest":"Government-source candidate snapshot";
   panel.append(newEl("p",head+" · reviewed "+b.reviewed_at,"eyebrow"));
   const list=newEl("div",null,"candidates");
   b.candidates.forEach(c=>{
     let line=newEl("div",null,"candidate"),badge=newEl("span",partyName(c.party),"party "+(c.party==="DEM"?"dem":c.party==="REP"?"rep":""));
     line.append(newEl("strong",c.name),badge);list.append(line);
   });panel.append(list);
   if(b.candidates.some(c=>c.party==="WRI"))panel.append(newEl("p","WRI denotes a qualified write-in; the person's name is not printed on the ballot.","footnote"));
   if(b.source_url)addLink(panel,"Open the original state election-office candidate document ↗",b.source_url,"src").target="_blank";
 }
 panel.append(newEl("p",r.registered_fec_filings_2026+" FEC candidate registration"+(r.registered_fec_filings_2026===1?"":"s")+" indexed for this district in the 2026 filing master. Registrations can include withdrawn, unsuccessful and duplicate filings; this is not a count of qualified candidates.","footnote"));
}
function pollPanel(r){
 const box=$("poll-panel");
 const polls=r.district_specific_2026_polls||[];
 if(!polls.length){
   box.append(newEl("p","No individually sourced 2026 House poll has yet passed this desk's source-review process for this district. This is not a claim that no poll exists."));
   box.append(newEl("p","A national generic-ballot poll or forecast probability is never substituted for a district poll.","footnote"));
   return;
 }
 box.append(newEl("p",polls.length+" published 2026 poll record"+(polls.length===1?"":"s")+" in our evidence ledger. Original releases checked directly and secondary public poll compilations are distinguished below; neither is a forecast.","footnote"));
 polls.forEach(p=>{
   const block=newEl("article",null,"callout");
   let hdr=newEl("div",null,"poll-head");
   const compiled=p.source_tier==="public_compilation_not_original_checked";
   hdr.append(newEl("strong",p.pollster),newEl("small",compiled?"PUBLIC COMPILATION · listed "+p.reported_date+" · sample not given":p.start_date+" – "+p.end_date+" · "+p.sample_size+" "+p.population));
   block.append(hdr);
   let vals=[...p.candidates].sort((x,y)=>y.pct-x.pct);
   for(const c of vals){
     const row=newEl("div",null,"poll-candidate");
     const clr=color(c.party,c.pct);
     row.append(newEl("span",c.name+" ("+partyName(c.party)+")","name"),newEl("span",one(c.pct)+"%","pct"));
     const track=newEl("div",null,"progress"),fill=newEl("span");fill.style.width=c.pct+"%";fill.style.background=c.party==="D"?"#3165a8":c.party==="R"?"#af4843":"#83928e";track.append(fill);
     row.append(track);block.append(row);
   }
   const margin=vals[0].pct-vals[1].pct;
   block.append(newEl("p",p.question_type==="generic_house"?"Generic district House-party question; this is NOT a named-candidate lead.":margin===0?"Poll reports a tie":vals[0].name+" leads by "+one(margin)+" percentage points in this reported poll.","footnote"));
   if(compiled)block.append(newEl("p","SECONDARY EVIDENCE: People's Poll lists this as the most recently reported poll in the district and attributes its records to a New York Times compilation. We have not independently verified this original survey's sample, field dates, sponsor or question wording.","footnote"));
   block.append(newEl("p",p.sponsor?"Survey sponsor: "+p.sponsor:compiled?"Survey sponsor: not independently confirmed from public compilation.":"Survey sponsor not specified in the reviewed source.","footnote"));
   block.append(newEl("p",p.method_note||"","footnote"));
   let link=addLink(block,compiled?"Original publication link provided by compilation ↗":"Original published survey ↗",p.source_url,"src");link.target="_blank";link.rel="noopener noreferrer";
   if(compiled){let a=addLink(block," · View public polling compilation ↗",p.compilation_url,"src");a.target="_blank";a.rel="noopener noreferrer";}
   box.append(block);
 });
 box.append(newEl("p","Single polls, including internal and partisan-sponsored surveys, can have sizable uncertainty. Leads should not be interpreted as win probabilities.","footnote"));
}
function resultPanel(r,state){
 const box=$("result-panel");
 const h=r["2024_house_result_on_prior_boundaries"];
 if(!h){
   box.append(newEl("p","No 2024 House result row was available in the independently collected MEDSL district extract for this office. No margin will be manufactured."));
 }else{
   const comparable=h.same_2026_geography;
   if(!comparable)box.append(newEl("div","IMPORTANT: This result used the 2024 district boundaries. "+state.name+" changed its House map for 2026, so the result cannot be used as a 2026 district margin.","callout"));
   box.append(newEl("div","2024 winner: "+h.winner+" ("+partyName(h.party)+")","big-margin"));
   if(h.dem_two_party_margin_pp!=null){
     const margin=h.dem_two_party_margin_pp,ds=Math.max(0,h.dem_votes),rs=Math.max(0,h.rep_votes),sum=ds+rs;
     box.append(newEl("p","2024 two-party House margin: "+(margin>0?"D":"R")+" +"+one(Math.abs(margin))+" percentage points"+(!comparable?" · OLD BOUNDARIES":"")));
     if(sum>0){let bar=newEl("div",null,"vote-bar");let left=newEl("span",null,"dem"),right=newEl("span",null,"rep");left.style.width=(100*ds/sum)+"%";right.style.width=(100*rs/sum)+"%";bar.append(left,right);box.append(bar);}
   }else{
     box.append(newEl("p","No valid two-party margin is reported for this election (for example, if only one major party ran). The winner alone does not establish a numeric partisan margin.","footnote"));
   }
   box.append(newEl("p","Democratic votes: "+fmt(h.dem_votes)+" · Republican votes: "+fmt(h.rep_votes)+" · Other votes: "+fmt(h.other_votes||0),"footnote"));
   if(h.source_url){let link=addLink(box,"Original-source-derived 2024 House return ↗",h.source_url,"src");link.target="_blank";link.rel="noopener noreferrer";}
 }
 box.append(newEl("p","Statewide 2024 presidential outcome (not a district result): "+voters(state)+".","footnote"));
}
function renderDistrict(a){
 let id=(new URLSearchParams(location.search).get("district")||"").trim().toUpperCase();
 const r=a.districts.find(x=>x.id===id);
 if(!r){err("District not found. The House atlas covers 435 voting House seats, including at-large seats such as AK-00. Return to the national atlas.");return;}
 const state=a.states.find(s=>s.code===r.state);
 title(r.id+" — House district election profile");
 const titleNode=$("district-title");titleNode.textContent=r.at_large?state.name+" at-large House seat":state.name+"'s "+parseInt(r.district,10)+(Number(r.district)%10===1&&r.district!=="11"?"st":Number(r.district)%10===2&&r.district!=="12"?"nd":Number(r.district)%10===3&&r.district!=="13"?"rd":"th")+" Congressional District";
 $("district-subtitle").textContent=r.id+" · November 3, 2026 · race data & original sources";
 $("state-link").href=urlForState(r.state);$("state-link").textContent="← All "+state.name+" districts";
 const current=districtEvidence(r),clr=color(current.party,current.margin);
 let badge=$("leader-badge");badge.textContent=current.source.toUpperCase()+" · "+current.text;badge.style.background=clr.bg;badge.style.color=clr.fg;
 $("district-updated").textContent="Evidence assembled "+a.generated_at.slice(0,10)+" · "+current.sub;
 insertMetric($("metrics"),[r.district_specific_2026_polls.length,r.official_2026_candidate_snapshot?r.official_2026_candidate_snapshot.candidates.length:"—",
  fmt(r.registered_fec_filings_2026),r["2026_boundaries_revised"]?"NEW":"OLD"]);
 if(r["2026_boundaries_revised"]){
   let box=$("map-warning");box.hidden=false;box.textContent="2026 district geography changed in "+state.name+". A 2024 race with the same district number may include different voters. We do not use its margin as a 2026 forecast or shade for this district.";
 }
 candidatePanel(r);pollPanel(r);resultPanel(r,state);
 const stateIds=a.districts.filter(x=>x.state===r.state).sort((x,y)=>x.district.localeCompare(y.district));
 const n=stateIds.findIndex(x=>x.id===r.id),prev=stateIds[(n-1+stateIds.length)%stateIds.length],next=stateIds[(n+1)%stateIds.length];
 $("prev-district").href=urlForDistrict(prev.id);$("prev-district").textContent="← "+prev.id;
 $("next-district").href=urlForDistrict(next.id);$("next-district").textContent=next.id+" →";
}
function init(){
 const page=document.body.dataset.housePage;
 readAtlas().then(a=>{
   if(page==="atlas")renderNational(a);
   else if(page==="state")renderState(a);
   else if(page==="district")renderDistrict(a);
 }).catch(ex=>{err("The source-verified House data could not be loaded. No placeholder winners or poll numbers will be shown.");console.error("House desk:",ex)});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
