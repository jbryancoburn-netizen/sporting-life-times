/* The Political Life & Times • 435 district evidence atlas.
 * Never create party shading from FEC filings, DDHQ chances, generic polls,
 * 2024 old district results in a 2026 redrawn House district, or guesses.
 */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const newEl=(tag,text,cl)=>{let x=document.createElement(tag);if(text!=null)x.textContent=text;if(cl)x.className=cl;return x};
const fmt=n=>Number(n).toLocaleString("en-US");
const one=n=>Number(n).toFixed(1);
const urlForState=s=>"politics-house-state.html?state="+encodeURIComponent(s);
const urlForDistrict=id=>"politics-house-district.html?district="+encodeURIComponent(id);
const partyName=p=>({"D":"Democratic","R":"Republican","DEM":"Democratic","REP":"Republican","NPA":"No Party Affiliation","NPP":"No Party Preference","WRI":"Qualified write-in","LPF":"Libertarian Party of Florida","AIP":"American Independent","PAF":"Peace and Freedom","LIB":"Libertarian","GRE":"Green"})[p]||p;
const color=(party,margin)=>{
 if(!["D","R"].includes(party))return {bg:"#d9ddda",fg:"#17242c"};
 const strength=margin==null?11:Math.min(42,Math.max(0,Math.abs(margin)));
 const light=Math.max(43,90-strength*1.2);
 return {bg:"hsl("+(party==="D"?216:4)+" 56% "+light+"%)",fg:light<65?"#ffffff":"#17242c"};
};
const voters=r=>{let a=r["2024_presidential_actual"];return a?(a.winner_party==="D"?"D":"R")+" +"+one(Math.abs(a.dem_margin_pp))+" pp · 2024 presidential":""};

/* Source-matched historical portraits; candidate and party MUST equal the official ballot ledger.
 * Unverified names use typographic initials, never an invented face or lookalike.
 */
let housePortraits=new Map();
const initials=name=>String(name||"").split(/\s+/).filter(Boolean).filter(x=>!["jr.","sr.","iii"].includes(x.toLowerCase())).slice(0,2).map(x=>x.replace(/[^A-Za-z]/g,"").slice(0,1).toUpperCase()).join("")||"—";
async function loadHousePortraits(){
 try{
  const response=await fetch("politics-candidate-photos.json?v=20261101-portraits1",{cache:"force-cache"});
  if(!response.ok)throw Error("Photo ledger unavailable");
  const data=await response.json();
  if(data.schema_version!==1||data.status!=="SOURCE_MATCHED_CANDIDATE_PORTRAITS_PARTIAL"||
    !Array.isArray(data.photos)||data.coverage!==data.photos.length||data.photos.length>435)
    throw Error("Unverified candidate photo manifest");
  const seen=new Set();const incoming=new Map();
  for(const x of data.photos){
   const key=x.race_id+"|"+x.candidate_name+"|"+x.party;
   if(seen.has(key)||!/^([A-Z]{2})-(\d{2})$/.test(x.race_id)||typeof x.candidate_name!=="string"||
      !["DEM","REP","IND","LIB","GRE","OTH","NPA","WRI","NPP","AIP","PAF"].includes(x.party)||
      !/^https:\/\/(?:unitedstates\.github\.io\/images\/congress\/225x275\/[A-Z]\d{6}\.jpg|commons\.wikimedia\.org\/wiki\/Special:FilePath\/)/.test(x.image_url)||
      !/^https:\/\/(?:github\.com\/unitedstates\/images|commons\.wikimedia\.org\/wiki\/File:)/.test(x.source_url))
      throw Error("Unverified portrait source or duplicate candidate identity");
   seen.add(key);incoming.set(key,x);
  }
  housePortraits=incoming;
 }catch(error){console.warn("Candidate portraits: official fallback initials",error.message);}
}
function matchedPhoto(r,c){
 const entry=housePortraits.get(r.id+"|"+c.name+"|"+c.party);
 if(!entry||!r.official_2026_candidate_snapshot?.candidates?.some(b=>b.name===c.name&&b.party===c.party))return null;
 return entry;
}
function portraitNode(r,c,detail=false){
 const photo=matchedPhoto(r,c);
 const figure=newEl("span",null,"candidate-portrait "+(c.party==="DEM"?"portrait-dem":c.party==="REP"?"portrait-rep":"portrait-other"));
 figure.setAttribute("role","img");
 figure.setAttribute("aria-label",photo?"Verified portrait of "+c.name:"Portrait unavailable for "+c.name);
 const fallback=newEl("span",initials(c.name),"portrait-initials");figure.append(fallback);
 if(photo){
  const img=document.createElement("img");
  img.loading=detail?"eager":"lazy";img.decoding="async";img.alt="";
  img.width=detail?80:62;img.height=detail?80:62;
  img.referrerPolicy="no-referrer";
  img.src=photo.image_url;
  img.onerror=()=>{img.remove();figure.classList.add("portrait-missing");};
  figure.title=photo.credit;
  figure.append(img);
 }else figure.classList.add("portrait-missing");
 return figure;
}
/* Readable party emblems. Free Font Awesome political-animal icons (CC BY 4.0),
 * with text fallbacks if CDN images cannot load. These are symbols, not endorsements.
 * https://fontawesome.com/license/free
 */
function partySeal(code){
 const c=code==="DEM"?"dem":code==="REP"?"rep":"other";
 const name=code==="DEM"?"Democratic":code==="REP"?"Republican":partyName(code);
 const seal=newEl("span",null,"political-party-seal seal-"+c);
 seal.setAttribute("aria-label",name+" party identification");
 const text=newEl("span",code==="DEM"?"D":code==="REP"?"R":code==="IND"?"I":code,"seal-letter");
 seal.append(text);
 if(code==="DEM"||code==="REP"){
  const image=document.createElement("img");
  const symbol=code==="DEM"?"democrat":"republican";
  image.alt="";image.width=24;image.height=24;
  image.loading="lazy";image.decoding="async";
  image.src="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.7.2/svgs/solid/"+symbol+".svg";
  image.onload=()=>{seal.classList.add("seal-loaded");};
  image.onerror=()=>{image.remove();};
  seal.append(image);
 }
 const lab=newEl("span",name,"seal-text");
 const wrap=newEl("span",null,"party-seal-group");wrap.append(seal,lab);
 return wrap;
}
window.PoliticsHouseIdentity=Object.freeze({portrait:(r,c)=>portraitNode(r,c,true),seal:partySeal});
function stateStamp(code,cl){
 if(!window.PoliticsStateArt)return newEl("span",code,cl+" state-art-fallback");
 const stamp=newEl("span",null,cl);
 stamp.append(window.PoliticsStateArt.create(code));
 return stamp;
}
function graphicTheme(r,read){
 if(read.watch||read.label==="Signals disagree")return "purple";
 if(read.kind.startsWith("2024")||read.kind.startsWith("HISTORICAL"))return "history";
 if(read.source==="poll"&&read.signalParty==="D")return "dem";
 if(read.source==="poll"&&read.signalParty==="R")return "rep";
 return "slate";
}
function openCardIcon(){
 const outer=newEl("span",null,"card-open");
 outer.setAttribute("aria-hidden","true");
 const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
 svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("width","23");svg.setAttribute("height","23");
 svg.setAttribute("fill","none");svg.setAttribute("stroke","currentColor");svg.setAttribute("stroke-width","2.2");
 svg.setAttribute("stroke-linecap","round");svg.setAttribute("stroke-linejoin","round");
 const p=document.createElementNS("http://www.w3.org/2000/svg","path");
 p.setAttribute("d","M5 19 19 5M9 5h10v10");svg.append(p);outer.append(svg);
 return outer;
}

