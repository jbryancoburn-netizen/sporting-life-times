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
  const r=await Promise.all(["politics-house-atlas.json","politics-district-guide.json",
   "politics-historical-contests.json","data/politics-district-communities.json"].map(async name=>{
   const response=await fetch(name,{cache:"no-cache"});if(!response.ok)throw Error(name+" unavailable");return response.json();
  }));
  const atlas=r[0],profile=r[1].districts?.[id],historical=r[2],places=r[3].districts?.[id],
   district=atlas.districts.find(d=>d.id===id);
  if(!district)throw Error("Unknown district");const state=atlas.states.find(s=>s.code===district.state);
  const stateName=state?.name||district.state;
  $("district-overview-id").textContent=stateName.toUpperCase()+" / "+(district.at_large?"AT-LARGE":"DISTRICT "+Number(district.district))+" / NOVEMBER 2026";
  $("district-overview-title").textContent=profile?
   id==="IA-01"?profile.explainer?.headline||profile.title:profile.title:
   stateName+"'s "+(district.at_large?"at-large seat":"District "+Number(district.district))+" — a closer look.";
  const mapped=[...(places?.communities||[]),...(places?.neighborhoods||[])];
  const clean=n=>n.replace(/ (?:city|town|village|CDP|borough|municipality)$/i,"");
  const named=(profile?.major_communities||[]).map(p=>p.name);
  const samples=named.length?named:mapped.slice(0,6).map(p=>clean(p.name));
  const boundary=district["2024_to_2026_geography_comparison"];
  const vintage=boundary==="verified_changed_district_blocks"?"Its 2026 lines changed under an official block comparison.":
    boundary==="pending_district_block_comparison"?"Its precise 2024–2026 boundary overlap is still being checked.":
    "Its district geography matches the 2024 election vintage.";
  $("district-overview-summary").textContent=profile?.explainer?.subheading||profile?.geography_deck||
    (samples.length?"Verified mapped reference points include "+samples.slice(0,4).join(", ")+". ":"")+
    vintage+" Earlier elections are displayed as actual historical results, never projected 2026 votes.";
  $("district-overview-places").textContent=samples.length?
    "Census-mapped places: "+samples.slice(0,7).join(" · ")+". These points do not imply whole-city inclusion.":
    "Explore Census-verified neighborhood geography on the district map.";
  const h=district["2024_house_result_on_prior_boundaries"];
  const valid=h?.both_major_parties===true&&Number.isFinite(h.dem_votes)&&Number.isFinite(h.rep_votes)
    &&h.dem_votes>0&&h.rep_votes>0;
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
   const off=profile?.congressional_history?.find(d=>d.year===2022);
   const archive=historical.house?.find(d=>d.id===id&&d.year===2022);
   const d22=off?.candidates?.find(c=>c.party==="D")?.votes??archive?.dem_votes;
   const r22=off?.candidates?.find(c=>c.party==="R")?.votes??archive?.rep_votes;
   const margins=district["2022_to_2024_geography_comparison"]==="unchanged_state_vintage"&&
     Number.isFinite(d22)&&Number.isFinite(r22)&&d22>0&&r22>0;
   const geographicCaution=boundary==="verified_changed_district_blocks"?
     " Official records confirm 2026 lines changed; this is the 2024 electorate.":
     boundary==="pending_district_block_comparison"?
     " Its 2026 district geographic match is still under review.":" The 2024 lines match 2026.";
   if(margins){
     const oldMargin=100*(d22-r22)/(d22+r22),currentMargin=100*(h.dem_votes-h.rep_votes)/(h.dem_votes+h.rep_votes);
     const delta=currentMargin-oldMargin;
     $("district-overview-history").textContent="2022 D/R margin "+(oldMargin>0?"D +":"R +")+Math.abs(oldMargin).toFixed(1)+
       " pts; 2024 "+(currentMargin>0?"D +":"R +")+Math.abs(currentMargin).toFixed(1)+
       " pts. "+Math.abs(delta).toFixed(1)+"-point shift toward "+(delta>0?"Democrats":delta<0?"Republicans":"neither party")+
       " on comparable 2022–24 lines."+geographicCaution;
   }else $("district-overview-history").textContent="Actual 2024 House vote gap: "+fmt(gap)+
     " ballots. No unverified 2022–24 partisan swing is claimed."+geographicCaution;
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
   const u=district["2024_unopposed_official_context"];
   if(u){
     place.textContent="Unopposed · 2024";
     label.textContent=u.winner+" was elected unopposed according to the official record.";
     rank.textContent="No invented vote total or partisan margin.";
   }else if(h){
     place.textContent="2024 actual";
     label.textContent=h.winner+" won the 2024 House election.";
     rank.textContent="No verified two-candidate vote margin.";
   }
   $("district-overview-history").textContent="Earlier election returns remain available in the district history. "+
     (boundary==="verified_changed_district_blocks"?"This district changed boundaries for 2026.":
      boundary==="pending_district_block_comparison"?"This district's 2026 map comparison is pending.":"2024 district boundaries are comparable with 2026.");
  }
 }catch(error){
  console.warn("District editorial profile:",error);
  $("district-overview-summary").textContent="The source archive is unavailable. See the official district map and the verified candidate list below.";
 }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();