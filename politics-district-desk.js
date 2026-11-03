/* POLITICAL LIFE & TIMES / DISTRICT SERVICE DESK.
 * District-specific reported news and survey observations, then accountable
 * official result and the seated member's voting record. Never imply a winner
 * from a date, market, poll, historical margin, or an unverified call.
 */
(function(){"use strict";
const $=id=>document.getElementById(id);
const E=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!==undefined&&txt!==null)n.textContent=String(txt);if(cls)n.className=cls;return n;};
const fmt=n=>Number(n).toLocaleString("en-US");
const dt=x=>{const t=new Date(x);return Number.isFinite(t.getTime())?t:null};
const format=x=>{const v=dt(x);return v?v.toLocaleDateString("en-US",{timeZone:"America/New_York",year:"numeric",month:"short",day:"numeric"}):"date unavailable"};
const good=u=>typeof u==="string"&&u.startsWith("https://");
const A=(label,url)=>{const a=E("a",label);a.href=url;a.target="_blank";a.rel="noopener noreferrer";return a};
function localClock(){
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
 const get=k=>parts.find(p=>p.type===k)?.value||"00";
 return {day:get("year")+"-"+get("month")+"-"+get("day"),hour:Number(get("hour"))};
}
const isoLocal=()=>localClock().day;
const electionClosed=()=>{const t=localClock();return t.day>"2026-11-03"||(t.day==="2026-11-03"&&t.hour>=21)};
function news(d,host,phase){
 const articles=Array.isArray(d?.articles)?d.articles.filter(x=>x&&good(x.url)&&x.title&&x.source&&dt(x.published_at)): [];
 articles.sort((a,b)=>new Date(b.published_at)-new Date(a.published_at));
 host.replaceChildren();
 host.classList.toggle("desk-has-no-news",articles.length===0);
 const serviceHost=$("district-service-desk");
 if(serviceHost)serviceHost.classList.toggle("district-news-empty",articles.length===0);
 const intro=E("div",null,"desk-intro");
 intro.append(E("span",phase==="campaign"?"THE DISTRICT / ON THE CAMPAIGN TRAIL":"THE DISTRICT / CONTINUING COVERAGE","desk-kicker"),
 E("h3",phase==="campaign"?"Reporting from this district":"What's happening in the district"),
 E("p","Stories must directly concern the district, its communities, or its elected official. Publisher headlines link to the original reporting—not republished articles."));
 host.append(intro);
 if(articles.length){
  const lead=articles[0],figure=E("article",null,"desk-lead-story");
  figure.append(E("span",lead.topic||"DISTRICT NEWS","desk-overline"),A(lead.title,lead.url),E("p",lead.source+" · "+format(lead.published_at)));
  if(lead.match_reason)figure.append(E("small",lead.match_reason==="verified_2026_ballot_candidate"?"SOURCE MATCH: state-verified ballot candidate":"SOURCE MATCH: explicitly named congressional district","desk-match-reason"));
  host.append(figure);
  const list=E("div",null,"desk-news-list");
  for(const item of articles.slice(1,9)){
   const row=E("article",null,"desk-news-row");
   const over=E("span",(item.topic||"REPORT")+" · "+item.source+" · "+format(item.published_at),"desk-overline");
   row.append(over,A(item.title,item.url));list.append(row);
  }host.append(list);
 }else { const empty=E("p","No verified district-specific headlines have been collected yet. We will publish linked local reporting here when its relevance is confirmed.","desk-empty");host.append(empty); const guide=E("a","Explore local geography and communities →","desk-local-guide-link");guide.href="#district-dossier";host.append(guide); }
 const foot=E("p",null,"desk-attribution");
 foot.textContent="District feed last collected: "+(d?.news_updated_at?format(d.news_updated_at):"not yet checked")+". ";
 const checked=d?.news_checked_at;if(checked)foot.textContent+="Source check: "+format(checked)+". ";
 if(d?.district_id==="IA-01")foot.append(A("Iowa Public Radio district reporting ↗","https://www.iowapublicradio.org/iowa-politics"));
 host.append(foot);
}
function polls(d,atlas,host,phase){
 host.replaceChildren();
 const header=E("div",null,"desk-intro");
 header.append(E("span","THE SURVEY FILE / NOT AN ELECTION FORECAST","desk-kicker"),
 E("h3",phase==="campaign"?"What the district polls say":"The 2026 campaign polls, archived"),
 E("p","Each entry is one publicly reported survey. Field dates, sample and sponsor matter. Polls are not actual votes; an update timestamp is not the date interviews occurred."));
 host.append(header);
 let rows=d?.polls||[];
 if(!rows.length){
  const r=atlas?.district_specific_2026_polls||[];
  rows=r.filter(x=>x.question_type==="named_house").map(x=>({
   id:x.id,pollster:x.pollster,start:x.start_date,end:x.end_date,
   n:x.sample_size,population:x.population,sponsor:x.sponsor||"Not reported",
   tier:x.source_tier||"Source not verified",url:x.source_url,results:x.candidates?.map(c=>({name:c.name,party:c.party,pct:c.pct}))||[]
  }));
 }
 rows=[...rows].filter(x=>x&&x.pollster&&good(x.url)&&dt(x.end)).sort((a,b)=>new Date(b.end)-new Date(a.end));
 if(!rows.length){host.append(E("p","No independently documented, district-specific poll is available in this data ledger. This is not evidence that no poll exists.","desk-empty"));return}
 for(const p of rows.slice(0,10)){
  const el=E("article",null,"desk-poll");
  const top=E("div",null,"desk-poll-head");
  top.append(E("h4",p.pollster),E("span",format(p.start)+" – "+format(p.end),"desk-poll-dates"));
  el.append(top);
  const method=E("p","n="+(Number.isFinite(p.n)?fmt(p.n):"not provided")+" · "+(p.population||"Population not reported")+" · Sponsor: "+(p.sponsor||"not verified"),"desk-poll-method");
  el.append(method);
  const bars=E("div",null,"desk-poll-bars");
  for(const entry of (p.results||[])){
   if(typeof entry.pct!=="number"||entry.pct<0||entry.pct>100)continue;
   const row=E("div",null,"desk-poll-choice");
   row.append(E("span",entry.name,"desk-poll-name"));
   const track=E("span",null,"desk-poll-track");
   const fill=E("span",null,"desk-poll-fill");
   fill.style.width=entry.pct+"%";
   fill.classList.add((entry.party==="D"||entry.party==="DEM")?"party-d":(entry.party==="R"||entry.party==="REP")?"party-r":"party-i");
   track.append(fill);row.append(track,E("strong",entry.pct.toFixed(0)+"%"));bars.append(row);
  }
  el.append(bars,E("p",p.tier||"Original survey report not independently verified","desk-poll-caution"));
  el.append(A("Read survey source and methodology ↗",p.url));host.append(el);
 }
 const foot=E("p","Last source check: "+(d?.polls_checked_at?format(d.polls_checked_at):"not recorded")+". The original source is the authority for new releases; records here change only with sourced evidence.","desk-attribution");
 foot.append(A("Compare newly published IA-01 polls ↗","https://www.270towin.com/2026-house-polls/iowa/district-1"));
 host.append(foot);
}
function record(d,host){
 host.replaceChildren();
 const e=d?.election||{},rep=d?.representation||{};
 const today=isoLocal();
 const after=electionClosed();
 const top=E("div",null,"desk-intro");
 top.append(E("span","OFFICIAL RECORD / VERIFY, DON'T INFER","desk-kicker"),
 E("h3",after?"Election results and the representative":"Who's representing the district now?"));
 host.append(top);
 const summary=E("div",null,"desk-result-status");
 if(e.certified&&e.winner&&e.certified_at){
  summary.append(E("strong","CERTIFIED 2026 HOUSE RESULT"),E("p",e.winner+" · certified "+format(e.certified_at)));
  if(e.totals&&typeof e.totals==="object"){
   for(const [k,v] of Object.entries(e.totals)){
    if(!Number.isFinite(v))continue;summary.append(E("p",k+": "+fmt(v)));
   }
  }
 }else{
  summary.append(E("strong",after?"2026 OFFICIAL RETURN NOT YET VERIFIED":"ELECTION / NOVEMBER 3, 2026"),
   E("p",after?"This desk is in post-election mode. No winner is displayed until an independently verified official return is recorded.":"The campaign and current representative are shown separately. Voting history and polls cannot determine who wins."));
 }
 if(good(e.official_source))summary.append(A("Iowa Secretary of State · official returns ↗",e.official_source));
 host.append(summary);
 const current=rep.current_119th;
 if(!current){host.append(E("p","An official representative record has not been linked to this district.","desk-empty"));return}
 const serving=(today>="2027-01-03"&&e.certified&&rep.new_120th?.bioguide)?
 rep.new_120th:current;
 const old=serving===current;
 const who=E("section",null,"desk-member");
 who.append(E("span",old?"119TH CONGRESS / 2025–2026 RECORD":"120TH CONGRESS / 2027–2028 RECORD","desk-kicker"),
  E("h4",serving.name),E("p",(serving.party||"")+" · "+(old&&today>="2027-01-03"?"Former representative; successor has not been verified for this record":"Member matched to recorded congressional identity")));
 if(good(serving.profile))who.append(A("Official House Clerk member profile ↗",serving.profile));
 if(good(serving.bills))who.append(A("Congress.gov · sponsored legislation and actions ↗",serving.bills));
 if(good(serving.rollcalls))who.append(A("U.S. House Clerk · roll-call vote records ↗",serving.rollcalls));
 const votes=old?rep.votes||[]:rep.new_120th?.votes||[];
 who.append(E("h5","Recorded House floor positions"));
 if(votes.length){
  const list=E("div",null,"desk-vote-list");
  for(const v of votes.slice(0,15)){
   if(!v.title||!good(v.url))continue;
   const item=E("article",null,"desk-vote");
   item.append(E("strong",v.position||"Position not parsed","desk-vote-choice"),A(v.title,v.url),
    E("span",format(v.when)+(v.reference?" · "+v.reference:""),"desk-vote-date"));list.append(item);
  }who.append(list);
 }else{
  who.append(E("p","No authenticated individual vote entries have been imported yet. Follow the House Clerk for original roll calls; no voting position is guessed.","desk-empty"));
 }
 const votesCheck=rep.votes_checked_at;
 if(votesCheck)who.append(E("p","Member-feed checked "+format(votesCheck)+". Positions are from the published roll-call record, not campaign statements.","desk-attribution"));
 host.append(who);
}
async function init(){
 const id=(new URLSearchParams(location.search).get("district")||"").toUpperCase();
 if(!/^[A-Z]{2}-\d{2}$/.test(id)||!$("district-service-desk"))return;
 const root=$("district-service-desk"),note=$("desk-edition-status");
 try{
  const [r1,r2]=await Promise.all(["data/politics-district-desk.json","politics-house-atlas.json"].map(async x=>{
   const r=await fetch(x,{cache:"no-cache"});if(!r.ok)throw Error("Not available: "+x);return r.json();
  }));
  const d=r1.districts?.[id],district=r2.districts?.find(x=>x.id===id);
  if(!district)throw Error("District not in congressional ledger");
  // Nationwide publisher-linked news lives in its own ledger so it never
  // overwrites IA-01's surveyed polls or verified congressional roll calls.
  const fresh=await fetch("data/politics-district-news.json",{cache:"no-cache"})
    .then(x=>x.ok?x.json():null).catch(()=>null);
  const latest=fresh?.districts?.[id];
  const combined=[...(d?.articles||[]),...(latest?.articles||[])];
  const seen=new Set(),unique=[];
  for(const story of combined.sort((a,b)=>new Date(b.published_at)-new Date(a.published_at))){
    const key=String(story.title||"").toLowerCase().replace(/[^a-z0-9]/g,"");
    if(key&&!seen.has(key)){seen.add(key);unique.push(story);}
  }
  const newsEntry={...(d||{}),district_id:id,articles:unique.slice(0,20),
    news_checked_at:latest?.news_checked_at||d?.news_checked_at,
    news_updated_at:latest?.news_checked_at||d?.news_updated_at};
  const state=(d?.election?.certified&&d.election.winner)?"certified":electionClosed()?"after":"campaign";
  document.body.dataset.districtEdition=state;
  if(note)note.textContent=state==="campaign"?"ELECTION 2026 / CAMPAIGN & SOURCED EVIDENCE":
   state==="certified"?"CERTIFIED ELECTION / REPRESENTATION & ACCOUNTABILITY":
   "POST-ELECTION / OFFICIAL RESULTS CHECK IN PROGRESS";
  news(newsEntry,$("desk-local-news"),state);
  polls(d,district,$("desk-local-polls"),state);
  record(d,$("desk-local-record"));
  // The graphic modules are drawn from the same source ledger as the text,
  // not another copy with invented polling averages or county swings.
  if(window.PoliticsDistrictGraphics){
    window.PoliticsDistrictGraphics.pollVisual(d,$("desk-local-polls"));
    window.PoliticsDistrictGraphics.representative(d,$("desk-local-record"),state);
  }
  // After election, congressional record becomes the leading tab. The
  // three sections remain accessible without losing campaign archives.
  const selectors=[...root.querySelectorAll("[data-desk-view]")];
  const panels={news:$("desk-local-news"),polls:$("desk-local-polls"),record:$("desk-local-record")};
  function choose(which){
   for(const button of selectors){const active=button.dataset.deskView===which;
    button.setAttribute("aria-pressed",active?"true":"false");button.classList.toggle("is-current",active);}
   for(const [name,panel] of Object.entries(panels))if(panel)panel.hidden=name!==which;
  }
  for(const button of selectors)button.addEventListener("click",()=>choose(button.dataset.deskView));
  choose(state==="campaign"?"news":"record");
  // Once Iowa polls close, the district and governing record supersede the
  // campaign landing page. Make the campaign material explicitly archival.
  const archive=$("desk-campaign-archive-toggle");
  if(archive&&state!=="campaign"){
   archive.hidden=false;archive.setAttribute("aria-expanded","false");
   archive.addEventListener("click",()=>{
    const open=document.body.classList.toggle("show-district-campaign-archive");
    archive.setAttribute("aria-expanded",open?"true":"false");
    archive.textContent=open?"Hide 2026 campaign materials ↑":"View archived 2026 campaign materials ↓";
   });
  }
 }catch(error){if(note)note.textContent="DISTRICT SOURCE DESK UNAVAILABLE · THE VERIFIED LOCAL FIELD GUIDE REMAINS BELOW";console.warn("District wire:",error);}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();