function districtEvidence(r){
 const poll=(r.district_specific_2026_polls||[]).find(p=>p.question_type!=="generic_house");
 if(poll){
   const people=[...poll.candidates].sort((a,b)=>b.pct-a.pct);
   const margin=people[0].pct-people[1].pct;
   const leader=margin<=0?"TIE":people[0].party;
   return {source:poll.source_tier==="public_compilation_not_original_checked"?"2026 published poll (compiled)":"2026 district poll (original release checked)",text:margin<=0?"Tied in latest named-candidate poll":partyName(leader)+" +"+one(margin)+" points",
           party:leader,margin:margin,sub:poll.pollster+" · "+poll.end_date+(poll.source_tier==="public_compilation_not_original_checked"?" · unverified survey sample":""),
           source_url:poll.source_url,dated:"2026",poll:true};
 }
 const h=r["2024_house_result_on_prior_boundaries"];
 if(h?.finalists?.length===2){
   const [winner,runner]=h.finalists;
   return {source:"Official 2024 general election",text:winner.name+" defeated "+runner.name+" by "+fmt(h.winner_runner_up_margin_votes)+" votes",
     party:null,margin:null,sub:"Named 2024 finalists · "+(h.same_2026_geography?"verified same geography":"2026 map comparison pending"),
     source_url:h.candidate_vote_source_url,dated:"2024",poll:false};
 }
 if(h && h.same_2026_geography){
   const margin=h.dem_two_party_margin_pp;
   return {source:"2024 House result",text:margin==null?partyName(h.party)+" won (no two-party margin)":partyName(h.party)+" +"+one(Math.abs(margin))+" points",
           party:h.party,margin:margin==null?null:Math.abs(margin),sub:"2024 actual result · not a 2026 poll",
           source_url:h.source_url,dated:"2024",poll:false};
 }
 const unopposed=r["2024_unopposed_official_context"];
 if(unopposed&&unopposed.contest_status==="elected_unopposed"){
   return {source:"Official 2024 unopposed result",text:unopposed.winner+" elected unopposed in 2024",
           party:null,margin:null,sub:"Winner verified; no vote-share tally or 2026 lead",dated:"2024",poll:false,source_url:unopposed.source_url};
 }
 if(r["2024_to_2026_geography_comparison"]==="pending_district_block_comparison"){
   return {source:"2026 district geography pending",text:"District boundary review pending",party:null,margin:null,
     sub:"State redrawn; individual district overlap not yet verified",dated:"2026",poll:false};
 }
 return {source:"No comparable local observations",text:"Data not available",party:null,margin:null,
          sub:"No sourced district poll or verified margin",dated:"2026",poll:false};
}
function assertAtlas(a){
 if(a?.status!=="COMPLETE_435_DISTRICT_RESEARCH_ATLAS_NOT_FORECAST"||a.district_count!==435||
    a.state_count!==50||!Array.isArray(a.districts)||a.districts.length!==435||
    !Array.isArray(a.states)||a.states.length!==50||a.forecast_eligible!==false||
    a.certified_2026_probabilities!==0)throw Error("Incomplete / uncertified House evidence");
}
async function readAtlas(){
 const response=await fetch("politics-house-atlas.json?t="+Date.now(),{cache:"no-store"});
 if(!response.ok)throw Error("Published source-ledger request failed");
 const x=await response.json();assertAtlas(x);return x;
}
function addLink(parent,text,href,cl){
 let a=newEl("a",text,cl);a.href=href;parent.append(a);return a;
}
function makeStateTile(s){
 let a=addLink(newEl("div"),s.code,urlForState(s.code),"state-tile");
 let m=s["2024_presidential_actual"],col=color(m.winner_party,Math.abs(m.dem_margin_pp));
 a.style.setProperty("--col",s.col);
 a.style.setProperty("--row",s.row);
 a.style.background=col.bg;a.style.color=col.fg;
 a.setAttribute("aria-label",s.name+": "+s.district_count+" House districts. 2024 statewide presidential "+(m.winner_party==="D"?"Democratic":"Republican")+" +"+one(Math.abs(m.dem_margin_pp))+" points. Open district directory.");
 a.title=s.name+" · "+voters(s)+" · "+s.district_count+" districts";
 return a;
}
function makeStateLink(s){
 const m=s["2024_presidential_actual"],c=color(m.winner_party,Math.abs(m.dem_margin_pp));
 let link=newEl("a",null,"state-link");link.href=urlForState(s.code);
 let stripe=newEl("div",null,"stripe");stripe.style.background=c.bg;
 let label=newEl("div");label.append(newEl("strong",s.name),newEl("small",s.district_count+" House seats · "+s["2026_verified_house_nominee_offices"]+" government-verified candidate lists · "+s["2026_house_poll_count"]+" district poll records"));
 link.append(stripe,label,newEl("span","›","arrow"));return link;
}
/* Election infographics use only attributable measurements, never model odds.
 * A 2026 poll is NOT averaged with 2024 votes; new boundaries are not backfilled.
 */
