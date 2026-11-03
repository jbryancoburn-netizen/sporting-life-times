/* District Almanac: source-linked history and geography, never forecasts. */
(()=>{"use strict";
const id=(new URLSearchParams(location.search).get("district")||"").toUpperCase();
const root=document.getElementById("district-factbook");
if(!root||!/^[A-Z]{2}-\d{2}$/.test(id))return;
const E=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e};
const fmt=n=>Number(n).toLocaleString("en-US",{maximumFractionDigits:0});
const val=n=>n!==null&&n!==undefined&&Number.isFinite(Number(n));
const party=p=>({D:"Democrat",R:"Republican",I:"Independent",DEM:"Democrat",REP:"Republican"}[p]||p||"Party unknown");
const A=(parent,label,url)=>{if(typeof url==="string"&&/^https:\/\//i.test(url)){const a=E("a","al-link",label);a.href=url;a.target="_blank";a.rel="noopener noreferrer";parent.append(a)}};
const title=(label,name,sub)=>{const n=E("header","al-head");n.append(E("small","al-kicker",label),E("h3","al-title",name));if(sub)n.append(E("p","al-deck",sub));return n};
const person=s=>String(s||"Unknown").replace(/_/g," ").replace(/\b[A-Z]{3,}\b/g,w=>w[0]+w.slice(1).toLowerCase());
const detail=(part,txt)=>part.append(E("p","al-note",txt));
function context(d){
 const g=d.geography,n=E("aside","al-boundary");n.append(E("strong",null,"THE BOUNDARY RECORD"));
 const status=g.status_2024_2026;
 const message=status==="verified_same_district_blocks"?"Official Census-block overlay confirms unchanged boundaries for this numbered district.":
 status==="verified_changed_district_blocks"?"Official Census-block overlay confirms changed boundaries for this numbered district. Earlier votes remain historical.":
 status==="unchanged_state_vintage"?"No statewide congressional redistricting is recorded between the 2024 and 2026 plans.":
 "State congressional lines changed, but this district's individual overlap with 2024 remains unverified; it is not automatically labeled changed.";
 n.append(E("p",null,message));
 if(g.blocks){n.append(E("small",null,fmt(g.blocks.incoming_blocks)+" Census blocks added · "+fmt(g.blocks.outgoing_blocks)+" removed (unweighted; not voters)."));A(n,"Official map-equivalency source ↗",g.blocks.source_url)}
 return n;
}
function demographics(d){
 const n=E("section","al-demographics");n.append(title("2020–2024 CENSUS ACS","The people, by the numbers","Original 119th-Congress district geography. Ranked against all published congressional districts."));
 const a=d.census;if(!a){detail(n,"No district ACS estimates available.");return n}
 const specs=[["Resident population",a.population,a.population_moe,a.ranks?.residents,false],
 ["Median household income",a.income,a.income_moe,a.ranks?.median_income,true],
 ["Adults 25+ with bachelor's degree",a.bachelors_pct,null,a.ranks?.bachelors_pct,false]];
 const grid=E("div","al-dem-grid");
 specs.forEach(([name,v,moe,rank,money],i)=>{
  const card=E("article","al-stat");card.append(E("small",null,name));
  card.append(E("strong",null,val(v)?(money?"$":"")+(i===2?Number(v).toFixed(1)+"%":fmt(v)):"Unavailable"));
  if(val(moe))card.append(E("span","al-moe","ACS margin of error ±"+(money?"$":"")+fmt(moe)));
  if(rank)card.append(E("p",null,"U.S. rank "+fmt(rank.rank)+"/"+fmt(rank.of)+" · in-state "+fmt(rank.state_rank)+"/"+fmt(rank.state_total)));
  grid.append(card);
 });
 n.append(grid);detail(n,"2020–2024 ACS estimates, not voter registration or 2026 election results. Education-percentage margin of error has not been recomputed.");return n;
}
function election(r){
 const n=E("article","al-election"),yr=E("div","al-year"),facts=E("div","al-votes"),source=E("div","al-source");
 yr.append(E("strong",null,r.year),E("small",null,r.year<=2020?"Prior map era":"2020 map era"));
 if(r.finalists?.length===2){
  const [a,b]=r.finalists;facts.append(E("strong",null,a.name+" defeated "+b.name));
  facts.append(E("p",null,fmt(a.votes)+" to "+fmt(b.votes)+" votes · "+(a.party===b.party?"same-party general election":"two named finalists")+" · "+fmt(r.finalist_gap_votes)+"-vote gap"));
  const track=E("div","al-bar"),tot=a.votes+b.votes;
  track.setAttribute("role","img");track.setAttribute("aria-label",a.name+" "+fmt(a.votes)+" votes, "+b.name+" "+fmt(b.votes)+" votes");
  [a,b].forEach((p,i)=>{const s=E("span",i?"al-runner":"al-first");s.style.width=(p.votes/tot*100)+"%";track.append(s)});facts.append(track);
 }else{
  facts.append(E("strong",null,person(r.winner)+" · "+party(r.winner_party)));
  if(r.contested_major_parties&&val(r.two_party_margin_pp)){
   const d=r.party_votes.D,rep=r.party_votes.R,total=d+rep,m=r.two_party_margin_pp;
   facts.append(E("p",null,"D "+fmt(d)+" / R "+fmt(rep)+" · "+(m>0?"+":"")+m.toFixed(1)+" points Democratic margin"));
   const track=E("div","al-bar");
   track.setAttribute("role","img");track.setAttribute("aria-label","Democratic "+fmt(d)+", Republican "+fmt(rep)+" actual votes");
   const b=E("span","al-dem"),c=E("span","al-rep");b.style.width=d/total*100+"%";c.style.width=rep/total*100+"%";track.append(b,c);facts.append(track);
  }else facts.append(E("p",null,"No verified candidate-to-candidate margin; party totals must not be treated as a 100% victory."));
 }
 if(val(r.total_votes))source.append(E("small",null,fmt(r.total_votes)+" votes reported"));
 A(source,"Source ↗",r.source_url);n.append(yr,facts,source);return n;
}
function history(d){
 const n=E("section","al-history");
 n.append(title("THE HISTORICAL CONGRESSIONAL RECORD","Seven election cycles, when available","Actual House returns from 2012–2024. A district number may have covered very different voters before redistricting."));
 if(!d.history.length){detail(n,"No source-backed past House contest is available.");return n}
 const list=E("div","al-list");d.history.forEach(r=>list.append(election(r)));n.append(list);
 const a=d.history.find(x=>x.year===2022),b=d.history.find(x=>x.year===2024);
 if(a?.contested_major_parties&&b?.contested_major_parties&&d.geography.status_2022_2024==="unchanged_state_vintage"){
  const delta=b.two_party_margin_pp-a.two_party_margin_pp;
  n.append(E("p","al-change","2022 → 2024 on comparable district lines: Democratic two-party margin "+(delta>=0?"increased ":"decreased ")+Math.abs(delta).toFixed(1)+" points. Not a 2026 forecast."));
 }
 if(d.missing_years.length)detail(n,"No source-backed contest row for "+d.missing_years.join(", ")+".");
 detail(n,"MIT Election Data and Science Lab archive; state-certified 2024 finalist votes where available. Results from 2012–2020 are on earlier apportionment-era geography, not assumed comparable to later districts.");
 return n;
}
function locality(d,local){
 const n=E("section","al-local");
 n.append(title("THE GEOGRAPHIC REGISTER","Cities and neighborhoods","Official representative points inside the district; places may straddle district boundaries."));
 const names=d.places.names||[],hoods=(local?.neighborhoods||[]).slice(0,12),cols=E("div","al-place-cols");
 if(names.length){const part=E("div");part.append(E("h4",null,"Cities and communities"));const ul=E("ul");names.forEach(x=>ul.append(E("li",null,person(x))));part.append(ul);cols.append(part)}
 if(hoods.length){const part=E("div");part.append(E("h4",null,"Mapped neighborhoods"));const ul=E("ul");hoods.forEach(x=>ul.append(E("li",null,person(x.name))));part.append(ul);cols.append(part)}
 if(!cols.children.length)detail(n,"No place reference point has been verified for this district.");
 else n.append(cols);
 if(d.places.total_verified)detail(n,fmt(d.places.total_verified)+" Census place reference points recorded; displayed places are not ranked by population.");
 A(n,"Census Gazetteer ↗",d.places.source_url);
 if(hoods.length)A(n,"Official neighborhood source ↗",hoods[0].source_url);
 return n;
}
function ballot(d){
 const n=E("section","al-ballot");
 n.append(title("THE GENERAL-ELECTION BALLOT","Qualified candidates","Official election-office snapshot; a candidate listing is not an election result."));
 const roster=d.ballot_2026;
 if(!roster?.candidates?.length)detail(n,"Official candidate roster not yet recovered in the source ledger; no absence of candidates is implied.");
 else{
  const ul=E("ul");roster.candidates.forEach(c=>ul.append(E("li",null,c.name+" · "+party(c.party))));n.append(ul);
  detail(n,"Election-office list reviewed "+roster.reviewed_at+".");A(n,"Official ballot source ↗",roster.source_url);
 }return n;
}
Promise.all([
 fetch("data/politics-district-dossiers.json",{cache:"no-cache"}).then(r=>{if(!r.ok)throw Error("dossier HTTP "+r.status);return r.json()}),
 fetch("data/politics-district-communities.json",{cache:"force-cache"}).then(r=>r.ok?r.json():null).catch(()=>null)
]).then(([book,places])=>{
 const d=book?.districts?.[id];if(book.district_count!==435||!d)throw Error("missing 435-district data");
 const h=E("header","al-intro");h.append(E("small","al-kicker","THE POLITICAL LIFE & TIMES · LOCAL REFERENCE EDITION"),E("h2",null,"The District Almanac"),E("p",null,id+" · Geography, actual election history and community data. Not a race forecast."));
 const cols=E("div","al-columns");cols.append(locality(d,places?.districts?.[id]),ballot(d));
 root.replaceChildren(h,context(d),demographics(d),cols,history(d));root.hidden=false;
}).catch(e=>{root.replaceChildren(E("p","al-error","Source-backed district almanac unavailable. Other district reporting remains accessible."));root.hidden=false;console.error("District Almanac",e.message)});
})();