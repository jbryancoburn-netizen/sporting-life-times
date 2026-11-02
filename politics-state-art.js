/* The Political Life & Times · 50 state silhouette watermarks from the same
 * Census district GeoJSON archive used by the interactive map.
 * These shapes are GEOGRAPHY ONLY: never election predictions.
 */
(function(){
"use strict";
const NS="http://www.w3.org/2000/svg";
const registry=new Map();
const pending=new Map();
const elem=(tag)=>document.createElementNS(NS,tag);
function shapeFor(code,cssClass){
 const svg=elem("svg");
 svg.setAttribute("viewBox","0 0 320 240");
 svg.setAttribute("preserveAspectRatio","xMidYMid meet");
 svg.setAttribute("aria-hidden","true");
 svg.classList.add("state-outline-svg");
 if(cssClass)for(const cl of cssClass.split(/\s+/))if(cl)svg.classList.add(cl);
 const use=elem("use");
 use.setAttribute("href","#political-state-shape-"+code);
 svg.append(use);
 return svg;
}
function eachRing(geometry,callback){
 if(!geometry)return;
 if(geometry.type==="Polygon")geometry.coordinates.forEach(callback);
 else if(geometry.type==="MultiPolygon")geometry.coordinates.forEach(poly=>poly.forEach(callback));
}
function generate(code,json,expected){
 if(json?.type!=="FeatureCollection"||json?.meta?.state!==code||!Array.isArray(json.features)||
    json.features.length!==expected)throw Error("Official state geography does not match the "+code+" seat ledger");
 const rings=[];
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const feature of json.features){
  eachRing(feature.geometry,ring=>{
   if(!Array.isArray(ring)||ring.length<3)return;
   const xy=[];
   for(const point of ring){
    if(!Array.isArray(point)||point.length<2)continue;
    const rawX=Number(point[0]),y=Number(point[1]);
    if(!Number.isFinite(rawX)||!Number.isFinite(y))continue;
    const x=code==="AK"&&rawX>0?rawX-360:rawX;
    // A longitude degree is shorter than a latitude degree, particularly in
    // Michigan's north. Drawing raw lon/lat as x/y stretches the Upper Peninsula
    // into a fake cartoon. Project the real Census rings to Web Mercator.
    const mercatorY=Math.log(Math.tan(Math.PI/4+y*Math.PI/360))*180/Math.PI;
    if(!Number.isFinite(mercatorY))continue;
    xy.push([x,mercatorY]);minX=Math.min(minX,x);maxX=Math.max(maxX,x);
    minY=Math.min(minY,mercatorY);maxY=Math.max(maxY,mercatorY);
   }
   if(xy.length>=3)rings.push(xy);
  });
 }
 if(!rings.length||!(maxX>minX&&maxY>minY))throw Error("No usable boundary polygon");
 const scale=Math.min(288/(maxX-minX),204/(maxY-minY));
 const left=(320-(maxX-minX)*scale)/2,top=(240-(maxY-minY)*scale)/2;
 const parts=[];
 for(const ring of rings){
  // The archived TIGER polygons are already geometry-simplified; retain all
  // vertices to preserve the entire state, including discontiguous islands.
  let part="";
  ring.forEach(([x,y],i)=>{
   const X=(left+(x-minX)*scale).toFixed(2),Y=(240-top-(y-minY)*scale).toFixed(2);
   part+=(i?"L":"M")+X+" "+Y;
  });
  parts.push(part+"Z");
 }
 const defs=elem("svg");
 defs.setAttribute("aria-hidden","true");
 defs.setAttribute("width","0");
 defs.setAttribute("height","0");
 defs.classList.add("political-state-shape-defs");
 defs.style.cssText="position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
 const symbol=elem("symbol");
 symbol.id="political-state-shape-"+code;
 symbol.setAttribute("viewBox","0 0 320 240");
 const path=elem("path");
 path.setAttribute("d",parts.join(" "));
 path.setAttribute("fill","currentColor");
 path.setAttribute("fill-rule","evenodd");
 symbol.append(path);defs.append(symbol);
 document.body.append(defs);
 registry.set(code,true);
}
async function prepare(code,expected){
 if(registry.has(code))return true;
 if(pending.has(code))return pending.get(code);
 const work=(async()=>{
   try{
    const response=await fetch("politics-geometry/"+code+".geojson",{cache:"force-cache"});
    if(!response.ok)throw Error("Census polygon unavailable");
    generate(code,await response.json(),expected);
    return true;
   }catch(error){
    console.warn("State silhouette unavailable; keeping typographic design",code,error.message);
    return false;
   }
 })();
 pending.set(code,work);
 return work;
}
window.PoliticsStateArt=Object.freeze({create:shapeFor,prepare});
})();