function districtGraphicData(r){
 const poll=(r.district_specific_2026_polls||[]).find(p=>p.question_type==="named_house");
 if(poll){
   const dem=(poll.candidates||[]).filter(x=>x.party==="D"),rep=(poll.candidates||[]).filter(x=>x.party==="R");
   if(dem.length===1&&rep.length===1){
     const d=dem[0].pct,v=rep[0].pct;
     if(Number.isFinite(d)&&Number.isFinite(v)&&d>=0&&v>=0&&d+v<=100.01){
       return {type:"poll",label:poll.source_tier==="original_release_checked"?"2026 POLL · ORIGINAL RELEASE":"2026 POLL · SECONDARY REPORT",
         source:poll.pollster+" · reported "+(poll.reported_date||poll.end_date),dem:d,rep:v,other:Math.max(0,100-d-v),
         foot:"Reported poll shares, not probabilities. Other / unreported share shown in gray.",
         caveat:poll.source_tier!=="original_release_checked"?"Original sample and sponsor not independently checked.":"Original survey source reviewed.",
         url:poll.source_url};
     }
   }
 }
 const hist=r["2024_house_result_on_prior_boundaries"];
 if(hist?.same_2026_geography&&hist.both_major_parties&&
    Number.isFinite(hist.dem_votes)&&Number.isFinite(hist.rep_votes)&&
    hist.dem_votes>0&&hist.rep_votes>0){
   const sum=hist.dem_votes+hist.rep_votes;
   return {type:"historical",label:"2024 HOUSE VOTE · ACTUAL RESULTS",source:"Previous election · comparable district boundaries",
     dem:hist.dem_votes/sum*100,rep:hist.rep_votes/sum*100,other:0,
     foot:"2024 two-party vote share only · NOT a 2026 poll or forecast.",
     caveat:"2024 vote totals: D "+fmt(hist.dem_votes)+" · R "+fmt(hist.rep_votes),
     url:hist.source_url};
 }
 if(hist?.finalists?.length===2){
   return {type:"historical_finalists",label:"2024 HOUSE · CERTIFIED FINALISTS",
     source:hist.candidate_vote_source_authority+" · 2024 general election",
     finalists:hist.finalists,writeins:hist.write_in_votes||0,
     foot:"Real general-election candidate votes, not a 2026 polling estimate.",
     caveat:hist.same_2026_geography?"Unchanged district boundary vintage.":"2026 district geography comparison pending; these are 2024 votes only.",
     url:hist.candidate_vote_source_url};
 }
 return {type:"unavailable",label:r["2024_to_2026_geography_comparison"]==="pending_district_block_comparison"?"BOUNDARY REVIEW · PENDING":"DISTRICT EVIDENCE · PENDING",
   source:"No validated D/R vote-share comparison",dem:null,rep:null,other:null,
   foot:"No comparable D/R percentage can be calculated from verified records.",
   caveat:r["2024_to_2026_geography_comparison"]==="pending_district_block_comparison"?"State map changed, but this district's overlap has not been verified.":"A named-candidate poll or comparable two-party result is not available.",url:null};
}
function renderDistrictGraphic(r){
 const data=districtGraphicData(r);
 const block=newEl("section",null,"district-infographic "+data.type);
 const head=newEl("div",null,"infographic-head");
 head.append(newEl("strong",data.label,"infographic-label"),newEl("span",data.type==="poll"?"SURVEY":data.type.startsWith("historical")?"HISTORY":"NO ESTIMATE","infographic-kind"));
 block.append(head);
 if(data.type==="unavailable"){
   const empty=newEl("div",null,"graphic-empty");
   empty.append(newEl("span","—","graphic-empty-mark"),newEl("span","No sourced comparison to chart","graphic-empty-text"));
   block.append(empty);
 }else if(data.type==="historical_finalists"){
   const figures=newEl("div",null,"infographic-figures finalist-vote-figures");
   const total=data.finalists.reduce((s,c)=>s+c.votes,0);
   const bar=newEl("div",null,"infographic-track");
   bar.setAttribute("role","img");
   bar.setAttribute("aria-label",data.finalists.map(c=>c.name+" "+fmt(c.votes)+" votes").join("; "));
   const palette={D:["#34649c","#8caed2"],R:["#a54940","#d1a097"]};
   data.finalists.forEach((c,i)=>{
     const share=100*c.votes/total;
     const cell=newEl("span",null,i?"infographic-rep":"infographic-dem");
     cell.append(newEl("b",fmt(c.votes)),newEl("small",c.name+" · "+partyName(c.party)+" · "+one(share)+"%"));
     figures.append(cell);
     const seg=newEl("span",null,i?"infographic-rep-bar":"infographic-dem-bar");
     seg.style.width=share+"%";seg.style.background=(palette[c.party]||["#75808b","#b2bbc5"])[i];bar.append(seg);
   });
   block.append(figures,bar);
   if(data.writeins)block.append(newEl("p",fmt(data.writeins)+" write-in votes recorded separately.","infographic-caveat"));
 }else{
   const figures=newEl("div",null,"infographic-figures");
   const left=newEl("span",null,"infographic-dem"),right=newEl("span",null,"infographic-rep");
   left.append(newEl("b",one(data.dem)+"%"),newEl("small","DEM"));
   right.append(newEl("b",one(data.rep)+"%"),newEl("small","REP"));
   figures.append(left,right);block.append(figures);
   const bar=newEl("div",null,"infographic-track");
   bar.setAttribute("role","img");
   bar.setAttribute("aria-label",data.label+": Democrats "+one(data.dem)+" percent; Republicans "+one(data.rep)+
       " percent"+(data.type==="poll"?"; other or unreported "+one(data.other)+" percent":"; two-party vote share")+".");
   const d=newEl("span",null,"infographic-dem-bar"),rep=newEl("span",null,"infographic-rep-bar");
   d.style.width=data.dem+"%";rep.style.width=data.rep+"%";bar.append(d,rep);
   if(data.type==="poll"&&data.other>0.01){
     const rest=newEl("span",null,"infographic-other-bar");rest.style.width=data.other+"%";bar.append(rest);
   }
   block.append(bar);
 }
 const source=newEl("div",null,"infographic-source");
 source.append(newEl("strong",data.source),newEl("span",data.foot));
 block.append(source,newEl("p",data.caveat,"infographic-caveat"));
 return block;
}
/* Editorial, transparent early outlook. Direction is a qualitative evidence read,
   never a calibrated 2026 win probability or certified forecast. */
