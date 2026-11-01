(function(){
"use strict";
const byId=id=>document.getElementById(id);
const number=n=>Number(n).toLocaleString("en-US");
const pct=n=>Number(n).toFixed(1)+"%";
const NAMES={D:"Democratic",R:"Republican",O:"Other"};
function message(text){const root=byId("history-lab");root.replaceChildren();const p=document.createElement("p");p.className="fine";p.textContent=text;root.appendChild(p);}
function el(tag,cl,content){const out=document.createElement(tag);if(cl)out.className=cl;if(content!==undefined)out.textContent=content;return out;}
function card(year,source){
 const div=el("article","history-year");
 div.append(el("span","history-yr",String(year.year)));
 const official=year.official_seats||null;
 const dSeats=official?official.dem_wins:year.dem_wins,rSeats=official?official.rep_wins:year.rep_wins;
 const other=official?official.unresolved_seats:year.other_wins;
 const caption=el("p","history-vote",official?"Official House winner totals · MIT extracted "+year.contests+"/435 races (not reconciled)":"MIT extracted Senate results · "+year.contests+" general contests");
 div.append(caption);
 const bar=el("div","history-year-bar");
 bar.setAttribute("role","img");
 bar.setAttribute("aria-label",year.year+" "+source+": "+dSeats+" Democratic wins, "+rSeats+" Republican wins, "+other+" other or unresolved");
 const percent=100*dSeats/(official?435:Math.max(1,year.contests));
 const blue=el("span","d");blue.style.width=percent+"%";
 const red=el("span","r");red.style.width=100*rSeats/(official?435:Math.max(1,year.contests))+"%";
 bar.append(blue,red);
 const line=el("p","history-wins",dSeats+" Democratic · "+rSeats+" Republican"+(other?" · "+other+" other/unresolved":""));
 div.append(bar,line);
 return div;
}
function render(data){
 if(data.status!=="ok"||!Array.isArray(data.house)||data.house.length!==4||!Array.isArray(data.senate)||data.senate.length!==4){
  message("Historical election data are awaiting verified MIT results. No 2026 predictions have been inferred from missing records.");return;
 }
 const last=new Date(data.updated_at),age=(Date.now()-last.getTime())/86400000;
 if(!Number.isFinite(age)||age>40||age< -1){
  message("Historical election dataset is outdated or its timestamp cannot be verified. Use the original source links below.");return;
 }
 const root=byId("history-lab");root.replaceChildren();
 const issues=(data.house_reconciliation||[]).filter(r=>r.status!=="matched");
 const sourceLink=el("a",null,"U.S. House Historian ↗");
 sourceLink.href="https://history.house.gov/Institution/Party-Divisions/Party-Divisions/";
 sourceLink.target="_blank";sourceLink.rel="noopener noreferrer";
 const alert=el("aside","history-flag",issues.length?
   "DATA QUALITY: "+issues.length+" historical House cycles do not yet reconcile at the candidate level. House charts use separately verified official seat totals; the MIT extract is not yet certified as model training data.":
   "Historical House outcomes passed the seat-total check.");
 alert.appendChild(document.createTextNode(" "));alert.appendChild(sourceLink);root.appendChild(alert);
 const kicker=el("p","history-note","Original calculations from MIT Election Data and Science Lab historical results, via electiondata.dev · CC0 1.0 · Updated "+last.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}));
 root.appendChild(kicker);
 if(data.winner_party_totals_reconciled===true){
  root.append(el("p","history-note","Verified winner-party coverage: all 435 voting House seats for 2020, 2022 and 2024, and 434 certified winners plus the unresolved NC-09 seat in 2018. Some uncontested races have no reported vote totals; no vote totals were imputed. Experimental model results remain withheld."));
 }
 [["U.S. House",data.house],["U.S. Senate",data.senate]].forEach(([title,years])=>{
  const section=el("section","history-subsection");
  section.append(el("h3",null,title+" elections since 2018"));
  const grid=el("div","history-years");
  years.forEach(y=>{
    const recon=title==="U.S. House"?(data.house_reconciliation||[]).find(r=>r.year===y.year):null;
    grid.append(card({...y,official_seats:recon&&recon.official},title));
  });
  section.append(grid);root.appendChild(section);
 });
 const closest=el("section","history-closest");
 closest.append(el("h3",null,"Closest U.S. House races in 2024"));
 closest.append(el("p","fine","Historical margin among the two major parties in the 2024 election. These are NOT the closest contests in 2026; redistricting and candidate changes make direct transfer unsafe."));
 const rows=el("div","history-close-grid");
 (data.closest_house_2024||[]).slice(0,12).forEach(item=>{
  const entry=el("div","history-close-row");
  const party=item.dem_margin_pp>0?"D":"R";
  entry.append(el("strong","",item.id),el("span","",party+" +"+Math.abs(item.dem_margin_pp).toFixed(1)+" pp"));
  rows.append(entry);
 });closest.append(rows);root.append(closest);
 const bench=el("section","history-bench");
 bench.append(el("h3",null,"Pre-model test: how far can the previous election miss?"));
 const groups=el("div","history-baseline-grid");
 (data.historical_house_baselines||[]).forEach(item=>{
  const box=el("div","history-baseline");
  box.append(el("span","",item.training_year+" → "+item.test_year));
  box.append(el("strong","",item.mean_absolute_margin_error===null?"—":item.mean_absolute_margin_error.toFixed(1)+" pp"));
  box.append(el("small","",number(item.sample_size)+" paired districts · lagged-margin mean absolute error"));
  groups.append(box);
 });bench.append(groups);
 const explanation=el("p","fine","This is a simple historical same-district-ID benchmark, NOT a calibrated statistical model. Redistricting, uncontested races, and candidate changes are not fully adjusted; a same-numbered district may have different boundaries. No 2026 win probabilities are generated from these comparisons.");
 bench.append(explanation);root.append(bench);

 const model=data.experimental_holdout;
 if(model&&model.status==="experimental_holdout_only"&&data.reconciliation_complete===true){
  const panel=el("section","historical-holdout");
  panel.append(el("p","eyebrow","EXPERIMENTAL STATISTICAL VALIDATION · NOT A 2026 FORECAST"));
  panel.append(el("h3",null,"An actual out-of-sample probability test."));
  panel.append(el("p","fine","We trained a basic historical margin-to-win-probability logistic model exclusively on 2018→2020 outcomes, then evaluated it on 2022→2024 results. This is a diagnostic exercise—not a deployable 2026 forecast. District maps and correlated election errors still need verification."));
  const stats=el("div","holdout-metrics");
  [[String(model.holdout_brier_score.toFixed(3)),"Holdout Brier score · lower is better"],
    [String(model.unconditional_baseline_brier_score.toFixed(3)),"Uninformed baseline Brier"],
    [number(model.test_samples),"House races in separate 2024 test set"]].forEach(([val,label])=>{
    const box=el("div","holdout-stat");box.append(el("strong",null,val),el("span",null,label));stats.append(box);
  });panel.append(stats);
  const heading=el("h4",null,"How historical forecast probabilities matched observed outcomes");
  panel.append(heading);
  const table=el("div","holdout-bins");
  (model.calibration_bins||[]).forEach(bin=>{
    const row=el("div","holdout-bin");row.append(el("b",null,bin.from+"–"+bin.to+"%"));
    const bar=el("div","holdout-bin-track");const shade=el("span","");shade.style.width=(bin.realized_win_rate===null?0:bin.realized_win_rate*100)+"%";bar.append(shade);row.append(bar);
    row.append(el("span",null,bin.count?Math.round(100*bin.realized_win_rate)+"% actual D wins · "+bin.count+" races":"No races"));table.append(row);
  });panel.append(table);
  panel.append(el("p","fine","These bins summarize the held-out 2024 test set, not a forecast for 2026. They are not proof of accuracy under new district boundaries or a changing national environment. The Brier score measures average squared probability error."));
  root.append(panel);
 }
 if(model && !data.reconciliation_complete){
  root.append(el("p","history-flag","VALIDATION GATE: Experimental Brier scores are withheld pending district-level reconciliation between official House results and the MIT candidate records. No independently certified 2026 forecast is available."));
 }
 const status=el("p","history-flag","MODEL STATUS · 2026 PROBABILITY FORECAST NOT CERTIFIED");
 root.append(status);
}
async function init(){
 try{const response=await fetch("politics-history.json?source="+Date.now(),{cache:"no-store"});if(!response.ok)throw Error("File unavailable");render(await response.json());}
 catch{message("The historical results desk could not retrieve its verified data. Original sources are linked below.");}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();