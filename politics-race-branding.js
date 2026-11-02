/* All-435 race identity: actual Census polygons, state flag graphics and party badges.
   Imagery is sourced, never fabricated candidate portraits. No poll is interpreted as odds. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const N="http://www.w3.org/2000/svg";
const partyName=p=>({DEM:"Democratic",REP:"Republican",IND:"Independent",LIB:"Libertarian",GRE:"Green",NPA:"No party",NPP:"No party",WRI:"Write-in",D:"Democratic",R:"Republican"})[p]||p||"Other";
const el=(tag,cls,txt)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(txt!=null)x.textContent=txt;return x;};
const partyName=p=>({DEM:"Democratic",REP:"Republican",IND:"Independent",LIB:"Libertarian",GRE:"Green",NPA:"No party affiliation",NPP:"No party affiliation",WRI:"Write-in"})[p]||p||"Other";
const named={
 AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",
 HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",
 MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",
 NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",
 SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming"
};
// Two-color treatment inspired by state flags; actual flag image is fetched separately.
const themes={
 AL:["#a7232e","#f5eee1"],AK:["#183c74","#ebc65d"],AZ:["#ba303d","#f6b943"],AR:["#ae2636","#205a9d"],CA:["#b62935","#397c52"],
 CO:["#bd3436","#ebbf49"],CT:["#204e91","#d4be76"],DE:["#18798b","#e8ba46"],FL:["#bb3044","#efae3c"],GA:["#b62d40","#c8a05a"],
 HI:["#284e89","#c0444c"],ID:["#1b5086","#dcb85f"],IL:["#2e659c","#b33c41"],IN:["#143b81","#e2b04d"],IA:["#245a9c","#ba3442"],
 KS:["#254e84","#e7be50"],KY:["#27497a","#dbbd69"],LA:["#2467a2","#d8b77a"],ME:["#23507a","#b89a65"],MD:["#cead44","#ba3140"],
 MA:["#29518c","#bd9f60"],MI:["#2d5a8d","#ddba56"],MN:["#2a5781","#79b7ca"],MS:["#a22c36","#e8bd59"],MO:["#9d3143","#1f4f86"],
 MT:["#24558e","#dfb65b"],NE:["#264a82","#c3a46e"],NV:["#2b5988","#b7ab64"],NH:["#245085","#dfc474"],NJ:["#b88c53","#285482"],
 NM:["#c53b37","#edbd3d"],NY:["#205295","#e2b967"],NC:["#bb343b","#275d91"],ND:["#285287","#e1be59"],OH:["#ae3546","#2e5691"],
 OK:["#3875ab","#bc9861"],OR:["#204b89","#e3b743"],PA:["#1b487e","#d4b76f"],RI:["#d9b34e","#245c88"],SC:["#216d8a","#d9c298"],
 SD:["#3b7caf","#d3bd63"],TN:["#b6303b","#254e88"],TX:["#b72d39","#244d8e"],UT:["#1b5691","#e7b944"],VT:["#2f6c59","#c9ac5e"],
 VA:["#2c568a","#c3a464"],WA:["#285e50","#bd9d5b"],WV:["#e4bd55","#31548c"],WI:["#24579b","#ddb45c"],WY:["#b13342","#2e6390"]
};
const flagFile=code=>"https://commons.wikimedia.org/wiki/Special:FilePath/"+(code==="GA"?"Flag_of_Georgia_(U.S._state)":"Flag_of_"+encodeURIComponent(named[code]||code).replace(/%20/g,"_"))+".svg";
function flag(code,cls="state-flag-image"){
 const img=document.createElement("img");img.className=cls;img.alt=(named[code]||code)+" state flag";
 img.loading="lazy";img.decoding="async";img.referrerPolicy="no-referrer";
 img.src=flagFile(code);
 img.addEventListener("error",()=>{img.hidden=true;const parent=img.parentNode;if(parent&&!parent.querySelector(".state-flag-fallback"))parent.append(el("span","state-flag-fallback",code));},{once:true});
 return img;
}
function branding(code,node){
 const c=themes[code]||["#365a83","#b5a783"];
 node.style.setProperty("--state-primary",c[0]);
 node.style.setProperty("--state-secondary",c[1]);
 return c;
}
function stateInsignia(code,cls="race-state-insignia"){
 const seal=el("div",cls);
 const shape=el("div","state-insignia-shape");
 if(window.PoliticsStateArt)shape.append(window.PoliticsStateArt.create(code));
 else shape.append(el("strong",null,code));
 seal.append(shape,el("b","state-insignia-code",code));
 return seal;
}
function previewEvidence(r){
 const p=(r.district_specific_2026_polls||[]).find(q=>q.question_type==="named_house"&&q.candidates?.filter(c=>c.party==="D").length===1&&q.candidates?.filter(c=>c.party==="R").length===1);
 if(!p)return null;
 const d=p.candidates.find(c=>c.party==="D")?.pct,rep=p.candidates.find(c=>c.party==="R")?.pct;
 if(!Number.isFinite(d)||!Number.isFinite(rep)||d<0||rep<0||d+rep>100.01)return null;
 return {margin:d-rep,source:p.source_tier==="original_release_checked"&&p.source_verified===true?"ORIGINAL POLL":"COMPILED POLL",year:2026};
}
function watch(r){
 const poll=previewEvidence(r);
 const h=r["2024_house_result_on_prior_boundaries"];
 const comparable=h?.same_2026_geography===true&&h.both_major_parties===true&&Number.isFinite(h.dem_two_party_margin_pp);
 const old=comparable?h.dem_two_party_margin_pp:null;
 const split=poll&&old!=null&&poll.margin*old<0;
 const closePoll=poll&&Math.abs(poll.margin)<=6;
 const closePast=old!=null&&Math.abs(old)<5;
 const isWatch=!!(split||closePoll||closePast);
 const category=split?"MIXED SIGNALS":closePoll?"CLOSE POLL":closePast?"CLOSE 2024 RESULT":"SOURCE CHECK";
 // Rankings here prioritize source availability and competitive observations;
 // they are never statistical 2026 win probabilities or model rankings.
 const tier=poll?.source==="ORIGINAL POLL"?0:poll?1:2;
 const distance=poll?Math.abs(poll.margin):old!=null?Math.abs(old):100;
 return {isWatch,category,tier,distance,split:!!split,poll,old};
}
const districtStore=new Map();
async function districtGeo(code){
 if(districtStore.has(code))return districtStore.get(code);
 const request=(async()=>{
  const response=await fetch("politics-geometry/"+code+".geojson",{cache:"force-cache"});
  if(!response.ok)throw Error("Census geometry unavailable");
  const geo=await response.json();
  if(geo.type!=="FeatureCollection"||geo.meta?.state!==code||!Array.isArray(geo.features))
   throw Error("Census state mismatch");
  return geo;
 })();
 districtStore.set(code,request);return request;
}
function ringsOf(geometry){
 if(geometry?.type==="Polygon")return geometry.coordinates;
 if(geometry?.type==="MultiPolygon")return geometry.coordinates.flat();
 return [];
}
function featureCode(feature){
 const p=feature.properties||{};
 const raw=p.CD120??p.CD119;
 const n=Number(raw);
 return Number.isInteger(n)&&n>=0&&n<100?String(n).padStart(2,"0"):null;
}
async function outlineDistrict(r,host){
 try{
  const geo=await districtGeo(r.state);
  const features=geo.features.filter(f=>f.geometry&&featureCode(f)!=null);
  if(!features.length)throw Error("No valid geographic district boundaries");
  const all=[],pieces=[];
  for(const f of features){
   const rings=ringsOf(f.geometry),id=featureCode(f);
   for(const ring of rings){
    if(!Array.isArray(ring)||ring.length<3)continue;
    const coords=ring.map(v=>[r.state==="AK"&&v[0]>0?v[0]-360:v[0],v[1]]).filter(v=>Number.isFinite(v[0])&&Number.isFinite(v[1]));
    if(coords.length<3)continue;
    all.push(...coords);pieces.push({id,coords});
   }
  }
  if(!all.length||!pieces.some(p=>p.id===r.district))throw Error("District not present in Census archive");
  let minx=Infinity,maxx=-Infinity,miny=Infinity,maxy=-Infinity;
  for(const [x,y] of all){minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y);}
  const width=maxx-minx,height=maxy-miny;
  if(width<=0||height<=0)throw Error("Degenerate geometry");
  const scale=Math.min(340/width,244/height);
  const left=(384-width*scale)/2,bottom=(284-height*scale)/2;
  const svg=document.createElementNS(N,"svg");
  svg.setAttribute("viewBox","0 0 384 284");svg.setAttribute("role","img");
  svg.setAttribute("aria-label",(named[r.state]||r.state)+" congressional district map. "+r.id+" highlighted in the 2026 Census-district archive.");
  svg.classList.add("race-district-svg");
  for(const p of pieces){
   const path=document.createElementNS(N,"path");
   const d=p.coords.map(([x,y],i)=>(i?"L":"M")+(left+(x-minx)*scale).toFixed(2)+","+(284-bottom-(y-miny)*scale).toFixed(2)).join("")+"Z";
   path.setAttribute("d",d);path.setAttribute("fill-rule","evenodd");
   path.setAttribute("class",p.id===r.district?"race-map-active":"race-map-neighbor");
   svg.append(path);
  }
  if(!host.isConnected)return;
  host.replaceChildren(svg);
  const desc=el("span","race-map-caption",r.id+" IN "+(named[r.state]||r.state).toUpperCase()+" · CENSUS DISTRICT GEOMETRY");
  host.append(desc);
 }catch(err){
  if(host.isConnected)host.replaceChildren(stateInsignia(r.state,"race-map-fallback"),el("span","race-map-caption","District shape unavailable. State outline shown."));
 }
}
function createIdentity(r,state){
 const brand=el("div","race-identity-strip");
 const flagBox=el("div","race-flag-frame");
 flagBox.append(flag(r.state),el("span","race-flag-label","STATE FLAG"));
 const name=el("div","race-identity-copy");
 name.append(el("small","race-identity-label",state.name.toUpperCase()+" · HOUSE ELECTION"),el("strong","race-identity-district",r.id));
 const mark=stateInsignia(r.state);
 brand.append(flagBox,name,mark);
 return brand;
}
function renderDistrict(r,state){
 const root=$("district-front");if(!root)return;
 branding(r.state,root);
 const w=watch(r);
 root.classList.add(w.isWatch?"race-branded-watch":"race-branded-ordinary");
 const banner=root.querySelector(".district-front-banner");
 if(banner){
  const grid=banner.querySelector(".front-banner-grid");
  if(grid)banner.insertBefore(createIdentity(r,state),grid);
 }
 const context=$("race-experience")?.querySelector(".race-editor-note");
 if(context){
  const board=el("div","race-cartographic");
  board.append(el("span","race-map-title","YOUR DISTRICT · GEOGRAPHIC VIEW"));
  const target=el("div","race-map-canvas","Loading verified district outline…");
  board.append(target);
  context.insertAdjacentElement("afterend",board);
  outlineDistrict(r,target);
 }
 const strip=el("div","race-heatbar "+(w.isWatch?"is-watch":"is-context"));
 strip.append(el("span","race-heaticon",w.isWatch?"◆":"▰"),
  el("span","race-heatname",w.isWatch?w.category:"RESEARCH DESK"),
  el("span","race-heatnote",w.isWatch?
   (w.poll?"A close reported poll or conflicting source evidence. Not model-certified odds.":"The previous comparable election was close; not a current forecast."):
    (w.poll?"A reported district poll is on file; not a certified forecast.":"No close current poll is established by this dataset.")));
 const featured=$("race-experience");
 if(featured)featured.insertBefore(strip,featured.querySelector(".race-experience-top"));
 // Make candidate identity visible before large data and methodology panels.
 const field=$("front-field");
 const metrics=featured?.querySelector(".race-headline-numbers");
 if(field&&metrics){field.classList.add("race-field-promoted");metrics.before(field);}
 // Provide party symbols in candidates; verified portraits stay connected to source-checked ballot identities.
 const all=r.official_2026_candidate_snapshot?.candidates||[];
 if(all.length>2&&field){
  const extras=el("div","race-other-candidates");
  extras.append(el("strong",null,"OTHER OFFICIAL BALLOT CANDIDATES"));
  for(const c of all){
   if(c.party==="DEM"||c.party==="REP")continue;
   const chip=el("span","race-other-candidate");
   chip.append(el("b",null,c.name),el("small",null,partyName(c.party)));
   extras.append(chip);
  }
  field.append(extras);
 }
}
function decorateStateCard(card,r){
 const top=card.querySelector(".state-brief-top");if(!top)return;
 branding(r.state,card);
 const insignia=stateInsignia(r.state,"brief-state-stamp");
 top.prepend(insignia);
 const category=watch(r);
 card.classList.add(category.isWatch?"brief-watch":"brief-record");
 const label=top.querySelector("span");if(label&&category.isWatch)label.textContent="◆ "+category.category+" · NOT FORECAST ODDS";
}
function decorateNationalCard(a,r){
 branding(r.state,a);
 const w=watch(r);
 a.classList.add(w.isWatch?"national-watch":"national-context");
 a.href="politics-house-district.html?district="+encodeURIComponent(r.id);
 const emblem=stateInsignia(r.state,"national-card-insignia");
 emblem.append(flag(r.state,"national-card-flag"));
 a.append(emblem);
 const body=el("div","national-card-body");
 body.append(el("small","national-card-id",r.id+" · "+(named[r.state]||r.state)),
  el("strong","national-card-title",w.split?"POLL & HISTORY DISAGREE":w.poll?"THE DISTRICT POLL":w.old!=null?"THE LAST HOUSE VOTE":"THE RESEARCH FILE"));
 const metric=w.poll?(Math.abs(w.poll.margin).toFixed(1)+" PT REPORTED POLL GAP"):
  (w.old!=null?Math.abs(w.old).toFixed(1)+" PT 2024 HOUSE GAP":"NO COMPARABLE MARGIN");
 body.append(el("span","national-card-stat",metric),el("span","national-card-cta","OPEN EVIDENCE →"));
 a.append(body);
}
window.PoliticsRaceBranding=Object.freeze({named,themes,branding,flag,stateInsignia,watch,renderDistrict,decorateStateCard,decorateNationalCard,outlineDistrict});
})();