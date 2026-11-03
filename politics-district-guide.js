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
 const response=await fetch(path,{cache:"no-cache"});
 if(!response.ok)throw Error("Missing "+path);
 return response.json();
}
function historyRows(host,r,extra,archive,atlas){
 const title=el("div",null,"dossier-module-head");
 title.append(el("span","THE 2022 & 2024 HOUSE RETURNS · ACTUAL VOTES","dossier-overline"),
  el("h3","The real election history"));
 host.append(title);
 const old=r["2024_house_result_on_prior_boundaries"],unopposed=r["2024_unopposed_official_context"];
 const hist=archive?.house||[],get=year=>hist.find(x=>x.id===r.id&&x.year===year);
 const votes22=get(2022);
 const specific=extra?.congressional_history||[];
 const results=[];
 for(const year of [2022,2024]){
  const official=specific.find(x=>x.year===year);
  if(official?.candidates?.length===2){
   results.push({year,people:official.candidates,source:official.source_url,origin:official.source||"State election office",verified:true});continue;
  }
  if(year===2024&&old?.finalists?.length===2){
   results.push({year,people:old.finalists,source:old.candidate_vote_source_url,origin:old.candidate_vote_source_authority,verified:true});continue;
  }
  const x=year===2024?old:votes22;
  const d=x?.dem_votes,g=x?.rep_votes;
  if(x?.both_major_parties&&Number.isFinite(d)&&Number.isFinite(g)&&d>0&&g>0)
   results.push({year,people:[{name:"Democratic candidate",party:"D",votes:d},{name:"Republican candidate",party:"R",votes:g}],
    source:x.source_url||x.source,origin:"MIT Election Data and Science Lab",verified:false});
  else if(x)results.push({year,winner:x.winner||x.winner_name,source:x.source_url||x.source,origin:"MEDSL · incomplete candidate pairing"});
  else if(year===2024&&unopposed)results.push({year,winner:unopposed.winner,source:unopposed.source_url,origin:"Official state return · elected unopposed"});
  else results.push({year,winner:null});
 }
 const grid=el("div",null,"dossier-history-grid");
 for(const x of results){
  const card=el("article",null,"dossier-history-row"),meta=el("div",null,"dossier-history-meta");
  if(x.people){
   const [first,second]=x.people,total=first.votes+second.votes;
   const winner=first.votes>=second.votes?first:second;
   const same=first.party===second.party;
   meta.append(el("strong",String(x.year)),el("span",winner.name+" · "+fmt(Math.abs(first.votes-second.votes))+"-vote win"));
   card.append(meta);
   const bar=el("div",null,"dossier-vote-bar");bar.setAttribute("role","img");
   bar.setAttribute("aria-label",x.people.map(c=>c.name+" "+c.party+" "+fmt(c.votes)+" votes").join("; "));
   x.people.forEach((candidate,index)=>{
    const seg=el("span",null,candidate.party==="D"?"dossier-dem":candidate.party==="R"?"dossier-rep":"dossier-dem");
    seg.style.width=(100*candidate.votes/total).toFixed(3)+"%";
    if(same)seg.style.background=index===0?(candidate.party==="R"?"#9a4439":"#355f8e"):
      (candidate.party==="R"?"#d6a19a":"#92b6d9");
    bar.append(seg);
   });card.append(bar);
   const text=el("div",null,"dossier-vote-legend");
   for(const c of x.people)text.append(el("span",c.name+" ("+c.party+") · "+fmt(c.votes)+" · "+pct(c.votes/total*100)+" of two finalists"));
   card.append(text);
   if(same)card.append(el("p","Contested SAME-PARTY general election. This is a candidate-to-candidate result, not a Democratic-versus-Republican vote share.","dossier-caution"));
   else if(!x.verified)card.append(el("p","Party-level vote totals from MIT/MEDSL; individual losing candidate names were not verified in this source.","dossier-caution"));
  }else{
   meta.append(el("strong",String(x.year)),el("span",x.winner?x.winner+" · winner recorded; no valid two-candidate margin":"No sourced numeric candidate matchup"));card.append(meta);
  }
  if(validSource(x.source))card.append(link((x.origin||"Election source")+" ↗",x.source));
  grid.append(card);
 }
 host.append(grid);
 const comparison=el("div",null,"dossier-history-analysis");
 if(r["2022_to_2024_geography_comparison"]==="unchanged_state_vintage"&&votes22?.both_major_parties&&old?.both_major_parties
   &&Number.isFinite(votes22.two_party_margin)&&Number.isFinite(old.dem_two_party_margin_pp)){
  const swing=Math.round((old.dem_two_party_margin_pp-votes22.two_party_margin)*100)/100;
  const direction=swing>0?"toward Democrats":swing<0?"toward Republicans":"with no net two-party change";
  comparison.append(el("strong",swing===0?"No net shift":Math.abs(swing).toFixed(1)+"-point change "+direction),
    el("p","Comparable 2022–2024 district geography. 2022 D/R vote margin: "+signedParty(votes22.two_party_margin)+
    "; 2024: "+signedParty(old.dem_two_party_margin_pp)+". These are election results, not a 2026 forecast."));
 }else comparison.append(el("p",r["2022_to_2024_geography_comparison"]==="pending_district_vintage_audit"?
  "2022 and 2024 district boundaries require verification before a geographic swing can be calculated.":
  "No valid 2022–2024 Democratic-versus-Republican margin comparison. Same-party elections and unopposed contests are not fabricated into partisan swings."));
 const status=r["2024_to_2026_geography_comparison"];
 comparison.append(el("p",status==="verified_changed_district_blocks"?"2026 boundary audit: official Census-block assignments prove this district changed.":
  status==="pending_district_block_comparison"?"2026 boundary audit: statewide map redrawn; this individual district's change remains unverified.":
  "2026 boundary audit: the 2024 district geography remains comparable, but previous votes are not future predictions."));
 if(old?.both_major_parties){
  const ranked=(atlas?.districts||[]).filter(x=>x["2024_house_result_on_prior_boundaries"]?.both_major_parties&&
   x["2024_house_result_on_prior_boundaries"].dem_votes>0&&x["2024_house_result_on_prior_boundaries"].rep_votes>0)
   .map(x=>({id:x.id,gap:Math.abs(x["2024_house_result_on_prior_boundaries"].dem_votes-x["2024_house_result_on_prior_boundaries"].rep_votes)}))
   .sort((x,y)=>x.gap-y.gap||x.id.localeCompare(y.id));
  const place=ranked.findIndex(x=>x.id===r.id);
  if(place>=0)comparison.append(el("p","2024 closeness ranking: "+(place+1)+" of "+ranked.length+
   " actual contested D/R House elections nationally, ordered by smallest counted vote margin."));
 }
 host.append(comparison);
 const early=hist.filter(x=>x.id===r.id&&(x.year===2018||x.year===2020));
 if(early.length){
  const older=el("details",null,"dossier-earlier-elections");
  older.append(el("summary","Earlier elections, 2018 and 2020 · different maps"));
  for(const row of early.sort((x,y)=>y.year-x.year)){
   const label=row.year+" · "+row.winner_name+" won. "+
    (row.both_major_parties?"D "+fmt(row.dem_votes)+" · R "+fmt(row.rep_votes)+" counted votes.":"No validated two-party share.")+
    " The district number may refer to different territory.";
   older.append(el("p",label));
   if(validSource(row.source))older.append(link("MEDSL "+row.year+" source ↗",row.source));
  }host.append(older);
 }
}
function signedParty(n){return n>0?"D +"+n.toFixed(1):n<0?"R +"+Math.abs(n).toFixed(1):"tied";}
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
function local(host,extra,r,community){
 host.append(el("span","GEOGRAPHY, COMMUNITIES AND CHARACTER","dossier-overline"),el("h3","Where you are—and what makes it different"));
 if(!extra){
  const named=Array.isArray(community?.communities)?community.communities:[];
  const neighborhoods=Array.isArray(community?.neighborhoods)?community.neighborhoods:[];
  if(named.length||neighborhoods.length){
   host.append(el("p","The mapped reference points for these places fall within the district's official congressional polygon. Cities and neighborhoods can cross district lines; this does not claim all their residents are represented by the same member.","dossier-local-deck"));
   const display=list=>{
     const ul=el("ul",null,"dossier-community-list");
     for(const p of list.slice(0,14)){
       const name=p.name.replace(/ (?:city|town|village|CDP|borough|municipality)$/i,"")
         .replace(/_/g," ").replace(/[A-Z]{3,}/g,w=>w[0]+w.slice(1).toLowerCase());
       ul.append(el("li",name));
     }
     host.append(ul);
   };
   if(named.length){
     host.append(el("h4","Cities and communities — 2026 Census Gazetteer"));
     display(named);
     host.append(link("Official Census 2026 places ↗","https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html"));
   }
   if(neighborhoods.length){
     host.append(el("h4","Neighborhood areas and local landmarks"));
     display(neighborhoods);
     host.append(link("Source: local planning neighborhood map ↗",neighborhoods[0].source_url));
   }
   if(community?.geographic_rule)warn(host,community.geographic_rule);
  }else warn(host,"Verified neighborhood-level detail is still being collected. The district boundary on the map is official; no speculative towns have been added.");
  return;
 }
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
function officialMap(r,extra,community){
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
  // Named locations are plotted at documented town coordinates; the polygons
  // remain U.S. Census data. Marker layers do not imply county boundaries.
  const list=$("dossier-map-town-links");if(list)list.replaceChildren();
  const existing=Array.isArray(extra?.map_places)?extra.map_places:[];
  const official=Array.isArray(community?.communities)?community.communities:[];
  const neighborhoods=Array.isArray(community?.neighborhoods)?community.neighborhoods:[];
  const places=(existing.length?existing:[...official,...neighborhoods])
    .filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)).slice(0,16);
  const fallbackLayer=L.layerGroup().addTo(map);
  for(const p of places){
    const pin=L.circleMarker([p.lat,p.lon],{radius:6,color:"#fff",weight:2,fillColor:"#b54b40",fillOpacity:1});
    pin.addTo(fallbackLayer);
    pin.bindTooltip(p.name,{direction:"top",permanent:false,opacity:.95});
    if(list){
      const button=el("button",p.name.replace(/ (?:city|town|village|CDP|borough|municipality)$/i,"").replace(/_/g," ").replace(/[A-Z]{3,}/g,w=>w[0]+w.slice(1).toLowerCase()),"dossier-town-zoom");button.type="button";
      button.addEventListener("click",()=>{map.flyTo([p.lat,p.lon],9,{duration:.5});pin.openTooltip();});
      list.append(button);
    }
  }
  map.fitBounds(shape.getBounds(),{padding:[24,24],maxZoom:9});
  const source=$("dossier-map-source");
  if(source){source.replaceChildren(link("Census 120th Congressional District geometry ↗",data.meta.source_url));}
  requestAnimationFrame(()=>map.invalidateSize());
  if(r.id==="IA-01"&&window.PoliticalGeoStory?.attach){
   window.PoliticalGeoStory.attach({map,shape,route:r,extra,fallbackLayer}).then(ok=>{
    const detail=$("geo-story-detail-wrap");if(detail)detail.hidden=!ok;
    for(const id of ["geo-story-controls","geo-story-legend","geo-story-status"]){
      const element=$(id);if(element)element.hidden=!ok;
    }
    requestAnimationFrame(()=>map.invalidateSize());
   }).catch(error=>{
    console.warn("Verified county map unavailable:",error);
    const status=$("geo-story-status");
    if(status){
      status.hidden=false;
      status.textContent="County GIS overlay unavailable; the official district outline and town map remain usable. ";
      status.append(link("State of Iowa county GIS ↗","https://geoservices.iowa.gov/arcgis/rest/services/revenue/iowa_counties/FeatureServer/0"));
    }
   });
  }
 }).catch(()=>{
  node.textContent="This district's live map could not load; no approximate map has been substituted.";
 });
}
async function init(){
 const id=(new URLSearchParams(location.search).get("district")||"").trim().toUpperCase();
 if(!/^[A-Z]{2}-\d{2}$/.test(id)||!$("district-dossier"))return;
 const status=$("dossier-status");
 try{
  const atlas=await dataFile("politics-house-atlas.json");
  const [censusResult,guideResult,communitiesResult,historyResult]=await Promise.allSettled([
   dataFile("politics-census-inputs.json"),dataFile("politics-district-guide.json"),
   dataFile("data/politics-district-communities.json"),dataFile("politics-historical-contests.json")
  ]);
  const census=censusResult.status==="fulfilled"?censusResult.value:null;
  const guide=guideResult.status==="fulfilled"?guideResult.value:{districts:{}};
  const communities=communitiesResult.status==="fulfilled"?communitiesResult.value:null;
  const history=historyResult.status==="fulfilled"?historyResult.value:null;
  const r=atlas.districts?.find(x=>x.id===id);if(!r)throw Error("District not found in the official district ledger");
  const extra=guide.districts?.[id];
  const namedCommunity=communities?.districts?.[id]||null;
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
    (namedCommunity?.communities?.length?"Census-verified communities in this district include "+namedCommunity.communities.slice(0,4).map(p=>p.name.replace(/ (?:city|town|village|CDP)$/i,"")).join(", ")+". Place reference points are not complete municipal boundaries.":
    "An original-source guide to the geography, people, historical House results and verified polling.");
  $("district-dossier-title").textContent=extra?.title||"Get to know "+(state?.name||r.state)+"'s "+(r.at_large?"at-large":"District "+Number(r.district))+".";
  $("dossier-kicker").textContent=r.id+" · A FIELD GUIDE TO PLACE, PEOPLE, POLITICS AND PAST ELECTIONS";
  status.textContent="Official Census boundaries · state-verified ballot snapshots · original historical vote sources";
  officialMap(r,extra,namedCommunity);
  local($("dossier-local"),extra,r,namedCommunity);
  historyRows($("dossier-history"),r,extra,history,atlas);
  polling($("dossier-polling"),r);
  if(census)census($("dossier-people"),null,r,census);
  else warn($("dossier-people"),"Census details are temporarily unavailable; district geography remains available.");
 }catch(error){
  status.textContent="The district guide is temporarily unavailable. See the independently sourced race report above and the official links below.";
  console.warn("District guide:",error);
 }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();