/* The Political Life & Times • Iowa 1st place-based reader's guide.
   Primary sources: Iowa 2024 certified county canvass + Iowa Code 40.1.
   Independent local references for economic/community reporting.
   Only rendered for IA-01; all other House districts use original atlas.
*/
(function(){"use strict";
const $=id=>document.getElementById(id), E=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==null&&text!==undefined)x.textContent=String(text);if(cls)x.className=cls;return x;};
const N=n=>Number(n).toLocaleString("en-US",{maximumFractionDigits:0}), L=(title,url)=>{const a=E("a",title);a.href=url;a.target="_blank";a.rel="noopener noreferrer";return a;};
function add(...children){const f=document.createDocumentFragment();for(const x of children)f.append(x);return f;}
function sectionHead(overline,title,desc){const h=E("header",null,"ia-section-head");h.append(E("span",overline,"ia-overline"),E("h3",title));if(desc)h.append(E("p",desc));return h;}
function article(extra,root){
 const intro=E("section",null,"ia-portrait");
 intro.append(E("span","IOWA'S 1ST / FIELD NOTES","ia-overline"),E("h2",extra.explainer.headline),
   E("p",extra.explainer.subheading,"ia-intro-description"));
 intro.append(E("p",extra.explainer.reading,"ia-portrait-analysis"));
 const link=E("div",null,"ia-source-trail");
 link.append(L("District boundary: Iowa Code §40.1 ↗","https://www.legis.iowa.gov/docs/code/2024/40.1.pdf"),
 L("Certified 2024 county results ↗",extra.county_results_2024.source_url));
 intro.append(link);
 root.append(intro);
}
function voting(extra,root){
 const v=extra.county_results_2024,rows=v.rows;
 if(!Array.isArray(rows)||rows.length!==20)return;
 const sum=rows.reduce((s,c)=>({d:s.d+c.dem,r:s.r+c.rep}),{d:0,r:0});
 if(sum.d!==206156||sum.r!==206955)return;
 const blue=rows.filter(c=>c.dem>c.rep),red=rows.filter(c=>c.rep>c.dem);
 const history=E("section",null,"ia-voting-story");
 history.id="iowa-voting-story";
 history.append(sectionHead("2024 / THE POLITICAL GEOGRAPHY",
   "The district is not politically uniform.",
   "The three blue counties do not make a blue district. Here is how the entire 20-county map adds up."));
 const insight=E("div",null,"ia-vote-insight");
 const lead=E("div",null,"ia-vote-insight-lead");
 lead.append(E("strong",blue.length+" counties","ia-count-blue"),
  E("p","Bohannan carried Johnson, Scott and Jefferson. Together they contributed "+
    N(blue.reduce((s,r)=>s+r.dem-r.rep,0))+" net Democratic votes."));
 const opposition=E("div",null,"ia-vote-insight-opp");
 opposition.append(E("strong",red.length+" counties","ia-count-red"),
  E("p","Miller-Meeks won the remaining counties by a combined "+
    N(red.reduce((s,r)=>s+r.rep-r.dem,0))+" votes—enough for an overall 799-vote win."));
 insight.append(lead,opposition);history.append(insight);
 const controls=E("div",null,"ia-results-toolbar");
 controls.append(E("span","COUNTY-BY-COUNTY HOUSE RETURNS","ia-overline"));
 const buttons=E("div",null,"ia-sort-controls");
 const b1=E("button","Most votes","ia-sort-active"),b2=E("button","Largest vote gaps"),b3=E("button","Alphabetical");
 for(const b of [b1,b2,b3]){b.type="button";buttons.append(b)}
 controls.append(buttons);history.append(controls);
 const legend=E("div",null,"ia-county-legend");legend.append(E("span","DEMOCRATIC SHARE"),E("span","2024 TWO-PARTY VOTE"),E("span","REPUBLICAN SHARE"));history.append(legend);
 const chart=E("div",null,"ia-county-list");chart.setAttribute("role","list");history.append(chart);
 function sortRow(mode){
  const a=rows.slice();
  if(mode===0)a.sort((x,y)=>(y.dem+y.rep)-(x.dem+x.rep));
  else if(mode===1)a.sort((x,y)=>Math.abs(y.rep-y.dem)-Math.abs(x.rep-x.dem));
  else a.sort((x,y)=>x.county.localeCompare(y.county));
  chart.replaceChildren();
  for(const c of a){
   const votes=c.dem+c.rep,demShare=100*c.dem/votes,margin=c.rep-c.dem;
   const row=E("div",null,"ia-county-row"+(margin<0?" dem":" rep"));row.setAttribute("role","listitem");
   const name=E("strong",c.county,"ia-county-name");
   const bar=E("div",null,"ia-county-bar");bar.setAttribute("role","img");
   bar.setAttribute("aria-label",c.county+": Bohannan "+N(c.dem)+" votes, Miller-Meeks "+N(c.rep)+" votes. "+(margin<0?"Democratic":"Republican")+" margin "+N(Math.abs(margin))+" votes.");
   const d=E("span",null,"ia-county-dem"),r=E("span",null,"ia-county-rep");
   d.style.width=demShare.toFixed(2)+"%";r.style.width=(100-demShare).toFixed(2)+"%";
   bar.append(d,r);
   const result=E("span",(margin<0?"D +":"R +")+N(Math.abs(margin)),"ia-county-result");
   row.append(name,bar,result);chart.append(row);
  }
 }
 function select(mode){for(const [i,b] of [b1,b2,b3].entries()){const on=mode===i;b.classList.toggle("ia-sort-active",on);b.setAttribute("aria-pressed",on?"true":"false")}sortRow(mode)}
 [b1,b2,b3].forEach((b,i)=>b.addEventListener("click",()=>select(i)));select(0);
 const notes=E("p",null,"ia-results-notes");
 notes.append(E("strong","Read the bars: "),"Blue is Bohannan's share of D+R votes; red is Miller-Meeks's. A county can look heavily Republican but still matter less than a populous, evenly divided county. Write-ins are excluded from the two-party shares. ");
 notes.append(L("Every county figure: Iowa Secretary of State canvass, pp. 16–18 ↗",v.source_url));history.append(notes);
 root.append(history);
}
function turnout(extra,root){
 // These published SOS totals reconcile exactly with the 2024 two-party district figure.
 const day={dem:96372,rep:126696},abs={dem:109784,rep:80259};
 const days={name:"Election Day ballots",d:day.dem,r:day.rep},mail={name:"Absentee ballots",d:abs.dem,r:abs.rep};
 const sec=E("section",null,"ia-turnout");
 sec.append(sectionHead("THE HIDDEN DIVIDE / 2024 VOTING METHOD",
  "Same electorate. Two very different vote patterns.",
  "Election Day ballots favored Miller-Meeks; absentee ballots favored Bohannan. These are actual counted votes, not a survey or a prediction."));
 const grid=E("div",null,"ia-ballot-split");
 for(const t of [days,mail]){
  const wrap=E("div",null,"ia-ballot-part");
  const vote=t.d+t.r;
  wrap.append(E("h4",t.name),E("strong",(t.r>t.d?"R +":"D +")+N(Math.abs(t.r-t.d)),"ia-ballot-margin"));
  const bar=E("div",null,"ia-ballot-bar");
  const dem=E("span"),rep=E("span");dem.style.width=(100*t.d/vote).toFixed(2)+"%";rep.style.width=(100*t.r/vote).toFixed(2)+"%";
  dem.className="ia-county-dem";rep.className="ia-county-rep";
  bar.append(dem,rep);wrap.append(bar);
  wrap.append(E("p","Bohannan "+N(t.d)+"  ·  Miller-Meeks "+N(t.r)));grid.append(wrap);
 }
 sec.append(grid);
 const caption=E("p",null,"ia-source-caption");
 caption.append(E("strong","What it means: "),"The Republican Election Day advantage (30,324 votes) was almost entirely offset by a Democratic absentee advantage (29,525 votes). The final major-party difference was 799 votes. ");
 caption.append(L("Official county canvass, district totals ↗",extra.county_results_2024.source_url));
 sec.append(caption);root.append(sec);
}
function places(extra,root){
 if(!Array.isArray(extra.local_regions)||extra.local_regions.length!==5)return;
 const section=E("section",null,"ia-places");section.id="iowa-places";
 section.append(sectionHead("FIVE DISTINCT PARTS OF THE SAME DISTRICT","Where people live, work and vote",
  "The university corridor is not the Quad Cities; the Quad Cities are not the farming counties. Each area has its own economy, communities and voting patterns."));
 const nav=E("nav",null,"ia-places-nav");nav.setAttribute("aria-label","Explore district regions");
 for(const region of extra.local_regions){
  const anchor=E("a",region.title);anchor.href="#iowa-place-"+region.slug;nav.append(anchor);
 }section.append(nav);
 const collection=E("div",null,"ia-regions");
 for(let i=0;i<extra.local_regions.length;i++){
  const r=extra.local_regions[i],unit=E("article",null,"ia-region");
  unit.id="iowa-place-"+r.slug;
  const no=E("div",String(i+1).padStart(2,"0"),"ia-region-number");
  const copy=E("div",null,"ia-region-copy");
  copy.append(E("span",r.places,"ia-region-places"),E("h4",r.title),E("p",r.lead,"ia-region-lead"),E("p",r.detail),E("p",r.why,"ia-region-why"));
  const footer=E("div",null,"ia-region-footer");
  footer.append(E("span",r.counties.join(" · ")+" COUNTIES","ia-overline"),L("Explore the original local source ↗",r.source_url));
  copy.append(footer);unit.append(no,copy);collection.append(unit);
 }
 section.append(collection);root.append(section);
}
function lenses(extra,root){
 const list=extra.explainer?.issue_lenses;if(!Array.isArray(list))return;
 const sec=E("section",null,"ia-lenses");sec.append(sectionHead("THE DISTRICT'S EVERYDAY ECONOMY",
  "Four themes to keep in mind",
  "These are documented features of the local economy, not claims about how any resident votes."));
 const grid=E("div",null,"ia-lens-grid");
 for(const t of list){const u=E("div",null,"ia-lens");u.append(E("h4",t.topic),E("p",t.description),L("Local source ↗",t.source_url));grid.append(u)}sec.append(grid);root.append(sec);
}
function mapCTA(root){
 const a=E("a","↑ Open the real district street map","ia-back-map");a.href="#dossier-map";root.append(a);
}
async function init(){
 const id=(new URLSearchParams(location.search).get("district")||"").trim().toUpperCase();
 const host=$("iowa-field-guide");if(id!=="IA-01"||!host)return;
 try{
  const response=await fetch("politics-district-guide.json",{cache:"no-cache"});
  if(!response.ok)throw Error("District guide source missing");
  const extra=(await response.json()).districts?.["IA-01"];
  if(!extra?.county_results_2024||!extra.explainer)throw Error("Source-backed guide not yet certified");
  host.replaceChildren();
  article(extra,host);places(extra,host);voting(extra,host);turnout(extra,host);lenses(extra,host);mapCTA(host);
  host.hidden=false;
 }catch(error){host.hidden=true;console.warn("Iowa field guide:",error);}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();