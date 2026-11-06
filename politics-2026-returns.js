/* Political Life and Times — 2026 visual elections desk. Source-based, never inferred calls. */
(()=>{"use strict";
document.title=document.title.replace(/\bThe Political Life\s*(?:&|and)\s*Times\b/gi,"Political Life and Times");
const page=location.pathname.split("/").pop();
if(!["politics-house-state.html","politics-house-district.html","politics-house.html"].includes(page))return;
const params=new URLSearchParams(location.search);
const states={AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming"};
const norm=s=>String(s||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
const stateCode=s=>Object.keys(states).find(k=>norm(k)===norm(s)||norm(states[k])===norm(s))||"";
const stateFilter=stateCode(params.get("state"));
const districtParam=norm(params.get("district"));
const selectDistrict=key=>{const id=norm(key);return id===districtParam||id===districtParam.replace(/^([A-Z]{2})0+(\d)$/,"$1$2")||id===districtParam.replace(/^([A-Z]{2})(\d)$/,"$10$2")};
const h=(tag,cls,txt)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=String(txt);return x};
const panel=h("section","plt-return-panel plt-visual-desk");panel.setAttribute("aria-label","Interactive 2026 House election returns");panel.id="house-returns";
panel.append(h("div","plt-kicker","NOVEMBER 2026 · THE RESULTS DESK"),h("h2",null,"The House · Interactive Election Atlas"));
const intro=h("p","plt-lede","Explore reported votes state by state. Select a race to reveal the complete returns and candidate comparison.");panel.append(intro);
const status=h("p","plt-status","Checking state-reported results…");status.setAttribute("role","status");panel.append(status);
const controls=h("div","plt-controls");
const select=h("select","plt-select");select.setAttribute("aria-label","Filter results by state");
const search=h("input","plt-search");search.type="search";search.placeholder="Find a district or candidate";search.setAttribute("aria-label","Search reported races");
const sort=h("select","plt-select");sort.setAttribute("aria-label","Sort races");
[["alpha","District order"],["close","Closest contests"],["votes","Most reported votes"]].forEach(([v,t])=>{const o=h("option",null,t);o.value=v;sort.append(o)});
controls.append(select,search,sort);panel.append(controls);
const metrics=h("div","plt-desk-metrics"),grid=h("div","plt-card-grid"),note=h("p","plt-meta","Source: Open America, derived from state-reported returns. These are incomplete, unofficial vote totals. A leader is not a called winner; unreported races are not zero. Select a race for details.");
panel.append(metrics,grid,note);
const root=document.querySelector("main")||document.querySelector(".paper")||document.body;
const anchor=root.querySelector(".hero")||root.querySelector("#coverage-section")||root.querySelector("section");
if(anchor)anchor.insertAdjacentElement("beforebegin",panel);else root.prepend(panel);
let races=[];let visibleCount=48;let lastSuccessfulUpdate=null;
function raceData(key,r){const candidates=(Array.isArray(r.cands)?r.cands:[]).filter(x=>typeof x.n==="string"&&Number.isInteger(x.v)&&x.v>=0).sort((a,b)=>b.v-a.v);let total=candidates.reduce((s,x)=>s+x.v,0);let code=key.slice(0,2).toUpperCase();let suffix=key.split("-")[1]||"";let title=states[code]||code;title+=" · "+(suffix==="00"?"At-large":("District "+Number(suffix)));return {key,code,title,candidates,total,margin:candidates.length>1&&total?100*(candidates[0].v-candidates[1].v)/total:null};}
function eligible(r){if(page==="politics-house-state.html")return !!stateFilter&&r.code===stateFilter;if(page==="politics-house-district.html")return !!districtParam&&selectDistrict(r.key);return true}
function makeMetric(big,label){const x=h("div","plt-desk-metric");x.append(h("strong",null,big),h("span",null,label));return x}
function render(){let list=races.filter(r=>!select.value||r.code===select.value).filter(r=>!search.value||norm(r.title+" "+r.key+" "+r.candidates.map(c=>c.n).join(" ")).includes(norm(search.value)));
if(sort.value==="close")list.sort((a,b)=>(a.margin??Infinity)-(b.margin??Infinity));else if(sort.value==="votes")list.sort((a,b)=>b.total-a.total);else list.sort((a,b)=>a.key.localeCompare(b.key));
grid.replaceChildren();metrics.replaceChildren();
const close=list.filter(r=>r.margin!==null&&r.margin<5).length;const votes=list.reduce((sum,r)=>sum+r.total,0);
metrics.append(makeMetric(list.length.toLocaleString(),"Reported races"),makeMetric(close.toLocaleString(),"Within 5 percentage points"),makeMetric(votes.toLocaleString(),"Votes reported in selection"));
if(page==="politics-house.html"){metrics.append(makeMetric(Math.max(0,435-new Set(races.map(r=>r.key)).size).toLocaleString(),"Districts not represented in this feed (approximate)"))}
const shown=list.slice(0,visibleCount);
for(const r of shown){
 const card=h("details","plt-race-card");
 const summary=h("summary","plt-race-summary");
 const heading=h("div","plt-card-head");heading.append(h("strong",null,r.title),h("span","plt-badge","REPORTED · NOT CALLED"));summary.append(heading);
 if(r.candidates.length){
 const first=r.candidates[0],second=r.candidates[1],total=r.total;
 const names=h("div","plt-race-names");names.append(h("span",null,first.n+" · "+(total?(first.v/total*100).toFixed(1)+"%":"—")),h("span",null,second?(second.n+" · "+(total?(second.v/total*100).toFixed(1)+"%":"—")):"No second candidate reported"));summary.append(names);
 const bar=h("div","plt-votebar");bar.setAttribute("role","img");bar.setAttribute("aria-label","Candidate vote shares, reported totals");
 for(const c of r.candidates){if(!total)continue;const s=h("span","plt-vote-segment");s.style.width=(100*c.v/total)+"%";s.style.backgroundColor=/^(D|DEM)$/i.test(c.p)?"#3b648f":/^(R|REP)$/i.test(c.p)?"#a54843":"#9b8564";s.title=c.n+": "+(100*c.v/total).toFixed(1)+"%";bar.append(s)}summary.append(bar);
 summary.append(h("small","plt-card-hint",(r.margin===null?"Margin unavailable":"Reported margin "+r.margin.toFixed(1)+" points")+" · "+total.toLocaleString()+" votes · Expand for full results"));
 }else summary.append(h("small",null,"No verified candidate votes available"));
 card.append(summary);
 const details=h("div","plt-card-detail");const table=h("table");const tr=h("tr");["Candidate","Party","Votes","Share"].forEach(x=>tr.append(h("th",null,x)));table.append(tr);
 for(const c of r.candidates){const row=h("tr");[c.n,c.p||"—",c.v.toLocaleString(),r.total?(c.v/r.total*100).toFixed(1)+"%":"—"].forEach(x=>row.append(h("td",null,x)));table.append(row)}
 details.append(table,h("p",null,"Reported votes only · No official race call asserted"));
 const a=h("a","plt-race-link","Open district profile →");a.href="politics-house-district.html?district="+encodeURIComponent(r.key);details.append(a);card.append(details);grid.append(card);
}
const previous=panel.querySelector(".plt-more");if(previous)previous.remove();
if(list.length>shown.length){const more=h("div","plt-more");const label=h("p",null,"Showing "+shown.length+" of "+list.length+" matching reported races.");const button=h("button","plt-load-more","Show 48 more races");button.type="button";button.addEventListener("click",()=>{visibleCount+=48;render()});more.append(label,button);grid.after(more)}
if(!list.length)grid.append(h("p","plt-empty","No reported races match this selection. This does not mean no election occurred."));
}
async function load(){try{const res=await fetch("https://openamerica.io/elections/results.json?year=2026&office=House",{cache:"no-store"});if(!res.ok)throw Error("Data feed unavailable");const data=await res.json();if(data.api!==1||data.year!==2026||String(data.office).toLowerCase()!=="house"||!data.races||Array.isArray(data.races))throw Error("Unexpected results format");
 races=Object.entries(data.races).map(([k,v])=>raceData(k,v)).filter(eligible);
 const codes=[...new Set(races.map(r=>r.code))].sort();
 const all=h("option",null,"All reporting states");all.value="";select.append(all);
 for(const code of codes){const opt=h("option",null,states[code]||code);opt.value=code;select.append(opt)}
 if(stateFilter)select.value=stateFilter;
 if(page==="politics-house-district.html")controls.hidden=true;
 status.textContent="Source returned "+races.length+" race records for this view · Unofficial and potentially incomplete · No nationwide winner count inferred";
 lastSuccessfulUpdate=new Date();status.textContent+=" · Checked "+lastSuccessfulUpdate.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/New_York",timeZoneName:"short"})+" (browser retrieval, not source publication time)";
select.addEventListener("change",()=>{visibleCount=48;render()});sort.addEventListener("change",()=>{visibleCount=48;render()});search.addEventListener("input",()=>{visibleCount=48;render()});render();
 }catch(e){controls.hidden=true;status.textContent="Live results feed unavailable. No election totals or winners are asserted.";grid.append(h("p","plt-empty","Check back when the reporting source is available. Existing historical atlas information remains accessible below."));}}
load();
})();