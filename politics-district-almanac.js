/* Political Life & Times — district almanac, actual source records.
 * First-class historical data; no fabricated district-level demographics or predictions.
 */
(()=>{"use strict";
const root=document.getElementById("district-almanac");
const id=new URLSearchParams(location.search).get("district")?.toUpperCase();
if(!root||!id||!/^[A-Z]{2}-(?:[0-9]{2}|AL)$/.test(id))return;
const el=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined&&value!==null)n.textContent=String(value);return n};
const number=value=>Number(value).toLocaleString("en-US",{maximumFractionDigits:0});
const party=x=>({D:"Democrat",R:"Republican",DEM:"Democrat",REP:"Republican",I:"Independent",IND:"Independent",LPF:"Libertarian"}[x]||x||"Undetermined");
const fetchData=async path=>{const r=await fetch(path,{cache:"force-cache"});if(!r.ok)throw Error("Source unavailable: "+path);return r.json()};
const link=(label,url)=>{if(!/^https:\/\//.test(url||""))return el("span","almanac-unavailable","Source not available");const a=el("a",null,label+" ↗");a.href=url;a.target="_blank";a.rel="noopener noreferrer";return a};
const section=(label,title)=>{const s=el("section","almanac-column");s.append(el("span","almanac-eyebrow",label),el("h3",null,title));return s};
const recordHeader=(year,title,tag)=>{const row=el("div","almanac-vote-head");row.append(el("strong","almanac-year",year),el("span","almanac-winner",title),el("span","almanac-vintage",tag));return row};
const rank=(entries,value,key,state)=>{
 if(!Number.isFinite(Number(value))||value===null)return null;
 const valid=entries.filter(r=>Number.isFinite(Number(r[key]))&&r[key]!==null);
 const above=valid.filter(r=>Number(r[key])>Number(value)).length;
 const inState=valid.filter(r=>r.state===state),aboveState=inState.filter(r=>Number(r[key])>Number(value)).length;
 return {national:above+1,total:valid.length,state:aboveState+1,stateTotal:inState.length};
};
function metric(label,value,subtitle){const row=el("div","almanac-metric");row.append(el("span",null,label),el("strong",null,value),el("small",null,subtitle));return row;}
function outcome(row,atlas){
 const area=el("article","almanac-result");
 const sameYear=row.year===2024?atlas?.["2024_house_result_on_prior_boundaries"]:null;
 const named=sameYear?.finalists?.length===2?sameYear.finalists:null;
 const counted=Number(row.dem_votes||0)+Number(row.rep_votes||0)+Number(row.other_votes||0);
 const years=row.year<=2020?"2010 MAP ERA":row.year===2022?"2020 MAP ERA":"2024 MAP";
 const winner=named?named[0].name:row.winner||"Winner not verified";
 area.append(recordHeader(String(row.year),winner+" · "+party(named?named[0].party:row.party_winner),years));
 const fact=el("p","almanac-vote-summary");
 if(named){
  const second=named[1];
  fact.textContent=number(named[0].votes)+" to "+number(second.votes)+" votes · "+number(named[0].votes-second.votes)+"-vote victory over "+second.name+" ("+party(second.party)+")";
 }else if(row.both_major_parties&&row.dem_votes+row.rep_votes>0){
  fact.textContent="Democratic "+number(row.dem_votes)+" · Republican "+number(row.rep_votes)+
    " · Other "+number(row.other_votes||0)+" · "+number(row.total_votes||counted)+" total recorded votes";
 }else{
  fact.textContent="Archived party totals: D "+(row.dem_votes==null?"unavailable":number(row.dem_votes))+
    " · R "+(row.rep_votes==null?"unavailable":number(row.rep_votes))+
    " · Other "+(row.other_votes==null?"unavailable":number(row.other_votes))+
    ". Candidate-to-candidate margin unavailable; no artificial 100% margin.";
 }
 area.append(fact);
 const total=named?named.reduce((s,x)=>s+Number(x.votes),0):Number(row.dem_votes||0)+Number(row.rep_votes||0);
 if(total>0&&(named||row.both_major_parties)){
  const bar=el("div","almanac-vote-track");bar.setAttribute("role","img");
  if(named){
   bar.setAttribute("aria-label",named.map(x=>x.name+": "+number(x.votes)+" votes").join("; "));
   named.forEach((x,i)=>{const seg=el("span","almanac-vote-segment "+(x.party==="D"?"dem":x.party==="R"?"rep":"ind")+(i?" secondary":""));seg.style.width=(100*x.votes/total)+"%";bar.append(seg)});
  }else{
   bar.setAttribute("aria-label",number(row.dem_votes)+" Democratic votes and "+number(row.rep_votes)+" Republican votes");
   for(const [cls,v]of [["dem",row.dem_votes],["rep",row.rep_votes]]){const seg=el("span","almanac-vote-segment "+cls);seg.style.width=(100*v/total)+"%";bar.append(seg)}
  }
  area.append(bar);
 }
 const ref=el("p","almanac-history-source");
 ref.append(link("2024 state-certified finalists",named?sameYear.candidate_vote_source_url:null));
 if(!named)ref.replaceChildren(link("MEDSL archived House election record",row.source_url));
 area.append(ref);return area;
}
function areaGuide(host,places){
 const s=section("THE GEOGRAPHIC REGISTER","Places inside the district");
 const locations=places?.districts?.[id];const list=[...(locations?.neighborhoods?.length?locations.neighborhoods:locations?.communities||[])];
 const lead=el("p","almanac-small",locations?.neighborhoods?.length?
  "Local neighborhood reference points verified within the mapped district. Neighborhood boundaries may cross the district line.":
  "Official Census place reference points inside the district polygon. These are not a ranking by population; a city may extend into another district.");
 s.append(lead);
 if(list.length){const ul=el("ul","almanac-places");for(const item of list.slice(0,14)){const li=el("li",null,item.name.replaceAll("_"," ").replace(/\b[a-z]/g,c=>c.toUpperCase()).replace(/\\bCdp\\b/g,"CDP"));ul.append(li)}s.append(ul);
  if(list.length>14)s.append(el("p","almanac-small","Showing 14 of "+number(list.length)+" mapped reference locations."));}
 else s.append(el("p","almanac-small","Named reference points are still being matched against the current district outline."));
 const sourceUrl=locations?.neighborhoods?.[0]?.source_url||places?.census_gazetteer_url;
 s.append(el("p","almanac-source-note","A geographic reference point does not establish that the entire community belongs to the district."),link("Original community geography",sourceUrl));
 host.append(s);
}
function censusGuide(host,acs){
 const row=acs.districts?.find(x=>x.id===id),s=section("THE PEOPLE / CENSUS REGISTER","The district by the numbers");
 s.append(el("p","almanac-small","2020–2024 ACS estimates on 119th-Congress geography. Rankings compare those same historical vintages, not the 2026 electorate."));
 if(row){
  const metrics=[["Resident population","population_2020_2024_acs_est",v=>number(v)],
   ["Median household income","median_household_income_est",v=>"$"+number(v)],
   ["Adults 25+ with a bachelor's degree or higher","bachelors_plus_age25_pct_est",v=>Number(v).toFixed(1)+"%"]];
  for(const [label,key,format]of metrics){
   if(row[key]===null||!Number.isFinite(Number(row[key])))continue;
   const r=rank(acs.districts,row[key],key,row.state);
   const note=r?"Rank "+r.state+" of "+r.stateTotal+" in state · "+r.national+" of "+r.total+" nationwide":"ACS historical comparison";
   s.append(metric(label,format(row[key]),note));
  }
  if(row.median_household_income_moe_est!==null&&Number.isFinite(Number(row.median_household_income_moe_est)))s.append(el("p","almanac-small","Median income margin of error: ±$"+number(row.median_household_income_moe_est)+". Education-rate margin of error was not recalculated."));
 }else s.append(el("p","almanac-small","Historical ACS record unavailable; no estimate generated."));
 s.append(link("U.S. Census ACS detailed tables",acs.source_url));host.append(s);
}
function ballotGuide(host,atlasRow){
 const s=section("THE CURRENT FIELD / SOURCE CHECK","Candidates on the 2026 ballot");
 const snap=atlasRow?.official_2026_candidate_snapshot,verified=snap?.contest_status==="general_ballot_listed"&&Array.isArray(snap.candidates);
 if(verified){
  const list=el("ul","almanac-candidates");for(const c of snap.candidates){list.append(el("li",null,c.name+" · "+party(c.party)))}s.append(list);
  s.append(el("p","almanac-small","Official election-office snapshot reviewed "+(snap.reviewed_at||"date unavailable")+". This is a candidate list, not an election result."),link("Original state election-office list",snap.source_url));
 }else s.append(el("p","almanac-small","A source-reviewed qualified general-election candidate list has not been entered for this seat. FEC filings are not proof of ballot qualification."));
 host.append(s);
}
function firstFour(history,atlasRow){
 const box=el("div","almanac-vote-list");for(const record of history.filter(r=>r.year>=2018).sort((a,b)=>b.year-a.year)){box.append(outcome(record,atlasRow))}
 if(!box.children.length)box.append(el("p","almanac-small","No archived election totals for 2018–2024 are currently available."));
 return box;
}
async function run(){
 try{
  const [atlas,census,places,dossiers]=await Promise.all([
   fetchData("politics-house-atlas.json"),fetchData("politics-census-inputs.json"),
   fetchData("data/politics-district-communities.json"),fetchData("data/politics-district-dossiers.json")]);
  if(dossiers.schema_version!==1||dossiers.district_count!==435)throw Error("435-district history archive invalid");
  const research=dossiers.districts?.[id];if(!research)throw Error("Missing record for "+id);
  const history=research.history.map(x=>({
    year:x.year,winner:x.winner,party_winner:x.winner_party,
    dem_votes:x.party_votes.D,rep_votes:x.party_votes.R,other_votes:x.party_votes.other,
    total_votes:x.total_votes,both_major_parties:x.contested_major_parties,
    two_party_margin_pp:x.two_party_margin_pp,source_url:x.source_url
  }));
  const row=atlas.districts.find(x=>x.id===id);if(!row)throw Error("District not found in 435-seat atlas");
  const state=atlas.states.find(x=>x.code===row.state);
  const content=el("div","almanac-content");
  const header=el("header","almanac-header");
  header.append(el("span","almanac-eyebrow","THE POLITICAL LIFE & TIMES / THE DISTRICT ALMANAC"),
    el("h2",null,(state?.name||row.state)+" · "+(row.at_large?"At-large congressional district":"Congressional District "+Number(row.district))),
    el("p","almanac-lede","Seven election cycles where records exist. Candidate names, actual counted votes, real Census communities, and comparative resident data—each with its source and geographic vintage."));
  const hsection=section("THE BALLOT BOX / ACTUAL ELECTION RETURNS","The House voting record");
  const hrows=history;
  hsection.append(el("p","almanac-small","Election totals belong to the boundaries used that year. The 2010 and 2020 redistricting eras are not the same electorate; 2024 and 2026 boundary comparability is assessed separately."));
  const status=row["2024_to_2026_geography_comparison"];
  const wording=status==="verified_same_district_blocks"?"Verified: this district kept the same 2024–2026 Census-block assignments.":
    status==="unchanged_state_vintage"?"The state did not redraw its congressional districts for 2026.":
    status==="verified_changed_district_blocks"?"Verified: this district's 2026 Census-block assignments differ from 2024.":
    "Boundary comparison pending for this numbered district; a statewide redraw does not establish that this district changed.";
  hsection.append(el("p","almanac-boundary",wording),firstFour(hrows,row));
  const details=el("details","almanac-older");
  const toggle=el("summary",null,"OPEN THE EARLIER HOUSE ARCHIVE · 2012, 2014, 2016");details.append(toggle);
  let loaded=false;details.addEventListener("toggle",()=>{
   if(!details.open||loaded)return;loaded=true;
   const early=history.filter(x=>x.year<=2016).sort((a,b)=>b.year-a.year);
   if(!early.length){details.append(el("p","almanac-small","No certified or archived result for this period."));return}
   for(const item of early)details.append(outcome(item,row));
   details.append(el("p","almanac-small","Pre-2022 House boundaries must not be treated as the 2026 electorate."));
  });
  hsection.append(details);
  if(research.missing_years?.length)hsection.append(el("p","almanac-small",
    "No archive record for: "+research.missing_years.join(", ")+". Those results are not guessed or carried forward."));
  hsection.append(el("p","almanac-small",
    "MEDSL historical election returns are a research archive. Named same-party 2024 finalists are taken from the state-certified ledger. These are not 2026 election returns."));
  const ancillary=el("div","almanac-side");censusGuide(ancillary,census);areaGuide(ancillary,places);ballotGuide(ancillary,row);
  content.append(hsection,ancillary);root.replaceChildren(header,content);root.hidden=false;
 }catch(error){root.hidden=false;root.replaceChildren(el("p","almanac-small","The district almanac's verified sources did not load. No substitute data have been generated."));console.warn("Almanac evidence unavailable:",error)}
}
if("IntersectionObserver" in window){
 const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();run()}},{rootMargin:"900px"});
 observer.observe(root);
}else run();
})();
