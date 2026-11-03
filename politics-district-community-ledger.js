/* THE POLITICAL LIFE & TIMES — LOCAL CENSUS CONTEXT
 * Editorial comparison of real 2020–2024 ACS 119th-district figures.
 * These are historical-geography statistics, never 2026 electorate estimates,
 * and every chart is explicitly labeled with its Census vintage.
 */
(()=>{"use strict";
const $=id=>document.getElementById(id);
const E=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==null&&text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e};
const number=n=>Number(n).toLocaleString("en-US",{maximumFractionDigits:0});
async function get(path){const r=await fetch(path,{cache:"no-cache"});if(!r.ok)throw Error(path+" returned "+r.status);return r.json();}
const indicators=[
 {key:"median_household_income_est",label:"Median household income",unit:"USD",fmt:v=>"$"+number(v),kind:"Income"},
 {key:"bachelors_plus_age25_pct_est",label:"Adults 25+ with bachelor's degree or higher",unit:"percent",fmt:v=>Number(v).toFixed(1)+"%",kind:"Education"},
 {key:"population_2020_2024_acs_est",label:"Resident population, ACS estimate",unit:"people",fmt:v=>number(v),kind:"Population"}
];
function chart(entry,spec,full,stateRows){
 const list=full.filter(row=>Number.isFinite(Number(row[spec.key]))&&Number(row[spec.key])>=0)
  .sort((a,b)=>Number(a[spec.key])-Number(b[spec.key]));
 const idx=list.findIndex(row=>row.id===entry.id);
 if(idx<0)return null;
 return {percentile:((idx+1)/list.length)*100,rank:list.length-idx,total:list.length,
  stateRank:stateRows.filter(row=>Number.isFinite(Number(row[spec.key]))&&Number(row[spec.key])>Number(entry[spec.key])).length+1,
  stateTotal:stateRows.filter(row=>Number.isFinite(Number(row[spec.key]))).length};
}
async function init(){
 const id=(new URLSearchParams(location.search).get("district")||"").toUpperCase();
 const root=$("community-ledger");
 if(!root||!/^[A-Z]{2}-[0-9]{2}$/.test(id)||id==="IA-01")return;
 try{
  const [acs,atlas,places]=await Promise.all([
   get("politics-census-inputs.json"),get("politics-house-atlas.json"),
   get("data/politics-district-communities.json").catch(()=>null)
  ]);
  const rows=acs.districts||[],current=rows.find(row=>row.id===id);
  const district=atlas.districts?.find(row=>row.id===id);
  const state=atlas.states?.find(row=>row.code===id.slice(0,2));
  if(!current||!district||!state)return;
  const stateRows=rows.filter(row=>row.state===current.state);
  root.classList.add("district-community-ledger");
  const head=E("header",null,"community-ledger-heading");
  head.append(E("span","THE PEOPLE / LOCAL CENSUS REGISTER","community-ledger-kicker"),
   E("h3","A statistical portrait of "+state.name+"'s "+(district.at_large?"at-large seat":"District "+Number(district.district))),
   E("p","Compare this district's published Census estimates with the other House districts. These figures describe 2020–2024 ACS data on 119th Congress boundaries, not current election results."));
  const grid=E("div",null,"community-ledger-grid");
  let available=0;
  for(const spec of indicators){
   const v=Number(current[spec.key]);
   if(!Number.isFinite(v)||v<0||current[spec.key]===null)continue;
   const c=chart(current,spec,rows,stateRows);if(!c)continue;
   available++;
   const card=E("article",null,"community-ledger-metric");
   const name=E("span",spec.label,"community-ledger-label");
   const value=E("strong",spec.fmt(v),"community-ledger-value");
   const bar=E("div",null,"community-ledger-bar");
   bar.setAttribute("role","img");
   bar.setAttribute("aria-label",spec.label+": "+spec.fmt(v)+". Ranked "+c.rank+" out of "+c.total+" House districts on historic boundaries.");
   const fill=E("span",null,"community-ledger-fill");fill.style.width=Math.max(.5,Math.min(100,c.percentile)).toFixed(2)+"%";bar.append(fill);
   const note=E("p","National rank: "+c.rank+" of "+c.total+" · "+state.name+" rank: "+c.stateRank+" of "+c.stateTotal,"community-ledger-rank");
   card.append(name,value,bar,note);grid.append(card);
  }
  if(!available)return;
  const place=places?.districts?.[id];
  const localCount=(place?.communities?.length||0)+(place?.neighborhoods?.length||0);
  const reading=E("div",null,"community-ledger-reading");
  if(localCount){
   reading.append(E("strong","The geographic file","community-ledger-reading-label"),
    E("p","This edition also links "+localCount+" verified named "+(place.neighborhoods?.length?"local neighborhood and community reference points":"community reference points")+" to the congressional map. A place name does not imply its full area lies in this district."));
  }
  const source=E("p",null,"community-ledger-source");
  const url=acs.source_url||"https://www.census.gov/programs-surveys/acs";
  const link=E("a","U.S. Census ACS 2020–2024 original source ↗");link.href=url;link.target="_blank";link.rel="noopener noreferrer";
  source.append(link,document.createTextNode(" · Ranks compare available estimates, not voters or election outcomes."));
  if(district["2026_boundaries_revised"]){
   const warn=E("p","BOUNDARY CAUTION: This district changed for 2026. The Census figures above describe the former 119th Congress district boundaries and must NOT be treated as estimates for the newly redrawn electorate.","community-ledger-warning");
   root.append(head,grid,reading,warn,source);
  }else root.append(head,grid,reading,source);
  root.hidden=false;
 }catch(error){console.warn("Verified local Census register:",error);}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
