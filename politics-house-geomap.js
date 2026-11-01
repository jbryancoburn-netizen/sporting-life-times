/* The Political Life & Times: source-verified Census congressional district
 * geometry. Draws the official 2026 120th Congress electoral shapes with
 * Missouri's 2024/2025-vintage fallback after September 2026 court action.
 * Shading comes solely from the separate, attributed House evidence ledger.
 * Neither map area nor color represents a victory probability.
 */
(function(){
"use strict";
const NS="http://www.w3.org/2000/svg";
const node=id=>document.getElementById(id);
const svgEl=(tag)=>document.createElementNS(NS,tag);
const fmt=n=>Number(n).toLocaleString("en-US");
function lon(state,value){return state==="AK"&&value>0?value-360:value;}
function toView(state,all){
 const pts=[];
 for(const r of all)for(const poly of r.polygons)for(const ring of poly)for(const p of ring)
   pts.push([lon(state,p[0]),p[1]]);
 if(!pts.length)throw Error("No valid coordinate rings");
 const minLon=Math.min(...pts.map(x=>x[0])),maxLon=Math.max(...pts.map(x=>x[0]));
 const minLat=Math.min(...pts.map(x=>x[1])),maxLat=Math.max(...pts.map(x=>x[1]));
 if(!Number.isFinite(minLon)||!Number.isFinite(maxLon)||maxLon-minLon>85||maxLat-minLat>45)
   throw Error("Unexpected Census coordinate span for "+state);
 const cos=Math.cos((minLat+maxLat)/2*Math.PI/180);
 const w=(maxLon-minLon)*cos,h=maxLat-minLat;
 if(w<=0||h<=0)throw Error("Invalid state projection bounds");
 const scale=Math.min(910/w,480/h);
 const pad=18;
 const width=w*scale+pad*2,height=h*scale+pad*2;
 return {width,height,point(p){return [pad+(lon(state,p[0])-minLon)*cos*scale,pad+(maxLat-p[1])*scale]}};
}
function pathData(shape,project){
 const chunks=[];
 for(const poly of shape.polygons)for(const ring of poly){
   let s="";
   for(let i=0;i<ring.length;i++){
     const p=project.point(ring[i]);
     s+=(i?"L":"M")+p[0].toFixed(1)+","+p[1].toFixed(1);
   }
   chunks.push(s+"Z");
 }
 return chunks.join(" ");
}
function numLabel(id){let n=id.split("-")[1];return n==="00"?"AL":String(Number(n));}
function plot(geo,rows,evidence,shade){
 const target=node("district-geo-map");
 if(!target)throw Error("State geographic container not ready");
 const indexed=new Map(rows.map(r=>[r.id,r]));
 const shapes=geo.districts;
 if(geo.status!=="CENSUS_CONGRESSIONAL_BOUNDARIES_ELECTION_2026"||
    geo.forecast_eligible!==false||
    geo.district_count!==rows.length||
    shapes.length!==rows.length||
    new Set(shapes.map(x=>x.id)).size!==rows.length||
    shapes.some(x=>!indexed.has(x.id) || !Array.isArray(x.polygons) || !x.polygons.length))
     throw Error("Census 2026 shapes not aligned with verified House seats");
 if(geo.state==="MO" && geo.vintage!=="119th_2025_predecessor_valid_2026")
     throw Error("Missouri map is not the court-approved 2026 election map");
 if(geo.state!=="MO"&&geo.vintage!=="120th_2026")throw Error("Incorrect 2026 House boundaries");
 const projection=toView(geo.state,shapes);
 const svg=svgEl("svg");svg.setAttribute("viewBox","0 0 "+projection.width+" "+projection.height);
 svg.setAttribute("role","group");svg.setAttribute("aria-label",geo.state+" official congressional district geography for November 2026");
 svg.setAttribute("preserveAspectRatio","xMidYMid meet");svg.classList.add("geo-svg");
 const hover=node("geometry-hover");
 const sorted=[...shapes].sort((a,b)=>a.id.localeCompare(b.id));
 for(const poly of sorted){
   const r=indexed.get(poly.id),obs=evidence(r),c=shade(obs.party,obs.margin);
   const link=svgEl("a");link.setAttribute("href","politics-house-district.html?district="+encodeURIComponent(poly.id));
   link.setAttribute("aria-label",poly.id+": "+obs.source+"; "+obs.text+". Open district page.");
   link.setAttribute("tabindex","0");
   link.classList.add("geo-district");
   const p=svgEl("path");p.setAttribute("d",pathData(poly,projection));
   p.setAttribute("fill",c.bg);p.setAttribute("fill-rule","evenodd");
   p.setAttribute("stroke","#24353c");p.setAttribute("stroke-width","0.8");p.setAttribute("vector-effect","non-scaling-stroke");
   link.append(p);
   if(poly.label_lon_lat){
      const xy=projection.point(poly.label_lon_lat),text=svgEl("text");
      text.setAttribute("x",xy[0].toFixed(1));text.setAttribute("y",xy[1].toFixed(1));
      text.setAttribute("text-anchor","middle");text.setAttribute("dominant-baseline","central");
      text.setAttribute("fill",c.fg);text.setAttribute("stroke","none");
      text.classList.add("geo-number");text.textContent=numLabel(poly.id);
      link.append(text);
   }
   const title=svgEl("title");title.textContent=poly.id+" · "+obs.source+" · "+obs.text;link.append(title);
   const message=()=>{hover.textContent=poly.id+" · "+obs.source+": "+obs.text+" · "+obs.sub+". Open the district for candidates, polls and historical returns."};
   link.addEventListener("mouseover",message);link.addEventListener("focus",message);
   link.addEventListener("mouseout",()=>{hover.textContent="Tap or keyboard-select any district to open its full evidence page."});
   svg.append(link);
 }
 target.replaceChildren(svg);
 const source=geo.vintage==="119th_2025_predecessor_valid_2026"?
   "Census 2025 119th Congress geometry: Missouri's court-approved November 2026 map (2026 Census copy is stale).":
   "Census TIGER/Line 2026: 120th Congress congressional district boundaries.";
 node("geometry-vintage").textContent=source+" "+rows.length+" districts.";
 let zoom=1;
 const update=()=>{
   zoom=Math.max(1,Math.min(10,zoom));
   const w=projection.width/zoom,h=projection.height/zoom;
   const x=(projection.width-w)/2,y=(projection.height-h)/2;
   svg.setAttribute("viewBox",x+" "+y+" "+w+" "+h);
 };
 node("geo-zoom-in").onclick=()=>{zoom*=1.6;update()};
 node("geo-zoom-out").onclick=()=>{zoom/=1.6;update()};
 node("geo-zoom-reset").onclick=()=>{zoom=1;update()};
 svg.addEventListener("wheel",(e)=>{if(e.ctrlKey||e.metaKey){e.preventDefault();zoom*=e.deltaY<0?1.2:1/1.2;update()}},{passive:false});
}
async function render(state,rows,evidence,shade){
 const box=node("district-geo-map");
 if(!box)return;
 try{
  const resp=await fetch("politics-house-geography/"+encodeURIComponent(state)+".json?t="+Date.now(),{cache:"no-store"});
  if(!resp.ok)throw Error("Census source geometry file not yet published");
  const geo=await resp.json();
  if(geo.state!==state)throw Error("Wrong Census state geometry loaded");
  plot(geo,rows,evidence,shade);
 }catch(err){
  box.textContent="The Census 2026 geographic map could not be verified. The district cards and their direct links below remain available.";
  node("geometry-vintage").textContent="Original district geometry unavailable; no replacement map is being guessed.";
  console.warn("Census House map:",err);
 }
}
window.PoliticalHouseGeoMap={render};
})();
