/* Political Life & Times / ELECTION NIGHT • PLACE DESK
 * An original art-directed district feature, built from Census TIGER polygon
 * geometry + 2024 actual House results. No AI imagery or invented geography.
 */
(function(){"use strict";
const $=id=>document.getElementById(id);
const NS="http://www.w3.org/2000/svg";
const e=(tag,t,cl)=>{const x=document.createElement(tag);if(t!==undefined&&t!==null)x.textContent=String(t);if(cl)x.className=cl;return x;};
const s=tag=>document.createElementNS(NS,tag);
const fmt=n=>Math.round(n).toLocaleString("en-US");
const text=(id,value)=>{const x=$(id);if(x)x.textContent=value};
function segments(geometry){
 if(!geometry||!Array.isArray(geometry.coordinates))return [];
 const parts=[];const coords=geometry.coordinates;
 if(geometry.type==="Polygon")coords.forEach(r=>parts.push(r));
 else if(geometry.type==="MultiPolygon")coords.forEach(p=>p.forEach(r=>parts.push(r)));
 return parts.filter(r=>r.length>=3);
}
function mapArt(root,geometry,district,places=[]){
 let rings=segments(geometry);
 // Alaska's Aleutian Islands cross the 180-degree meridian. Normalize
 // western longitudes for a truthful, continuous geographic depiction.
 if(district.startsWith("AK-"))rings=rings.map(r=>r.map(p=>[p[0]>0?p[0]-360:p[0],p[1]]));
 if(!rings.length)throw Error("No official district polygon");
 const xy=rings.flatMap(r=>r.filter(x=>Number.isFinite(x[0])&&Number.isFinite(x[1])));
 const lons=xy.map(p=>p[0]),lats=xy.map(p=>p[1]);
 const minLon=Math.min(...lons),maxLon=Math.max(...lons),minLat=Math.min(...lats),maxLat=Math.max(...lats);
 // Web Mercator local projection, not raw degrees. Keeps district shape factual.
 const merc=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
 const minY=merc(minLat),maxY=merc(maxLat);
 const width=660,height=470,pad=42,rangeX=Math.max(.001,maxLon-minLon),rangeY=Math.max(.001,maxY-minY);
 const scale=Math.min((width-2*pad)/rangeX,(height-2*pad)/rangeY);
 const offX=(width-rangeX*scale)/2,offY=(height-rangeY*scale)/2;
 const pts=ring=>ring.map((p,i)=>{
  const x=offX+(p[0]-minLon)*scale,y=offY+(maxY-merc(p[1]))*scale;
  return (i?"L":"M")+x.toFixed(1)+" "+y.toFixed(1);
 }).join(" ")+"Z";
 const svg=s("svg");svg.setAttribute("viewBox","0 0 660 470");svg.setAttribute("class","feature-census-svg");
 svg.setAttribute("role","img");svg.setAttribute("aria-label",district+" official U.S. Census congressional district silhouette, projected from archived district boundary coordinates.");
 const defs=s("defs"),pattern=s("pattern");
 pattern.setAttribute("id","feature-grid-"+district);pattern.setAttribute("patternUnits","userSpaceOnUse");
 pattern.setAttribute("width","31");pattern.setAttribute("height","31");
 const lines=s("path");lines.setAttribute("d","M31 0H0V31");lines.setAttribute("class","feature-grid-line");
 pattern.append(lines);defs.append(pattern);svg.append(defs);
 const field=s("rect");field.setAttribute("width",width);field.setAttribute("height",height);
 field.setAttribute("fill","url(#feature-grid-"+district+")");field.setAttribute("opacity",".6");svg.append(field);
 const path=s("path");path.setAttribute("d",rings.map(pts).join(" "));
 path.setAttribute("fill-rule","evenodd");path.setAttribute("class","feature-census-territory");svg.append(path);
 // Boundary drawn directly from source coordinates — no approximated state art.
 const outline=s("path");outline.setAttribute("d",rings.map(pts).join(" "));
 outline.setAttribute("fill-rule","evenodd");outline.setAttribute("class","feature-census-border");svg.append(outline);
 // Town dots are drawn ONLY when a source supplies exact lat/lon (in
 // Iowa: original 2026 Census incorporated-place centroids). No guessed pins.
 const validPlaces=(Array.isArray(places)?places:[]).filter(p=>p&&typeof p.name==="string"&&
  Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.lat>=minLat&&p.lat<=maxLat&&p.lon>=minLon&&p.lon<=maxLon);
 const positions=validPlaces.map(p=>({name:p.name,x:offX+(p.lon-minLon)*scale,
   y:offY+(maxY-merc(p.lat))*scale})).sort((a,b)=>a.y-b.y);
 // Keep labels on distinct lines without moving the authentic marker dots.
 let previous=5;for(const p of positions){p.ty=Math.max(25,p.y,previous+28);previous=p.ty;}
 const excess=positions.length?Math.max(0,positions[positions.length-1].ty-432):0;
 if(excess)positions.forEach(p=>p.ty-=excess);
 for(const p of positions){
  const left=p.x>width*.58,tx=left?p.x-28:p.x+28;
  const g=s("g");g.setAttribute("class","feature-town-pin");
  const leader=s("line");leader.setAttribute("x1",p.x);leader.setAttribute("y1",p.y);
  leader.setAttribute("x2",left?tx+4:tx-4);leader.setAttribute("y2",p.ty-3);
  leader.setAttribute("class","feature-city-leader");g.append(leader);
  const halo=s("circle");halo.setAttribute("cx",p.x);halo.setAttribute("cy",p.y);
  halo.setAttribute("r","6.2");halo.setAttribute("class","feature-city-marker-halo");g.append(halo);
  const dot=s("circle");dot.setAttribute("cx",p.x);dot.setAttribute("cy",p.y);
  dot.setAttribute("r","3.1");dot.setAttribute("class","feature-city-marker");g.append(dot);
  const title=s("title");title.textContent=p.name+" · U.S. Census 2026 incorporated-place centroid";g.append(title);
  const text=s("text");text.setAttribute("x",tx);text.setAttribute("y",p.ty);
  text.setAttribute("text-anchor",left?"end":"start");text.setAttribute("class","feature-city-label");
  text.textContent=p.name;g.append(text);svg.append(g);
 }
 const label=s("text");label.setAttribute("x","28");label.setAttribute("y","450");
 label.setAttribute("class","feature-census-watermark");
 label.textContent=district.replace("-"," / ");svg.append(label);
 root.replaceChildren(svg);
}
async function loadArt(id,places){
 const root=$("feature-terrain");if(!root)return;
 const state=id.slice(0,2),field=state==="MO"?"CD119":"CD120";
 try{
  const res=await fetch("politics-geometry/"+state+".geojson",{cache:"force-cache"});
  if(!res.ok)throw Error("geometry absent");
  const g=await res.json();
  if(g.meta?.state!==state||g.meta?.field!==field)throw Error("geometry vintage mismatch");
  const f=g.features.find(x=>state+"-"+String(x.properties?.[field]).padStart(2,"0")===id);
  if(!f?.geometry)throw Error("specific district geometry not verified");
  mapArt(root,f.geometry,id,places);
  text("feature-map-caption",(Array.isArray(places)&&places.length?"REAL BOUNDARIES + TOWN CENTROIDS":"REAL BOUNDARIES")+" / U.S. CENSUS "+(state==="MO"?"119TH":"120TH")+" CONGRESS");
 }catch(error){
  root.replaceChildren(e("p","Official shape unavailable. No illustrative substitute is used.","feature-map-unavailable"));
  text("feature-map-caption","CENSUS DISTRICT GEOGRAPHY / UNAVAILABLE");
 }
}
function render(){
 const id=(new URLSearchParams(location.search).get("district")||"").trim().toUpperCase();
 if(!/^[A-Z]{2}-\d{2}$/.test(id)||!$("district-feature"))return;
 Promise.all(["politics-house-atlas.json","politics-district-guide.json"].map(async path=>{
  const r=await fetch(path,{cache:"no-cache"});if(!r.ok)throw Error(path);return r.json();
 })).then(([atlas,guide])=>{
  const district=atlas.districts.find(x=>x.id===id);if(!district)return;
  const state=atlas.states.find(x=>x.code===district.state);
  const add=guide.districts?.[id];const history=district["2024_house_result_on_prior_boundaries"];
  const name=state?.name||district.state;
  text("feature-issue",name.toUpperCase()+" / CONGRESSIONAL DISTRICT "+(district.at_large?"AT-LARGE":Number(district.district)));
  text("feature-state-code",district.state);
  text("feature-district-code",district.at_large?"AL":district.district);
  const local=add?.major_communities?.slice(0,4).map(x=>x.name).join(" / ");
  text("feature-towns",local||"THE DISTRICT'S GEOGRAPHY / AN ORIGINAL-SOURCE GUIDE");
  if(add?.counties?.length)text("feature-county-line",add.counties.length+" COUNTIES · "+(add.major_communities||[]).length+" LOCALLY RESEARCHED COMMUNITY GROUPS");
  else text("feature-county-line","435 HOUSE SEATS · THE LOCAL PROFILE / SOURCES FIRST");
  const h=history?.both_major_parties&&history.same_2026_geography&&Number.isFinite(history.dem_votes)&&Number.isFinite(history.rep_votes)?history:null;
  if(h){
   const gap=Math.abs(h.rep_votes-h.dem_votes);
   const winner=h.rep_votes>h.dem_votes?"R":"D";
   const model=window.PoliticsDistrictCharts?.getModel(atlas,{districts:[]},guide,id);
   text("feature-big-number",fmt(gap));
   const big=$("feature-big-number");if(big)big.dataset.digits=String(gap).length;
   text("feature-big-label","VOTES DECIDED THE 2024 HOUSE RACE");
   text("feature-prelude",id==="IA-01"?"A recount. A rematch. A river district.":"How thin was the line between victory and defeat?");
   text("feature-deck",id==="IA-01"?
      "From the University of Iowa to the Quad Cities, twenty southeast Iowa counties. The 2024 House election went to a recount and finished this close.":
      "The difference in actual Republican and Democratic House votes in 2024. Explore the real communities and election record below.");
   text("feature-margin-note",winner==="R"?"REPUBLICAN HOUSE WIN / 2024 ACTUAL":"DEMOCRATIC HOUSE WIN / 2024 ACTUAL");
   text("feature-vote-rep",fmt(h.rep_votes));
   text("feature-vote-dem",fmt(h.dem_votes));
   text("feature-margin-win",winner==="R"?"R +"+fmt(gap):"D +"+fmt(gap));
   if(model?.rank){
    text("feature-rank",String(model.rank.place).padStart(2,"0"));
    text("feature-rank-denom","OF "+model.rank.total+" VERIFIED 2024 HOUSE RACES");
   }else{
    text("feature-rank","—");text("feature-rank-denom","COMPLETE TWO-PARTY 2024 RACES ONLY");
   }
   const row2022=add?.congressional_history?.find(x=>x.year===2022);
   const row2024=add?.congressional_history?.find(x=>x.year===2024);
   const verified2024=row2024?.candidates?.find(x=>x.party==="D")?.votes===h.dem_votes&&
    row2024?.candidates?.find(x=>x.party==="R")?.votes===h.rep_votes;
   if(row2022&&verified2024&&!district["2026_boundaries_revised"]){
    const d=row2022.candidates.find(x=>x.party==="D")?.votes;
    const r=row2022.candidates.find(x=>x.party==="R")?.votes;
    if(Number.isFinite(d)&&Number.isFinite(r)&&d+r>0){
     const priorGap=Math.abs(r-d);
     text("feature-prior",fmt(priorGap)+" VOTES");text("feature-now",fmt(gap)+" VOTES");
     const shrink=priorGap>0?100*(1-gap/priorGap):null;
     text("feature-trend-caption",shrink>0?
      "THE MAJOR-PARTY VOTE GAP SHRANK "+shrink.toFixed(1)+"% FROM 2022 TO 2024.":
      "THE TWO HOUSE ELECTIONS USED THE SAME DISTRICT BOUNDARIES.");
     const bars=$("feature-then-now");
     if(bars){
      bars.hidden=false;
      const then=bars.querySelector(".feature-2022 .feature-evidence-bar");
      const now=bars.querySelector(".feature-2024 .feature-evidence-bar");
      if(then)then.style.width="100%";
      if(now)now.style.width=Math.max(1,100*gap/priorGap)+"%";
     }
    }
   }
  }else{
   // A 2024 district using different boundaries should not be advertised
   // as the margin of the 2026 seat.
   text("feature-prelude","The people and places behind the race.");
   text("feature-big-number","435");const big=$("feature-big-number");if(big)big.dataset.digits="3";text("feature-big-label","DISTRICTS, EACH WITH A DIFFERENT STORY");
   text("feature-deck","Get to know the communities and sourced history before judging a congressional contest. Prior election boundaries may differ.");
   text("feature-margin-note","HISTORICAL BOUNDARIES NEED VERIFICATION");
   text("feature-rank","—");text("feature-rank-denom","HISTORIC VOTE RANK NOT COMPARABLE");
   const d=$("feature-vote-tally");if(d)d.hidden=true;
  }
  text("feature-map-desc",id+" · district boundaries from the official U.S. Census archive");
  if(h&&history.source_url){
   const source=$("feature-election-source");
   if(source){source.href=history.source_url;source.target="_blank";source.rel="noopener noreferrer";}
  }
  loadArt(id,add?.map_places||[]);
 }).catch(error=>{
  console.warn("District cover:",error);
  text("feature-deck","The congressional atlas could not be loaded. Source-linked district research remains available below.");
 });
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",render);else render();
})();