function preliminaryRaceRead(r){
 const graphic=districtGraphicData(r);
 const h=r["2024_house_result_on_prior_boundaries"];
 const validHistory=!!(h?.same_2026_geography&&h.both_major_parties&&Number.isFinite(h.dem_two_party_margin_pp));
 const oldMargin=validHistory?h.dem_two_party_margin_pp:null;
 const poll=(r.district_specific_2026_polls||[]).find(p=>p.question_type==="named_house"&&
   p.candidates?.filter(c=>c.party==="D").length===1&&p.candidates?.filter(c=>c.party==="R").length===1&&
   p.candidates?.every(c=>Number.isFinite(c.pct)&&c.pct>=0&&c.pct<=100)&&
   p.candidates.reduce((sum,c)=>sum+c.pct,0)<=100.01);
 const pollValid=graphic.type==="poll"&&!!poll;
 const pMargin=pollValid?graphic.dem-graphic.rep:null;
 const sourceChecked=!!(poll&&poll.source_tier==="original_release_checked"&&poll.source_verified===true&&
   Number.isFinite(poll.sample_size)&&poll.sample_size>=250);
 const winner=v=>v>0?"Democratic":v<0?"Republican":"Neither";
 const side=v=>v>0?"D":v<0?"R":null;
 const small=pMargin!=null&&Math.abs(pMargin)<3;
 const historyClose=oldMargin!=null&&Math.abs(oldMargin)<5;
 const split=pMargin!=null&&oldMargin!=null&&Math.abs(pMargin)>=3&&Math.abs(oldMargin)>=3&&Math.sign(pMargin)!==Math.sign(oldMargin);
 const aligned=pMargin!=null&&oldMargin!=null&&!small&&!historyClose&&Math.sign(pMargin)===Math.sign(oldMargin);
 let label="Evidence incomplete",kind="INSUFFICIENT INPUTS",sub="The desk cannot yet identify a defensible edge.",tag="Needs research",watch=false;
 if(r["2024_to_2026_geography_comparison"]==="pending_district_block_comparison"&&!pollValid){
  label="Map review pending";kind="DISTRICT OVERLAP UNVERIFIED";sub="The state was redrawn, but a change to this district has not been verified.";tag="Boundary audit";
 }else if(pollValid&&split){
  label="Signals disagree";kind="EARLY RACE READ · NOT ODDS";sub="The 2026 poll and comparable 2024 House result point in different directions.";tag="Race to watch";watch=true;
 }else if(pollValid&&small){
  label="Close in the polling";kind=sourceChecked?"ORIGINAL 2026 POLL":"REPORTED 2026 POLL";
  sub="The named-party polling difference is under three points; one poll cannot settle the race.";tag="Race to watch";watch=true;
 }else if(pollValid&&sourceChecked&&aligned){
  label="Early "+winner(pMargin)+" edge";kind="EARLY READ · TWO ALIGNED SIGNALS";
  sub="A verified 2026 poll and comparable 2024 House votes point the same way; not calibrated odds.";
  tag=Math.abs(pMargin)<=6?"Race to watch":"Polling + history";watch=Math.abs(pMargin)<=6;
 }else if(pollValid){
  label=(sourceChecked?"Polling edge: ":"Reported poll: ")+winner(pMargin);
  kind=sourceChecked?"ORIGINAL 2026 POLL":"SECONDARY POLL · PRELIMINARY";
  sub=sourceChecked?"One original survey shows this direction; historic context may differ.":"A public compilation reports this lead; original survey details are not fully verified.";
  tag=sourceChecked?"Poll signal":"Limited-source signal";watch=Math.abs(pMargin)<=6;
 }else if(validHistory&&historyClose){
  label="Close in 2024";kind="HISTORICAL BASELINE · NOT FORECAST";
  sub="The last comparable House election was decided by fewer than five points.";tag="Race to watch";watch=true;
 }else if(validHistory){
  label="History favors "+winner(oldMargin);kind="2024 ACTUAL HOUSE RESULT";
  sub="This is the prior-election baseline, not a 2026 winner prediction.";tag="Historical only";
 }else if(h&&h.same_2026_geography){
  label="No two-party baseline";kind="2024 HISTORY · INCOMPLETE";
  sub="The earlier contest lacks a measured two-party margin.";tag="Needs research";
 }
 const reasons=[];
 if(pollValid)reasons.push({head:"2026 POLL",value:(pMargin>0?"D":pMargin<0?"R":"TIED")+(pMargin===0?"":" +"+one(Math.abs(pMargin)))+" pts",note:sourceChecked?"Original checked":"Secondary compilation"});
 else reasons.push({head:"2026 POLL",value:"Not verified",note:"No eligible named poll"});
 if(validHistory)reasons.push({head:"2024 HOUSE",value:(oldMargin>0?"D":"R")+" +"+one(Math.abs(oldMargin))+" pts",note:"Comparable boundary"});
 else reasons.push({head:"2024 HOUSE",value:r["2026_boundaries_revised"]?"Old map":"No D/R margin",note:r["2026_boundaries_revised"]?"Cannot compare":"Not eligible"});
 reasons.push({head:"CANDIDATE FILE",value:r.official_2026_candidate_snapshot?"Source-checked":"Not confirmed",note:r.official_2026_candidate_snapshot?"State election office":"FEC filing ≠ ballot"});
 return {label,kind,sub,tag,watch,reasons,source:graphic.type,signalParty:pMargin!=null?side(pMargin):oldMargin!=null?side(oldMargin):null};
}
function raceReadPanel(r){
 const read=preliminaryRaceRead(r);
 const block=newEl("section",null,"early-race-read "+(read.watch?"watch-race-read":""));
 block.setAttribute("aria-label","Preliminary evidence read, not a certified election forecast");
 const head=newEl("div",null,"read-heading");
 head.append(newEl("span","THE EARLY READ","read-eyebrow"),newEl("span",read.kind,"read-status"));
 block.append(head);
 const line=newEl("div",null,"read-main");
 line.append(newEl("strong",read.label,"read-outlook"),newEl("span",read.tag,"read-tag"));
 block.append(line,newEl("p",read.sub,"read-context"));
 return block;
}
function raceReasonPanel(r){
 const read=preliminaryRaceRead(r);
 const block=newEl("div",null,"race-fast-facts");
 block.append(newEl("span","WHY THIS READ?","fast-facts-head"));
 const grid=newEl("div",null,"fast-facts-grid");
 for(const fact of read.reasons){
  const item=newEl("span",null,"fast-fact");
  item.append(newEl("small",fact.head),newEl("strong",fact.value),newEl("em",fact.note));
  grid.append(item);
 }
 block.append(grid);
 return block;
}
function makeDistrictCard(r){
 const info=districtEvidence(r),paint=color(info.party,info.margin);
 const read=preliminaryRaceRead(r);
 const theme=graphicTheme(r,read);
 const link=newEl("a",null,"district-card district-card-infographic theme-"+theme+(read.watch?" race-watch-card":""));link.href=urlForDistrict(r.id);
 link.setAttribute("aria-label",r.id+": "+read.label+". "+info.text+". Open the source-linked district report.");
 const top=newEl("div",null,"top");
 const mark=newEl("span",read.watch?"◆":info.party||"—","marker");
 if(read.watch){mark.setAttribute("aria-label","Purple watchlist / mixed-signal marker");}
 mark.style.background=paint.bg;mark.style.color=paint.fg;
 mark.classList.add(info.party==="D"?"marker-dem":info.party==="R"?"marker-rep":"marker-neutral");
 mark.title=read.watch?"Purple watchlist: conflicting or competitive evidence, not a predicted winner":
   (info.party==="D"?"Democratic":info.party==="R"?"Republican":"No comparable lead")+" · "+info.source+" · never a 2026 probability";
 const actions=newEl("span",null,"card-actions");actions.append(mark,openCardIcon());
 const titleWrap=newEl("div",null,"card-district-title");
 titleWrap.append(newEl("span","CONGRESSIONAL DISTRICT","district-kicker"),newEl("strong",r.at_large?r.state+" At-Large":r.id));
 top.append(stateStamp(r.state,"district-watermark"),titleWrap,actions);
 const early=raceReadPanel(r);
 const evidence=renderDistrictGraphic(r);
 const reasons=raceReasonPanel(r);
 const ballot=r.official_2026_candidate_snapshot;
 let field=null;
 if(ballot?.candidates?.length){
   field=newEl("div",null,"state-candidate-preview infographic-candidate-field");
   field.append(newEl("span","2026 BALLOT · VERIFIED CANDIDATES","field-label"));
   const names=newEl("div",null,"field-names candidate-versus");
   // Display both major parties where possible without changing the official source list.
   const selected=[...ballot.candidates].sort((x,y)=>{
     const priority=p=>p==="DEM"?0:p==="REP"?1:2;
     return priority(x.party)-priority(y.party);
   }).slice(0,2);
   selected.forEach(c=>{
     const item=newEl("div",null,"field-person");
     item.append(portraitNode(r,c));
     item.classList.add("candidate-side-"+(c.party==="DEM"?"dem":c.party==="REP"?"rep":"other"));
     const identity=newEl("span",null,"field-identity");
     identity.append(newEl("span",c.name,"field-name"),partySeal(c.party));item.append(identity);names.append(item);
   });
   if(selected.length===2)names.append(newEl("span","VS","faceoff-versus"));
   field.append(names);
   if(ballot.candidates.length>2)field.append(newEl("span","+"+(ballot.candidates.length-2)+" more verified candidate"+(ballot.candidates.length===3?"":"s")+" · full roster in report","field-more"));
 }else{
   field=newEl("div",null,"field-unverified");
   field.append(newEl("span","CANDIDATE FILE","field-label"),newEl("strong","2026 official list not yet independently verified"));
 }
 const foot=newEl("div",null,"bottom infographic-bottom");
 const sourceBadge=newEl("span",ballot?"CANDIDATES VERIFIED ✓":"BALLOT SOURCE PENDING","source-chip "+(ballot?"source-chip-ok":"source-chip-pending"));
 foot.append(sourceBadge,newEl("span","VIEW RACE FILE →","infographic-cta"));
 link.append(top,early,field,evidence,reasons,foot);
 link.title=r.id+": "+info.source+". "+info.text+". Data is not a forecast.";
 return link;
}
/* Transparent, identical source-coverage criteria for every 2026 House seat. */
function coverageCell(label,value,note,status){
 const cell=newEl("article",null,"coverage-cell "+status);
 cell.append(newEl("span",label,"coverage-label"),newEl("strong",String(value)),newEl("span",note,"coverage-note"));
 return cell;
}
function showCoverage(rows,mode){
 const target=$("coverage-board");if(!target)return;
 target.replaceChildren();
 const n=rows.length;
 const official=rows.filter(r=>!!r.official_2026_candidate_snapshot).length;
 const anyPoll=rows.filter(r=>r.district_specific_2026_polls?.length).length;
 const primary=rows.filter(r=>r.district_specific_2026_polls?.some(p=>p.source_tier==="original_release_checked")).length;
 const secondary=rows.filter(r=>r.district_specific_2026_polls?.some(p=>p.source_tier==="public_compilation_not_original_checked")).length;
 const old=rows.filter(r=>!!r["2024_house_result_on_prior_boundaries"]).length;
 const unopposed=rows.filter(r=>!!r["2024_unopposed_official_context"]).length;
 const comparable=rows.filter(r=>r["2024_house_result_on_prior_boundaries"]?.same_2026_geography).length;
 const fec=rows.filter(r=>r.registered_fec_filings_2026>0).length;
 const changed=rows.filter(r=>r["2026_boundaries_revised"]).length;
 const suffix=mode==="district"?"":(" / "+n);
 target.append(
   coverageCell("State-source candidate snapshots",official+suffix,official===n?"Government-source candidate lists present.":"Other seats await independently reviewed general-election candidate lists.",official===n?"ok":"limited"),
   coverageCell("2026 district polls published",anyPoll+suffix,primary+" seat(s) with directly checked originals; "+secondary+" with secondary compiled entries.",anyPoll===n?"ok":anyPoll?"limited":"absent"),
   coverageCell("2024 House counted-vote records",old+suffix,unopposed+" official unopposed winner(s) without general-election vote totals; "+comparable+" counted-vote records on comparable boundaries.",old===n&&changed===0?"ok":"limited"),
   coverageCell("FEC registration records",fec+suffix,"Official candidate registrations; not November ballot qualification.",fec===n?"ok":"limited"),
   coverageCell("Census demographic context",n+suffix,changed?"ACS 2020–2024 district profiles use old boundaries in "+changed+" seat(s).":"Historical ACS 2020–2024; not a current population count.",changed?"limited":"ok"),
   coverageCell("Certified 2026 district forecasts","0"+suffix,"Our independent probabilities are not yet certified; never fill missing odds.", "absent")
 );
 if(mode==="district"){
   // Avoid showing a '0 / 1' boilerplate where an explicit check is clearer.
   const cells=[...target.querySelectorAll(".coverage-cell")];
   const yes=cell=>cell.querySelector("strong").textContent==="1";
   cells[0].querySelector("strong").textContent=official?"Available":"Not verified";
   cells[1].querySelector("strong").textContent=primary?"Original checked":secondary?"Compiled only":anyPoll?"Poll recorded":"No reviewed poll";
   cells[2].querySelector("strong").textContent=old?(comparable?"Comparable 2024":"Old boundaries"):unopposed?"Unopposed; no tally":"Not in archive";
   cells[3].querySelector("strong").textContent=fec?"FEC records":"None indexed";
   cells[4].querySelector("strong").textContent=changed?"Historical lines":"Historical ACS";
   cells[5].querySelector("strong").textContent="Not certified";
   cells[2].classList.toggle("limited",!comparable);
   if(comparable){cells[2].classList.remove("limited");cells[2].classList.add("ok");}
 }
}
const FEC_PARTY_CODES={
 "DEM":"Democratic","REP":"Republican","IND":"Independent","LIB":"Libertarian",
 "GRE":"Green","N":"Unspecified N","NON":"Nonpartisan/unspecified",
 "UN":"Unspecified","W":"Other/W","OTH":"Other","NNE":"Unspecified NNE"
};
async function renderFEC(r){
 const box=$("fec-panel");if(!box)return;
 try{
  const response=await fetch("politics-fec-race-index.json?t="+Date.now(),{cache:"no-store"});
  if(!response.ok)throw Error("FEC indexed file unavailable");
  const data=await response.json();
  if(data.status!=="ok"||data.cycle!==2026||data.house_district_inventory!==435||
      !Array.isArray(data.house)||data.house.length!==435)
    throw Error("FEC source contract failed");
  const entry=data.house.find(x=>x.id===r.id);
  if(!entry||entry.registered_filings!==r.registered_fec_filings_2026)
    throw Error("FEC district count conflicts with 435-seat research atlas");
  const total=Object.values(entry.parties||{}).reduce((a,b)=>a+b,0);
  if(total!==entry.registered_filings)throw Error("Party-code total does not match original filings");
  box.replaceChildren();
  box.append(newEl("p",entry.registered_filings+" candidate records indexed in the official 2026 FEC candidate master. These include primaries, withdrawn or unsuccessful filings and possibly multiple records; they do not identify the certified November ballot.","fec-rule"));
  box.append(newEl("p","FEC party-code breakdown · registration records, not general-election candidates","eyebrow"));
  const tags=newEl("div",null,"fec-tags");
  Object.entries(entry.parties).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).forEach(([code,n])=>{
    tags.append(newEl("span",(FEC_PARTY_CODES[code]||"FEC code "+code)+" ("+code+"): "+n));
  });
  box.append(tags);
  box.append(newEl("p",entry.finance_records+" FEC candidate financial-record matches in the indexed dataset. This is a record-coverage count, not the amount raised or spent.","footnote"));
  box.append(newEl("p",entry.incumbent_filing_ids?.length?
     entry.incumbent_filing_ids.length+" filing ID(s) flagged as incumbent in the FEC index; this flag is not an independently verified current officeholder or candidate qualification.":
     "No incumbent-flagged filing IDs in this source snapshot.","footnote"));
  const link=addLink(box,"FEC candidate-master file and field definitions ↗",data.source_url,"src");
  link.target="_blank";link.rel="noopener noreferrer";
 }catch(e){
  box.replaceChildren(newEl("p","The 2026 FEC party breakdown is temporarily unavailable or inconsistent with the House ledger; no counts have been inferred.","fec-rule"));
  console.error("FEC House record",e);
 }
}

