/* POLITICAL LIFE & TIMES | DATA GRAPHICS DESK
 * Distinguishes 2024 actual returns from the 2026 polling ledger and ACS
 * household survey estimates. No invented forecast or redistricting joins.
 * Shared across all 435 House district pages with no paid services.
 */
(function(){"use strict";
const ns="http://www.w3.org/2000/svg",$=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined&&text!==null)x.textContent=String(text);if(cls)x.className=cls;return x;};
const svgEl=tag=>document.createElementNS(ns,tag);
const fmt=n=>Number(n).toLocaleString("en-US",{maximumFractionDigits:0});
const dec=n=>Number(n).toFixed(1);
const safeurl=u=>typeof u==="string"&&/^https:\/\//.test(u);
const a=(label,href)=>{const x=el("a",label);x.href=href;x.target="_blank";x.rel="noopener noreferrer";return x;};
const House=(x)=>x["2024_house_result_on_prior_boundaries"];
function ranked2024(atlas){
 return (atlas?.districts||[]).filter(r=>{
  const h=House(r);
  return h?.both_major_parties===true&&Number.isFinite(h.dem_votes)&&
         Number.isFinite(h.rep_votes)&&h.dem_votes+h.rep_votes>0;
 }).map(r=>({id:r.id,dem:House(r).dem_votes,rep:House(r).rep_votes,
             gap:Math.abs(House(r).dem_votes-House(r).rep_votes)}))
 .sort((p,q)=>p.gap-q.gap||p.id.localeCompare(q.id));
}
function rankMetric(census,id,key){
 const all=(census?.districts||[]).filter(d=>Number.isFinite(d[key])&&d[key]>=0)
  .sort((a,b)=>b[key]-a[key]||a.id.localeCompare(b.id));
 const at=all.findIndex(x=>x.id===id);if(at<0||all.length<10)return null;
 const mid=all.length%2?all[(all.length-1)/2][key]:
    (all[all.length/2-1][key]+all[all.length/2][key])/2;
 const n=all.length,rank=at+1;
 return {value:all[at][key],rank,n,median:mid,percentile:100*(n-rank)/(n-1)};
}
function getModel(atlas,census,guide,id){
 const r=atlas?.districts?.find(x=>x.id===id);if(!r)return null;
 const historical=ranked2024(atlas),idx=historical.findIndex(x=>x.id===id);
 const h=House(r),extra=guide?.districts?.[id]||null;
 const rows=extra?.congressional_history?.filter(x=>{
  const d=x.candidates?.find(c=>c.party==="D"),rep=x.candidates?.find(c=>c.party==="R");
  return Number.isInteger(x.year)&&Number.isFinite(d?.votes)&&Number.isFinite(rep?.votes)&&
     d.votes>=0&&rep.votes>=0&&d.votes+rep.votes>0;
 })||[];
 const valid=rows.filter(x=>x.year===2024&&h?.both_major_parties&&
   x.candidates.find(c=>c.party==="D").votes===h.dem_votes&&
   x.candidates.find(c=>c.party==="R").votes===h.rep_votes).length>0;
 // Curated 2022 and 2024 counts may be compared only when 2024 matches the
 // independently recorded election atlas and no 2026 boundary has changed.
 const comparable=valid&&r["2022_to_2024_geography_comparison"]==="unchanged_state_vintage"?
    rows.filter(x=>x.year===2022||x.year===2024).sort((x,y)=>x.year-y.year):[];
 return {r,rank:idx>=0?{place:idx+1,total:historical.length,gap:historical[idx].gap}:null,
  closest:historical.slice(0,8),comparable,
  metrics:[
   {label:"Median household income",key:"median_household_income_est",unit:"$",format:v=>"$"+fmt(v)},
   {label:"Adults 25+ with bachelor's degree or more",key:"bachelors_plus_age25_pct_est",unit:"%",format:v=>dec(v)+"%"},
   {label:"Estimated residents",key:"population_2020_2024_acs_est",unit:"",format:v=>fmt(v)}
  ].map(m=>({...m,stat:rankMetric(census,id,m.key)}))};
}
function heading(kicker,title){const h=el("header",null,"charts-title");h.append(el("span",kicker,"charts-kicker"),el("h3",title));return h;}
function annotation(text){return el("p",text,"charts-foot");}
function drawRank(host,model){
 host.append(heading("THE NATIONAL HOUSE / 2024 OFFICIAL VOTE RECORD","How close was this race—really?"));
 if(!model.rank){host.append(annotation("A two-party 2024 House margin is not available in this archived record. No rank is generated."));return;}
 const stripe=el("div",null,"charts-rank-lead");
 stripe.append(el("strong","#"+model.rank.place,"charts-rank-number"));
 const words=el("div",null,"charts-rank-explainer");
 words.append(el("span","CLOSEST 2024 HOUSE FINISH · "+model.rank.total+" VERIFIED TWO-PARTY RACES","charts-rank-eyebrow"),
  el("h4",fmt(model.rank.gap)+" votes separated the major parties"),
  el("p","Sorted by the absolute gap in actual Democratic and Republican votes. The #1 race had the smallest gap; this is not a 2026 race rating."));
 stripe.append(words);host.append(stripe);
 const chart=el("div",null,"charts-near-list");
 const top=model.closest,max=Math.max(...top.map(x=>x.gap));
 for(let i=0;i<top.length;i++){
  const row=top[i],current=model.r.id===row.id;
  const link=el("a",null,"charts-near-row"+(current?" charts-near-active":""));
  link.href="politics-house-district.html?district="+encodeURIComponent(row.id)+"#district-data-story";
  link.setAttribute("aria-label",row.id+" had a "+fmt(row.gap)+"-vote gap in 2024. Open race profile.");
  link.append(el("span",String(i+1).padStart(2,"0"),"charts-near-position"),el("strong",row.id));
  const track=el("span",null,"charts-near-track"),bar=el("span",null,"charts-near-bar");
  bar.style.width=Math.max(3,100*row.gap/max)+"%";track.append(bar);
  link.append(track,el("span",fmt(row.gap)+" votes","charts-near-gap"));
  chart.append(link);
 }
 host.append(chart);
 const legend=el("div",null,"charts-sources");
 legend.append(annotation("2024 actual two-party vote gaps among "+model.rank.total+" House races with usable Democratic and Republican totals. Only the eight closest are shown. A longer bar means a LARGER vote gap."));
 const url=House(model.r)?.source_url;
 if(safeurl(url))legend.append(a("Original 2024 election data ↗",url));
 host.append(legend);
}
function makeLine(svg,x1,y1,x2,y2,cls){const e=svgEl("line");e.setAttribute("x1",x1);e.setAttribute("x2",x2);e.setAttribute("y1",y1);e.setAttribute("y2",y2);e.setAttribute("class",cls);svg.append(e);return e;}
function makeText(svg,x,y,text,cls,anchor){
 const e=svgEl("text");e.setAttribute("x",x);e.setAttribute("y",y);e.setAttribute("class",cls);
 if(anchor)e.setAttribute("text-anchor",anchor);e.textContent=text;svg.append(e);return e;
}
function drawHistory(host,model){
 const h=House(model.r);
 if(h?.finalists?.length===2){
   host.append(heading("CERTIFIED 2024 HOUSE GENERAL ELECTION","Two finalists, one actual winner"));
   const figures=el("div",null,"charts-finalists");
   const twoTotal=h.finalists.reduce((total,c)=>total+c.votes,0);
   for(const c of h.finalists){
     const line=el("div",null,"charts-finalist-row"),label=el("strong",c.name+" · "+c.party+" · "+fmt(c.votes)+" votes","charts-finalist-label");
     const track=el("div",null,"charts-finalist-track"),bar=el("span",null,"charts-finalist-bar");
     bar.style.display="block";bar.style.width=(100*c.votes/twoTotal).toFixed(2)+"%";bar.style.height="11px";
     bar.style.background=c.party==="D"?"#35639c":c.party==="R"?"#a54940":"#78838d";
     track.style.background="#e8e5dc";track.append(bar);line.append(label,track);figures.append(line);
   }
   host.append(figures,annotation("2024 winning gap: "+fmt(h.winner_runner_up_margin_votes)+" actual votes. "+
     (h.finalists[0].party===h.finalists[1].party?"Both finalists belonged to the same party. ":"")+
     (h.same_2026_geography?"2026 district lines unchanged.":"2026 district boundary overlap not yet verified.")+
     " These historical votes are not a 2026 prediction."));
   return;
 }
 host.append(heading("THE TWO-PARTY ELECTORATE / ACTUAL VOTES ONLY","The margin, election by election"));
 const rows=model.comparable.length>=2?model.comparable:[
   ...(House(model.r)?.both_major_parties&&Number.isFinite(House(model.r).dem_votes)&&
     Number.isFinite(House(model.r).rep_votes)&&House(model.r).dem_votes+House(model.r).rep_votes>0?[
     {year:2024,candidates:[{party:"D",votes:House(model.r).dem_votes},{party:"R",votes:House(model.r).rep_votes}]}]:[])
 ];
 if(!rows.length){host.append(annotation("No source-validated comparable two-party House result is available for charting."));return;}
 const points=rows.map(row=>{
  const d=row.candidates.find(c=>c.party==="D").votes,rep=row.candidates.find(c=>c.party==="R").votes;
  return {year:row.year,margin:100*(rep-d)/(rep+d),rep,dem:d};});
 const lim=Math.min(100,Math.max(10,Math.ceil(Math.max(...points.map(x=>Math.abs(x.margin)))/5)*5));
 const frame=el("div",null,"charts-shift-frame"),svg=svgEl("svg");
 svg.setAttribute("viewBox","0 0 760 250");svg.setAttribute("role","img");
 svg.setAttribute("aria-label",points.map(p=>p.year+" Republican minus Democratic two-party vote margin: "+dec(p.margin)+" percentage points").join("; "));
 svg.setAttribute("class","charts-shift-svg");
 const x=margin=>380+margin/lim*300;
 makeText(svg,65,26,"DEMOCRATIC MARGIN","charts-axis-d");makeText(svg,695,26,"REPUBLICAN MARGIN","charts-axis-r","end");
 makeLine(svg,380,40,380,216,"charts-center");
 for(let i=0;i<points.length;i++){
  const p=points[i],y=points.length===1?127:84+111*i;
  makeLine(svg,80,y,680,y,"charts-track-line");
  makeText(svg,17,y+6,String(p.year),"charts-shift-year");
  const end=x(p.margin);
  const rect=svgEl("rect");rect.setAttribute("x",Math.min(380,end));rect.setAttribute("y",y-12);
  rect.setAttribute("width",Math.max(2,Math.abs(end-380)));rect.setAttribute("height",24);
  rect.setAttribute("class",p.margin>=0?"charts-shift-rep":"charts-shift-dem");svg.append(rect);
  const circle=svgEl("circle");circle.setAttribute("cx",end);circle.setAttribute("cy",y);circle.setAttribute("r",7);
  circle.setAttribute("class","charts-shift-point");svg.append(circle);
  const value=(p.margin>0?"R +":p.margin<0?"D +":"Tied ")+dec(Math.abs(p.margin))+" pp";
  makeText(svg,p.margin>=0?Math.min(end+14,665):Math.max(end-14,95),y-18,value,"charts-shift-label",p.margin<0?"end":null);
 }
 frame.append(svg);
 if(points.length>=2){
  const first=points[0],last=points[points.length-1],shift=last.margin-first.margin;
  const strip=el("p",null,"charts-shift-callout");
  strip.append(el("strong",dec(Math.abs(shift))+" points"));
  strip.append(el("span",shift<0?
    "Smaller Republican two-party margin in 2024 than in 2022.":
    shift>0?"Larger Republican two-party margin in 2024 than in 2022.":"No change in two-party margin between the two elections."));
  frame.append(strip);
 }else frame.append(el("p","Only one comparable election has been verified; no trend line or change is inferred.","charts-shift-caveat"));
 host.append(frame);
 host.append(annotation("Each row is the actual two-party Republican minus Democratic House vote margin for that election; 2026 voting is not shown. Comparing elections describes a past change in observed votes, not a polling trend or prediction."));
 if(model.comparable.length>=2){
  const guideLink=model.r.id==="IA-01"?"https://sos.iowa.gov/elections/pdf/2022/general/canvsummary.pdf":null;
  if(guideLink)host.append(a("Iowa's original 2022 canvass ↗",guideLink));
 }
}
function drawCensus(host,model){
 host.append(heading("U.S. CENSUS BUREAU / ACS 2020–2024 FIVE-YEAR","Is this district typical?"));
 host.append(el("p","A national comparison using all available congressional-district survey estimates—not voting behavior. Markers show where the district falls relative to other House districts; the midpoint marks the nationwide district median.","charts-census-intro"));
 const wrap=el("div",null,"charts-census-list");
 let found=0;
 for(const metric of model.metrics){
  const d=metric.stat;if(!d)continue;found++;
  const section=el("div",null,"charts-census-row");
  const title=el("div",null,"charts-census-top");
  const lead=el("div");
  lead.append(el("span",metric.label,"charts-census-label"),el("strong",metric.format(d.value),"charts-census-value"));
  title.append(lead,el("span","#"+d.rank+" highest / "+d.n+" districts","charts-census-rank"));
  const ruler=el("div",null,"charts-census-ruler");ruler.setAttribute("role","img");
  ruler.setAttribute("aria-label",metric.label+": district "+metric.format(d.value)+", national district median "+metric.format(d.median)+", rank "+d.rank+" of "+d.n+".");
  const median=el("span",null,"charts-census-median"),dot=el("span",null,"charts-census-marker");
  median.style.left="50%";dot.style.left=d.percentile+"%";
  ruler.append(median,dot);
  const bottom=el("div",null,"charts-census-baseline");
  bottom.append(el("span","LOWER"),el("span","NATIONAL DISTRICT MEDIAN · "+metric.format(d.median)),el("span","HIGHER"));
  section.append(title,ruler,bottom);wrap.append(section);
 }
 if(!found){host.append(annotation("Census statistics are not available for this congressional district."));return;}
 host.append(wrap);
 const note=annotation("Original 2020–2024 American Community Survey five-year estimates, measured on the 119th-Congress district boundaries (2024 vintage). All national ranks are descriptive and do not imply 2026 electorate composition. The degree measure is for residents ages 25 and older.");
 if(model.r["2026_boundaries_revised"])note.textContent+=" IMPORTANT: This district's 2026 boundaries differ. The Census comparison reflects the OLD district, not the newly redrawn seat.";
 host.append(note);
}
async function build(){
 const id=(new URLSearchParams(location.search).get("district")||"").trim().toUpperCase();
 if(!/^[A-Z]{2}-\d{2}$/.test(id)||!$("district-data-story"))return;
 const root=$("district-data-story"),status=$("charts-load-status");
 try{
  const [ar,cr,gr]=await Promise.all(["politics-house-atlas.json","politics-census-inputs.json","politics-district-guide.json"].map(x=>fetch(x,{cache:"no-cache"})));
  if(!ar.ok||!cr.ok||!gr.ok)throw Error("A source archive could not be loaded");
  const [atlas,census,guide]=await Promise.all([ar.json(),cr.json(),gr.json()]);
  if(atlas.district_count!==435||census.district_count!==435)throw Error("District data coverage is incomplete");
  const model=getModel(atlas,census,guide,id);if(!model)throw Error("District does not match the House ledger");
  drawRank($("charts-national-rank"),model);
  drawHistory($("charts-election-shift"),model);
  drawCensus($("charts-census-comparison"),model);
  const teaser=$("district-new-desk-rank");
  if(teaser&&model.rank){
   teaser.textContent="#"+model.rank.place+" CLOSEST 2024 HOUSE RESULT OF "+model.rank.total+" VERIFIED TWO-PARTY RACES · "+fmt(model.rank.gap)+" VOTES";
   teaser.hidden=false;
  }
  if(status)status.textContent="2024 actual House results · 2020–2024 Census ACS · source checked";
 }catch(e){
  if(status)status.textContent="Some source data could not be loaded; no ranks or chart values have been invented.";
  for(const box of root.querySelectorAll(".charts-slot"))if(!box.childElementCount)box.append(annotation("This figure is temporarily unavailable."));
  console.warn("Election data graphics:",e);
 }
}
window.PoliticsDistrictCharts=Object.freeze({getModel,ranked2024,rankMetric});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",build);else build();
})();