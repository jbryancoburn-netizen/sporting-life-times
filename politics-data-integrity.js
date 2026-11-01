/* Audited political research evidence; independent of external forecast snapshots. */
(function(){
"use strict";
const root=document.getElementById("original-evidence-panel");
if(!root)return;
function node(tag,txt,cls){
 const element=document.createElement(tag);
 if(txt!==undefined&&txt!==null)element.textContent=String(txt);
 if(cls)element.className=cls;
 return element;
}
function addCard(title,value,caption){
 const card=node("article",null,"evidence-card");
 card.append(node("span",title,"evidence-title"),node("strong",value,"evidence-value"),node("p",caption,"evidence-description"));
 root.append(card);
 return card;
}
async function fetchJSON(file){
 const result=await fetch(file+"?t="+Date.now(),{cache:"no-store"});
 if(!result.ok)throw Error(file+": HTTP "+result.status);
 return result.json();
}
async function display(){
 root.replaceChildren(node("p","Verifying dated source audits…","evidence-waiting"));
 try{
  const [b,x,g,r]=await Promise.all([
    fetchJSON("politics-ballot-audit.json"),
    fetchJSON("politics-ballot-fec-crosswalk.json"),
    fetchJSON("politics-geography-audit.json"),
    fetchJSON("politics-sim-readiness.json")
  ]);
  if(b.status!=="PARTIAL_GOVERNMENT_SOURCE_BALLOTS_VALIDATED" ||
     x.status!=="EXACT_JOIN_DIAGNOSTIC_ONLY" ||
     g.status!=="VERIFIED_OFFICIAL_DISTRICT_VINTAGES_NOT_DISTRICT_VOTES" ||
     r.status!=="NOT_READY_FOR_PUBLIC_PREDICTIONS" ||
     b["2026_independent_forecast_certified"]!==false ||
     x.forecast_eligible!==false ||
     g.original_2026_house_model_geography_eligible!==false ||
     r.certified_original_probability_count!==0 ||
     x.certified_2026_probability_count!==0 ||
     g.certified_2026_probability_count!==0)
       throw Error("Source evidence has not passed independence or original-forecast safeguards");
  if(x.candidate_records!==b.candidate_ballot_entries ||
     x.house_offices!==b.house_contests_transcribed ||
     x.senate_offices!==b.senate_contests_transcribed ||
     x.official_ballot_reviewed_at!==b.source_reviewed_at)
       throw Error("FEC identity index is from a different ballot-data version");
  if(g.states_checked!==50 ||
     !Array.isArray(g.boundary_changed_states) ||
     g.boundary_changed_states.length!==g.boundary_changed_states_count ||
     g.states_with_certified_2024_presidential_vote_on_2026_districts!==0 ||
     r.house_forecast_ready!==false)
       throw Error("District vote baselines are not independently cleared");
  const n=x.counts;
  if(!n || n.unique_exact+n.no_exact_identity+n.ambiguous+n.party_not_mapped!==x.candidate_records ||
     n.matched_finance>n.unique_exact)
       throw Error("FEC candidate matching totals fail the audit");
  root.replaceChildren();
  addCard("Exact official ballot ↔ FEC matches",n.unique_exact+" / "+x.candidate_records,
          "Exact full name, office, state, district and party required. Unmatched or ambiguous entries are left unresolved.");
  addCard("Financial summaries connected",n.matched_finance,
          "Original Federal Election Commission filings, with different reporting cutoffs; amounts are not standardized and are not vote forecasts.");
  addCard("States with 2026 House map changes",g.boundary_changed_states_count,
          g.boundary_changed_states.join(" · ")+" · Source: U.S. Census Bureau, 120th Congress.");
  addCard("2024 presidential voting totals on 2026 districts",0+" certified",
          "No precinct-to-new-district crosswalk is certified. Whole-county votes and old district labels are never substituted.");
  const foot=node("p",null,"evidence-disclosure");
  foot.append(node("strong","MODEL NOT CERTIFIED · "));
  foot.append(node("span",r.counts.verified+" fully verified sources · "+r.counts.partial+" partial · "+r.counts.missing+" missing. No original 2026 probability estimates may be published."));
  root.append(foot);
  const ext=node("a","U.S. Census 120th Congress boundary authority ↗");
  ext.href=g.source_url;ext.target="_blank";ext.rel="noopener noreferrer";ext.className="evidence-source";
  root.append(ext);
  const last=node("p","Audit timestamps — FEC identity: "+x.evaluated_at+" · District vintage: "+g.evaluated_at+" · Readiness: "+r.evaluated_at,"evidence-timestamp");
  root.append(last);
 }catch(error){
  root.replaceChildren(node("div","The original-data audit files are unavailable or inconsistent. We are withholding the evidence totals rather than displaying stale or unverified figures.","evidence-unavailable"));
 }
}
display();
})();