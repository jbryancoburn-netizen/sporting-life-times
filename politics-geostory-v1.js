/* POLITICAL LIFE & TIMES • DISTRICT MAP FIELD GUIDE / IA-01
 * Source county polygons from Iowa's official ArcGIS county layer.
 * Geolocation is checked against Iowa Code §40.1 and 20 certified 2024
 * county returns. No approximate districts, candidate models or proxy pins.
 */
(function(){"use strict";
const $=id=>document.getElementById(id),EL=(t,v,c)=>{const x=document.createElement(t);if(v!==undefined&&v!==null)x.textContent=String(v);if(c)x.className=c;return x};
const fmt=n=>Number(n).toLocaleString("en-US"),validURL=u=>typeof u==="string"&&/^https:\/\//.test(u);
const A=(label,u)=>{const x=EL("a",label);x.href=u;x.target="_blank";x.rel="noopener noreferrer";return x};
const partyColor={D:"#3574a4",R:"#af4b46"},nrm=s=>String(s||"").trim().toLowerCase().replace(/\s+county$/,"");
function text(k,v){const el=$(k);if(el)el.textContent=v}
function linkLocal(anchor,label){const x=EL("a",label);x.href=anchor;return x}
function regionFor(extra,county){
 return extra.local_regions?.find(z=>z.counties?.includes(county))||null;
}
function sourceText(host,label,url){
 if(!validURL(url))return;
 const foot=EL("p",null,"geo-story-source");foot.append(A(label+" ↗",url));host.append(foot);
}
function numberLine(label,value,klass){
 const d=EL("div",null,"geo-story-stat "+(klass||""));d.append(EL("span",label),EL("strong",value));return d;
}
function percentage(row){return (100*row.dem/(row.dem+row.rep)).toFixed(1)}
function countyCard(row,extra,desk){
 const root=EL("div",null,"geo-story-card");
 const winner=row.rep>row.dem?"R":"D",margin=Math.abs(row.rep-row.dem);
 root.append(EL("span","COUNTY FILE / 2024 VERIFIED HOUSE VOTE","geo-story-eyebrow"),EL("h4",row.county+" County"));
 const big=EL("div",null,"geo-story-winner "+(winner==="R"?"rep":"dem"));
 big.append(EL("strong",(winner==="R"?"R":"D")+" +"+fmt(margin)),
  EL("span",winner==="R"?"MILLER-MEEKS COUNTY MARGIN":"BOHANNAN COUNTY MARGIN"));
 root.append(big);
 const bar=EL("div",null,"geo-story-vote-share");
 bar.setAttribute("role","img");bar.setAttribute("aria-label",row.county+": Bohannan "+fmt(row.dem)+" votes; Miller-Meeks "+fmt(row.rep)+" votes.");
 const d=EL("span",null,"dem"),r=EL("span",null,"rep");d.style.width=percentage(row)+"%";r.style.width=(100-Number(percentage(row))).toFixed(1)+"%";bar.append(d,r);root.append(bar);
 const stats=EL("div",null,"geo-story-stat-grid");
 stats.append(numberLine("BOHANNAN · D",fmt(row.dem)),numberLine("MILLER-MEEKS · R",fmt(row.rep)),numberLine("TWO-PARTY TOTAL",fmt(row.rep+row.dem)));
 root.append(stats);
 const region=regionFor(extra,row.county);
 if(region){
  const section=EL("div",null,"geo-story-county-context");
  section.append(EL("span","WHERE IT FITS IN THE DISTRICT","geo-story-eyebrow"),EL("h5",region.title),
   EL("p",region.lead),EL("p",region.why));
  section.append(linkLocal("#iowa-place-"+region.slug,"Read the full regional portrait ↓"));
  root.append(section);
 }
 const relevant=(desk?.articles||[]).filter(a=>new RegExp("\\b"+row.county+"\\b","i").test(a.title)||row.county==="Johnson"&&/iowa city/i.test(a.title)).slice(0,2);
 if(relevant.length){const news=EL("div",null,"geo-story-local-coverage");news.append(EL("h5","Reporting naming this county"));
  for(const a of relevant)news.append(A(a.title+" — "+a.source,a.url));root.append(news);}
 const foot=EL("p","2024 major-party votes only; third-party/write-ins excluded from the two-party bar. County colors are 2024 results, not 2026 forecasts.","geo-story-footnote");
 root.append(foot);sourceText(root,"Iowa SOS certified canvass",extra.county_results_2024.source_url);return root;
}
function townCard(town,extra,desk){
 const root=EL("div",null,"geo-story-card");
 root.append(EL("span","TOWN / WORK & COMMUNITY","geo-story-eyebrow"),EL("h4",town.name),
  EL("p",town.description,"geo-story-town-deck"));
 root.append(numberLine("2020 CENSUS · CITY RESIDENTS",fmt(town.population2020),"geo-story-population"));
 root.append(EL("p",town.county+" County · Census incorporated-place geographic label, not an employer facility pin.","geo-story-footnote"));
 const region=regionFor(extra,town.county);
 if(region){root.append(EL("h5","This part of Iowa"),EL("p",region.detail));
  root.append(linkLocal("#iowa-place-"+region.slug,"Read more about the "+region.title.toLowerCase()+" ↓"));}
 if(town.topics?.length){
  const employers=EL("div",null,"geo-story-employers");
  employers.append(EL("h5","Verified community institutions & employers"));
  for(const name of town.topics)employers.append(EL("p",name));
  root.append(employers);
  sourceText(root,"Employer / institution source",town.employer_source);
 }
 const news=(desk?.articles||[]).filter(a=>new RegExp("\\b"+town.name+"\\b","i").test(a.title)).slice(0,2);
 if(news.length){root.append(EL("h5","Recent reporting naming this town"));
 for(const story of news)root.append(A(story.title+" · "+story.source,story.url));}
 else{root.append(EL("p","No individually verified current headline names this town in the district feed.","geo-story-footnote"));}
 sourceText(root,"City label source",town.source_url);
 return root;
}
function openingCountyCard(extra){
 const root=EL("div",null,"geo-story-card");
 root.append(EL("span","2024 ELECTION / COUNTY GEOGRAPHY","geo-story-eyebrow"),
  EL("h4","Twenty counties. Twenty different results."),
  EL("p","Choose a shaded county on the map to see its actual Democratic and Republican House votes, a short regional portrait, and source-linked reporting.","geo-story-town-deck"));
 const summary=EL("div",null,"geo-story-stat-grid");
 summary.append(numberLine("BOHANNAN COUNTY WINS","3"),
  numberLine("MILLER-MEEKS COUNTY WINS","17"),
  numberLine("DISTRICT RESULT","R +799"));
 root.append(summary);
 root.append(EL("p","The blue counties were Johnson, Scott and Jefferson. Miller-Meeks carried the other seventeen. County results reflect the 2024 House election—not polling or the 2026 race.","geo-story-footnote"));
 sourceText(root,"Official county canvass",extra.county_results_2024.source_url);
 return root;
}
function districtNewsCard(desk){
 const node=EL("div",null,"geo-story-card");
 node.append(EL("span","THE NEWS MAP / IA-01","geo-story-eyebrow"),EL("h4","What’s happening across the district"),
  EL("p","These reports cover the congressional district or its communities. A districtwide story is not presented as a story about one particular county."));
 const list=EL("div",null,"geo-story-news-list");
 for(const story of (desk?.articles||[]).slice(0,6)){
  if(!validURL(story.url))continue;
  const item=EL("article");
  item.append(EL("span",story.topic+" · "+story.source),A(story.title+" ↗",story.url));list.append(item);
 }
 node.append(list,linkLocal("#district-service-desk","Browse the full district newsroom ↓"));
 return node;
}
function normalizeFeatures(geo,expected){
 if(!geo||geo.type!=="FeatureCollection"||!Array.isArray(geo.features))throw Error("County layer was not GeoJSON");
 const subset=[],used=new Set();
 for(const feature of geo.features){
  const p=feature?.properties||{};
  const raw=p.name||p.NAME||p.county_name||p.COUNTY_NAME||"";
  const key=nrm(raw);
  if(!expected.has(key)||used.has(key))continue;
  if(!["Polygon","MultiPolygon"].includes(feature?.geometry?.type))throw Error("Invalid shape for "+raw);
  if(!Array.isArray(feature.geometry.coordinates)||!feature.geometry.coordinates.length)throw Error("Empty geometry for "+raw);
  const stateFIPS=String(p.stfips||p.STATE||p.STATEFP||"19");
  if(stateFIPS!=="19")throw Error("Non-Iowa feature");
  used.add(key);subset.push(feature);
 }
 if(used.size!==expected.size)throw Error("State GIS returned "+used.size+" of "+expected.size+" district counties");
 return {type:"FeatureCollection",features:subset};
}
function countyUrl(base,names){
 const where="name IN ("+names.map(n=>"'"+n.replace(/'/g,"''")+"'").join(",")+")";
 return base+"?where="+encodeURIComponent(where)+
  "&outFields=name,stfips,cofips&returnGeometry=true&outSR=4326&geometryPrecision=4&f=geojson";
}
async function readCounties(conf,names){
 const expected=new Set(names.map(nrm));
 // Prefer a published, validated, locally cached official GIS extract.
 const files=["data/politics-ia01-counties.geojson",countyUrl(conf.county_geography.endpoint,names)];
 for(const url of files){
  try{
   const res=await fetch(url,{mode:url.startsWith("https:")?"cors":"same-origin",cache:"no-cache"});
   if(!res.ok)continue;
   const collection=normalizeFeatures(await res.json(),expected);
   return {collection,origin:url.startsWith("https:")?"State of Iowa live GIS":"State of Iowa verified local GIS cache"};
  }catch(error){console.warn("Official Iowa county overlay:",error.message);}
 }
 throw Error("The 20 official county polygons are temporarily unavailable");
}
function makeControl(label,mode,group,select){
 const button=EL("button",label);button.type="button";button.dataset.geoMode=mode;
 button.setAttribute("aria-pressed","false");button.addEventListener("click",()=>select(mode));group.append(button);
 return button;
}
async function attach({map,shape,route,extra,fallbackLayer}){
 if(!map||!shape||route?.id!=="IA-01"||!window.L)return false;
 const [r1,r2]=await Promise.all(["data/politics-ia01-geostory.json","data/politics-district-desk.json"].map(async x=>{
  const res=await fetch(x,{cache:"no-cache"});if(!res.ok)throw Error(x+" not published");return res.json();
 }));
 const conf=r1,desk=r2.districts?.["IA-01"];
 if(conf.district!=="IA-01"||!Array.isArray(extra?.county_results_2024?.rows))throw Error("District source mismatch");
 const rows=extra.county_results_2024.rows,lookup=new Map(rows.map(x=>[nrm(x.county),x]));
 if(rows.length!==20||rows.reduce((s,x)=>s+x.dem,0)!==206156||rows.reduce((s,x)=>s+x.rep,0)!==206955)throw Error("Certified 2024 county totals invalid");
 const countyFeature=await readCounties(conf,rows.map(x=>x.county));
 const controls=$("geo-story-controls"),details=$("geo-story-detail"),status=$("geo-story-status"),legend=$("geo-story-legend");
 if(!controls||!details||!status||!legend)throw Error("Missing map dashboard anchors");
 const countyLayers=L.layerGroup().addTo(map),townLayers=L.layerGroup(),labels=L.layerGroup();
 const counties=new Map(),towns=new Map();
 let activeCounty=null,activeTown=null,mode="votes";
 function selected(county){const row=lookup.get(nrm(county));if(!row)return;
  details.replaceChildren(countyCard(row,extra,desk));activeCounty=county;
  for(const [name,layer] of counties){const r=lookup.get(nrm(name));layer.setStyle({weight:nrm(name)===nrm(county)?3.3:1.15,fillOpacity:nrm(name)===nrm(county)?.46:(.15+.4*Math.abs(r.rep-r.dem)/(r.rep+r.dem))});}
  const l=counties.get(nrm(county));if(l&&mode==="votes"){map.fitBounds(l.getBounds(),{padding:[55,55],maxZoom:9});}
 }
 function chosenTown(name){const pin=towns.get(name);if(!pin)return;
  const town=conf.towns.find(p=>p.name===name);if(!town)return;
  activeTown=name;details.replaceChildren(townCard(town,extra,desk));map.flyTo([town.lat,town.lon],Math.max(map.getZoom(),9),{duration:.45});
  pin.openTooltip();
 }
 function cityPopulationOverview(){
  const root=EL("div",null,"geo-story-card");
  root.append(EL("span","POPULATION CENTERS / 2020 DECENNIAL CENSUS","geo-story-eyebrow"),
   EL("h4","Where are the largest towns?"),
   EL("p","Compare the incorporated cities and explore what each community does. These are city populations, NOT full metropolitan-area populations or 2026 estimates.","geo-story-town-deck"));
  const set=[...conf.towns].sort((a,b)=>b.population2020-a.population2020),highest=set[0].population2020;
  const list=EL("div",null,"geo-story-city-list");
  for(const t of set){
   const button=EL("button",null,"geo-story-city-row");
   button.type="button";button.setAttribute("aria-label","Explore "+t.name+", 2020 Census population "+fmt(t.population2020));
   const label=EL("strong",t.name),track=EL("span",null,"geo-story-city-track"),fill=EL("span",null,"geo-story-city-fill");
   fill.style.width=(100*t.population2020/highest).toFixed(1)+"%";track.append(fill);
   button.append(label,track,EL("span",fmt(t.population2020)));
   button.addEventListener("click",()=>chosenTown(t.name));list.append(button);
  }
  root.append(list);
  sourceText(root,"U.S. Census incorporated-place counts",conf.town_population_source);
  return root;
 }
 const state={origin:countyFeature.origin,complete:countyFeature.collection.features.length};
 const countyGeo=L.geoJSON(countyFeature.collection,{
  style(feature){const row=lookup.get(nrm(feature.properties.name||feature.properties.NAME));
   const margin=Math.abs(row.rep-row.dem)/(row.rep+row.dem);
   return{color:"#fffdfa",weight:1.15,opacity:.9,fillColor:partyColor[row.rep>row.dem?"R":"D"],fillOpacity:.15+.4*margin};},
  onEachFeature(feature,layer){
   const key=nrm(feature.properties.name||feature.properties.NAME),row=lookup.get(key);
   counties.set(key,layer);
   layer.bindTooltip(row.county+" County · "+(row.rep>row.dem?"R":"D")+" +"+fmt(Math.abs(row.rep-row.dem)),{sticky:true});
   layer.on("click",()=>selected(row.county));
   layer.on("mouseover",()=>layer.setStyle({weight:2.8,color:"#273d51"}));
   layer.on("mouseout",()=>{if(nrm(activeCounty)!==key)layer.setStyle({weight:1.15,color:"#fffdfa"});});
  }
 });countyGeo.addTo(countyLayers);
 for(const town of conf.towns){
  if(!Number.isFinite(town.lat)||!Number.isFinite(town.lon)||!Number.isInteger(town.population2020)||town.population2020<100||!lookup.has(nrm(town.county)))throw Error("Town metadata malformed: "+town.name);
  const pin=L.circleMarker([town.lat,town.lon],{radius:7,color:"#fffefa",weight:2,fillColor:"#244a61",fillOpacity:1});
  pin.bindTooltip(town.name+" · "+fmt(town.population2020)+" people (2020)",{direction:"top",opacity:.95});
  pin.on("click",()=>chosenTown(town.name));pin.addTo(townLayers);towns.set(town.name,pin);
 }
 const group=$("dossier-map-town-links");if(group)group.replaceChildren();
 for(const town of conf.towns){if(!group)break;const btn=EL("button",town.name,"dossier-town-zoom");btn.type="button";
  btn.addEventListener("click",()=>{if(mode!=="towns")selectMode("towns");chosenTown(town.name);});group.append(btn);}
 const buttons=EL("div",null,"geo-story-toolbar");
 const title=EL("span","EXPLORE THE DISTRICT","geo-story-toolbar-title");controls.replaceChildren(title,buttons);
 function selectMode(next){
  mode=next;
  for(const b of buttons.querySelectorAll("button")){const active=b.dataset.geoMode===mode;b.classList.toggle("is-selected",active);b.setAttribute("aria-pressed",active?"true":"false");}
  if(mode==="votes"){
   if(!map.hasLayer(countyLayers))countyLayers.addTo(map);
   if(map.hasLayer(townLayers))map.removeLayer(townLayers);
   if(map.hasLayer(labels))map.removeLayer(labels);
   details.replaceChildren(openingCountyCard(extra));
   map.fitBounds(shape.getBounds(),{padding:[24,24],maxZoom:9});
   activeCounty=null;activeTown=null;
   legend.textContent="2024 COUNTY WINNER · BLUE: BOHANNAN (D) · RED: MILLER-MEEKS (R) · DARKER: LARGER TWO-PARTY MARGIN";
  }else if(mode==="towns"){
   if(map.hasLayer(countyLayers))map.removeLayer(countyLayers);
   townLayers.addTo(map);details.replaceChildren(cityPopulationOverview());
   map.fitBounds(shape.getBounds(),{padding:[24,24],maxZoom:9});
   activeCounty=null;activeTown=null;
   legend.textContent="PIN = CITY CENTER · EMPLOYERS ARE CITY-LEVEL CONTEXT, NOT PLOTTED FACTORY LOCATIONS";
  }else{
   if(map.hasLayer(countyLayers))map.removeLayer(countyLayers);
   if(map.hasLayer(townLayers))map.removeLayer(townLayers);
   details.replaceChildren(districtNewsCard(desk));
   map.fitBounds(shape.getBounds(),{padding:[24,24],maxZoom:9});
   legend.textContent="DISTRICTWIDE NEWS · LOCATION IS NOT INFERRED FROM A POLITICAL HEADLINE";
  }
 }
 makeControl("2024 COUNTY VOTE","votes",buttons,selectMode);
 makeControl("TOWNS & EMPLOYERS","towns",buttons,selectMode);
 makeControl("LOCAL REPORTING","news",buttons,selectMode);
 selectMode("votes");
 if(fallbackLayer&&map.hasLayer(fallbackLayer))map.removeLayer(fallbackLayer);
 status.replaceChildren(EL("span","20 of 20 verified county boundaries loaded · "+state.origin+" · 2024 county canvass"));
 if(validURL(conf.county_geography.source_page))status.append(A("Iowa GIS boundaries ↗",conf.county_geography.source_page));
 if(validURL(conf.county_geography.district_counties_source))status.append(A("Iowa Code §40.1 ↗",conf.county_geography.district_counties_source));
 const source=$("dossier-map-source");if(source)source.append(" · County GIS: State of Iowa");
 const reset=$("geo-story-reset");if(reset)reset.addEventListener("click",()=>selectMode("votes"));
 window.PoliticalGeoStoryLast={counties:state.complete,towns:towns.size,countyTotals:{dem:206156,rep:206955},modes:3,geometrySource:state.origin};
 return true;
}
window.PoliticalGeoStory=Object.freeze({attach,normalizeFeatures,countyUrl,countyCard,townCard,districtNewsCard});
})();