function insertMetric(container,values){
 const cells=container.querySelectorAll(".metric b");
 values.forEach((v,i)=>{if(cells[i])cells[i].textContent=String(v)});
}
function title(suffix){document.title=suffix+" | The Political Life & Times"}
function err(message){const area=$("view-content")||$("state-cards")||$("district-details");if(area)area.replaceChildren(newEl("p",message,"notice-error"));}
function renderNational(a){
 title("All 435 U.S. House districts");
 insertMetric($("metrics"),["435","50",fmt(a["2026_official_ballot_offices"]),a["2026_polled_districts"]]);
  showCoverage(a.districts,"national");
 if(window.PoliticsRaceExperience)window.PoliticsRaceExperience.renderNational({rows:a.districts});
 const board=$("state-tiles"),list=$("state-list");
 a.states.forEach(s=>list.append(makeStateLink(s)));
  if(window.HouseGeo){window.HouseGeo.evidenceColor=color;window.HouseGeo.national(a,board);}
 const input=$("state-search");input.addEventListener("input",()=>{
   let term=input.value.trim().toLocaleLowerCase();
   list.replaceChildren();
   a.states.filter(s=>s.name.toLowerCase().includes(term)||s.code.toLowerCase().includes(term)).forEach(s=>list.append(makeStateLink(s)));
   if(!list.children.length)list.append(newEl("p","No states match that search.","footnote"));
 });
 $("atlas-updated").textContent="EVIDENCE ASSEMBLED "+a.generated_at.slice(0,10)+" · ORIGINAL SOURCE SNAPSHOTS";
}
function renderState(a){
 let code=(new URLSearchParams(location.search).get("state")||"").trim().toUpperCase();
 let state=a.states.find(x=>x.code===code);
 if(!state){err("This is not one of the 50 states. Choose a state from the House atlas.");return}
 title(state.name+" — all House districts");
 $("state-title").textContent=state.name;
 $("state-desc").textContent=state.district_count+" CONGRESSIONAL "+(state.district_count===1?"SEAT":"DISTRICTS")+" · NOVEMBER 3, 2026";

 const pres=state["2024_presidential_actual"];
 $("state-history").textContent=(pres.winner_party==="D"?"Democrat":"Republican")+" +"+one(Math.abs(pres.dem_margin_pp))+" points · statewide presidential vote";
 $("state-edition-heading").textContent=state.district_count===1?"The race for the House seat":"The race for "+state.name+"'s "+state.district_count+" House seats";
 const mapStatus=$("state-map-status-pill");
 if(mapStatus)mapStatus.textContent=state["2026_congressional_map_changed"]?"2026 map · redrawn":"2026 map · unchanged";
 insertMetric($("metrics"),[state.district_count,state["2026_verified_house_nominee_offices"],state["2026_house_poll_count"]]);
 const rows=a.districts.filter(x=>x.state===code).sort((a,b)=>a.district.localeCompare(b.district));
 if(window.PoliticsRaceExperience)window.PoliticsRaceExperience.renderState({state,rows});
 if(window.PoliticsRaceBranding)window.PoliticsRaceBranding.decorateState({state,rows});
 if(window.PoliticsStateArt){
  const hero=$("state-hero-art");
  if(hero)hero.append(window.PoliticsStateArt.create(code,"hero-outline"));
  // A single shared SVG symbol powers the page hero and every district card.
  window.PoliticsStateArt.prepare(code,state.district_count);
 }
 const watchRows=rows.filter(x=>preliminaryRaceRead(x).watch);
 const lead=$("state-edition-heading"),deck=document.querySelector(".state-lead-main > p");
 const comparable=rows.filter(r=>{
  const h=r["2024_house_result_on_prior_boundaries"];
  return h?.same_2026_geography&&Number.isFinite(h.dem_votes)&&Number.isFinite(h.rep_votes);
 }).sort((a,b)=>{
  const x=a["2024_house_result_on_prior_boundaries"],y=b["2024_house_result_on_prior_boundaries"];
  return Math.abs(x.dem_votes-x.rep_votes)-Math.abs(y.dem_votes-y.rep_votes);
 });
 if(state.district_count===4&&lead)lead.textContent="Four districts. Four different House stories.";
 if(deck){
  const near=comparable[0],old=near?.["2024_house_result_on_prior_boundaries"];
  const n=rows.filter(r=>r.district_specific_2026_polls?.length).length;
  deck.textContent=(old?"Closest 2024 House vote: "+fmt(Math.abs(old.dem_votes-old.rep_votes))+" ballots in "+near.id+". ":"")+
   watchRows.length+" watch-flagged district"+(watchRows.length===1?"":"s")+
   " and "+n+" district"+(n===1?"":"s")+" with reported polling. Sources and vintage restrictions remain visible.";
 }
 const conflicting=rows.filter(x=>preliminaryRaceRead(x).label==="Signals disagree");
 const watchBox=$("state-headline-watch"),mixedBox=$("state-headline-conflicts"),ballotBox=$("state-headline-ballots");
 if(watchBox)watchBox.textContent=String(watchRows.length);
 if(mixedBox)mixedBox.textContent=String(conflicting.length);
 if(ballotBox)ballotBox.textContent=String(rows.filter(x=>x.official_2026_candidate_snapshot).length)+" / "+rows.length;
 const highlight=conflicting[0]||watchRows[0];
 const spotlight=$("state-spotlight");
 if(spotlight){
  spotlight.replaceChildren();
  if(highlight){
    const read=preliminaryRaceRead(highlight),spotlink=newEl("a",null,"state-spotlight-link");
    spotlink.href=urlForDistrict(highlight.id);
    spotlink.append(newEl("span",highlight.id+" · THE RACE FILE","spotlight-kicker"),
       newEl("strong",read.label,"spotlight-title"),
       newEl("span","See the polling, historical context and candidate field ↗","spotlight-cta"));
    spotlight.append(spotlink);
  }else{
    spotlight.append(newEl("span","No districts are flagged by the current screening rules; missing data is not an uncompetitive race.","spotlight-empty"));
  }
 }
 showCoverage(rows,"state");
  let grid=$("district-cards"),select=$("district-filter");
 function paint(){
  let filter=select.value,shown=rows.filter(x=>filter==="all"||(filter==="poll"&&x.district_specific_2026_polls.length)||
    (filter==="ballot"&&x.official_2026_candidate_snapshot)||(filter==="historical"&&x["2024_house_result_on_prior_boundaries"]?.same_2026_geography)||
     (filter==="missing-ballot"&&!x.official_2026_candidate_snapshot)||(filter==="missing-poll"&&!x.district_specific_2026_polls.length)||
     (filter==="redrawn"&&x["2026_boundaries_revised"])||
     (filter==="watch"&&preliminaryRaceRead(x).watch));
  grid.replaceChildren();shown.forEach(r=>grid.append(makeDistrictCard(r)));
  if(!shown.length)grid.append(newEl("div","No district records in this filter. An empty filter does not mean there is no election.","callout"));
  $("district-count").textContent=shown.length+" / "+rows.length+" House districts";
 }
 const watchNode=$("state-watch-count");
 if(watchNode)watchNode.textContent=rows.filter(x=>preliminaryRaceRead(x).watch).length+" races to watch · early data signals";
 const watchLink=$("news-watch-link");
 if(watchLink)watchLink.addEventListener("click",()=>{
   select.value="watch";paint();
 });
 select.addEventListener("change",paint);paint();
 if(state["2026_congressional_map_changed"]){
  let callout=$("boundary-caution");
  callout.hidden=false;
  callout.textContent="NEW 2026 STATE MAP: Each district requires its own boundary comparison. A revised state map does not prove every district changed. Unverified overlaps are not treated as current-vintage voting baselines.";
 }
 if(window.PoliticsHouseMap)window.PoliticsHouseMap.drawState({state,rows,districtEvidence,color,urlForDistrict});
}
function candidatePanel(r){
 let panel=$("candidate-panel");
 const b=r.official_2026_candidate_snapshot;
 if(!b){
   panel.append(newEl("p","The state-qualified November 2026 candidate slate has not yet been independently transcribed for this office. FEC registrations do not prove ballot access."));
 }else{
   const head=b.contest_status==="unopposed_no_general_ballot"?"Unopposed office — no November ballot contest":"Government-source candidate snapshot";
   panel.append(newEl("p",head+" · reviewed "+b.reviewed_at,"eyebrow"));
   const list=newEl("div",null,"candidates");
   b.candidates.forEach(c=>{
     let line=newEl("div",null,"candidate"),badge=newEl("span",c.ballot_label||partyName(c.party),"party "+(c.party==="DEM"?"dem":c.party==="REP"?"rep":""));
     const photo=matchedPhoto(r,c),person=newEl("span",null,"candidate-with-portrait");
     person.append(portraitNode(r,c,true),newEl("strong",c.name));
     line.append(person,badge);
     if(photo){const credit=addLink(line,"Photo source ↗",photo.source_url,"portrait-credit");credit.target="_blank";credit.rel="noopener noreferrer";}
     list.append(line);
   });panel.append(list);
   if(b.candidates.some(c=>c.party==="WRI"))panel.append(newEl("p","WRI denotes a qualified write-in; the person's name is not printed on the ballot.","footnote"));
    if(b.candidates.some(c=>c.ballot_label))panel.append(newEl("p","Independent petition slogans and other ballot designations are reproduced from the election-office list; they are not presented as official major-party affiliations.","footnote"));
   if(b.source_url)addLink(panel,"Open the original state election-office candidate document ↗",b.source_url,"src").target="_blank";
 }
 panel.append(newEl("p",r.registered_fec_filings_2026+" FEC candidate registration"+(r.registered_fec_filings_2026===1?"":"s")+" indexed for this district in the 2026 filing master. Registrations can include withdrawn, unsuccessful and duplicate filings; this is not a count of qualified candidates.","footnote"));
}
function pollPanel(r){
 const box=$("poll-panel");
 const polls=r.district_specific_2026_polls||[];
 if(!polls.length){
   box.append(newEl("p","No individually sourced 2026 House poll has yet passed this desk's source-review process for this district. This is not a claim that no poll exists."));
   box.append(newEl("p","A national generic-ballot poll or forecast probability is never substituted for a district poll.","footnote"));
   return;
 }
 box.append(newEl("p",polls.length+" published 2026 poll record"+(polls.length===1?"":"s")+" in our evidence ledger. Original releases checked directly and secondary public poll compilations are distinguished below; neither is a forecast.","footnote"));
 polls.forEach(p=>{
   const block=newEl("article",null,"callout");
   let hdr=newEl("div",null,"poll-head");
   const compiled=p.source_tier==="public_compilation_not_original_checked";
   hdr.append(newEl("strong",p.pollster),newEl("small",compiled?"PUBLIC COMPILATION · listed "+p.reported_date+" · sample not given":p.start_date+" – "+p.end_date+" · "+p.sample_size+" "+p.population));
   block.append(hdr);
   let vals=[...p.candidates].sort((x,y)=>y.pct-x.pct);
   for(const c of vals){
     const row=newEl("div",null,"poll-candidate");
     const clr=color(c.party,c.pct);
     row.append(newEl("span",c.name+" ("+partyName(c.party)+")","name"),newEl("span",one(c.pct)+"%","pct"));
     const track=newEl("div",null,"progress"),fill=newEl("span");fill.style.width=c.pct+"%";fill.style.background=c.party==="D"?"#3165a8":c.party==="R"?"#af4843":"#83928e";track.append(fill);
     row.append(track);block.append(row);
   }
   const margin=vals[0].pct-vals[1].pct;
   block.append(newEl("p",p.question_type==="generic_house"?"Generic district House-party question; this is NOT a named-candidate lead.":margin===0?"Poll reports a tie":vals[0].name+" leads by "+one(margin)+" percentage points in this reported poll.","footnote"));
   if(compiled)block.append(newEl("p","SECONDARY EVIDENCE: People's Poll lists this as the most recently reported poll in the district and attributes its records to a New York Times compilation. We have not independently verified this original survey's sample, field dates, sponsor or question wording.","footnote"));
   block.append(newEl("p",p.sponsor?"Survey sponsor: "+p.sponsor:compiled?"Survey sponsor: not independently confirmed from public compilation.":"Survey sponsor not specified in the reviewed source.","footnote"));
   block.append(newEl("p",p.method_note||"","footnote"));
   let link=addLink(block,compiled?"Original publication link provided by compilation ↗":"Original published survey ↗",p.source_url,"src");link.target="_blank";link.rel="noopener noreferrer";
   if(compiled){let a=addLink(block," · View public polling compilation ↗",p.compilation_url,"src");a.target="_blank";a.rel="noopener noreferrer";}
   box.append(block);
 });
 box.append(newEl("p","Single polls, including internal and partisan-sponsored surveys, can have sizable uncertainty. Leads should not be interpreted as win probabilities.","footnote"));
}
function resultPanel(r,state){
 const box=$("result-panel");
 const h=r["2024_house_result_on_prior_boundaries"];
 if(!h){
   const u=r["2024_unopposed_official_context"];
   if(u&&u.contest_status==="elected_unopposed"&&u.general_election_vote_totals_available===false){
     box.append(newEl("div","2024 winner: "+u.winner+" ("+partyName(u.party)+")","big-margin"));
     box.append(newEl("p","ELECTED UNOPPOSED · Confirmed from state election-office records · No general-election candidate vote totals recorded.","callout"));
     box.append(newEl("p","No vote share, two-party margin or 2026 forecast can be inferred from an unopposed result.","footnote"));
     if(!u.verified_2026_geographic_comparability)box.append(newEl("p","Individual 2026 district geographic comparability is not yet verified; this alone does not establish a boundary change.","footnote"));
     const link=addLink(box,"Official original 2024 unopposed winner record ↗",u.source_url,"src");link.target="_blank";link.rel="noopener noreferrer";
   }else{
     box.append(newEl("p","No 2024 counted-vote record or official unopposed winner was found for this district. No margin will be manufactured."));
   }
 }else{
   const comparable=h.same_2026_geography;
   if(!comparable)box.append(newEl("div","BOUNDARY REVIEW: "+state.name+" redrew its map, but whether this individual district changed is not yet established. These are real 2024 votes, not a 2026 margin.","callout"));
   box.append(newEl("div","2024 winner: "+h.winner+" ("+partyName(h.party)+")","big-margin"));
   if(h.finalists?.length===2){
     const [winner,runner]=h.finalists;
     box.append(newEl("p",winner.party===runner.party?"CONTESTED SAME-PARTY GENERAL ELECTION":"CONTESTED GENERAL ELECTION","footnote"));
     for(const c of h.finalists)box.append(newEl("p",c.name+" ("+partyName(c.party)+") · "+fmt(c.votes)+" actual votes","footnote"));
     box.append(newEl("strong","Winner–runner-up gap: "+fmt(h.winner_runner_up_margin_votes)+" votes","big-margin"));
     if(h.write_in_votes)box.append(newEl("p","Write-ins: "+fmt(h.write_in_votes),"footnote"));
     if(h.candidate_vote_source_url){
       const link=addLink(box,"Official candidate vote certificate ↗",h.candidate_vote_source_url,"src");link.target="_blank";link.rel="noopener noreferrer";
     }
   }
   if(h.dem_two_party_margin_pp!=null){
     const margin=h.dem_two_party_margin_pp,ds=Math.max(0,h.dem_votes),rs=Math.max(0,h.rep_votes),sum=ds+rs;
     box.append(newEl("p","2024 two-party House margin: "+(margin>0?"D":"R")+" +"+one(Math.abs(margin))+" percentage points"+(!comparable?" · OLD BOUNDARIES":"")));
     if(sum>0){let bar=newEl("div",null,"vote-bar");let left=newEl("span",null,"dem"),right=newEl("span",null,"rep");left.style.width=(100*ds/sum)+"%";right.style.width=(100*rs/sum)+"%";bar.append(left,right);box.append(bar);}
   }else if(!h.finalists?.length){
     box.append(newEl("p","No validated Democrat-versus-Republican two-party margin; no candidate gap is inferred from party-only totals.","footnote"));
   }
   box.append(newEl("p","Democratic votes: "+fmt(h.dem_votes)+" · Republican votes: "+fmt(h.rep_votes)+" · Other votes: "+fmt(h.other_votes||0),"footnote"));
   if(h.source_url){let link=addLink(box,"Original-source-derived 2024 House return ↗",h.source_url,"src");link.target="_blank";link.rel="noopener noreferrer";}
 }
 box.append(newEl("p","Statewide 2024 presidential outcome (not a district result): "+voters(state)+".","footnote"));
}
/* District profile: the same transparent race read as the 435-seat atlas,
 * with official candidate identities and original observed data in a newsroom front.
 * No uncertified forecast percentages are created here.
 */
