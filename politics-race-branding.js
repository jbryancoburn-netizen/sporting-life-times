/* THE POLITICAL LIFE & TIMES / LOCAL IDENTITY DESK
 * Real state flags (with text fallbacks), official Census district geometry,
 * and party-affiliation emblems. All shapes are geography, never forecast.
 * State flag images: flagcdn.com (US state flags, public domain).
 * Party emblems: Font Awesome Free 6.7.2 (CC BY 4.0), text fallback.
 */
(function(){
"use strict";
const NS="http://www.w3.org/2000/svg";
const byId=id=>document.getElementById(id);
const el=(tag,cl,content)=>{const x=document.createElement(tag);if(cl)x.className=cl;if(content!=null)x.textContent=String(content);return x};
const svgEl=tag=>document.createElementNS(NS,tag);
const atlasGeoCache=new Map();
// These are visual/identity colors, not partisan forecast ratings.
const stateTones={
 AL:["#173c63","#d3aa70"],AK:["#142e64","#efcd5e"],AZ:["#9b3d30","#d5a34a"],
 AR:["#a83b43","#eee5d5"],CA:["#b64c3f","#bd9e59"],CO:["#1e4f87","#d6b452"],
 CT:["#213d74","#e5c37c"],DE:["#327fa8","#daa66b"],FL:["#173d6f","#e9a84f"],
 GA:["#af4145","#d6ae6e"],HI:["#355b8a","#e3ac72"],ID:["#355f83","#d4aa6c"],
 IL:["#276b9c","#cb7c51"],IN:["#1b477f","#d3ac5b"],IA:["#214879","#bb4654"],
 KS:["#2d5182","#e8ad59"],KY:["#174d86","#deb56b"],LA:["#194b74","#d8af67"],
 ME:["#21447b","#e7bb68"],MD:["#a74c35","#dcb153"],MA:["#28587e","#d2b16c"],
 MI:["#214f75","#dfb35b"],MN:["#1f6a88","#90d1c5"],MS:["#29537d","#d9b46c"],
 MO:["#254973","#e5bb71"],MT:["#27477b","#e9b95e"],NE:["#1c5586","#ddb257"],
 NV:["#24558b","#d9af61"],NH:["#274983","#d7b46c"],NJ:["#3d5777","#d8b46f"],
 NM:["#bb503f","#f1c65d"],NY:["#1c4d87","#dcb66c"],NC:["#214b7a","#d8b16b"],
 ND:["#234e7f","#dbb369"],OH:["#1b487b","#dfb45d"],OK:["#487e9f","#dbb163"],
 OR:["#1d4b7f","#d8ad54"],PA:["#1d4271","#e1bb67"],RI:["#26528a","#daa85c"],
 SC:["#1e5084","#e3b96f"],SD:["#266f99","#e6ba59"],TN:["#a83d48","#dcb16f"],
 TX:["#1c4981","#e0b36d"],UT:["#224776","#d8ac65"],VT:["#244a65","#dcb366"],
 VA:["#22467e","#d0aa61"],WA:["#215d59","#d1b46b"],WV:["#234d7a","#d4b36b"],
 WI:["#1c4b89","#dcb669"],WY:["#245283","#d6b569"]
};
const currentTone=code=>stateTones[code]||["#204d78","#d9b56b"];
const unique=arr=>[...new Set(arr)];
function badge(code,state,variant){
 const wrap=el("div","race-place-badge "+(variant||""));
 const flag=el("span","race-flag-frame");
 const img=document.createElement("img");
 img.src="https://flagcdn.com/us-"+code.toLowerCase()+".svg";
 img.alt=state.name+" state flag";
 img.loading="eager";img.decoding="async";
 img.onerror=()=>{img.remove();flag.classList.add("flag-unavailable");};
 flag.append(img,el("span","race-flag-fallback",code));
 const text=el("div","race-place-caption");
 text.append(el("small",null,"STATE EDITION · OFFICIAL FLAG"),
  el("strong",null,state.name.toUpperCase()),
  el("span",null,"THE POLITICAL LIFE & TIMES"));
 wrap.append(flag,text);
 return wrap;
}
function seatChip(r,state){
 const number=Number(r.district);
 const chip=el("div","race-seat-chip");
 chip.append(el("span",null,"U.S. HOUSE / 2026"),el("strong",null,r.at_large?"AT-LARGE":String(number).padStart(2,"0")),
  el("small",null,r.at_large?"STATEWIDE SEAT":"DISTRICT "+number));
 chip.title="Congressional district identifier only; not a race prediction";
 return chip;
}
function flagCredit(){
 const p=el("span","race-brand-credit");
 const a=el("a",null,"State flag artwork");
 a.href="https://flagpedia.net/us-states/download";a.target="_blank";a.rel="noopener noreferrer";p.append(a);
 return p;
}
function partyEmblem(party){
 const known=party==="DEM"||party==="REP";
 const name=party==="DEM"?"Democratic":party==="REP"?"Republican":"Other party";
 const slot=el("span","race-party-feature "+(party==="DEM"?"race-party-blue":party==="REP"?"race-party-red":"race-party-neutral"));
 slot.setAttribute("aria-label",name+" candidate affiliation symbol; not a prediction");
 if(known){
  const img=document.createElement("img");
  img.src="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.7.2/svgs/solid/"+(party==="DEM"?"democrat":"republican")+".svg";
  img.alt="";img.loading="lazy";img.decoding="async";
  img.onerror=()=>{img.remove();};
  slot.append(img);
 }
 slot.append(el("strong",null,party==="DEM"?"D":party==="REP"?"R":"I"));
 return slot;
}
function partyRoster(r,selector){
 const container=document.querySelector(selector);if(!container)return;
 const major=(r.official_2026_candidate_snapshot?.candidates||[])
  .filter(c=>c.party==="DEM"||c.party==="REP")
  .sort((a,b)=>a.party==="DEM"?-1:b.party==="DEM"?1:a.name.localeCompare(b.name));
 if(!major.length)return;
 const cards=[...container.children].filter(x=>x.matches(".front-person,.ia-candidate"));
 for(const c of major){
  const node=cards.find(card=>card.textContent.includes(c.name));
  if(!node||node.querySelector(".race-party-feature"))continue;
  const emblem=partyEmblem(c.party);
  node.classList.add("race-branded-person");
  node.setAttribute("data-party",c.party);
  node.prepend(emblem);
 }
}
function geomRings(geometry){
 if(!geometry)return [];
 if(geometry.type==="Polygon")return geometry.coordinates||[];
 if(geometry.type==="MultiPolygon")return geometry.coordinates.flat(1);
 return [];
}
function keyForFeature(f,field,code){
 const val=f.properties?.[field];
 if(val==null)return "";
 return code+"-"+String(val).padStart(2,"0");
}
function buildCartography(geo,state,id,mini){
 const feats=geo.features,field=geo.meta.field||"CD120";
 const expected=Number(state.district_count);
 if(geo.meta.state!==state.code||feats.length!==expected||!feats.every(f=>f.geometry))throw Error("State geography inventory mismatch");
 const keys=feats.map(f=>keyForFeature(f,field,state.code));
 if(unique(keys).length!==expected||!keys.includes(id))throw Error("Selected congressional district was not in 2026 Census archive");
 const paths=feats.map(f=>({id:keyForFeature(f,field,state.code),rings:geomRings(f.geometry)}));
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 const shifted=paths.map(row=>({...row,rings:row.rings.map(ring=>ring.map(point=>{
  let x=Number(point[0]),y=Number(point[1]);
  if(state.code==="AK"&&x>0)x-=360;
  if(Number.isFinite(x)&&Number.isFinite(y)){
   minX=Math.min(x,minX);maxX=Math.max(x,maxX);minY=Math.min(y,minY);maxY=Math.max(y,maxY);
  }
  return [x,y];
 }))}));
 if(!(maxX>minX&&maxY>minY))throw Error("Invalid state geography bounds");
 const W=mini?170:380,H=mini?118:247,pad=mini?10:18;
 const scale=Math.min((W-2*pad)/(maxX-minX),(H-2*pad)/(maxY-minY));
 const dx=(W-(maxX-minX)*scale)/2,dy=(H-(maxY-minY)*scale)/2;
 const pt=([x,y])=>[(dx+(x-minX)*scale).toFixed(2),(H-dy-(y-minY)*scale).toFixed(2)];
 const svg=svgEl("svg");
 svg.setAttribute("viewBox","0 0 "+W+" "+H);
 svg.setAttribute("class","race-district-geometry"+(mini?" mini":""));
 svg.setAttribute("role","img");
 svg.setAttribute("aria-label",state.name+" 2026 House district boundaries, with "+id+" highlighted; boundaries only, not an election forecast");
 for(const row of shifted){
  const shape=svgEl("path");
  let d="";
  for(const ring of row.rings){
   if(ring.length<3)continue;
   const usable=ring.filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));
   if(usable.length<3)continue;
   d+=usable.map((p,i)=>{const [x,y]=pt(p);return(i?"L":"M")+x+" "+y;}).join("")+"Z";
  }
  if(!d)continue;
  shape.setAttribute("d",d);
  shape.setAttribute("fill-rule","evenodd");
  shape.setAttribute("class",row.id===id?"race-geographic-current":"race-geographic-other");
  shape.setAttribute("data-district",row.id);
  const title=svgEl("title");title.textContent=row.id===id?row.id+" highlighted current seat":row.id+" neighboring seat";shape.append(title);
  svg.append(shape);
 }
 return svg;
}
async function geography(code,state,id,host,mini){
 if(!host)return;
 let future=atlasGeoCache.get(code);
 if(!future){
  future=fetch("politics-geometry/"+code+".geojson",{cache:"force-cache"}).then(r=>{
   if(!r.ok)throw Error("District geometry unavailable");return r.json();
  });
  atlasGeoCache.set(code,future);
 }
 try{
  const svg=buildCartography(await future,state,id,mini);
  host.replaceChildren(svg);
 }catch(error){
  host.replaceChildren(el("span","race-geo-fallback",state.name+" · "+id));
  console.warn("Source-checked district crest unavailable:",code,error.message);
 }
}
function applyTheme(node,r){
 if(!node)return;
 const [primary,trim]=currentTone(r.state);
 node.style.setProperty("--local-primary",primary);
 node.style.setProperty("--local-trim",trim);
 node.classList.add("race-location-"+r.state.toLowerCase());
 node.classList.add("race-location-seat-"+r.id.replace("-","-").toLowerCase());
}
function decorateDistrict({r,state}){
 const iowa=r.state==="IA";
 const area=iowa?byId("iowa-edition"):byId("district-front");
 if(!area)return;
 applyTheme(area,r);
 if(iowa){
  const mast=area.querySelector(".ia-cover-strap");
  const flagbar=el("div","race-identity-row race-identity-iowa");
  flagbar.append(badge(r.state,state,"race-iowa-flag"),seatChip(r,state),flagCredit());
  if(mast)mast.insertAdjacentElement("afterend",flagbar);
  partyRoster(r,".ia-candidate-grid");
  // Keep the separate detailed four-way Iowa SVG: it is already fully clickable.
  const map=area.querySelector(".ia-cover-map");
  if(map){
   map.classList.add("race-local-map");
   const mark=el("strong","race-local-map-id",r.id+" / SELECTED");
   map.prepend(mark);
  }
 }else{
  const banner=area.querySelector(".district-front-banner");
  if(!banner)return;
  const identity=el("div","race-identity-row race-identity-general");
  identity.append(badge(r.state,state),seatChip(r,state));
  const square=el("div","race-identity-map");
  square.setAttribute("aria-label",r.id+" Census district outline");
  square.append(el("span","race-map-loading","DRAWING "+r.id+" DISTRICT OUTLINE…"));
  identity.append(square);
  banner.insertAdjacentElement("afterend",identity);
  geography(r.state,state,r.id,square,false);
  partyRoster(r,".front-faceoff");
 }
}
function decorateState({state,rows}){
 const hero=document.querySelector(".state-graphic-hero");
 if(!hero)return;
 applyTheme(hero,{state:state.code,id:state.code+"-00"});
 const strip=el("div","race-state-signature");
 strip.append(badge(state.code,state),el("span","race-state-signature-count",state.district_count+" U.S. HOUSE "+(state.district_count===1?"SEAT":"SEATS")),flagCredit());
 const lead=hero.querySelector(".state-edition-line");
 if(lead)lead.insertAdjacentElement("afterend",strip);
 const storyCards=[...document.querySelectorAll(".state-brief-card")];
 for(const card of storyCards){
  const id=new URL(card.href,location.href).searchParams.get("district");
  const row=rows.find(x=>x.id===id);
  if(!row)continue;
  applyTheme(card,row);
  const existing=card.querySelector(".state-brief-top");
  if(!existing)continue;
  const geo=el("span","race-story-map","DISTRICT OUTLINE");
  existing.append(geo);
  geography(state.code,state,row.id,geo,true);
  const label=el("span","race-brief-state-id",state.code+" / "+row.district);
  existing.append(label);
 }
}
window.PoliticsRaceBranding=Object.freeze({decorateDistrict,decorateState,buildCartography,partyEmblem});
})();
