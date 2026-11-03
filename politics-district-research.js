/* Political Life & Times — 435 source-backed district research dossiers.
 * No forecast assumptions; district vintages and same-party races remain distinct.
 */
(()=>{"use strict";
const host=document.getElementById("district-research-dossier");
const id=(new URLSearchParams(location.search).get("district")||"").toUpperCase();
if(!host||!/^[A-Z]{2}-(?:[0-9]{2}|AL)$/.test(id))return;
const $=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=String(text);return e;};
const fmt=n=>Number(n).toLocaleString("en-US",{maximumFractionDigits:0});
const known=n=>n!==null&&n!==undefined&&Number.isFinite(Number(n))&&Number(n)>=0;
const party=p=>({D:"Democrat",R:"Republican",DEM:"Democrat",REP:"Republican",I:"Independent"}[p]||p||"Unknown");
function link(text,url){const a=$("a",null,text+" ↗");a.href=/^https:\/\//.test(url||"")?url:"https://doi.org/10.7910/DVN/IG0UN2";a.rel="noopener noreferrer";a.target="_blank";return a;}
function header(label,title,deck){const h=$("header","rd-head");h.append($("span","rd-kicker",label),$("h3",null,title),$("p",null,deck));return h;}
function election(r){
 const row=$("article","rd-election"),year=$("div","rd-year"),content=$("div","rd-election-main");
 year.append($("strong",null,r.year),$("small",null,r.winner||"Winner not verified"),$("span",null,party(r.winner_party)));
 const people=r.finalists?.length===2?r.finalists:null,v=r.party_votes||{};
 if(people){
  content.append($("strong","rd-vote-result",people[0].name+" defeated "+people[1].name+" by "+fmt(r.finalist_gap_votes)+" votes"));
  const sum=people.reduce((n,p)=>n+p.votes,0),bars=$("div","rd-bars");
  bars.setAttribute("role","img");bars.setAttribute("aria-label",people.map(p=>p.name+" "+fmt(p.votes)+" votes").join("; "));
  for(const [i,p] of people.entries()){const part=$("span",p.party==="D"?"rd-dem":p.party==="R"?"rd-rep":"rd-other");part.style.width=(100*p.votes/sum)+"%";if(i===1)part.style.opacity=".55";bars.append(part);}
  content.append(bars,$("p","rd-values",people.map(p=>p.name+" ("+party(p.party)+") "+fmt(p.votes)).join(" · ")));
  content.append($("small","rd-caption",people[0].party===people[1].party?"Contested same-party general election — not an uncontested win.":"Certified two-finalist general election."));
 }else if(r.contested_major_parties&&known(v.D)&&known(v.R)&&v.D+v.R>0){
  const total=v.D+v.R,bars=$("div","rd-bars"),a=$("span","rd-dem"),b=$("span","rd-rep");
  a.style.width=(v.D/total*100).toFixed(2)+"%";b.style.width=(v.R/total*100).toFixed(2)+"%";bars.append(a,b);
  bars.setAttribute("role","img");bars.setAttribute("aria-label","Democratic "+fmt(v.D)+" Republican "+fmt(v.R)+" votes");
  content.append(bars,$("p","rd-values","D "+fmt(v.D)+" · R "+fmt(v.R)+" · "+(r.two_party_margin_pp>=0?"D":"R")+" +"+Math.abs(r.two_party_margin_pp).toFixed(1)+" two-party points"));
 }else{
  content.append($("p","rd-values","No verified D-versus-R two-party comparison available."));
 }
 if(r.year<=2020)content.append($("small","rd-caption","Earlier district boundaries; do not compare directly with the current numbered district."));
 if(r.year===2022&&r.comparability_to_2024!=="unchanged_state_vintage")content.append($("small","rd-caption","2022-to-2024 geographic overlap not verified."));
 const sourceRow=$("div","rd-source");sourceRow.append(link(r.source_label||"Historic return",r.source_url));content.append(sourceRow);
 row.append(year,content);return row;
}
function censusCard(title,value,unit,rank,moe){
 const box=$("div","rd-census-card");
 box.append($("span","rd-label",title),$("strong",null,value),$("small",null,unit));
 if(rank)box.append($("p","rd-rank","State "+rank.state_rank+"/"+rank.state_total+" · Nationwide "+rank.rank+"/"+rank.of+" (highest first)"));
 if(known(moe))box.append($("small","rd-moe","ACS margin of error ±"+fmt(moe)));
 return box;
}
function render(d){
 host.replaceChildren();host.classList.add("rd-dossier");
 host.append(header("THE DISTRICT RECORD · 2012–2024","Seven election cycles. One district dossier.",
  "Documented results, Census comparisons, and geography. Every number has a source and a date."));
 const layout=$("div","rd-columns");
 const elections=$("section","rd-election-section");elections.append(header("I · HISTORICAL ELECTIONS","How this district voted","Records are shown under each election's own district boundaries, never as a 2026 prediction."));
 const list=$("div","rd-election-list");let era="";
 for(const r of d.history){
  if(era!==r.historical_vintage){
   era=r.historical_vintage;list.append($("div","rd-era",era==="2020_apportionment_era"?"2022–2024 · recent congressional map":"2012–2020 · earlier map era"));
  }
  list.append(election(r));
 }
 if(!d.history.length)list.append($("p",null,"No sourced House contest in this archive."));
 elections.append(list);
 if(d.missing_years.length)elections.append($("p","rd-caution","No archived results for: "+d.missing_years.join(", ")+". Those elections are not estimated."));
 elections.append($("p","rd-caution","MEDSL party totals are archived election returns, not independently recertified candidate tallies. The explicitly named 2024 finalists come from state-certified records."));
 const sidebar=$("aside","rd-sidebar");
 const a=d.census;
 const stats=$("section");stats.append(header("II · CENSUS REGISTER","The people and their district","2020–2024 ACS five-year estimates on 119th-Congress boundaries, not 2026 voter counts."));
 if(a){
  const grid=$("div","rd-census-grid");
  grid.append(censusCard("Resident population",known(a.population)?fmt(a.population):"Unavailable","ACS estimate",a.ranks?.residents,a.population_moe),
   censusCard("Median household income",known(a.income)?"$"+fmt(a.income):"Unavailable","annual household estimate",a.ranks?.median_income,a.income_moe),
   censusCard("Adults 25+ with degree",known(a.bachelors_pct)?Number(a.bachelors_pct).toFixed(1)+"%":"Unavailable",
    "bachelor’s or higher",a.ranks?.bachelors_pct,null));
  stats.append(grid);
 }
 stats.append($("p","rd-caution","Rankings are estimates across 435 congressional districts; a higher rank is not a political score."));
 const cs=$("p","rd-source");cs.append(link("Original Census ACS tables","https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/"));stats.append(cs);
 const place=$("section","rd-geography");place.append(header("III · LOCAL GEOGRAPHY","The places in the district","Census representative points inside the official polygon, not a ranking of largest population centers."));
 const names=d.places?.names||[];place.append($("p","rd-place-names",names.length?names.slice(0,10).join(" · "):
   "Official Census place-point data does not identify named localities for this urban district; use its geographic map."));
 const g=d.geography||{};let meaning=g.status_2024_2026==="verified_changed_district_blocks"?
   "This district's boundaries changed, confirmed by an individual block comparison.":
   g.status_2024_2026==="verified_same_district_blocks"?
   "This district's 2024 and 2026 block assignments were verified as identical.":
   g.status_2024_2026==="pending_district_block_comparison"?
   "The state's map changed; this individual district's boundary comparison remains pending.":
   "This state's congressional map vintage did not change for 2026.";
 place.append($("p","rd-caution",meaning));
 if(g.blocks){
  const counts=$("div","rd-blocks");
  counts.append($("strong",null,"Official Florida 2024–2026 block audit"),
   $("span",null,fmt(g.blocks.same_blocks)+" unchanged blocks"),
   $("span",null,fmt(g.blocks.incoming_blocks)+" entering"),
   $("span",null,fmt(g.blocks.outgoing_blocks)+" departing"));
  place.append(counts,$("p","rd-caution","Blocks are geographic units, not people or votes."),link("Florida official map source",g.blocks.source_url));
 }
 const ps=$("p","rd-source");ps.append(link("Census Gazetteer",d.places.source_url));place.append(ps);
 sidebar.append(stats,place);layout.append(elections,sidebar);host.append(layout);
 const ballot=d.ballot_2026;
 if(ballot?.candidates?.length){
  const foot=$("div","rd-ballot");foot.append($("strong",null,"2026 candidates on the official state ballot list: "));
  foot.append(document.createTextNode(ballot.candidates.map(x=>x.name+" ("+party(x.party)+")").join(" · ")+" · "));
  foot.append(link("State election-office source",ballot.source_url));host.append(foot);
 }
 host.hidden=false;
}
fetch("data/politics-district-dossiers.json",{cache:"no-cache"}).then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json()}).then(db=>{
 if(db.schema_version!==1||db.district_count!==435||!db.districts?.[id])throw Error("District dossier not certified");
 render(db.districts[id]);
}).catch(e=>{console.warn("District research dossier:",e.message);host.hidden=true;});
})();
