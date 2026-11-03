/* THE POLITICAL LIFE & TIMES — original-source district graphics desk.
 * Shared across 435 seats. IA-01 gets a fully certified 20-county analysis.
 * Missing sources yield an explicit "not yet verified", never a synthetic value.
 */
(function(){"use strict";
const $=id=>document.getElementById(id);
const E=(tag,text,klass)=>{const x=document.createElement(tag);if(text!==null&&text!==undefined)x.textContent=String(text);if(klass)x.className=klass;return x};
const fmt=n=>Number(n).toLocaleString("en-US",{maximumFractionDigits:0});
const L=(s,url)=>{const a=E("a",s);a.href=url;a.target="_blank";a.rel="noopener noreferrer";return a};
const validUrl=v=>typeof v==="string"&&/^https:\/\//.test(v);
function head(kicker,title,subtitle){
 const h=E("header",null,"ig-head");h.append(E("span",kicker,"ig-kicker"),E("h3",title));
 if(subtitle)h.append(E("p",subtitle,"ig-intro"));return h;
}
function fact(label,value,detail,href){
 const node=E("div",null,"ig-fact");
 node.append(E("span",label,"ig-fact-label"),E("strong",value,"ig-fact-value"),E("p",detail,"ig-fact-detail"));
 if(href)node.append(L("SOURCE ↗",href));return node;
}
function glance(atlas,census,guide,ledger,id,communities){
 const host=$("district-glance");if(!host)return;
 const district=atlas?.districts?.find(x=>x.id===id);if(!district)return;
 const h=district["2024_house_result_on_prior_boundaries"],extra=guide?.districts?.[id],acs=census?.districts?.find(x=>x.id===id),desk=ledger?.districts?.[id],local=communities?.districts?.[id];
 const factual=h?.both_major_parties===true&&
  Number.isFinite(h.dem_votes)&&Number.isFinite(h.rep_votes);
 const counties=extra?.counties?.length;const polls=desk?.polls||district.district_specific_2026_polls||[];
 host.replaceChildren();
 const title=E("header",null,"ig-glance-title");
 title.append(E("strong","THE DISTRICT / FIVE FACTS TO KEEP IN MIND"),
  E("span","Each statistic has its own source and vintage. These are not forecasts."));
 host.append(title);
 const rail=E("div",null,"ig-fact-rail");
 const geo=district["2024_to_2026_geography_comparison"];
 const vintage=geo==="verified_changed_district_blocks"?"2026 boundary assignments changed; 2024 votes remain historical":
   geo==="pending_district_block_comparison"?"2026 district map match pending; 2024 votes remain historical":
   "2024 actual votes · prior election, not 2026 outcome";
 const finalist=h?.finalists?.length===2;
 const observed=finalist?h.finalists[0].name+" over "+h.finalists[1].name:
   factual?(h.rep_votes>h.dem_votes?"R":"D")+" +"+fmt(Math.abs(h.rep_votes-h.dem_votes)):
   h?h.winner+" (no valid D/R margin)":"Not available";
 rail.append(fact("2024 HOUSE RESULT",observed,
   finalist?fmt(h.winner_runner_up_margin_votes)+"-vote candidate gap · "+vintage:vintage,
   validUrl(h?.candidate_vote_source_url||h?.source_url)?h.candidate_vote_source_url||h.source_url:null));
 const pointCount=local?.verified_place_point_count||0;
 rail.append(fact(counties?"VERIFIED COUNTIES":"MAPPED LOCALITIES",
   counties?fmt(counties):pointCount?fmt(pointCount):local?.neighborhoods?.length?fmt(local.neighborhoods.length):"Not certified",
   counties?"Original-source county list":"2026 Census place reference points, not complete municipal territory",
   counties?"#district-overview":communities?.census_gazetteer_url||"#district-overview"));
 rail.append(fact("RESIDENTS / ACS",Number.isFinite(acs?.population_2020_2024_acs_est)?fmt(acs.population_2020_2024_acs_est):"Not available",
  "2020–24 Census ACS estimate · older 119th-district geography",census?.source_url||null));
 rail.append(fact("MEDIAN HOUSEHOLD INCOME",Number.isFinite(acs?.median_household_income_est)?"$"+fmt(acs.median_household_income_est):"Not available",
  "2020–24 ACS · household estimate",census?.source_url||null));
 const supported=Array.isArray(polls)?polls.filter(p=>p&&(
  validUrl(p.url)||validUrl(p.source_url))):[];
 rail.append(fact("REPORTED 2026 HOUSE POLLS",String(supported.length),
  "District-specific reported surveys · not averaged","#desk-local-polls"));
 host.append(rail);
 const note=E("p","Census ACS data are survey estimates for older 119th-Congress boundaries; do not treat them as the exact 2026 population. Poll entries are published observations, not winner probabilities.","ig-caveat");host.append(note);
}
function county(extra,host){
 if(!host||host.querySelector(".ig-county-structure"))return;
 const rows=extra?.county_results_2024?.rows||[];
 if(rows.length!==20)return;
 const D=rows.reduce((v,x)=>v+x.dem,0),R=rows.reduce((v,x)=>v+x.rep,0);
 if(D!==206156||R!==206955)return; // audit guard: nothing renders if the ledger diverges.
 const blue=rows.filter(x=>x.dem>x.rep),red=rows.filter(x=>x.rep>x.dem);
 const dMargin=blue.reduce((v,x)=>v+x.dem-x.rep,0),rMargin=red.reduce((v,x)=>v+x.rep-x.dem,0);
 if(dMargin!==37470||rMargin!==38269||rMargin-dMargin!==799)return;
 const frame=E("section",null,"ig-county-structure");
 frame.append(head("WHAT THE MAP MEANS / 2024 ACTUAL HOUSE VOTES",
  "Three blue counties. Seventeen red ones.",
  "Each side's county victories almost canceled the other out. The result was a Republican win by 799 votes."));
 const plate=E("div",null,"ig-county-balance");
 const l=E("div",null,"ig-county-side dem"),r=E("div",null,"ig-county-side rep");
 const make=(node,party,total,details)=>{node.append(E("span",party,"ig-balance-side-label"),
  E("strong","+"+fmt(total),"ig-balance-total"),E("p",details));
  const line=E("div",null,"ig-balance-line");line.style.width=(100*total/Math.max(dMargin,rMargin)).toFixed(2)+"%";
  node.append(line);
 };
 make(l,"3 DEMOCRATIC COUNTIES",dMargin,"Johnson, Scott and Jefferson");
 make(r,"17 REPUBLICAN COUNTIES",rMargin,"The other counties combined");
 plate.append(l,r);frame.append(plate);
 const net=E("div",null,"ig-county-net");
 net.append(E("strong","R +799","ig-county-net-result"),E("span","NET DISTRICT DIFFERENCE / OUT OF 413,111 MAJOR-PARTY VOTES"));
 frame.append(net);
 const lead=E("div",null,"ig-county-leaders");
 function column(label,list,party){
  const node=E("section",null,"ig-county-leader-column");
  node.append(E("h4",label));
  const lim=Math.max(...list.map(x=>Math.abs(x.rep-x.dem)));
  for(const row of list){const n=E("div",null,"ig-county-leader-row");
   n.append(E("span",row.county));
   const track=E("span",null,"ig-county-leader-track"),fill=E("span",null,"ig-county-leader-fill "+party);
   fill.style.width=Math.max(2,100*Math.abs(row.rep-row.dem)/lim)+"%";track.append(fill);
   n.append(track,E("strong",(party==="dem"?"D +":"R +")+fmt(Math.abs(row.rep-row.dem))));
   node.append(n);
  }return node;
 }
 lead.append(column("The Democratic anchors",blue.sort((a,b)=>(b.dem-b.rep)-(a.dem-a.rep)),"dem"),
 column("The largest Republican offsets",red.sort((a,b)=>(b.rep-b.dem)-(a.rep-a.dem)).slice(0,5),"rep"));
 frame.append(lead);
 const source=E("p",null,"ig-source");
 source.append(E("strong","Source & method: "),
  "2024 Secretary of State county canvass. Each county's contribution is the difference between Bohannan and Miller-Meeks ballots; add them to get the districtwide two-party margin. This is not a 2022-to-2024 county swing. ");
 if(validUrl(extra.county_results_2024.source_url))source.append(L("State canvass ↗",extra.county_results_2024.source_url));
 frame.append(source);
 const summary=host.querySelector(".ia-vote-insight");
 if(summary)summary.replaceWith(frame);
 else host.prepend(frame);
}
function pollVisual(d,host){
 if(!host||host.querySelector(".ig-poll-comparison"))return;
 const polls=Array.isArray(d?.polls)?[...d.polls].filter(p=>p.end&&p.results?.length&&validUrl(p.url)):[];
 if(!polls.length)return;
 polls.sort((a,b)=>b.end.localeCompare(a.end));
 const figure=E("figure",null,"ig-poll-comparison");
 figure.append(head("SURVEY COMPARISON / PUBLISHED 2026 POLLS","Different polls, different pictures.",
  "Each dot represents one candidate's reported share in that survey. The surveys are NOT connected into a trendline or averaged."));
 const legend=E("div",null,"ig-poll-legend");
 for(const [klass,txt] of [["dem","Bohannan (D)"],["rep","Miller-Meeks (R)"],["ind","Bridgford (I)"]]){
  const sp=E("span",txt);sp.className=klass;legend.append(sp);
 }figure.append(legend);
 const maximum=Math.max(60,Math.ceil(Math.max(...polls.flatMap(p=>p.results.map(r=>r.pct||0)))/10)*10);
 for(const p of polls.slice(0,6)){
  const section=E("section",null,"ig-poll-snapshot");
  const title=E("div",null,"ig-poll-survey-title");
  title.append(E("strong",p.pollster),E("span",p.start+" → "+p.end+" · n="+(p.n||"unknown")+" "+(p.population||"")));
  section.append(title);
  const plot=E("div",null,"ig-poll-plot");plot.setAttribute("role","img");
  const readable=p.results.map(x=>x.name+" "+x.pct+"%").join(", ");
  plot.setAttribute("aria-label",p.pollster+" surveyed "+p.start+" through "+p.end+". "+readable+". Different polls are not directly comparable.");
  const ticks=E("div",null,"ig-poll-ticks");
  for(let t=0;t<=maximum;t+=10){const mark=E("span",t+"%");mark.style.left=(100*t/maximum)+"%";ticks.append(mark)}
  plot.append(ticks);
  for(const candidate of p.results){
   const party=candidate.party==="D"?"dem":candidate.party==="R"?"rep":"ind";
   const line=E("div",null,"ig-poll-dotline "+party);
   const x=100*candidate.pct/maximum;
   const dot=E("span",null,"ig-poll-dot");dot.style.left=x+"%";
   const number=E("b",candidate.pct+"%","ig-poll-number");number.style.left=x+"%";
   line.append(dot,number);plot.append(line);
  }
  section.append(plot);
  const methods=E("p",null,"ig-source");
  methods.append(E("strong","Verification: "),p.tier||"Original questionnaire not independently confirmed",".",L("Reported survey source ↗",p.url));
  section.append(methods);figure.append(section);
 }
 const footer=E("figcaption","Field dates, pollster, sampling frame and sponsorship can differ. Horizontal position shows the reported percentage on a 0–"+maximum+"% axis. Undecided/other not shown; these are NOT modeled odds.","ig-source");
 figure.append(footer);
 host.insertBefore(figure,host.children[1]||null);
}
function representative(d,host,edition){
 if(!host||host.querySelector(".ig-representative-brief"))return;
 const current=d?.representation?.current_119th;
 const next=d?.representation?.new_120th;
 const cert=!!(d?.election?.certified&&d.election?.winner);
 const serving=edition==="certified"&&cert&&next?.bioguide?next:current;
 const records=serving===next?(next?.votes||[]):(d?.representation?.votes||[]);
 const frame=E("section",null,"ig-representative-brief");
 frame.append(head("THE GOVERNING RECORD / HOUSE CLERK",
  "What has the representative actually done?",
  "A selected roll-call reading, not a fabricated legislative score or party-loyalty percentage."));
 if(!serving){frame.append(E("p","A verified member identity is not yet available.","ig-source"));host.append(frame);return}
 const top=E("div",null,"ig-member-line");
 top.append(E("strong",serving.name),E("span",serving.party+" · "+(serving===next?"120th Congress":"119th Congress archive")+" · verified identity"));
 frame.append(top);
 const summary=E("div",null,"ig-record-samples");
 const filtered=records.filter(v=>v&&["Yea","Nay","Present","Not Voting"].includes(v.position)&&validUrl(v.url)&&v.title);
 summary.append(E("strong",filtered.length+" sourced examples"),E("p","A selection only. Two records cannot establish a member's overall voting attendance, ideology or party-loyalty rate."));
 frame.append(summary);
 if(filtered.length){
  const rails=E("div",null,"ig-record-issues");
  for(const v of filtered.slice(0,5)){
   const line=E("div",null,"ig-record-issue");
   const kind=/water|river|resource|infrastructure/i.test(v.title)?"WATER & INFRASTRUCTURE":/iran|war|armed|forces/i.test(v.title)?"WAR POWERS":"HOUSE LEGISLATION";
   line.append(E("span",kind,"ig-record-issue-type"),E("strong",v.position.toUpperCase(),"ig-record-issue-choice"),
    L(v.title+" ↗",v.url));
   rails.append(line);
  }frame.append(rails);
 }else frame.append(E("p","Individual vote positions have not been independently imported for this member.","ig-source"));
 const foot=E("p",null,"ig-source");
 foot.append(E("strong","Verify every roll call: "),"House Clerk records identify the member, the roll-call number and their position. Bill sponsorship and committee records are separate from floor votes. ");
 if(validUrl(serving.rollcalls))foot.append(L("Official House Clerk voting ledger ↗",serving.rollcalls));
 frame.append(foot);
 const before=host.querySelector(".desk-member");if(before)host.insertBefore(frame,before);else host.append(frame);
}
window.PoliticsDistrictGraphics=Object.freeze({glance,county,pollVisual,representative});
async function initGlance(){
 const id=(new URLSearchParams(location.search).get("district")||"").trim().toUpperCase();
 if(!/^[A-Z]{2}-\d{2}$/.test(id)||!$("district-glance"))return;
 try{
  const names=["politics-house-atlas.json","politics-census-inputs.json","politics-district-guide.json","data/politics-district-desk.json","data/politics-district-communities.json"];
  const parts=await Promise.all(names.map(async name=>{const r=await fetch(name,{cache:"no-cache"});return r.ok?r.json():null}));
  glance(parts[0],parts[1],parts[2],parts[3],id,parts[4]);
 }catch(e){$("district-glance").append(E("p","Source summary unavailable. The district guide and original records remain accessible below.","ig-source"));}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initGlance);else initGlance();
})();