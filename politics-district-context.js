/* Source-backed place & people register for all district editions except the
 * separately researched IA-01 feature. No inferred local politics, no forecasts.
 * 2020-2024 ACS compares 119th Congress boundaries only. */
(()=>{"use strict";
const id=(new URLSearchParams(location.search).get("district")||"").toUpperCase();
const node=document.getElementById("district-census-context");
if(!node||id==="IA-01"||!/^[A-Z]{2}-[0-9]{2}$/.test(id))return;
const el=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=String(txt);return e};
const fmt=new Intl.NumberFormat("en-US",{maximumFractionDigits:0});
const percent=x=>Number(x).toFixed(1)+"%";
const fetchJSON=async path=>{const r=await fetch(path,{cache:"force-cache"});if(!r.ok)throw Error(path+": "+r.status);return r.json()};
Promise.all([
 fetchJSON("politics-house-atlas.json"),
 fetchJSON("politics-census-inputs.json"),
 fetchJSON("data/politics-district-communities.json")
]).then(([atlas,census,communities])=>{
 const state=atlas.states.find(x=>x.code===id.slice(0,2));
 const route=atlas.districts.find(x=>x.id===id);
 const record=census.districts.find(x=>x.id===id);
 const geography=communities.districts[id];
 if(!state||!route||!record||!geography)return;
 const stateRows=census.districts.filter(x=>x.state===state.code);
 const compute=(field,val)=>{
  const peers=stateRows.map(x=>Number(x[field])).filter(x=>Number.isFinite(x)).sort((a,b)=>b-a);
  if(!peers.length||!Number.isFinite(Number(val)))return null;
  const rank=1+peers.filter(x=>x>Number(val)).length;
  return {rank,n:peers.length};
 };
 const named=geography.neighborhoods?.length?geography.neighborhoods:geography.communities||[];
 const prettify=s=>s.replace(/ (?:city|town|village|CDP|borough|municipality)$/i,"")
   .replaceAll("_"," ").replace(/\b[A-Z]{3,}\b/g,x=>x[0]+x.slice(1).toLowerCase());
 const heading=el("header","context-head");
 heading.append(
  el("span","context-kicker","THE DISTRICT / PEOPLE & PLACES"),
  el("h2",null,"Inside the district"),
  el("p",null,"Verified geography and Census comparisons, distinct from election results and polling.")
 );
 const content=el("div","context-columns");
 const communitiesCol=el("div","context-community");
 const title=el("h3",null,geography.neighborhoods?.length?"Neighborhoods on the map":"Communities on the map");
 communitiesCol.append(title);
 if(named.length){
  const list=el("ul","context-place-list");
  for(const place of named.slice(0,9)){const li=el("li");li.append(el("span",null,prettify(place.name)));list.append(li)}
  communitiesCol.append(list);
  const small=el("p","context-fineprint",geography.neighborhoods?.length?
    "Mapped neighborhood reference points, not whole-neighborhood boundaries.":
    "Census place representative points, not whole-city boundaries.");
  communitiesCol.append(small);
 }
 const navigate=el("a","context-map-link","Explore their locations on the official map ↓");
 navigate.href="#dossier-map";communitiesCol.append(navigate);
 const numbers=el("div","context-measures");
 numbers.append(el("h3",null,"The Census register"));
 const metrics=[
  ["Residents",record.population_2020_2024_acs_est,"population_2020_2024_acs_est",x=>fmt.format(x)],
  ["Median household income",record.median_household_income_est,"median_household_income_est",x=>"$"+fmt.format(x)],
  ["Adults with a bachelor's degree or higher",record.bachelors_plus_age25_pct_est,"bachelors_plus_age25_pct_est",percent]
 ];
 const grid=el("div","context-metric-grid");
 for(const [label,value,field,display]of metrics){
  if(!Number.isFinite(Number(value)))continue;
  const fact=el("article","context-metric");
  fact.append(el("span","context-metric-label",label),el("strong","context-metric-value",display(value)));
  const rank=compute(field,value);
  if(rank&&rank.n>1)fact.append(el("small","context-metric-rank","Ranks "+rank.rank+" of "+rank.n+" "+state.name+" House districts for this measure (highest first)"));
  grid.append(fact);
 }
 numbers.append(grid);
 const note=el("p","context-source-note");
 const status=route["2024_to_2026_geography_comparison"];
 note.textContent=status==="verified_changed_district_blocks"?
  "Official block comparisons prove this district's 2026 boundaries differ. The 2020–2024 ACS estimates describe the older geographic area.":
  status==="pending_district_block_comparison"?
  "The state was redrawn but this district's geographic overlap has not yet been verified. These ACS estimates refer to the prior 119th Congress geographic vintage.":
  "2020–2024 ACS estimates describe independently matched district geography. These are demographic estimates, not election returns or vote forecasts.";
 const source=el("a","context-source-link","Census ACS original tables ↗");
 source.href=census.source_url||"https://data.census.gov/";
 source.target="_blank";source.rel="noopener noreferrer";
 numbers.append(note,source);
 content.append(communitiesCol,numbers);
 node.replaceChildren(heading,content);
 node.hidden=false;
}).catch(error=>console.warn("Verified district context unavailable:",error));
})();