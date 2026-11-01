/* The Political Life & Times — official geographic election atlas.
 * National outlines: US-Atlas Census-derived geometries, Albers USA projection.
 * State districts: U.S. Census TIGERweb, 120th Congress (2026) polygons.
 * Missouri uses the 119th Congress's 2025 Census vintage due to the
 * reinstated 2024 electoral plan. No geometry creates electoral forecasts.
 */
(function(){
"use strict";
const FIPS={"AL":"01","AK":"02","AZ":"04","AR":"05","CA":"06","CO":"08","CT":"09","DE":"10","FL":"12","GA":"13","HI":"15","ID":"16","IL":"17","IN":"18","IA":"19","KS":"20","KY":"21","LA":"22","ME":"23","MD":"24","MA":"25","MI":"26","MN":"27","MS":"28","MO":"29","MT":"30","NE":"31","NV":"32","NH":"33","NJ":"34","NM":"35","NY":"36","NC":"37","ND":"38","OH":"39","OK":"40","OR":"41","PA":"42","RI":"44","SC":"45","SD":"46","TN":"47","TX":"48","UT":"49","VT":"50","VA":"51","WA":"53","WV":"54","WI":"55","WY":"56"};
const REVERSE=Object.fromEntries(Object.entries(FIPS).map(([k,v])=>[v,k]));
const ATLAS_URL="https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";
const CENSUS_API="https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer/";
const $=x=>document.getElementById(x);
const escape=String;
function notify(box,message){box.replaceChildren();const p=document.createElement("p");p.className="geography-notice";p.textContent=message;box.append(p);}
function stateMap(a,box){
 if(!window.d3||!window.topojson){notify(box,"Map drawing library did not load. Select a state from the alphabetical directory below.");return;}
 notify(box,"Drawing the geographic U.S. map…");
 fetch(ATLAS_URL).then(r=>{if(!r.ok)throw Error("State boundary service unavailable");return r.json()}).then(topology=>{
   const byId=Object.fromEntries(a.states.map(s=>[FIPS[s.code],s]));
   const shapes=topojson.feature(topology,topology.objects.states).features.filter(f=>byId[String(f.id).padStart(2,"0")]);
   if(shapes.length!==50)throw Error("State geography validation failed: "+shapes.length+" of 50");
   const width=1040,height=640;
   const projection=d3.geoAlbersUsa().fitExtent([[14,20],[width-14,height-20]],{type:"FeatureCollection",features:shapes});
   const path=d3.geoPath(projection);
   box.replaceChildren();
   const svg=d3.select(box).append("svg").attr("viewBox",`0 0 ${width} ${height}`)
     .attr("class","us-shape-svg").attr("role","img")
     .attr("aria-label","Actual geographic outlines of all 50 states, each clickable to open its congressional district map");
   const tooltip=document.createElement("div");tooltip.className="geo-hover";tooltip.hidden=true;box.append(tooltip);
   svg.selectAll("path").data(shapes).join("path").each(function(f){
     const s=byId[String(f.id).padStart(2,"0")];
     const pres=s["2024_presidential_actual"];
     const c=window.HouseGeo.evidenceColor(pres.winner_party,Math.abs(pres.dem_margin_pp));
     const label=s.name+" · "+s.district_count+" House "+(s.district_count===1?"district":"districts")+" · 2024 presidential "+(pres.winner_party==="D"?"D":"R")+" +"+Math.abs(pres.dem_margin_pp).toFixed(1)+" pp";
     d3.select(this).attr("d",path(f)).attr("fill",c.bg).attr("stroke","#f8f7f3").attr("stroke-width","1.4")
       .attr("class","us-state-region").attr("tabindex","0").attr("role","link").attr("aria-label",label+"; press Enter for district map")
       .on("click",()=>location.assign("politics-house-state.html?state="+encodeURIComponent(s.code)))
       .on("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();location.assign("politics-house-state.html?state="+encodeURIComponent(s.code));}})
       .on("pointermove",e=>{
          tooltip.hidden=false;tooltip.textContent=label;
          const r=box.getBoundingClientRect();
          tooltip.style.left=Math.min(e.clientX-r.left+12,r.width-245)+"px";
          tooltip.style.top=Math.max(8,e.clientY-r.top-45)+"px";
       }).on("pointerleave",()=>{tooltip.hidden=true;})
       .on("focus",()=>{tooltip.textContent=label;tooltip.hidden=false;tooltip.style.left="12px";tooltip.style.top="10px";})
       .on("blur",()=>{tooltip.hidden=true;});
     d3.select(this).append("title").text(label);
   });
   svg.selectAll(".geo-label").data(shapes).join("text").attr("class","geo-label")
     .attr("x",f=>path.centroid(f)[0]).attr("y",f=>path.centroid(f)[1])
     .attr("text-anchor","middle").attr("dy",".33em")
     .text(f=>{const code=REVERSE[String(f.id).padStart(2,"0")];return code||""})
     .filter(function(){const box=this.getBBox();return !Number.isFinite(+this.getAttribute("x"))||box.width>25;})
     .remove();
   // State boundaries are the actual Census-derived outlines, not map tiles.
 }).catch(e=>{console.error("National geographic map:",e);notify(box,"Geographic map could not be loaded. The complete clickable state directory remains below.");});
}
function stateDistrictMap(state,rows,evidence,color,urlForDistrict){
 const target=$("state-geometry");if(!target)return;
 if(!window.L){notify(target,"Interactive geography library unavailable. Use the complete district directory below.");return;}
 notify(target,"Loading official congressional boundaries for "+state.name+"…");
 const fips=FIPS[state.code];
 if(!fips){notify(target,"No Census identifier for this state.");return;}
 // In 2026 Missouri elects on its reinstated 2024 plan; ACS 2025 is the
 // preserved 119th-Congress map. The 120th layer is not safe for Missouri.
 const layer=state.code==="MO"?8:0;
 const endpoint=CENSUS_API+layer+"/query";
 const query=new URLSearchParams({
   where:"STATE='"+fips+"'",outFields:"STATE,CD120,CD119,GEOID,NAME",
   returnGeometry:"true",outSR:"4326",geometryPrecision:"4",
   maxAllowableOffset:"0.001",f:"geojson"
 });
 // Query only fields actually on each layer. Querying absent fields causes
 // ArcGIS to fail rather than returning partial geographic evidence.
 query.set("outFields",layer===8?"STATE,CD119,GEOID,NAME":"STATE,CD120,GEOID,NAME");
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),30000);
 fetch(endpoint+"?"+query.toString(),{signal:controller.signal}).then(r=>{if(!r.ok)throw Error("Census service HTTP "+r.status);return r.json()})
 .then(geo=>{
   if(geo.error)throw Error("Census service: "+geo.error.message);
   if(geo.type!=="FeatureCollection"||!Array.isArray(geo.features))throw Error("Invalid geographic data");
   const available=new Map(rows.map(r=>[r.id,r]));
   const districts=geo.features.map(f=>{
     const p=f.properties||{};
     const raw=String(layer===8?p.CD119:p.CD120);
     const id=state.code+"-"+raw.padStart(2,"0");
     return {feature:f,rec:available.get(id),id};
   });
   if(districts.length!==rows.length||districts.some(x=>!x.rec)||
      new Set(districts.map(x=>x.id)).size!==rows.length){
     throw Error("District geometry mismatch: got "+districts.length+" polygons, expected "+rows.length+" valid numbered districts");
   }
   target.replaceChildren();
   const map=L.map(target,{scrollWheelZoom:false,zoomControl:true,attributionControl:false,preferCanvas:false});
   const rendered=L.geoJSON(geo,{
     style:f=>{
       const p=f.properties||{};
       const rec=available.get(state.code+"-"+String(layer===8?p.CD119:p.CD120).padStart(2,"0"));
       const e=evidence(rec),c=color(e.party,e.margin);
       return {color:"#ffffff",weight:1.3,fillColor:c.bg,fillOpacity:0.94,opacity:1};
     },
     onEachFeature:(f,lyr)=>{
       const p=f.properties||{};
       const id=state.code+"-"+String(layer===8?p.CD119:p.CD120).padStart(2,"0");
       const r=available.get(id),ev=evidence(r);
       const title=(r.at_large?state.name+" at-large":id)+" · "+ev.source+" · "+ev.text;
       lyr.bindTooltip(title,{sticky:true,className:"politics-district-tooltip"});
       lyr.on("click",()=>location.assign(urlForDistrict(id)));
       lyr.on("mouseover",()=>lyr.setStyle({weight:3,color:"#17242c",fillOpacity:1}));
       lyr.on("mouseout",()=>rendered.resetStyle(lyr));
       lyr.getElement()?.setAttribute("aria-label",title);
     }
   }).addTo(map);
   const extent=rendered.getBounds();
   if(!extent.isValid())throw Error("Census polygon extent is invalid");
   map.fitBounds(extent,{padding:[20,20],maxZoom:10});
   map.setMaxBounds(extent.pad(.45));
   // Labels positioned within displayed bounds; labels never block clicks.
   rendered.eachLayer(lyr=>{
     const p=lyr.feature?.properties||{};
     const n=String(layer===8?p.CD119:p.CD120).padStart(2,"0");
     const label=n==="00"?"AL":String(parseInt(n,10));
     const center=lyr.getBounds().getCenter();
     L.marker(center,{interactive:false,keyboard:false,icon:L.divIcon({
       className:"district-map-label",html:"<span>"+escape(label)+"</span>",iconSize:[34,22],iconAnchor:[17,11]
     })}).addTo(map);
   });
   const banner=$("geography-source");
   if(banner){
     const note=state.code==="MO"?"Missouri: reinstated earlier congressional plan (Census 119th Congress, 2025 vintage).":"U.S. Census TIGERweb congressional district polygons, 120th Congress (2026 vintage).";
     banner.textContent=note+" Click any outlined district. Zoom with +/-; drag to explore. Shading displays sourced observations, never forecast odds.";
   }
   setTimeout(()=>map.invalidateSize(),100);
 }).catch(e=>{console.error("State congressional geography:",e);notify(target,"Official congressional district geometry unavailable or failed validation. The complete district list below remains clickable; no approximate district boundaries are displayed.");})
 .finally(()=>clearTimeout(timer));
}
window.HouseGeo={national:stateMap,state:stateDistrictMap,evidenceColor:null};
})();
