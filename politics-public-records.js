/* Political Life and Times — Congressional public records desk.
 * Official external records; no inferred representatives, fictional results or vote positions.
 * The two existing page templates supply state/district navigation and data.
 */
(()=>{"use strict";
const states={"AL":"Alabama","AK":"Alaska","AZ":"Arizona","AR":"Arkansas","CA":"California","CO":"Colorado","CT":"Connecticut","DE":"Delaware","FL":"Florida","GA":"Georgia","HI":"Hawaii","ID":"Idaho","IL":"Illinois","IN":"Indiana","IA":"Iowa","KS":"Kansas","KY":"Kentucky","LA":"Louisiana","ME":"Maine","MD":"Maryland","MA":"Massachusetts","MI":"Michigan","MN":"Minnesota","MS":"Mississippi","MO":"Missouri","MT":"Montana","NE":"Nebraska","NV":"Nevada","NH":"New Hampshire","NJ":"New Jersey","NM":"New Mexico","NY":"New York","NC":"North Carolina","ND":"North Dakota","OH":"Ohio","OK":"Oklahoma","OR":"Oregon","PA":"Pennsylvania","RI":"Rhode Island","SC":"South Carolina","SD":"South Dakota","TN":"Tennessee","TX":"Texas","UT":"Utah","VT":"Vermont","VA":"Virginia","WA":"Washington","WV":"West Virginia","WI":"Wisconsin","WY":"Wyoming"};
const code=new URLSearchParams(location.search).get("state")?.toUpperCase()||new URLSearchParams(location.search).get("district")?.slice(0,2).toUpperCase();
if(!code||!states[code])return;
const district=new URLSearchParams(location.search).get("district")||"";
const name=states[code],isDistrict=document.body.dataset.housePage==="district";
// District pages already have their own sourced accountability desk. Avoid a second generic, oversized duplicate.
if(isDistrict)return;
const section=document.createElement("section");
section.className="plt-public-record";
section.id="public-records";
section.setAttribute("aria-labelledby","plt-public-record-title");
const header=document.createElement("header");header.className="plt-public-record-head";
const eyebrow=document.createElement("p");eyebrow.className="plt-public-record-kicker";eyebrow.textContent="POLITICAL LIFE AND TIMES / PUBLIC RECORD";
const title=document.createElement("h2");title.id="plt-public-record-title";title.textContent=isDistrict?"Representation and accountability":"The state's representation and elections";
const lead=document.createElement("p");lead.textContent=isDistrict?"Follow the district's election record separately from its representative's actual legislative votes. Official congressional sources are linked below.":"Follow statewide Senate elections, congressional delegations and official legislative activity, with direct links to primary sources.";
header.append(eyebrow,title,lead);section.append(header);
const grid=document.createElement("div");grid.className="plt-public-record-grid";section.append(grid);
function card(kicker,heading,description,links){const a=document.createElement("article");a.className="plt-public-record-card";const k=document.createElement("span");k.className="plt-public-record-kicker";k.textContent=kicker;const h=document.createElement("h3");h.textContent=heading;const p=document.createElement("p");p.textContent=description;const ul=document.createElement("ul");for(const [label,href] of links){const li=document.createElement("li"),link=document.createElement("a");link.href=href;link.target="_blank";link.rel="noopener noreferrer";link.textContent=label+" ↗";li.append(link);ul.append(li);}a.append(k,h,p,ul);grid.append(a)}
const search=q=>"https://www.congress.gov/search?q="+encodeURIComponent(JSON.stringify({"source":"legislation","search":q}));
const records="https://clerk.house.gov/Votes";
const senate="https://www.senate.gov/legislative/votes_new.htm";
const bios="https://bioguide.congress.gov/search";
const sec="https://www.usa.gov/state-election-office";
if(isDistrict){
card("THE HOUSE / ROLL CALL","How the representative voted","Official recorded House votes, with bill numbers, dates and individual member positions. Use the member directory to verify who represented the district on each vote.",[["House Clerk: recorded votes",records],["Find a representative", "https://www.house.gov/representatives"],["Congressional member biographies",bios]]);
card("LEGISLATION / CONGRESS","Bills and committee work","Look up sponsored bills, cosponsorship, committees and legislative actions. A bill's sponsorship does not establish the outcome of a House vote.",[["Congress.gov legislation",search(name)],["Congressional committees","https://www.congress.gov/committees"],["House committee directory","https://www.house.gov/committees"]]);
card("ELECTIONS / OFFICIAL RESULTS","Election results and candidates","Consult official state election records for certified House returns and ballot information; filing data is not an election result.",[["State election office directory",sec],["Federal Election Commission","https://www.fec.gov/data/"],["All districts in "+name,"politics-house-state.html?state="+encodeURIComponent(code)]]);
}else{
card("THE STATE / SENATE","Senators and Senate elections","Identify the state's two serving senators and check the election calendar. Not every state elects a senator in every general election.",[["Official Senate senators directory","https://www.senate.gov/senators/"],["Senate roll-call votes",senate],["Official state election office",sec]]);
card("THE STATE / HOUSE","Congressional delegation","Open each House district's election profile and check the current delegation against official House membership.",[["House members by state","https://www.house.gov/representatives"],["State's district atlas","#district-list"],["House recorded votes",records]]);
card("THE STATE / RETURNS","Election returns and campaign records","Use state election authorities for certified statewide and district results, and the FEC for federal campaign finance filings.",[["State election office directory",sec],["Federal election finance reports","https://www.fec.gov/data/"],["Congress.gov member activity","https://www.congress.gov/members"]]);
}
const note=document.createElement("p");note.className="plt-public-record-note";note.textContent="Source policy: these are links to official public records, not claims that a particular person won, served or voted a certain way. A complete vote-by-vote member timeline requires source-matched member IDs, Congress numbers and roll-call data. Election returns are not final until the responsible authority reports or certifies them.";section.append(note);
const target=document.querySelector(isDistrict?"#district-service-desk":".state-editorial-briefing")||document.querySelector("main");
if(target&&target.parentNode)target.insertAdjacentElement("afterend",section);
})();