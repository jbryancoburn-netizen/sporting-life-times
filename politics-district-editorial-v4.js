/* POLITICAL LIFE & TIMES / 2026 DISTRICT PROFILE
 * One coherent introduction, using only existing independently sourced
 * House actuals, Census figures and separately checked local reporting.
 */
(function(){"use strict";
const $=id=>document.getElementById(id);
const fmt=n=>Number(n).toLocaleString("en-US",{maximumFractionDigits:0});
const digits=n=>Number.isFinite(n)?fmt(n):"—";
const party=n=>n>0?"Republican":n<0?"Democratic":"Tied";
async function start(){
 const id=(new URLSearchParams(location.search).get("district")||"").trim().toUpperCase();
 if(!/^[A-Z]{2}-\d{2}$/.test(id)||!$("district-overview"))return;
 try{
  const r=await Promise.all(["politics-house-atlas.json","politics-district-guide.json"].map(async name=>{
   const response=await fetch(name,{cache:"no-cache"});if(!response.ok)throw Error(name+" unavailable");return response.json();
  }));
  const atlas=r[0],profile=r[1].districts?.[id],district=atlas.districts.find(d=>d.id===id);
  if(!district)throw Error("Unknown district");const state=atlas.states.find(s=>s.code===district.state);
  const stateName=state?.name||district.state;
  $("district-overview-id").textContent=stateName.toUpperCase()+" / "+(district.at_large?"AT-LARGE":"DISTRICT "+Number(district.district))+" / NOVEMBER 2026";
  $("district-overview-title").textContent=profile?
   id==="IA-01"?profile.explainer?.headline||profile.title:profile.title:
   stateName+"'s "+(district.at_large?"at-large seat":"District "+Number(district.district))+" — a closer look.";
  $("district-overview-summary").textContent=profile?.explainer?.subheading||profile?.geography_deck||
    "An original-source portrait of the district's boundaries, voters and candidates. Place-by-place reporting is added only after verification.";
  $("district-overview-places").textContent=profile?.major_communities?.length?
    profile.major_communities.slice(0,7).map(p=>p.name).join("  ·  "):
    "Open the official district map to explore towns, cities and county boundaries.";
  const h=district["2024_house_result_on_prior_boundaries"];
  const valid=h?.both_major_parties===true&&h.same_2026_geography===true&&
      Number.isFinite(h.dem_votes)&&Number.isFinite(h.rep_votes);
  const place=$("overview-vote-gap"),label=$("overview-vote-label"),rank=$("overview-vote-rank");
  if(valid){
   const gap=Math.abs(h.rep_votes-h.dem_votes);
   place.textContent=fmt(gap)+" votes";
   label.textContent=party(h.rep_votes-h.dem_votes)+" win · 2024 actual House result";
   const list=(atlas.districts||[]).filter(d=>{const v=d["2024_house_result_on_prior_boundaries"];return v?.both_major_parties&&Number.isFinite(v.dem_votes)&&Number.isFinite(v.rep_votes)});
   const order=list.sort((a,b)=>{
    const gap=v=>Math.abs(v["2024_house_result_on_prior_boundaries"].rep_votes-v["2024_house_result_on_prior_boundaries"].dem_votes);
    return gap(a)-gap(b);
   });
   const ordinal=order.findIndex(r=>r.id===id)+1;
   rank.textContent=ordinal?"#"+ordinal+" closest of "+list.length+" races with usable major-party totals":"2024 actual major-party votes";
   const old=profile?.congressional_history?.find(d=>d.year===2022);
   const current=profile?.congressional_history?.find(d=>d.year===2024);
   const rep=old?.candidates?.find(c=>c.party==="R")?.votes,dem=old?.candidates?.find(c=>c.party==="D")?.votes;
   if(district["2022_to_2024_geography_comparison"]==="unchanged_state_vintage"&&current&&rep!==undefined&&dem!==undefined&&
    current.candidates.find(c=>c.party==="R")?.votes===h.rep_votes&&current.candidates.find(c=>c.party==="D")?.votes===h.dem_votes){
    const pastGap=Math.abs(rep-dem);
    $("district-overview-history").textContent="2022: "+digits(pastGap)+"-vote gap. 2024: "+fmt(gap)+"-vote gap. Same district lines; real counted votes, not polls.";
   }else $("district-overview-history").textContent="2024 House result: "+fmt(gap)+"-vote margin. Historic comparisons require matched district boundaries.";
  }else if(h?.finalists?.length===2){
   const [winner,runner]=h.finalists,same=winner.party===runner.party;
   place.textContent=fmt(h.winner_runner_up_margin_votes)+" votes";
   label.textContent=winner.name+" defeated "+runner.name+" · 2024 actual House vote";
   rank.textContent=same?"Contested same-party general election · both "+(winner.party==="D"?"Democrats":"Republicans"):
     "Contested general election · "+winner.party+" versus "+runner.party;
   $("district-overview-history").textContent="2024 actual: "+winner.name+" "+fmt(winner.votes)+
     " votes; "+runner.name+" "+fmt(runner.votes)+". "+
     (h.same_2026_geography?"Unchanged district map vintage.":"2026 district overlap awaiting geographic certification.")+
     " This is not 2026 polling.";
  }else{
   place.textContent="See the record";
   label.textContent="Past candidate gap or map match not yet verified";
   rank.textContent="No unverifiable historic comparison shown.";
   $("district-overview-history").textContent="Earlier elections remain archived. Each district requires independent map verification before using its votes as a current-boundary baseline.";
  }
 }catch(error){
  console.warn("District editorial profile:",error);
  $("district-overview-summary").textContent="The source archive is unavailable. See the official district map and the verified candidate list below.";
 }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();