/* THE DISTRICT, EXPLAINED · Political Life & Times
 * Official congressional boundaries, source-qualified local communities,
 * historical ACTUAL vote totals, an explicit current-survey file, and U.S. ACS.
 * No extrapolated 2026 winner odds, guessed districts, or synthetic geography.
 */
(function(){"use strict";
const $=id=>document.getElementById(id);
const el=(tag,text,cl)=>{const x=document.createElement(tag);if(text!==undefined&&text!==null)x.textContent=String(text);if(cl)x.className=cl;return x;};
const fmt=n=>Number(n).toLocaleString("en-US",{maximumFractionDigits:0});
const pct=n=>Number(n).toFixed(1)+"%";
const link=(txt,url)=>{const a=el("a",txt);a.href=url;a.target="_blank";a.rel="noopener noreferrer";return a;};
const validSource=url=>typeof url==="string"&&/^https:\/\/[a-z0-9.-]+\//i.test(url);
const warn=(host,text)=>host.append(el("p",text,"dossier-caution"));
async function dataFile(path){
 const response=await fetch(path,{cache:"force-cache"});
 if(!response.ok)throw Error("Missing "+path);
 return response.json();
}
function historyRows(host,r,extra){
 const heading=el("div",null,"dossier-module-head");
 heading.append(el("span","THE RECORD · NOT A FORECAST","dossier-overline"),el("h3","How this district voted"));
 host.append(heading);
 let rows=extra?.congressional_history||[];
 const prior=r["2024_house_result_on_prior_boundaries"];
 if(!rows.length&&prior?.same_2026_geography&&prior?.both_major_parties){
  rows=[{year:2024,candidates:[{party:"R",name:"Republican candidate",votes:prior.rep_votes},{party:"D",name:"Democratic candidate",votes:prior.dem_votes}],source:"MIT Election Data and Science Lab",source_url:prior.source_url,scope:"2024 actual House vote on comparable boundaries"}];
 }
 if(!rows.length){
  warn(host,r["2026_boundaries_revised"]?
   "This district was redrawn for 2026. Older House results under the same number cover different voters, so no misleading history comparison is shown.":
   "Comparable district-level results have not yet been verified in the historical record.");
  return;
 }
 rows=rows.slice().sort((a,b)=>b.year-a.year);
 const grid=el("div",null,"dossier-history-grid");
 for(const row of rows){
  if(!Array.isArray(row.candidates)||row.candidates.length<2)continue;
  const d=row.candidates.find(c=>c.party==="D"),rep=row.candidates.find(c=>c.party==="R");
  if(!d||!rep||!Number.isFinite(Number(d.votes))||!Number.isFinite(Number(rep.votes)))continue;
  const total=Number(d.votes)+Number(rep.votes),margin=Math.abs(Number(d.votes)-Number(rep.votes)),leader=Number(d.votes)>Number(rep.votes)?"Democratic":"Republican";
  const article=el("article",null,"dossier-history-row");
  const meta=el("div",null,"dossier-history-meta");
  meta.append(el("strong",String(row.year)),el("span",leader+" victory · "+fmt(margin)+" votes"));
  article.append(meta);
  const chart=el("div",null,"dossier-vote-bar");chart.setAttribute("role","img");
  chart.setAttribute("aria-label",row.year+" two-party votes: "+fmt(d.votes)+" Democratic and "+fmt(rep.votes)+" Republican.");
  const barD=el("span",null,"dossier-dem"),barR=el("span",null,"dossier-rep");
  barD.style.width=(100*Number(d.votes)/total)+"%";barR.style.width=(100*Number(rep.votes)/total)+"%";
  chart.append(barD,barR);article.append(chart);
  const legend=el("div",null,"dossier-vote-legend");
  legend.append(el("span","D "+fmt(d.votes)+" ("+pct(Number(d.votes)/total*100)+" two-party)"),
    el("span","R "+fmt(rep.votes)+" ("+pct(Number(rep.votes)/total*100)+" two-party)"));
  article.append(legend);
  article.append(link(row.source+" ↗",row.source_url));
  grid.append(article);
 }
 host.append(grid);
 warn(host,"Bars show ONLY the Democratic and Republican votes to compare the two major parties. Minor-party and write-in votes may exist; two-party percentages are not total vote shares. Never compare old boundaries as if they were the same electorate.");
}
function polling(host,r){
 const head=el("div",null,"dossier-module-head");
 head.append(el("span","THE SURVEY FILE / METHODOLOGY MATTERS","dossier-overline"),el("h3","What the polls actually say"));
 host.append(head);
 const candidates=(r.district_specific_2026_polls||[]).filter(p=>p.question_type==="named_house"&&Array.isArray(p.candidates)&&
 p.candidates.some(c=>c.party==="D")&&p.candidates.some(c=>c.party==="R")&&p.candidates.every(c=>Number.isFinite(c.pct)&&c.pct>=0&&c.pct<=100));
 if(!candidates.length){warn(host,"No independently entered named-candidate district survey is available in the current source ledger. That does not prove no poll has been conducted.");return;}
 const poll=candidates[0],verified=poll.source_tier==="original_release_checked"&&poll.source_verified===true;
 const badge=el("p",(verified?"DIRECT PUBLICATION CHECKED":"SECONDARY REPORT · ORIGINAL NOT INDEPENDENTLY CHECKED")+" · "+(poll.pollster||"Pollster not specified")+" · "+(poll.reported_date||"date unavailable"),"dossier-poll-badge");
 host.append(badge);
 const chart=el("div",null,"dossier-poll-bars");const listed=poll.candidates.filter(c=>Number(c.pct)>0);
 const sum=listed.reduce((s,c)=>s+Number(c.pct),0);
 for(const c of listed){
  const row=el("div",null,"dossier-poll-line"),header=el("div",null,"dossier-poll-line-head");
  header.append(el("span",c.name+" · "+c.party),el("strong",pct(c.pct)));
  const track=el("div",null,"dossier-poll-track"),bar=el("span",null,"dossier-poll-"+(c.party==="D"?"dem":c.party==="R"?"rep":"other"));
  bar.style.width=Math.min(100,Number(c.pct))+"%";track.append(bar);row.append(header,track);chart.append(row);
 }
 host.append(chart);
 if(sum<99.9)host.append(el("p",pct(100-sum)+" is not assigned to these listed candidates. It may include undecided voters, other candidates or categories omitted by the source summary; no allocation has been invented.","dossier-poll-unassigned"));
 const note="The original field dates, sample size and sponsor "+((poll.start_date&&poll.sample_size&&poll.sponsor)?"are listed in the available record.":"are not all verified in this desk's record.")+" Poll responses are not win probabilities or an averaged district forecast.";
 warn(host,note);
 if(validSource(poll.source_url))host.append(link("View published survey reference ↗",poll.source_url));
 if(!verified&&validSource(poll.compilation_url))host.append(link("View the secondary polling compilation ↗",poll.compilation_url));
}
function census(host,row,r,acs){
 host.append(el("span","THE PEOPLE / CENSUS ACS 2020–2024","dossier-overline"),el("h3","Life in the district"));
 const d=acs?.districts?.find(x=>x.id===r.id);
 if(!d){warn(host,"Official district-level demographic estimates have not been verified here.");return;}
 const metrics=el("div",null,"dossier-demographics");
 const values=[
 ["Residents, ACS estimate",Number.isFinite(d.population_2020_2024_acs_est)?fmt(d.population_2020_2024_acs_est):"—"],
 ["Median household income",Number.isFinite(d.median_household_income_est)?"$"+fmt(d.median_household_income_est):"—"],
 ["Bachelor's degree or higher, age 25+",Number.isFinite(d.bachelors_plus_age25_pct_est)?pct(d.bachelors_plus_age25_pct_est):"—"]
 ];
 for(const [label,val]of values){const x=el("div",null,"dossier-demographic");x.append(el("span",label),el("strong",val));metrics.append(x);}
 host.append(metrics);
 warn(host,"U.S. Census Bureau American Community Survey, 2020–2024 five-year estimates on 119th Congress district geography. These are not current voter counts, election results, or a 2026 poll."+
 (r["2026_boundaries_revised"]?" CAUTION: This district was redrawn for 2026; these figures describe its PREVIOUS boundary.":""));
 host.append(link("Original Census detailed-table data ↗",acs.source_url));
}
function local(host,extra,r){
 host.append(el("span","GEOGRAPHY, COMMUNITIES AND CHARACTER","dossier-overline"),el("h3","Where you are—and what makes it different"));
 if(!extra){warn(host,"Community-by-community reporting for "+r.id+" is still being source-checked. The interactive map shows real cities, towns, roads and district boundaries. No town lists have been guessed.");return;}
 host.append(el("p",extra.geography_deck,"dossier-local-deck"));
 // Actual geographic photography is never invented or reused for a different
 // district. Display only curated Commons images with verifiable file credits.
 const photos=(Array.isArray(extra.location_photography)?extra.location_photography:[])
  .filter(p=>/^https:\/\/commons\.wikimedia\.org\/wiki\/(?:Special:FilePath\/|File:)/.test(p.image_url||"")&&
    /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(p.source_url||"")&&
    /^https:\/\/creativecommons\.org\/licenses\/by-sa\//.test(p.license_url||""));
 if(photos.length){
  const gallery=el("div",null,"dossier-actual-photo-essay");gallery.setAttribute("aria-label","Verified photographs from communities in this congressional district");
  for(const p of photos){
   const figure=el("figure",null,"dossier-place-photo");
   const photo=el("img");photo.src=p.image_url;photo.alt=p.headline+": "+p.caption;
   photo.loading="lazy";photo.decoding="async";photo.referrerPolicy="no-referrer";
   photo.addEventListener("error",()=>{figure.classList.add("photo-unavailable");});
   const caption=el("figcaption");
   caption.append(el("span",p.place,"dossier-photo-where"),el("strong",p.headline),
     el("span",p.caption,"dossier-photo-description"));
   const credit=el("span",null,"dossier-photo-credit");
   credit.append(link("Photograph: "+p.photographer+" ↗",p.source_url),
     el("span"," · "),
     link(p.license+" ↗",p.license_url),
     el("span"," · "+p.taken));
   caption.append(credit);figure.append(photo,caption);gallery.append(figure);
  }
  host.append(gallery);
 }
 const people=el("div",null,"dossier-local-places");
 for(const c of extra.major_communities||[]){
  const item=el("div",null,"dossier-local-place");item.append(el("strong",c.name),el("span",c.region),el("p",c.note));people.append(item);
 }host.append(people);
 const counties=el("details",null,"dossier-county-list");
 counties.append(el("summary",(extra.counties||[]).length+" counties · view the complete county list"));
 counties.append(el("p",(extra.counties||[]).join(" · ")));
 host.append(counties);
 const context=el("div",null,"dossier-local-character");
 for(const c of extra.character||[]){
  const block=el("div",null,"dossier-character-item");block.append(el("strong",c.title),el("p",c.text));context.append(block);
 }
 host.append(context);
 const sources=el("div",null,"dossier-local-sources");
 sources.append(el("strong","Original geography and historical documentation: "));
 for(const item of extra.sources||[]){if(validSource(item.url))sources.append(link(item.title+" ↗",item.url));}
 host.append(sources);
}
function officialMap(r){
 const node=$("dossier-map");if(!node)return;
 if(!window.L){node.textContent="Map library unavailable. Official Census boundaries remain available from the source link.";return;}
 const state=r.state,field=state==="MO"?"CD119":"CD120",name=state+".geojson";
 fetch("politics-geometry/"+name,{cache:"force-cache"}).then(async response=>{
  if(!response.ok)throw Error("No verified geometry");
  return response.json();
 }).then(data=>{
  if(data?.meta?.state!==state||data?.meta?.field!==field||!Array.isArray(data.features))throw Error("Incorrect Census layer");
  const feature=data.features.find(f=>state+"-"+String(f.properties?.[field]).padStart(2,"0")===r.id);
  if(!feature||!feature.geometry)throw Error("District boundary not certified");
  const map=L.map(node,{scrollWheelZoom:false,attributionControl:true,zoomControl:true,keyboard:true,minZoom:2,maxZoom:16});
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{
   attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
   maxZoom:16,maxNativeZoom:16,detectRetina:false
  }).addTo(map);
  L.geoJSON(data,{interactive:false,style:()=>({color:"#5d7180",weight:1.2,fillColor:"#829eb1",fillOpacity:0.03})}).addTo(map);
  const shape=L.geoJSON(feature,{style:()=>({color:"#102f47",weight:3.2,fillColor:"#245d83",fillOpacity:.14})}).addTo(map);
  shape.eachLayer(layer=>layer.bindTooltip(r.id+" · official congressional district", {sticky:true}));
  map.fitBounds(shape.getBounds(),{padding:[24,24],maxZoom:9});
  const source=$("dossier-map-source");
  if(source){source.replaceChildren(link("Census 120th Congressional District geometry ↗",data.meta.source_url));}
  requestAnimationFrame(()=>map.invalidateSize());
 }).catch(()=>{
  node.textContent="This district's live map could not load; no approximate map has been substituted.";
 });
}
async function init(){
 const id=(new URLSearchParams(location.search).get("district")||"").trim().toUpperCase();
 if(!/^[A-Z]{2}-\d{2}$/.test(id)||!$("district-dossier"))return;
 const status=$("dossier-status");
 try{
  const [atlas,census,guide]=await Promise.all([
   dataFile("politics-house-atlas.json"),dataFile("politics-census-inputs.json"),dataFile("politics-district-guide.json")
  ]);
  const r=atlas.districts?.find(x=>x.id===id);if(!r)throw Error("District not found in the official district ledger");
  const extra=guide.districts?.[id];
  const state=atlas.states?.find(s=>s.code===r.state);
  // Make the local field guide visible in the first viewport, not only below
  // the race graphic. The same bridge works for all 435 shared district URLs.
  const newDeskTitle=$("district-new-desk-title"),newDeskSummary=$("district-new-desk-summary");
  const newDeskGeo=$("district-new-desk-geography");
  if(newDeskTitle)newDeskTitle.textContent=extra?.title||
    (state?.name||r.state)+" · "+(r.at_large?"At-large district":"District "+Number(r.district))+" · get to know the place behind the race.";
  if(newDeskGeo)newDeskGeo.textContent=extra?.counties?.length?
    extra.counties.length+" COUNTIES · "+(extra.major_communities||[]).length+" COMMUNITY PROFILES · 2022–2024 VOTE HISTORY":
    "REAL CENSUS DISTRICT MAP · DEMOGRAPHICS · ACTUAL VOTE HISTORY";
  if(newDeskSummary)newDeskSummary.textContent=extra?.geography_deck||
    "An original-source guide to the geography, people, historical House results and verified polling. Specific towns are displayed only after their locations are researched.";
  $("district-dossier-title").textContent=extra?.title||"Get to know "+(state?.name||r.state)+"'s "+(r.at_large?"at-large":"District "+Number(r.district))+".";
  $("dossier-kicker").textContent=r.id+" · A FIELD GUIDE TO PLACE, PEOPLE, POLITICS AND PAST ELECTIONS";
  status.textContent="Official Census boundaries · state-verified ballot snapshots · original historical vote sources";
  local($("dossier-local"),extra,r);
  historyRows($("dossier-history"),r,extra);
  polling($("dossier-polling"),r);
  census($("dossier-people"),null,r,census);
  officialMap(r);
 }catch(error){
  status.textContent="The district guide is temporarily unavailable. See the independently sourced race report above and the official links below.";
  console.warn("District guide:",error);
 }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();