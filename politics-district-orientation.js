/* District-specific geographic orientation. Evidence-backed; no invented boundary descriptions. */
(()=>{"use strict";
const editions={
 "CA-12":{
  eyebrow:"CALIFORNIA / THE EAST BAY EDITION",
  heading:"Oakland, Berkeley and the inner East Bay",
  deck:"California's 12th Congressional District is in Alameda County, on the eastern shore of San Francisco Bay. Oakland and Berkeley anchor the district; other communities include Alameda, Emeryville, Albany, Piedmont and San Leandro. Congressional lines may divide cities, so the actual district outline below determines which addresses fall inside.",
  context:"LOCATE IT",mapLabel:"East Bay · Alameda County",
  places:["Oakland — the district's principal urban center","Berkeley — university city north of Oakland","Alameda — island city beside Oakland","Emeryville and Albany — smaller East Bay municipalities","Piedmont and San Leandro — additional communities in the district"],
  features:[
   ["THE LANDSCAPE","San Francisco Bay's eastern shoreline, Oakland's dense neighborhoods, university communities, port and transportation corridors."],
   ["THE CIVIC CHARACTER","The Port of Oakland, UC Berkeley, BART connections and diverse residential neighborhoods shape regional conversations about jobs, housing, transit and public services."],
   ["THE 2026 MAP","California Proposition 50 created the congressional lines used for the November 2026 election. The new congressional term begins January 3, 2027; do not mistake the former CA-12 outline for the election map."]
  ],
  official:"https://sdmg.senate.ca.gov/committeehome/2025-congressional-districts/congressional-district-12-2025",
  election:"https://www.sos.ca.gov/elections/california-redistricting"
 }
};
const id=(new URLSearchParams(location.search).get("district")||"").toUpperCase(),data=editions[id];
if(!data){
 // A real geographic edition for every remaining district: official Census polygon
 // and shared House atlas facts, never a fabricated town list or generic race label.
 const node=document.getElementById("district-local-orientation");
 if(node && /^[A-Z]{2}-[0-9]{2}$/.test(id)){
  Promise.all([
   fetch("politics-house-atlas.json",{cache:"no-cache"}).then(x=>{if(!x.ok)throw Error("atlas");return x.json()}),
   fetch("politics-geometry/"+id.slice(0,2)+".geojson",{cache:"force-cache"}).then(x=>{if(!x.ok)throw Error("geography");return x.json()}),
   fetch("data/politics-district-communities.json",{cache:"no-cache"}).then(x=>x.ok?x.json():null).catch(()=>null)
  ]).then(([atlas,geo,communityData])=>{
   const route=atlas.districts.find(x=>x.id===id);
   const state=atlas.states.find(x=>x.code===id.slice(0,2));
   if(!route||!state)return;
   const field=geo.meta?.field;
   const feature=geo.features?.find(x=>id.slice(0,2)+"-"+String(x.properties?.[field]).padStart(2,"0")===id);
   if(!feature)return;
   const name=state.name+(route.at_large?" · At-large":" · "+Number(route.district)+(Number(route.district)%100>=11&&Number(route.district)%100<=13?"th":({1:"st",2:"nd",3:"rd"}[Number(route.district)%10]||"th"))+" Congressional District");
   const lat=Number(feature.properties?.CENTLAT),lon=Number(feature.properties?.CENTLON);
   const location=Number.isFinite(lat)&&Number.isFinite(lon)?
    "Official Census geographic reference point: "+Math.abs(lat).toFixed(2)+"°"+(lat>=0?"N":"S")+", "+Math.abs(lon).toFixed(2)+"°"+(lon>=0?"E":"W")+".": 
    "Explore the official congressional boundaries in the interactive atlas below.";
   const verifiedPlaces=communityData?.districts?.[id]?.communities||[];
   const verifiedNeighborhoods=communityData?.districts?.[id]?.neighborhoods||[];
   const displayPlaces=verifiedPlaces.length?verifiedPlaces:verifiedNeighborhoods;
   const localNeighborhood=!verifiedPlaces.length&&verifiedNeighborhoods.length>0;
   const cleanPlace=name=>name.replace(/ (?:city|town|village|CDP|borough|municipality)$/i,"")
     .replace(/_/g," ").replace(/[A-Z]{3,}/g,w=>w[0]+w.slice(1).toLowerCase());
   const named=displayPlaces.slice(0,6).map(x=>cleanPlace(x.name));
   const revised=route["2026_boundaries_revised"];
   const frame=document.createElement("div");frame.className="orientation-national-edition";
   const kicker=document.createElement("span");kicker.className="orientation-kicker";kicker.textContent=state.name.toUpperCase()+" / DISTRICT FIELD GUIDE";
   const heading=document.createElement("h2");heading.textContent=name;
   const description=document.createElement("p");description.className="orientation-deck";
   description.textContent="One of "+state.district_count+" congressional district"+(state.district_count===1?"":"s")+" in "+state.name+". This edition follows its actual mapped communities, verified candidates, historical results and local reporting.";
   const columns=document.createElement("div");columns.className="orientation-columns";
   const place=document.createElement("section");place.className="orientation-places";
   const pt=document.createElement("h3");pt.textContent="Locate this district";
   const p1=document.createElement("p");
   p1.textContent=named.length?
     (localNeighborhood?"Source-verified neighborhood reference points: ":"Census-verified community reference points: ")+named.join(", ")+". "+
     "The exact district outline determines which blocks are included; these names do not imply full-community containment.":
     "The district outline is verified. More neighborhood geography is still being researched. "+location;
   if(named.length){
    const list=document.createElement("ul");list.className="orientation-verified-places";
    for(const p of displayPlaces.slice(0,9)){
      const li=document.createElement("li");li.textContent=cleanPlace(p.name);list.append(li);
    }
    place.append(pt,p1,list);
   }else place.append(pt,p1);
   const link=document.createElement("a");link.className="orientation-map-link";link.href="#dossier-map";link.textContent="See the actual district outline, cities and roads ↓";
   place.append(link);
   const facts=document.createElement("section");facts.className="orientation-facts";
   const fact=(title,body)=>{const article=document.createElement("article");const h=document.createElement("h3");const p=document.createElement("p");h.textContent=title;p.textContent=body;article.append(h,p);return article};
   facts.append(
    fact("THE GEOGRAPHY",named.length?"Reference points for "+named.slice(0,3).join(", ")+" fall inside the official district outline. Explore the map for streets and neighborhood detail.":"Official Census polygons define this district; community-level detail awaits verified neighborhood mapping."),
    fact("THE ELECTORATE",revised?"The district was redrawn for 2026. Older election results may describe different voters.":"Historical votes are labeled by election year and never presented as current polling."),
    fact("THE REPORTING","District-specific articles appear only after their local connection and publisher are confirmed. Missing coverage is not filled with unrelated headlines.")
   );
   columns.append(place,facts);
   const source=document.createElement("p");source.className="orientation-source";
   const a=document.createElement("a");a.href=geo.meta?.source_url||"https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer";a.target="_blank";a.rel="noopener noreferrer";a.textContent="Official Census boundary source ↗";
   source.append("SOURCE / VERIFIED 2026 GEOGRAPHY · ",a);
   if(verifiedPlaces.length){const gaz=document.createElement("a");gaz.href=communityData.census_gazetteer_url;gaz.textContent="Census 2026 named places ↗";gaz.target="_blank";gaz.rel="noopener noreferrer";source.append(" · ",gaz);}
   if(verifiedNeighborhoods.length){const near=document.createElement("a");near.href=verifiedNeighborhoods[0].source_url;near.textContent="Local neighborhood geography ↗";near.target="_blank";near.rel="noopener noreferrer";source.append(" · ",near);}
   frame.append(kicker,heading,description,columns,source);
   node.replaceChildren(frame);node.hidden=false;
  }).catch(error=>console.warn("District orientation source unavailable:",error));
 }
 return;
}
const node=document.getElementById("district-local-orientation");if(!node)return;
const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt)n.textContent=txt;return n};
node.hidden=false;node.classList.add("has-verified-orientation");
const head=el("header","orientation-heading");
head.append(el("span","orientation-kicker",data.eyebrow),el("h2",null,data.heading),el("p","orientation-deck",data.deck));
const grid=el("div","orientation-columns");
const left=el("div","orientation-places");
left.append(el("h3",null,"A reader's guide to the district"));
const ul=el("ul");data.places.forEach(p=>ul.append(el("li",null,p)));left.append(ul);
const anchor=el("a","orientation-map-link","Explore the precise 2026 district map ↓");anchor.href="#dossier-map";left.append(anchor);
const right=el("div","orientation-facts");
for(const [title,body]of data.features){const a=el("article");a.append(el("h3",null,title),el("p",null,body));right.append(a)}
grid.append(left,right);
const footer=el("p","orientation-source","GEOGRAPHY SOURCES · ");
const a=el("a",null,"California Senate official 2026 district map ↗");a.href=data.official;a.target="_blank";a.rel="noopener noreferrer";
const b=el("a",null,"California Secretary of State redistricting ↗");b.href=data.election;b.target="_blank";b.rel="noopener noreferrer";
footer.append(a,document.createTextNode(" · "),b);
node.replaceChildren(head,grid,footer);
})();