function renderDistrictFront(r,state){
 const root=$("district-front");
 if(!root)return;
 const read=preliminaryRaceRead(r);
 const graphic=districtGraphicData(r);
 root.classList.add("front-theme-"+graphicTheme(r,read));
 $("front-title").textContent=r.at_large?state.name+" at-large":r.id+" / "+state.name;
 const readBox=$("front-read");
 readBox.replaceChildren(raceReadPanel(r));
 const chart=$("front-chart");
 chart.append(renderDistrictGraphic(r));
 if(graphic.url){
  const link=addLink(chart,"OPEN MEASURED-DATA SOURCE ↗",graphic.url,"src front-source-link");
  link.target="_blank";link.rel="noopener noreferrer";
 }
 $("front-facts").append(raceReasonPanel(r));
 const roster=$("front-field");
 const ballot=r.official_2026_candidate_snapshot;
 if(!ballot?.candidates?.length){
  roster.append(newEl("div","Official November candidate list has not been independently verified for this district. FEC registrations are not a ballot.","front-unverified"));
 }else{
  const people=newEl("div",null,"front-faceoff");
  const selected=[...ballot.candidates].sort((a,b)=>{
   const priority=p=>p==="DEM"?0:p==="REP"?1:2;
   return priority(a.party)-priority(b.party);
  }).slice(0,2);
  for(const c of selected){
   const person=newEl("div",null,"front-person front-party-"+(c.party==="DEM"?"dem":c.party==="REP"?"rep":"other"));
   person.append(portraitNode(r,c,true),newEl("strong",c.name,"front-person-name"),partySeal(c.party));
   people.append(person);
  }
  if(selected.length===2)people.append(newEl("span","VS","front-vs"));
  roster.append(people);
  const label=ballot.candidates.length>2?
   (ballot.candidates.length-2)+" additional verified candidate"+(ballot.candidates.length===3?"":"s")+" listed in the detailed roster.":
   "Candidates matched to the election-office record; photographs appear only when source-verified.";
  roster.append(newEl("p",label,"front-candidate-note"));
 }
 if(window.PoliticsStateArt){
  $("front-map-art").append(window.PoliticsStateArt.create(r.state,"front-map-shape"));
  window.PoliticsStateArt.prepare(r.state,state.district_count);
 }
}
/* District wire service: navigate the official 50-state, 435-seat archive without
 * a trip back to the state directory. A watch flag is observed evidence, not odds. */
