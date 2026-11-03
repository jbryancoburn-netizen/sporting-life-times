/* Official Census 2020–2024 ACS context on original 119th House district geography.
 * Strictly descriptive survey estimates: not 2026 votes, polls, or election odds.
 */
(function(){
"use strict";
const SOURCE="politics-census-inputs.json";
const ESTIMATE_YEAR="2020–2024";
const fmt=(n)=>Number(n).toLocaleString("en-US",{maximumFractionDigits:0});
const safe=(n)=>Number.isFinite(n)&&n>=0;
const money=(n)=>"$"+fmt(n);
const elem=(tag,content,cl)=>{
  const node=document.createElement(tag);
  if(content!==undefined&&content!==null)node.textContent=String(content);
  if(cl)node.className=cl;
  return node;
};
const sourceLine=(panel,label,raw)=>{
  if(!raw||!/^https:\/\/www2\.census\.gov\/programs-surveys\/acs\/summary_file\/2024\/table-based-SF\/data\/5YRData\//.test(raw))return;
  const link=elem("a",label+" ↗");link.href=raw;link.target="_blank";link.rel="noopener noreferrer";
  panel.append(link);
};
function metric(label,value,note){
 const block=elem("div",null,"acs-stat");
 block.append(elem("span",label,"acs-label"),elem("strong",value,"acs-value"));
 block.append(elem("span",note,"acs-note"));
 return block;
}
function render(data,id,atlas){
 const host=document.getElementById("result-panel");
 if(!host||!host.closest("section"))return;
 const section=elem("section",null,"panel acs-wrap");
 section.id="census-context";
 section.setAttribute("aria-labelledby","acs-heading");
 section.append(elem("span","ORIGINAL FEDERAL SURVEY · 2020–2024","eyebrow"));
 const heading=elem("h3","People & communities","acs-heading");heading.id="acs-heading";section.append(heading);
 const caption=elem("p","The U.S. Census Bureau's 2020–2024 American Community Survey, five-year estimates on the 119th-Congress district boundaries.","acs-intro");
 section.append(caption);
 const oldDistrict=data.districts.find(x=>x.id===id);
 if(!oldDistrict){
   section.append(elem("p","Census district profile unavailable. Nothing estimated or filled in.","acs-warning"));
 }else{
   const status=atlas?.districts?.find(x=>x.id===id)?.["2024_to_2026_geography_comparison"];
   const warning=status==="verified_changed_district_blocks";
   const pending=status==="pending_district_block_comparison";
   const explanation=warning?"Official block comparison confirms the numbered district changed for 2026. These figures describe its older 119th-Congress geography.":
    pending?"This state redrew its map, but the geographic overlap of this specific district is not yet verified. These statistics describe 119th-Congress geography.":
    "This district's geographic correspondence is verified. Estimates still reflect the 2020–2024 ACS survey period, not a current population count.";
   const geo=elem("p",explanation,warning||pending?"acs-warning":"acs-muted");
   section.append(geo);
   const grid=elem("div",null,"acs-stat-grid");
   const pop=oldDistrict["population_2020_2024_acs_est"];
   const pm=oldDistrict["population_moe_est"];
   const income=oldDistrict["median_household_income_est"];
   const im=oldDistrict["median_household_income_moe_est"];
   const education=oldDistrict["bachelors_plus_age25_pct_est"];
   grid.append(metric("Estimated population",safe(pop)?fmt(pop):"Not available",
      safe(pm)?"ACS margin of error ±"+fmt(pm):"ACS margin of error not reported"));
   grid.append(metric("Median household income",safe(income)?money(income):"Not available",
      safe(im)?"ACS margin of error ±"+money(im):"ACS margin of error not reported"));
   grid.append(metric("Bachelor's degree or higher, age 25+",
      safe(education)&&education<=100?Number(education).toFixed(1)+"%":"Not available",
      "Calculated from table B15003; margin of error not calculated"));
   section.append(grid);
 }
 section.append(elem("p","These are sampled demographic estimates, not individual voter attributes, partisan vote shares, polls, electoral predictions or 2026 district-level voting results.","acs-muted"));
 const links=elem("div",null,"acs-sources");
 links.append(elem("strong","Original U.S. Census Bureau source tables: "));
 for(const [name,title] of [["B01003","Population"],["B19013","Income"],["B15003","Education"]]){
   sourceLine(links,title,data.source_files?.[name]?.url);
 }
 section.append(links);
 host.closest("section").after(section);
}
async function start(){
 if(document.body.dataset.housePage!=="district")return;
 const id=(new URLSearchParams(location.search).get("district")||"").trim().toUpperCase();
 if(!/^[A-Z]{2}-(?:\d{2})$/.test(id))return;
 const [response,atlasResponse]=await Promise.all([
  fetch(SOURCE+"?v=20261101-acs",{cache:"no-store"}),
  fetch("politics-house-atlas.json",{cache:"no-cache"})
 ]);
 if(!response.ok||!atlasResponse.ok)throw Error("No verified original Census or House geographic source");
 const [d,atlas]=await Promise.all([response.json(),atlasResponse.json()]);
 if(d.status!=="ok"||d.district_count!==435||d.districts?.length!==435||
    d.forecast_eligible!==false||d["2026_district_geography_harmonized"]!==false||
    !d.geography?.startsWith("119th Congress")||
    Object.keys(d.source_files||{}).sort().join(",")!=="B01003,B15003,B19013"){
   throw Error("Census evidence did not pass the 119th district geographic source contract");
 }
 render(d,id,atlas);
}
function init(){start().catch(e=>{
 const host=document.getElementById("result-panel")?.closest("section");
 if(!host)return;
 const note=elem("p","Original Census context is temporarily unavailable or failed its source audit. No substitute demographic estimates are being displayed.","acs-warning");
 host.after(note);
 console.warn("Official Census district context:",e.message);
});}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
