/* The Political Life & Times | Iowa's four distinct 2026 House race files.
 * All electoral numbers originate in the existing 435-seat atlas.
 * The news desk is editorial interpretation, NEVER a probability model.
 */
(function(){
"use strict";
const el=(tag,cl,txt)=>{
 const x=document.createElement(tag);
 if(cl)x.className=cl;
 if(txt!==undefined&&txt!==null)x.textContent=String(txt);
 return x;
};
const put=(parent,...nodes)=>{parent.append(...nodes);return parent;};
const fmt=n=>Number(n).toLocaleString("en-US");
const pp=n=>Number(n).toFixed(1);
const page=id=>"politics-house-district.html?district="+encodeURIComponent(id);
const source=(parent,label,href)=>{
 if(!href)return null;
 const a=el("a","ia-source",label+" ↗");a.href=href;a.target="_blank";a.rel="noopener noreferrer";parent.append(a);return a;
};
const story={
 "IA-01":{
  kicker:"THE 799-VOTE BATTLEGROUND",short:"799-vote finish",tone:"mixed",
  headline:"The closest possible starting line.",
  standfirst:"The last House contest was nearly even. A reported July 2026 survey points the other direction, but its underlying sample and sponsorship have not been independently verified.",
  angle:"A 2024 Republican win of fewer than a thousand votes and a 2026 reported Democratic survey advantage are two different observations. Neither is a November win probability.",
  question:"Does a July poll showing an independent candidate in double digits capture the November electorate?",
  fact:"THE INDEPENDENT FACTOR",factDetail:"The reported survey also assigns a share to Michael Bridgford, not just the Democratic and Republican candidates."
 },
 "IA-02":{
  kicker:"THE CONTRADICTORY SIGNALS FILE",short:"Signals diverge",tone:"mixed",
  headline:"The past says one thing. The poll says another.",
  standfirst:"The 2024 Republican victory was substantial, but a reported October 2026 survey shows a narrow Democratic lead in a matchup with different candidates.",
  angle:"A 2024 district result cannot tell us what the current nominees will do. The reported October survey is a separate snapshot, not a validated forecast.",
  question:"How much weight should one unverified survey compilation carry against a markedly different previous election?",
  fact:"A CHANGED BALLOT",factDetail:"The Republican who won this district in 2024 is not listed among the state-reviewed 2026 contenders."
 },
 "IA-03":{
  kicker:"THE FRESHNESS QUESTION",short:"Older survey",tone:"watch",
  headline:"One district. Two Republican-leaning signals. An old poll.",
  standfirst:"The 2024 election and a reported March 2026 survey both favor the Republican side, but a March survey offers only a limited view of an election in November.",
  angle:"A matching poll direction and historical outcome are not enough to establish current win odds, particularly without a newer independently verified district survey.",
  question:"Would newer district polling confirm or challenge the reported March numbers?",
  fact:"WATCH THE DATE",factDetail:"The available 2026 named-candidate poll entry is dated March; the original field dates and sample remain unverified."
 },
 "IA-04":{
  kicker:"THE MISSING-POLL FILE",short:"History only",tone:"history",
  headline:"A strong historical margin, and an unanswered 2026 question.",
  standfirst:"The last House result favored Republicans by a wide margin. But the state-reviewed ballot lists a different 2026 matchup, and this desk has no eligible district poll.",
  angle:"It is fair to describe the 2024 Republican vote advantage. It is not fair to turn that old result into 2026 probability or a current candidate lead.",
  question:"Will verified district polling or other direct 2026 evidence emerge before Election Day?",
  fact:"A NEW MATCHUP",factDetail:"The 2024 winning candidate is not listed on the reviewed 2026 general-election ballot."
 }
};
const partyText=p=>p==="DEM"||p==="D"?"Democrat":p==="REP"||p==="R"?"Republican":p==="IND"?"Independent":p==="LIB"?"Libertarian":p;
function checked2024(r){
 const h=r["2024_house_result_on_prior_boundaries"];
 if(!h||h.same_2026_geography!==true||!Number.isFinite(h.dem_votes)||!Number.isFinite(h.rep_votes))return null;
 const gap=Math.abs(h.rep_votes-h.dem_votes);
 return {h,gap,party:h.rep_votes>=h.dem_votes?"R":"D"};
}
function eligiblePoll(r){
 const p=(r.district_specific_2026_polls||[]).find(x=>x.question_type==="named_house"&&Array.isArray(x.candidates)&&
   x.candidates.length>=2&&x.candidates.every(c=>Number.isFinite(c.pct)&&c.pct>=0&&c.pct<=100)&&
   x.candidates.reduce((a,c)=>a+c.pct,0)<=100.01);
 if(!p)return null;
 const d=p.candidates.find(c=>c.party==="D"),rep=p.candidates.find(c=>c.party==="R");
 if(!d||!rep)return null;
 return {p,d,rep,delta:d.pct-rep.pct};
}
function metadata(r){
 const past=checked2024(r),poll=eligiblePoll(r),s=story[r.id];
 const checked=!!r.official_2026_candidate_snapshot;
 return {past,poll,checked,s};
}
function renderMap(r,target){
 fetch("politics-geometry/IA.geojson",{cache:"force-cache"}).then(a=>{
  if(!a.ok)throw Error("Geometry archive unavailable");return a.json();
 }).then(geo=>{
  if(geo.meta?.state!=="IA"||geo.features?.length!==4)throw Error("Wrong census geography");
  const paths=[],features=[];
  for(const f of geo.features){
   const coords=f.geometry?.type==="Polygon"?f.geometry.coordinates:f.geometry?.type==="MultiPolygon"?f.geometry.coordinates.flat():[];
   const id="IA-"+String(f.properties?.CD120||"").padStart(2,"0");
   if(!story[id])throw Error("Unexpected congressional district");
   for(const ring of coords){
    if(ring.length<3)continue;
    paths.push(...ring);
   }
   features.push({f,coords,id});
  }
  const minX=Math.min(...paths.map(x=>x[0])),maxX=Math.max(...paths.map(x=>x[0]));
  const minY=Math.min(...paths.map(x=>x[1])),maxY=Math.max(...paths.map(x=>x[1]));
  if(!(maxX>minX&&maxY>minY))throw Error("Geometry incomplete");
  const scale=Math.min(420/(maxX-minX),266/(maxY-minY));
  const ox=(460-(maxX-minX)*scale)/2,oy=(300-(maxY-minY)*scale)/2;
  const xy=([lon,lat])=>[ox+(lon-minX)*scale,300-oy-(lat-minY)*scale];
  const ns="http://www.w3.org/2000/svg";
  const make=t=>document.createElementNS(ns,t);
  const svg=make("svg");svg.setAttribute("viewBox","0 0 460 300");
  svg.setAttribute("class","ia-map-svg");
  svg.setAttribute("role","group");
  svg.setAttribute("aria-label","2026 official Iowa congressional district outlines. Select a district to open its report.");
  for(const {f,coords,id} of features){
   const a=make("a");a.setAttribute("href",page(id));
   a.setAttribute("aria-label",id+" election briefing");
   a.setAttribute("class","ia-map-seat"+(id===r.id?" current":""));
   const path=make("path");
   const d=coords.map(ring=>ring.map((p,i)=>{const [x,y]=xy(p);return(i?"L":"M")+x.toFixed(2)+" "+y.toFixed(2);}).join("")+"Z").join(" ");
   path.setAttribute("d",d);path.setAttribute("fill-rule","evenodd");a.append(path);
   const center=[Number(f.properties.CENTLON),Number(f.properties.CENTLAT)];
   const [cx,cy]=xy(center);
   const label=make("text");label.textContent=String(Number(f.properties.CD120));
   label.setAttribute("x",cx);label.setAttribute("y",cy);
   label.setAttribute("text-anchor","middle");label.setAttribute("dominant-baseline","central");
   a.append(label);svg.append(a);
  }
  target.replaceChildren(svg);
 }).catch(()=>{
  target.replaceChildren(el("p","ia-map-fallback","The map is unavailable. Use the four district links above to navigate."));
 });
}
function topNav(r){
 const nav=el("nav","ia-race-nav");
 nav.setAttribute("aria-label","Browse Iowa's four congressional districts");
 Object.entries(story).forEach(([id,s])=>{
  const a=el("a","ia-race-link"+(r.id===id?" is-current":""),null);
  a.href=page(id);if(r.id===id)a.setAttribute("aria-current","page");
  put(a,el("span","ia-race-id",id),el("small","ia-race-mini",s.short));
  nav.append(a);
 });
 return nav;
}
function candidateCard(r,c){
 const item=el("article","ia-candidate ia-party-"+String(c.party).toLowerCase());
 const portrait=window.PoliticsHouseIdentity?.portrait?.(r,c);
 if(portrait)item.append(portrait);
 else item.append(el("span","ia-fallback-initials",c.name.split(" ").slice(0,2).map(x=>x[0]).join("")));
 const info=el("div","ia-candidate-copy");
 put(info,el("span","ia-candidate-party",partyText(c.party)),el("strong","ia-candidate-name",c.name));
 const seal=window.PoliticsHouseIdentity?.seal?.(c.party);if(seal)info.append(seal);
 item.append(info);return item;
}
function candidates(r){
 const s=el("section","ia-candidate-section");
 const header=el("div","ia-section-head");
 put(header,el("span","ia-section-number","01 / THE BALLOT"),el("h3",null,"The people on the ballot"));
 s.append(header);
 const b=r.official_2026_candidate_snapshot;
 if(!b?.candidates?.length){
  s.append(el("p","ia-no-candidates","The state general-election candidate list has not passed our source review."));
  return s;
 }
 const major=[...b.candidates].filter(x=>x.party==="DEM"||x.party==="REP").sort((a,b)=>a.party==="DEM"?-1:1);
 const other=b.candidates.filter(x=>x.party!=="DEM"&&x.party!=="REP");
 const grid=el("div","ia-candidate-grid");
 major.forEach(c=>grid.append(candidateCard(r,c)));
 if(major.length===2)grid.append(el("span","ia-versus","VS"));
 s.append(grid);
 if(other.length){
  const overflow=el("div","ia-other-ballot");overflow.append(el("strong",null,"ALSO ON THE STATE-REVIEWED BALLOT"));
  const tags=el("div","ia-other-tags");
  for(const c of other)put(tags,el("span","ia-other-person",c.name+" · "+partyText(c.party)));
  overflow.append(tags);s.append(overflow);
 }
 const foot=el("div","ia-candidate-sourcing");
 put(foot,el("span",null,"Names checked against the Iowa Secretary of State's 2026 candidate list."));
 source(foot,"View ballot source",b.source_url);s.append(foot);
 return s;
}
function bar(parent,entries){
 const track=el("div","ia-data-bar");
 track.setAttribute("role","img");
 track.setAttribute("aria-label",entries.map(x=>x.name+" "+pp(x.pct)+" percent").join("; "));
 for(const x of entries){
  if(x.pct<=0)continue;
  const piece=el("span","ia-bar-piece ia-color-"+x.kind);
  piece.style.width=x.pct+"%";piece.title=x.name+" "+pp(x.pct)+"%";
  track.append(piece);
 }
 parent.append(track);
 const legend=el("div","ia-bar-legend");
 for(const x of entries){
  put(legend,put(el("div","ia-legend-item"),el("i","ia-legend-chip ia-color-"+x.kind),el("span",null,x.name),el("strong",null,pp(x.pct)+"%")));
 }
 parent.append(legend);
}
function renderEvidence(r,meta,mode,target){
 target.replaceChildren();
 const {past,poll}=meta;
 if(mode==="2024"){
  if(!past){
   target.append(el("p","ia-evidence-missing","No comparable counted-vote district result is available."));return;
  }
  const h=past.h,total=h.dem_votes+h.rep_votes+(h.other_votes||0);
  const title=put(el("div","ia-measurement-heading"),el("span","ia-proof-label","2024 ACTUAL HOUSE VOTES · COMPARABLE DISTRICT LINES"),
    el("strong","ia-measurement-lead",fmt(past.gap)+" votes"),el("span","ia-measurement-context","separated the two major parties · "+partyText(past.party)+" won"));
  target.append(title);
  bar(target,[
   {name:"Democratic votes",kind:"dem",pct:h.dem_votes/total*100},
   {name:"Republican votes",kind:"rep",pct:h.rep_votes/total*100},
   {name:"Other votes",kind:"other",pct:(h.other_votes||0)/total*100}
  ]);
  target.append(el("p","ia-evidence-note",fmt(h.dem_votes)+" Democratic votes · "+fmt(h.rep_votes)+" Republican votes · "+fmt(h.other_votes||0)+" other votes. The bar shows votes cast in 2024, not 2026 support or winning chances."));
  source(target,"2024 original-source-derived results",h.source_url);
 }else{
  if(!poll){
   put(target,el("div","ia-measurement-heading",null),el("p","ia-evidence-missing","No eligible 2026 named-candidate poll in the desk's verified evidence ledger. An absent poll is not a tie or a forecast."));
   return;
  }
  const p=poll.p;
  const compiled=p.source_tier!=="original_release_checked";
  const leader=poll.delta>0?"Democratic":poll.delta<0?"Republican":"Neither party";
  const heading=el("div","ia-measurement-heading");
  put(heading,el("span","ia-proof-label","2026 NAMED-CANDIDATE POLL · "+(compiled?"SECONDARY REPORT":"ORIGINAL REVIEWED")),
     el("strong","ia-measurement-lead",poll.delta===0?"Tied responses":pp(Math.abs(poll.delta))+" points"),
     el("span","ia-measurement-context",poll.delta===0?"Democratic and Republican response shares tied":leader+" reported survey advantage"));
  target.append(heading);
  const entries=p.candidates.map(c=>({name:c.name,kind:c.party==="D"?"dem":c.party==="R"?"rep":"ind",pct:c.pct}));
  const unreported=100-p.candidates.reduce((a,c)=>a+c.pct,0);
  if(unreported>0.01)entries.push({name:"Other / unreported",kind:"other",pct:unreported});
  bar(target,entries);
  target.append(el("p","ia-evidence-note",p.pollster+" · listed "+p.reported_date+" · "+(compiled?"Original survey sample, sponsor and field dates not independently checked.":"Original publication reviewed.")+" These are survey response shares, NOT election results or probabilities."));
  source(target,compiled?"Reported survey page":"Published original survey",p.source_url);
  if(compiled)source(target,"Public compilation listing",p.compilation_url);
 }
}
function evidence(r,meta){
 const wrap=el("section","ia-evidence-section");
 const hdr=el("div","ia-section-head");
 put(hdr,el("span","ia-section-number","02 / EVIDENCE LAB"),el("h3",null,"Compare the evidence, not pretend it's a forecast"));
 wrap.append(hdr);
 const intro=el("p","ia-section-intro","Switch between two different types of measurement. Each uses its own year, candidates and source. Neither becomes a certified 2026 win probability.");
 wrap.append(intro);
 const controls=el("div","ia-evidence-tabs");
 controls.setAttribute("role","tablist");controls.setAttribute("aria-label","Choose Iowa race evidence year");
 const panel=el("div","ia-measurement");panel.id="ia-evidence-panel";panel.setAttribute("role","tabpanel");
 const buttons={};
 for(const mode of ["2024","2026"]){
  const button=el("button","ia-evidence-tab",mode==="2024"?"2024 · COUNTED VOTES":"2026 · PUBLISHED POLL");
  button.type="button";button.setAttribute("role","tab");button.id="ia-tab-"+mode;
  button.setAttribute("aria-controls",panel.id);
  button.addEventListener("click",()=>choose(mode));
  button.addEventListener("keydown",e=>{
   if(e.key==="ArrowRight"||e.key==="ArrowLeft"){
    e.preventDefault();const target=mode==="2024"?"2026":"2024";choose(target);buttons[target].focus();
   }
  });
  buttons[mode]=button;controls.append(button);
 }
 function choose(mode){
  for(const [key,b] of Object.entries(buttons)){
   b.setAttribute("aria-selected",String(mode===key));
   b.tabIndex=mode===key?0:-1;
  }
  panel.setAttribute("aria-labelledby",buttons[mode].id);
  renderEvidence(r,meta,mode,panel);
 }
 wrap.append(controls,panel);
 choose(meta.poll?"2026":"2024");
 return wrap;
}
function insights(r,meta){
 const {s,past,poll}=meta;
 const block=el("section","ia-insights");
 const title=el("div","ia-section-head");
 put(title,el("span","ia-section-number","03 / THE NEWSROOM READ"),el("h3",null,"Three things that actually matter"));
 block.append(title);
 const grid=el("div","ia-insight-grid");
 const a=el("article","ia-insight");
 put(a,el("small",null,"WHAT THE LAST ELECTION TELLS US"),el("strong",null,past?fmt(past.gap)+" votes · 2024 gap":"Historical comparison unavailable"),
    el("p",null,past?"In 2024, "+partyText(past.party)+" won this district by "+fmt(past.gap)+" major-party votes. This is a recorded result, not a 2026 estimate.":"No comparable historical voting margin is available."));
 grid.append(a);
 const b=el("article","ia-insight");
 put(b,el("small",null,s.fact),el("strong",null,poll?"Survey dated "+poll.p.reported_date:"No 2026 district poll"),
   el("p",null,s.factDetail));
 grid.append(b);
 const c=el("article","ia-insight ia-insight-question");
 put(c,el("small",null,"THE QUESTION WE CAN'T ANSWER YET"),
   el("strong",null,"What comes next?"),el("p",null,s.question));
 grid.append(c);block.append(grid);
 return block;
}
function sourceStrip(r,meta){
 const box=el("div","ia-evidence-footer");
 const col=el("div","ia-evidence-footer-main");
 put(col,el("strong",null,"READING RULES"),el("span",null,"2024 returns are actual counted-vote evidence; 2026 survey figures are reported shares. They are never averaged into odds. A secondary compilation is not an original poll audit."));
 box.append(col);
 const links=el("div","ia-footer-links");
 const ballot=r.official_2026_candidate_snapshot;
 if(ballot)source(links,"Official state ballot roster",ballot.source_url);
 if(meta.past)source(links,"2024 House votes",meta.past.h.source_url);
 if(meta.poll)source(links,"Reported poll",meta.poll.p.source_url);
 box.append(links);return box;
}
function render(r,state){
 if(r.state!=="IA"||!story[r.id])return;
 const slot=document.getElementById("iowa-edition");if(!slot)return;
 const meta=metadata(r),s=meta.s;
 const valid=meta.past!==null&&meta.checked;
 // Do not substitute an invented story if the primary inputs unexpectedly disappear.
 if(!valid)return;
 document.body.classList.add("iowa-edition-active","ia-tone-"+s.tone);
 slot.hidden=false;slot.replaceChildren();
 const lead=el("section","ia-cover");
 const mast=el("div","ia-cover-strap");
 put(mast,el("span",null,"THE POLITICAL LIFE & TIMES · THE IOWA FOUR"),
   el("span",null,"2026 HOUSE ELECTION · NOVEMBER 3"));
 lead.append(mast,topNav(r));
 const grid=el("div","ia-cover-grid");
 const editorial=el("div","ia-cover-editorial");
 const history=meta.past, polled=meta.poll;
 put(editorial,el("span","ia-feature-kicker",s.kicker),
     el("h2","ia-feature-headline",r.id==="IA-01"?"A seat decided by "+fmt(history.gap)+" votes.":s.headline),
     el("p","ia-feature-deck",s.standfirst));
 const prose=el("div","ia-editorial-callout");
 put(prose,el("strong",null,"THE READ, WITHOUT FAKE ODDS"),el("p",null,s.angle));
 editorial.append(prose);
 const micro=el("div","ia-quick-metrics");
 const gap=put(el("div","ia-quick-fact"),el("span",null,"2024 VOTE GAP"),el("strong",null,fmt(history.gap)),el("small",null,"actual major-party votes"));
 const survey=put(el("div","ia-quick-fact"),el("span",null,"2026 REPORTED POLL"),el("strong",null,polled?(polled.delta>0?"D +":polled.delta<0?"R +":"TIED ")+pp(Math.abs(polled.delta)):"—"),
    el("small",null,polled?"secondary survey / not odds":"no eligible survey"));
 const people=put(el("div","ia-quick-fact"),el("span",null,"OFFICIAL BALLOT"),el("strong",null,r.official_2026_candidate_snapshot.candidates.length),el("small",null,"listed candidates"));
 micro.append(gap,survey,people);editorial.append(micro);grid.append(editorial);
 const geography=el("aside","ia-cover-map");
 put(geography,el("span","ia-cover-map-title","IOWA / 2026 DISTRICT LINES"),el("div","ia-map-art","Loading the Census district map…"),
   el("p","ia-map-note","Select any outlined district to open its own race file. The map shows boundaries only, not predicted winners."));
 grid.append(geography);lead.append(grid);slot.append(lead);
 renderMap(r,geography.querySelector(".ia-map-art"));
 slot.append(candidates(r),evidence(r,meta),insights(r,meta),sourceStrip(r,meta));
 // Retain and expose the full existing research audit without forcing it above the story.
 const dossier=el("details","ia-full-dossier");
 const summary=el("summary",null,"OPEN THE FULL RACE EVIDENCE, SOURCE AUDIT & FEC RECORDS");
 const content=el("div","ia-dossier-content");
 const nodes=[document.getElementById("coverage-section"),document.getElementById("map-warning"),
   document.querySelector("body[data-house-page=district] .panels"),
   document.querySelector("body[data-house-page=district] .fec-wrap"),
   document.getElementById("result-panel")?.parentElement];
 for(const n of nodes)if(n)content.append(n);
 dossier.append(summary,content);
 slot.append(dossier);
 const oldFront=document.getElementById("district-front");if(oldFront)oldFront.hidden=true;
 const oldMetrics=document.getElementById("metrics");if(oldMetrics)oldMetrics.hidden=true;
}
window.PoliticsIowaDesk=Object.freeze({render});
})();