function renderDistrictSwitcher(atlas,r,state){
 const root=$("district-front");
 if(!root||root.querySelector(".race-switchboard"))return;
 const rows=atlas.districts.filter(x=>x.state===r.state).sort((a,b)=>a.district.localeCompare(b.district));
 const index=rows.findIndex(x=>x.id===r.id);
 if(index<0)return;
 const prev=rows[(index+rows.length-1)%rows.length],next=rows[(index+1)%rows.length];
 const read=window.PoliticsRaceExperience?.evidenceWatch(r);
 const watch=!!read?.watch;
 const strip=newEl("section",null,"race-switchboard"+(watch?" race-switchboard-watch":""));
 strip.setAttribute("aria-label","Navigate congressional race reports");
 const title=newEl("div",null,"race-switchboard-status");
 title.append(newEl("span","THE 2026 HOUSE / DISTRICT WIRE","race-switch-eyebrow"),
    newEl("strong",watch?(read.mixed?"◆ MIXED SIGNALS":read.closePoll?"◆ CLOSE REPORTED POLL":"◆ CLOSE 2024 ELECTION"):"DISTRICT RESEARCH FILE","race-switch-status"),
    newEl("small",watch?"Watch flag based on available evidence, not a certified 2026 forecast.":"Showing state and district evidence, not an election prediction.","race-switch-context"));
 const controls=newEl("div",null,"race-switchboard-controls");
 const previous=newEl("a","← "+prev.id,"race-wire-link");
 previous.href=urlForDistrict(prev.id);
 previous.setAttribute("aria-label","Previous "+state.name+" House district: "+prev.id);
 const selector=newEl("select",null,"race-seat-picker");
 selector.id="race-seat-picker";
 selector.setAttribute("aria-label","Choose a House district in "+state.name);
 for(const row of rows){
  const option=newEl("option",(row.at_large?"At-large":row.id)+" · "+(row.official_2026_candidate_snapshot?.candidates?.length?"candidate slate checked":"source review"),null);
  option.value=row.id;
  if(row.id===r.id)option.selected=true;
  selector.append(option);
 }
 const go=newEl("button","OPEN SEAT →","race-seat-open");
 go.type="button";
 go.addEventListener("click",()=>{if(rows.some(x=>x.id===selector.value))location.href=urlForDistrict(selector.value)});
 selector.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();go.click();}});
 const forward=newEl("a",next.id+" →","race-wire-link");
 forward.href=urlForDistrict(next.id);
 forward.setAttribute("aria-label","Next "+state.name+" House district: "+next.id);
 if(rows.length>1)controls.append(previous);
 controls.append(selector,go);
 if(rows.length>1)controls.append(forward);
 const explore=newEl("div",null,"race-switchboard-next");
 const stateLink=newEl("a","VIEW "+state.name.toUpperCase()+" HOUSE MAP ↗","race-switch-map");
 stateLink.href=urlForState(r.state);
 explore.append(stateLink);
 if(window.PoliticsRaceExperience){
  const watchlist=window.PoliticsRaceExperience.orderRaces(atlas.districts.filter(x=>window.PoliticsRaceExperience.evidenceWatch(x).watch));
  if(watchlist.length>1){
   const n=watchlist.findIndex(x=>x.id===r.id);
   const nextWatch=watchlist[(n+1)%watchlist.length];
   if(nextWatch?.id!==r.id){
    const link=newEl("a","NEXT EVIDENCE-WATCH RACE · "+nextWatch.id+" →","race-switch-watch-link");
    link.href=urlForDistrict(nextWatch.id);
    explore.append(link);
   }
  }
 }
 strip.append(title,controls,explore);
 const anchor=root.querySelector(".race-identity-general")||root.querySelector(".district-front-banner");
 if(anchor)anchor.insertAdjacentElement("afterend",strip);
 else root.prepend(strip);
}
function renderDistrict(a){
 let id=(new URLSearchParams(location.search).get("district")||"").trim().toUpperCase();
 const r=a.districts.find(x=>x.id===id);
 if(!r){err("District not found. The House atlas covers 435 voting House seats, including at-large seats such as AK-00. Return to the national atlas.");return;}
 const state=a.states.find(s=>s.code===r.state);
  showCoverage([r],"district");
  renderFEC(r);
 title(r.id+" — House district election profile");
 const titleNode=$("district-title");titleNode.textContent=r.at_large?state.name+" at-large House seat":state.name+"'s "+parseInt(r.district,10)+(Number(r.district)%10===1&&r.district!=="11"?"st":Number(r.district)%10===2&&r.district!=="12"?"nd":Number(r.district)%10===3&&r.district!=="13"?"rd":"th")+" Congressional District";
 $("district-subtitle").textContent=r.id+" · November 3, 2026 · race data & original sources";
 $("state-link").href=urlForState(r.state);$("state-link").textContent="← All "+state.name+" districts";
 renderDistrictFront(r,state);
 if(window.PoliticsRaceExperience)window.PoliticsRaceExperience.renderDistrict({r,state});
 const current=districtEvidence(r),clr=color(current.party,current.margin);
 let badge=$("leader-badge");badge.textContent=current.source.toUpperCase()+" · "+current.text;badge.style.background=clr.bg;badge.style.color=clr.fg;
 if(preliminaryRaceRead(r).watch){
  badge.textContent="◆ WATCH / CONFLICTING OR CLOSE SIGNALS";
  badge.style.background="#6f4bae";badge.style.color="#ffffff";
 }
 $("district-updated").textContent="Evidence assembled "+a.generated_at.slice(0,10)+" · "+current.sub;
 insertMetric($("metrics"),[r.district_specific_2026_polls.length,r.official_2026_candidate_snapshot?r.official_2026_candidate_snapshot.candidates.length:"—",
  fmt(r.registered_fec_filings_2026),r["2026_boundaries_revised"]?"NEW":"OLD"]);
 if(r["2026_boundaries_revised"]){
   let box=$("map-warning");box.hidden=false;box.textContent="2026 district geography changed in "+state.name+". A 2024 race with the same district number may include different voters. We do not use its margin as a 2026 forecast or shade for this district.";
 }
 candidatePanel(r);pollPanel(r);resultPanel(r,state);
 // Iowa and every other state use the same interactive race edition.
 if(window.PoliticsRaceBranding)window.PoliticsRaceBranding.decorateDistrict({r,state});
 renderDistrictSwitcher(a,r,state);
 const stateIds=a.districts.filter(x=>x.state===r.state).sort((x,y)=>x.district.localeCompare(y.district));
 const n=stateIds.findIndex(x=>x.id===r.id),prev=stateIds[(n-1+stateIds.length)%stateIds.length],next=stateIds[(n+1)%stateIds.length];
 $("prev-district").href=urlForDistrict(prev.id);$("prev-district").textContent="← "+prev.id;
 $("next-district").href=urlForDistrict(next.id);$("next-district").textContent=next.id+" →";
}
function init(){
 const page=document.body.dataset.housePage;
 Promise.all([readAtlas(),loadHousePortraits()]).then(([a])=>{
   if(page==="atlas")renderNational(a);
   else if(page==="state")renderState(a);
   else if(page==="district")renderDistrict(a);
 }).catch(ex=>{err("The source-verified House data could not be loaded. No placeholder winners or poll numbers will be shown.");console.error("House desk:",ex)});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
