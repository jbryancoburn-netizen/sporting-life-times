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
if(!data)return;
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
